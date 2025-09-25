/* prisma/seed.ts */
import {
    PrismaClient,
    Prisma,
    EffectKind,
    UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

/* ========================== GUARD: seed tylko na pustej bazie ========================== */
async function isDatabaseEmpty(): Promise<boolean> {
    const [users, effects, weapons, factions, units] = await Promise.all([
        prisma.user.count(),
        prisma.effect.count(),
        prisma.weaponTemplate.count(),
        prisma.faction.count(),
        prisma.unitTemplate.count(),
    ]);
    return users === 0 && effects === 0 && weapons === 0 && factions === 0 && units === 0;
}

/* ========================== HELPERY OGÓLNE ========================== */

async function ensureAdminUser(name: string = 'admin') {
    return prisma.user.upsert({
        where: { name },
        update: { role: UserRole.ADMIN },
        create: { name, role: UserRole.ADMIN },
    });
}

export type EffectSpec = {
    name: string;
    kind: EffectKind;
    description: string;
    requiresValue?: boolean;
};

async function ensureEffect(spec: EffectSpec) {
    const existing = await prisma.effect.findFirst({
        where: { name: spec.name, kind: spec.kind },
    });
    if (existing) {
        return prisma.effect.update({
            where: { id: existing.id },
            data: { description: spec.description, requiresValue: spec.requiresValue ?? false },
        });
    }
    return prisma.effect.create({
        data: {
            name: spec.name,
            kind: spec.kind,
            description: spec.description,
            requiresValue: spec.requiresValue ?? false,
        },
    });
}

const effectKey = (name: string, kind: EffectKind): string => `${name}:${kind}`;

/* ========================== BRONIE – BUNDLE ========================== */

export type WeaponProfileInput = {
    order?: number;
    typeOverride?: string | null;
    testOverride?: string | null;
    partsOverride?: number | null;
    ratingDelta?: number | null;
    rating?: number | null;
    effects?: Array<{ name: string; kind: EffectKind; valueInt?: number | null }>;
};

export type WeaponBundle = {
    name: string;
    imagePath?: string | null;
    notes?: string | null;
    base: {
        baseType?: string;
        baseTest?: string;
        baseParts?: number | null;
        baseRating?: number | null;
    };
    baseEffects?: Array<{ name: string; kind: EffectKind; valueInt?: number | null }>;
    profiles?: WeaponProfileInput[];
};

async function upsertWeaponBundle(
    bundle: WeaponBundle,
    effectIds: Map<string, string>
) {
    const { name, imagePath, notes, base, baseEffects = [], profiles = [] } = bundle;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existing = await tx.weaponTemplate.findFirst({ where: { name } });
        const template = existing
            ? await tx.weaponTemplate.update({
                where: { id: existing.id },
                data: {
                    imagePath: imagePath ?? existing.imagePath ?? null,
                    notes: notes ?? existing.notes ?? null,
                    baseType: base.baseType ?? existing.baseType,
                    baseTest: base.baseTest ?? existing.baseTest,
                    baseParts: base.baseParts ?? existing.baseParts ?? null,
                    baseRating: base.baseRating ?? existing.baseRating ?? null,
                },
            })
            : await tx.weaponTemplate.create({
                data: { name, imagePath: imagePath ?? null, notes: notes ?? null, ...base },
            });

        // idempotentny reset zależności dla danego template
        await tx.weaponProfileEffect.deleteMany({ where: { profile: { weaponId: template.id } } });
        await tx.weaponProfile.deleteMany({ where: { weaponId: template.id } });
        await tx.weaponBaseEffect.deleteMany({ where: { weaponId: template.id } });

        for (const be of baseEffects) {
            const id = effectIds.get(effectKey(be.name, be.kind));
            if (!id) throw new Error(`Brak efektu: ${be.name} (${be.kind}) — zasiej efekty wcześniej`);
            await tx.weaponBaseEffect.create({
                data: { weaponId: template.id, effectId: id, valueInt: be.valueInt ?? null },
            });
        }

        for (let idx = 0; idx < profiles.length; idx++) {
            const p = profiles[idx]!;
            const ratingDelta =
                p.ratingDelta ??
                (p.rating != null && template.baseRating != null
                    ? p.rating - template.baseRating
                    : null);

            const profile = await tx.weaponProfile.create({
                data: {
                    weaponId: template.id,
                    order: p.order ?? idx,
                    typeOverride: p.typeOverride ?? null,
                    testOverride: p.testOverride ?? null,
                    partsOverride: p.partsOverride ?? null,
                    ratingDelta,
                },
            });

            for (const pe of p.effects ?? []) {
                const id = effectIds.get(effectKey(pe.name, pe.kind));
                if (!id) throw new Error(`Brak efektu dla profilu: ${pe.name} (${pe.kind})`);
                await tx.weaponProfileEffect.create({
                    data: { profileId: profile.id, effectId: id, valueInt: pe.valueInt ?? null },
                });
            }
        }

        return template;
    });
}

/* ========================== FRAKCJE – pełny zestaw ========================== */

export type Tier = 1 | 2 | 3;

export type FactionInput = {
    name: string;
    goalSets: Array<{
        name: string;
        goals: Array<{ tier: Tier; description: string; target: number; order?: number }>;
    }>;
    upgradeRules: Array<{ statKey: string; ratingPerPoint: number }>;
    limits: Array<{ tag: string; tier1?: number | null; tier2?: number | null; tier3?: number | null }>;
};

function assertThreePerTier(goals: Array<{ tier: Tier }>): void {
    const counts: Record<Tier, number> = { 1: 0, 2: 0, 3: 0 };
    for (const g of goals) {
        if (![1, 2, 3].includes(g.tier)) throw new Error(`Goal z niedozwolonym tierem: ${g.tier as number}`);
        counts[g.tier as Tier]++;
    }
    ([1, 2, 3] as const).forEach((t) => {
        if (counts[t] !== 3) {
            throw new Error(`Zestaw goal'i musi mieć **dokładnie 3** zadania dla tier=${t} (jest ${counts[t]}).`);
        }
    });
}

async function upsertFactionFull(input: FactionInput) {
    const faction = await prisma.faction.upsert({
        where: { name: input.name },
        update: {},
        create: { name: input.name },
    });

    // UWAGA: te czyszczenia są bezpieczne tylko na zupełnie pustej bazie.
    await prisma.factionGoal.deleteMany({ where: { set: { factionId: faction.id } } });
    await prisma.factionGoalSet.deleteMany({ where: { factionId: faction.id } });
    await prisma.factionUpgradeRule.deleteMany({ where: { factionId: faction.id } });
    await prisma.factionLimit.deleteMany({ where: { factionId: faction.id } });

    if (input.upgradeRules.length) {
        await prisma.factionUpgradeRule.createMany({
            data: input.upgradeRules.map((r) => ({ factionId: faction.id, ...r })),
            skipDuplicates: true,
        });
    }

    for (const gs of input.goalSets) {
        assertThreePerTier(gs.goals);
        const set = await prisma.factionGoalSet.create({ data: { factionId: faction.id, name: gs.name } });
        await prisma.factionGoal.createMany({
            data: gs.goals.map((g, i) => ({
                setId: set.id,
                tier: g.tier,
                description: g.description,
                target: g.target,
                order: g.order ?? i,
            })),
        });
    }

    if (input.limits.length) {
        await prisma.factionLimit.createMany({
            data: input.limits.map((l) => ({
                factionId: faction.id,
                tag: l.tag,
                tier1: l.tier1 ?? null,
                tier2: l.tier2 ?? null,
                tier3: l.tier3 ?? null,
            })),
        });
    }

    return faction;
}

/* ========================== UNIT TEMPLATES ========================== */

async function upsertUnitTemplate(
    name: string,
    data: {
        factionId: string | null;
        roleTag?: string | null;
        baseRating?: number | null;
        hp?: number; s?: number; p?: number; e?: number; c?: number; i?: number; a?: number; l?: number;
    }
) {
    const found = await prisma.unitTemplate.findFirst({ where: { name } });
    if (!found) return prisma.unitTemplate.create({ data: { name, ...data } });
    return prisma.unitTemplate.update({ where: { id: found.id }, data });
}

async function upsertUnitOption(
    unitId: string,
    weapon1Id: string,
    weapon2Id: string | null,
    costCaps: number,
    rating: number | null = null
) {
    const existing = await prisma.unitWeaponOption.findFirst({
        where: { unitId, weapon1Id, weapon2Id: weapon2Id ?? null },
    });
    if (existing) {
        return prisma.unitWeaponOption.update({
            where: { id: existing.id },
            data: { costCaps, rating },
        });
    }
    return prisma.unitWeaponOption.create({
        data: { unitId, weapon1Id, weapon2Id: weapon2Id ?? null, costCaps, rating },
    });
}

/* ========================== MAIN ========================== */

async function main(): Promise<void> {
    // 🔒 Uruchamiaj seed tylko jeśli baza jest pusta
    if (!(await isDatabaseEmpty())) {
        console.log('ℹ️ Seed skipped: database is not empty.');
        return;
    }

    /* 1) ADMIN */
    const admin = await ensureAdminUser('admin');
    console.log('Admin:', admin.name);

    /* 2) EFEKTY BRONI */
    const EFFECTS: EffectSpec[] = [
        { name: 'Aim', kind: EffectKind.WEAPON, description: 'Tworząc pulę kości dla Attack Action z tą bronią, model może wziąć 1 Fatigue, aby dodać +X Bonus Dice do puli.', requiresValue: true }, // (+X)
        { name: 'Area', kind: EffectKind.WEAPON, description: 'Atak wskazuje punkt na planszy; każdy model w promieniu X" staje się celem. Jeden Attack Test (bez Bonus Dice), potem Inflict Damage osobno dla każdego celu; modyfikatory obrażeń nie przenoszą się między modelami. Confusion po zadaniu obrażeń wszystkim.', requiresValue: true }, // (X")
        { name: 'Big Swing', kind: EffectKind.WEAPON, description: 'Możesz wziąć 1 Fatigue, by zwiększyć Effective Range tej broni o X".', requiresValue: true }, // (X)
        { name: 'Bladed', kind: EffectKind.WEAPON, description: 'Gdy model z tą bronią używa Makeshift Weapon do ataku w zwarciu, dodaj 1 Bonus Die do puli.' },
        { name: 'CQB', kind: EffectKind.WEAPON, description: 'Broń nie może celować w modele poza swoim Effective Range.' },
        { name: 'Creative Projectiles', kind: EffectKind.WEAPON, description: 'Podczas Attack Action możesz wydać Parts ze Stash, by tymczasowo zmienić Test i Critical Effect profilu wg Creative Projectiles Table (po ataku wracają).' },
        { name: 'Distress Signal', kind: EffectKind.WEAPON, description: "Daje akcję: 'SEND HELP!' (dla niezaangażowanych). Wybierz przyjazny model; porusza się do 2\" (może wejść/wyjść z Engagement)." },
        { name: 'Fast', kind: EffectKind.WEAPON, description: 'Modele z tą bronią mogą wykonać do dwóch akcji Open Fire lub Brawl w tej samej turze, o ile obie używają tej broni.' },
        { name: 'Irradiate', kind: EffectKind.WEAPON, description: 'Po rozstrzygnięciu Attack Action połóż Radiation Token w kontakcie z celem; jeśli broń ma Area (X"), w promieniu 1" od punktu celu.' },
        { name: 'One & Done', kind: EffectKind.WEAPON, description: 'Po wykonaniu ataku tą bronią nie można jej użyć ponownie w tej grze.' },
        { name: 'Selective Fire', kind: EffectKind.WEAPON, description: 'Po deklaracji ataku, przed tworzeniem puli, wybierz jeden z wymienionych przy tej broni Traitów (np. Area (1"), Storm (3)) — broń zyskuje go do końca rozstrzygnięcia ataku.' },
        { name: 'Slow', kind: EffectKind.WEAPON, description: 'Model może wykonać tylko jedną Attack Action z użyciem tej broni na rundę.' },
        { name: 'Storm', kind: EffectKind.WEAPON, description: 'Jeśli cel jest w połowie Effective Range lub bliżej, dodaj +X Bonus Dice do puli ataku.', requiresValue: true }, // (+X)
        { name: 'Unwieldy', kind: EffectKind.WEAPON, description: 'Jeśli Siła (S) modelu jest mniejsza niż X, Attack Test nie może zyskiwać Bonus Dice.', requiresValue: true }, // (X)
        { name: 'Wind Up', kind: EffectKind.WEAPON, description: 'Tworząc pulę dla Attack Action, dodaj 2 Bonus Dice zamiast 1, jeśli model w tej turze wszedł w Engagement z celem.' },

        // ——— CRITICAL EFFECTS z obrazków
        { name: 'Pushback', kind: EffectKind.CRITICAL, description: "Na końcu 'Inflict Damage' przeciwnik rzuca X kośćmi. Za każdą wyższą od Siły (S) celu — cel przesuwa się o 1\" bezpośrednio od modelu atakującego (jeśli nie może pełnego dystansu, porusza się maksymalnie).", requiresValue: true },
        { name: 'Tranquilize', kind: EffectKind.CRITICAL, description: "Na końcu 'Inflict Damage' przeciwnik rzuca X kośćmi. Za każdą wyższą od Wytrzymałości (E) celu — cel otrzymuje 1 Harm (nadwyżka powoduje Injury). Jeśli to Injury wyeliminuje cel, w 'Treat the Wounded' nie rzucasz — otrzymuje Clean Bill of Health.", requiresValue: true },
        { name: 'Ignite', kind: EffectKind.CRITICAL, description: "Na początku 'Inflict Damage' przeciwnik rzuca X kośćmi. Za każdą wyższą od Zwinności (AGI) celu — zadane obrażenia zwiększają się o 1.", requiresValue: true },
        { name: 'Maim', kind: EffectKind.CRITICAL, description: "Na końcu 'Inflict Damage' cel otrzymuje 1 Harm." },
        { name: 'Meltdown', kind: EffectKind.CRITICAL, description: "Na końcu 'Inflict Damage' przeciwnik wykonuje Meltdown Test (2E) dla celu. Jeśli uzyska mniej Trafień niż ilość Harm na celu, cel otrzymuje Injury." },
        { name: 'Pierce', kind: EffectKind.CRITICAL, description: "Podczas 'Inflict Damage' Wytrzymałość (E) celu jest traktowana jako o 1 niższa (min. 1)." },
        { name: 'Poison', kind: EffectKind.CRITICAL, description: "Na końcu 'Inflict Damage' przeciwnik rzuca X kośćmi. Za każdą wyższą od Wytrzymałości (E) celu — cel otrzymuje 1 Harm (nadwyżka powoduje Injury).", requiresValue: true },
        { name: 'Suppress', kind: EffectKind.CRITICAL, description: "Na końcu 'Inflict Damage' przeciwnik rzuca X kośćmi. Jeśli jakakolwiek kość przewyższy Inteligencję (I) celu — cel otrzymuje 1 Fatigue.", requiresValue: true },
    ];
    const effects = await Promise.all(EFFECTS.map(ensureEffect));
    const effectIds = new Map<string, string>(effects.map((e) => [effectKey(e.name, e.kind), e.id]));

    const shortHuntingRifle = await upsertWeaponBundle(
        {
            name: 'Short Hunting Rifle',
            base: { baseType: 'Rifle (14")', baseTest: '3P', baseRating: 6 },
            baseEffects: [{ name: 'Pierce', kind: EffectKind.CRITICAL }],
            profiles: [
                { order: 0, testOverride: '4P', partsOverride: 4, rating: 6 },
                { order: 1, partsOverride: 3, rating: 8, effects: [{ name: 'Fast', kind: EffectKind.WEAPON }] },
            ],
        },
        effectIds
    );

    const pistol10mm = await upsertWeaponBundle(
        {
            name: '10mm Pistol',
            base: { baseType: 'Pistol', baseTest: 'AGI', baseParts: 2, baseRating: 1 },
            baseEffects: [{ name: 'Armor Piercing', kind: EffectKind.WEAPON, valueInt: 1 }],
            profiles: [
                { order: 0, partsOverride: 1, rating: 2, effects: [{ name: 'Suppressive Fire', kind: EffectKind.WEAPON }] },
                { order: 1, rating: 2, effects: [{ name: 'Armor Piercing', kind: EffectKind.WEAPON, valueInt: 1 }] },
            ],
        },
        effectIds
    );

    const laserMusket = await upsertWeaponBundle(
        {
            name: 'Laser Musket',
            base: { baseType: 'Energy', baseTest: 'INT', baseParts: 4, baseRating: 2 },
            baseEffects: [{ name: 'Explosive', kind: EffectKind.WEAPON }],
            profiles: [
                {
                    order: 0,
                    partsOverride: 1,
                    rating: 3,
                    effects: [
                        { name: 'Explosive', kind: EffectKind.WEAPON },
                        { name: 'Bleed', kind: EffectKind.CRITICAL, valueInt: 1 },
                    ],
                },
            ],
        },
        effectIds
    );

    /* 4) FRAKCJE */
    const vaultDwellers = await upsertFactionFull({
        name: 'Vault Dwellers',
        goalSets: [
            {
                name: 'Foundations',
                goals: [
                    // Tier 1
                    { tier: 1, description: 'Zbierz materiały budowlane', target: 10 },
                    { tier: 1, description: 'Zrekrutuj 2 osadników', target: 2 },
                    { tier: 1, description: 'Pozyskaj 20 części (parts)', target: 20 },
                    // Tier 2
                    { tier: 2, description: 'Zbuduj 2 placówki', target: 2 },
                    { tier: 2, description: 'Odkryj 2 nowe lokacje', target: 2 },
                    { tier: 2, description: 'Wygeneruj 100 zasięgu (reach)', target: 100 },
                    // Tier 3
                    { tier: 3, description: 'Obroń schron 3 razy', target: 3 },
                    { tier: 3, description: 'Utrzymaj 3 terytoria przez 1 turę', target: 3 },
                    { tier: 3, description: 'Wygraj bitwę bez strat jednostek', target: 1 },
                ],
            },
            {
                name: 'Prosperity',
                goals: [
                    // Tier 1
                    { tier: 1, description: 'Zdobądź 50 caps', target: 50 },
                    { tier: 1, description: 'Przeprowadź 3 wymiany handlowe', target: 3 },
                    { tier: 1, description: 'Zbierz 5 rzadkich części', target: 5 },
                    // Tier 2
                    { tier: 2, description: 'Ulepsz 3 jednostki', target: 3 },
                    { tier: 2, description: 'Podnieś poziom bazy 2 razy', target: 2 },
                    { tier: 2, description: 'Odblokuj 1 frakcyjne ulepszenie', target: 1 },
                    // Tier 3
                    { tier: 3, description: 'Wygraj 2 potyczki z rzędu', target: 2 },
                    { tier: 3, description: 'Osiągnij 200 caps w skarbcu', target: 200 },
                    { tier: 3, description: 'Wystaw armię o łącznym ratingu ≥ 10', target: 10 },
                ],
            },
        ],
        upgradeRules: [
            { statKey: 'hp', ratingPerPoint: 1 },
            { statKey: 'S', ratingPerPoint: 1 },
            { statKey: 'P', ratingPerPoint: 1 },
            { statKey: 'E', ratingPerPoint: 1 },
            { statKey: 'C', ratingPerPoint: 1 },
            { statKey: 'I', ratingPerPoint: 1 },
            { statKey: 'A', ratingPerPoint: 1 },
            { statKey: 'L', ratingPerPoint: 1 },
        ],
        limits: [
            { tag: 'CORE', tier1: 6, tier2: 8, tier3: 10 },
            { tag: 'SPECIAL', tier1: 2, tier2: 3, tier3: 4 },
            { tag: 'HEAVY', tier1: 1, tier2: 2, tier3: 3 },
        ],
    });

    const raiders = await upsertFactionFull({
        name: 'Raiders',
        goalSets: [
            {
                name: 'Pillage',
                goals: [
                    // Tier 1
                    { tier: 1, description: 'Zrabuj 30 caps', target: 30 },
                    { tier: 1, description: 'Splądruj 2 karawany', target: 2 },
                    { tier: 1, description: 'Zdobądź 15 części', target: 15 },
                    // Tier 2
                    { tier: 2, description: 'Zniszcz 2 placówki przeciwnika', target: 2 },
                    { tier: 2, description: 'Przeprowadź 3 najazdy', target: 3 },
                    { tier: 2, description: 'Przejmij 1 terytorium', target: 1 },
                    // Tier 3
                    { tier: 3, description: 'Pokonaj elitarną jednostkę', target: 1 },
                    { tier: 3, description: 'Utrzymaj kontrolę przez 2 tury', target: 2 },
                    { tier: 3, description: 'Zgarnij 100 caps w jednej bitwie', target: 100 },
                ],
            },
            {
                name: 'Infamy',
                goals: [
                    // Tier 1
                    { tier: 1, description: 'Zdobądź 3 poziomy reputacji', target: 3 },
                    { tier: 1, description: 'Wygraj 2 bitwy', target: 2 },
                    { tier: 1, description: 'Zwerbuj 1 najemnika', target: 1 },
                    // Tier 2
                    { tier: 2, description: 'Zniszcz 3 pojazdy/umocnienia', target: 3 },
                    { tier: 2, description: 'Zakończ 2 misje fabularne', target: 2 },
                    { tier: 2, description: 'Zbierz 50 reach', target: 50 },
                    // Tier 3
                    { tier: 3, description: 'Wygraj bitwę bez utraty jednostki', target: 1 },
                    { tier: 3, description: 'Utrzymaj dwa terytoria 2 tury', target: 2 },
                    { tier: 3, description: 'Zdobądź 3 rzadkie artefakty', target: 3 },
                ],
            },
        ],
        upgradeRules: [
            { statKey: 'hp', ratingPerPoint: 1 },
            { statKey: 'S', ratingPerPoint: 1 },
            { statKey: 'P', ratingPerPoint: 2 },
            { statKey: 'E', ratingPerPoint: 1 },
            { statKey: 'C', ratingPerPoint: 0 },
            { statKey: 'I', ratingPerPoint: 2 },
            { statKey: 'A', ratingPerPoint: 1 },
            { statKey: 'L', ratingPerPoint: 1 },
        ],
        limits: [
            { tag: 'CORE', tier1: 7, tier2: 9, tier3: 11 },
            { tag: 'SPECIAL', tier1: 1, tier2: 2, tier3: 3 },
            { tag: 'HEAVY', tier1: 1, tier2: 1, tier3: 2 },
        ],
    });

    /* 5) UNIT TEMPLATES + opcje broni */
    const vaultSecurity = await upsertUnitTemplate('Vault Security', {
        factionId: vaultDwellers.id,
        roleTag: 'TROOPER',
        baseRating: 2,
        hp: 4, s: 6, p: 5, e: 5, c: 5, i: 5, a: 5, l: 5,
    });

    const raiderScavver = await upsertUnitTemplate('Raider Scavver', {
        factionId: raiders.id,
        roleTag: 'RAIDER',
        baseRating: 1,
        hp: 3, s: 5, p: 5, e: 4, c: 5, i: 4, a: 6, l: 5,
    });

    const raiderHunter = await upsertUnitTemplate('Raider Hunter', {
        factionId: raiders.id,
        roleTag: 'SCOUT',
        baseRating: 2,
        hp: 3, s: 5, p: 6, e: 4, c: 5, i: 5, a: 6, l: 5,
    });

    await Promise.all([
        upsertUnitOption(vaultSecurity.id, pistol10mm.id, null, 30, 1),
        upsertUnitOption(vaultSecurity.id, shortHuntingRifle.id, null, 45, 2),

        upsertUnitOption(raiderScavver.id, pistol10mm.id, null, 25, 1),

        upsertUnitOption(raiderHunter.id, shortHuntingRifle.id, null, 40, 2),
        upsertUnitOption(raiderHunter.id, laserMusket.id, null, 55, 2),
    ]);

    console.log('✅ Seed OK: admin, effects, weapons, factions (3 goals/tier), units.');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
