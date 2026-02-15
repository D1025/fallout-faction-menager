/* prisma/seed.ts */
import {
    PrismaClient,
    Prisma,
    EffectKind,
    StatKeySpecial,
    UserRole,
} from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME ?? 'admin').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!ChangeMe';

function hashPassword(password: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64, {
        N: 16_384,
        r: 8,
        p: 1,
        maxmem: 32 * 1024 * 1024,
    });
    return ['scrypt', '16384', '8', '1', salt.toString('base64'), hash.toString('base64')].join('$');
}

/* ========================== GUARD: seed tylko na pustej bazie ========================== */
async function isDatabaseEmpty(): Promise<boolean> {
    const [effects, weapons, factions, units] = await Promise.all([
        prisma.effect.count(),
        prisma.weaponTemplate.count(),
        prisma.faction.count(),
        prisma.unitTemplate.count(),
    ]);
    return effects === 0 && weapons === 0 && factions === 0 && units === 0;
}

/* ========================== HELPERY OGĂ„â€šĂ˘â‚¬ĹľÄ‚ËĂ˘â€šÂ¬ÄąË‡Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă˘â‚¬ĹźLNE ========================== */

async function ensureAdminUser(name: string = ADMIN_USERNAME, password: string = ADMIN_PASSWORD) {
    const passwordHash = hashPassword(password);
    return prisma.user.upsert({
        where: { name },
        update: { role: UserRole.ADMIN, passwordHash },
        create: { name, role: UserRole.ADMIN, passwordHash },
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

/* ========================== BRONIE Ä‚â€žĂ˘â‚¬ĹˇÄ‚â€ąĂ‚ÂĂ„â€šĂ‹ÂÄ‚ËĂ˘â€šÂ¬ÄąË‡Ä‚â€šĂ‚Â¬Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă˘â‚¬Ĺź BUNDLE ========================== */

export type WeaponProfileInput = {
    order?: number;
    typeOverride?: string | null;
    testOverride?: string | null;
    partsOverride?: number | null;
    ratingDelta?: number | null;
    rating?: number | null;
    // effectMode:
    // - 'ADD' (default): dodaje efekt do profilu
    // - 'REMOVE': usuwa efekt bazowy o tym samym effectId (name+kind)
    effects?: Array<{ name: string; kind: EffectKind; valueInt?: number | null; valueText?: string | null; effectMode?: 'ADD' | 'REMOVE' }>;
};
type ProfileEffectSeed = NonNullable<WeaponProfileInput['effects']>[number];

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
    baseEffects?: Array<{ name: string; kind: EffectKind; valueInt?: number | null; valueText?: string | null }>;
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

        // idempotentny reset zaleĂ„â€šĂ˘â‚¬ĹľÄ‚â€žĂ˘â‚¬Â¦Ă„â€šĂ˘â‚¬ĹľÄ‚â€ąÄąÄ„noĂ„â€šĂ˘â‚¬ĹľÄ‚â€žĂ˘â‚¬Â¦Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…ÄąĹźci dla danego template
        await tx.weaponProfileEffect.deleteMany({ where: { profile: { weaponId: template.id } } });
        await tx.weaponProfile.deleteMany({ where: { weaponId: template.id } });
        await tx.weaponBaseEffect.deleteMany({ where: { weaponId: template.id } });

        for (const be of baseEffects) {
            const id = effectIds.get(effectKey(be.name, be.kind));
            if (!id) throw new Error(`Brak efektu: ${be.name} (${be.kind}) Ä‚â€žĂ˘â‚¬ĹˇÄ‚â€ąĂ‚ÂĂ„â€šĂ‹ÂÄ‚ËĂ˘â€šÂ¬ÄąË‡Ä‚â€šĂ‚Â¬Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă„â€ž zasiej efekty wczeĂ„â€šĂ˘â‚¬ĹľÄ‚â€žĂ˘â‚¬Â¦Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…ÄąĹźniej`);
            const baseEffectData: Prisma.WeaponBaseEffectUncheckedCreateInput & { valueText?: string | null } = {
                weaponId: template.id,
                effectId: id,
                valueInt: be.valueInt ?? null,
                valueText: be.valueText ?? null,
            };
            await tx.weaponBaseEffect.create({
                data: baseEffectData,
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
                const profileEffectData: Prisma.WeaponProfileEffectUncheckedCreateInput & {
                    valueText?: string | null;
                    effectMode: 'ADD' | 'REMOVE';
                } = {
                    profileId: profile.id,
                    effectId: id,
                    valueInt: pe.valueInt ?? null,
                    valueText: pe.valueText ?? null,
                    effectMode: pe.effectMode ?? 'ADD',
                };
                await tx.weaponProfileEffect.create({
                    data: profileEffectData,
                });
            }
        }

        return template;
    });
}

/* ========================== FRAKCJE Ä‚â€žĂ˘â‚¬ĹˇÄ‚â€ąĂ‚ÂĂ„â€šĂ‹ÂÄ‚ËĂ˘â€šÂ¬ÄąË‡Ä‚â€šĂ‚Â¬Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă˘â‚¬Ĺź peĂ„â€šĂ˘â‚¬ĹľÄ‚â€žĂ˘â‚¬Â¦Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă‹â€ˇny zestaw ========================== */

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
            throw new Error(`Zestaw goal'i musi mieÄ‚â€žĂ˘â‚¬ĹˇÄ‚ËĂ˘â€šÂ¬ÄąÄľĂ„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ä‚â€ąĂ˘â‚¬Ë‡ **dokĂ„â€šĂ˘â‚¬ĹľÄ‚â€žĂ˘â‚¬Â¦Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă‹â€ˇadnie 3** zadania dla tier=${t} (jest ${counts[t]}).`);
        }
    });
}

async function upsertFactionFull(input: FactionInput) {
    const faction = await prisma.faction.upsert({
        where: { name: input.name },
        update: {},
        create: { name: input.name },
    });

    // UWAGA: te czyszczenia sÄ… bezpieczne tylko na zupeĂ„â€šĂ˘â‚¬ĹľÄ‚â€žĂ˘â‚¬Â¦Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă‹â€ˇnie pustej bazie.
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
        roleTag?: 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS' | null;
        isLeader?: boolean;
        baseRating?: number | null;
        hp?: number; s?: number; p?: number; e?: number; c?: number; i?: number; a?: number; l?: number;
    }
) {
    const { factionId, ...templateData } = data;
    const found = await prisma.unitTemplate.findFirst({ where: { name } });
    const unit = !found
        ? await prisma.unitTemplate.create({ data: { name, ...templateData } })
        : await prisma.unitTemplate.update({ where: { id: found.id }, data: templateData });

    await prisma.unitTemplateFaction.deleteMany({ where: { unitId: unit.id } });
    if (factionId) {
        await prisma.unitTemplateFaction.create({
            data: { unitId: unit.id, factionId },
        });
    }

    return unit;
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

async function replaceUnitOptions(
    unitId: string,
    options: Array<{ weapon1Id: string; weapon2Id?: string | null; costCaps: number; rating?: number | null }>
) {
    await prisma.unitWeaponOption.deleteMany({ where: { unitId } });
    await Promise.all(
        options.map((o) =>
            upsertUnitOption(
                unitId,
                o.weapon1Id,
                o.weapon2Id ?? null,
                o.costCaps,
                o.rating ?? null
            )
        )
    );
}

async function setUnitStartPerks(unitId: string, perkNames: string[]) {
    await prisma.unitStartPerk.deleteMany({ where: { unitId } });
    if (perkNames.length === 0) return;

    const perks = await prisma.perk.findMany({
        where: { name: { in: perkNames } },
        select: { id: true, name: true },
    });
    const perkIdByName = new Map(perks.map((p) => [p.name, p.id]));

    for (const name of perkNames) {
        if (!perkIdByName.has(name)) {
            throw new Error(`Missing perk for unit template: ${name}`);
        }
    }

    await prisma.unitStartPerk.createMany({
        data: perkNames.map((name) => ({
            unitId,
            perkId: perkIdByName.get(name)!,
        })),
        skipDuplicates: true,
    });
}

async function upsertSubfaction(factionId: string, name: string) {
    const found = await prisma.subfaction.findFirst({ where: { factionId, name } });
    if (found) return found;
    return prisma.subfaction.create({ data: { factionId, name } });
}

async function replaceSubfactionUnitRules(
    subfactionId: string,
    input: { allowUnitIds: string[]; denyUnitIds: string[] }
) {
    const allowUnitIds = [...new Set(input.allowUnitIds)];
    const denyUnitIds = [...new Set(input.denyUnitIds)];

    await prisma.subfactionUnitAllow.deleteMany({ where: { subfactionId } });
    await prisma.subfactionUnitDeny.deleteMany({ where: { subfactionId } });

    if (allowUnitIds.length > 0) {
        await prisma.subfactionUnitAllow.createMany({
            data: allowUnitIds.map((unitId) => ({ subfactionId, unitId })),
            skipDuplicates: true,
        });
    }
    if (denyUnitIds.length > 0) {
        await prisma.subfactionUnitDeny.createMany({
            data: denyUnitIds.map((unitId) => ({ subfactionId, unitId })),
            skipDuplicates: true,
        });
    }
}

/* ========================== PERKS ========================== */

type PerkSpec = {
    name: string;
    description: string;
    category?: 'REGULAR' | 'AUTOMATRON';
    isInnate?: boolean;
    statKey?: StatKeySpecial | null;
    minValue?: number | null;
};

async function ensurePerk(spec: PerkSpec) {
    const isSpecialLinked = spec.statKey != null && spec.minValue != null;
    const isInnate = spec.isInnate ?? !isSpecialLinked;

    const existing = await prisma.perk.findFirst({ where: { name: spec.name } });
    if (existing) {
        return prisma.perk.update({
            where: { id: existing.id },
            data: {
                description: spec.description,
                isInnate,
                category: spec.category ?? 'REGULAR',
                statKey: spec.statKey ?? null,
                minValue: spec.minValue ?? null,
            },
        });
    }
    return prisma.perk.create({
        data: {
            name: spec.name,
            description: spec.description,
            isInnate,
            category: spec.category ?? 'REGULAR',
            statKey: spec.statKey ?? null,
            minValue: spec.minValue ?? null,
            requiresValue: false,
            startAllowed: false,
            behavior: 'NONE',
        },
    });
}

function uniqByName(perks: PerkSpec[]): PerkSpec[] {
    const m = new Map<string, PerkSpec>();
    for (const p of perks) {
        const key = p.name.trim().toUpperCase();
        if (!m.has(key)) m.set(key, { ...p, name: p.name.trim() });
    }
    return [...m.values()];
}

function applySpecialRequirements(perks: PerkSpec[]): PerkSpec[] {
    const reqByName = new Map<string, { statKey: StatKeySpecial; minValue: number }>();
    const keyOf = (name: string): string => name.trim().toUpperCase().replace(/[’‘`]/g, "'");

    const assign = (statKey: StatKeySpecial, pairs: Array<[string, number]>) => {
        for (const [name, minValue] of pairs) {
            reqByName.set(keyOf(name), { statKey, minValue });
        }
    };

    assign('S', [
        ['STRONG BACK', 3],
        ['BASHER', 4],
        ['BIG LEAGUES', 4],
        ['DRAG', 4],
        ['STEADY AIM', 4],
        ['MANCATCHER', 5],
        ['CHARGE', 5],
        ['WIDE SWINGS', 6],
        ['GRENADIER', 6],
        ['FREIGHT TRAIN', 6],
        ['IRON FIST', 7],
    ]);
    assign('P', [
        ['WAYFINDER', 3],
        ['HOBBLE', 3],
        ['SNIPER', 4],
        ['OVERWATCH', 4],
        ['SPOTTER', 4],
        ['PENETRATOR', 5],
        ['PICKPOCKET', 5],
        ['CALLED SHOT', 6],
        ['RIFLEMAN', 6],
        ['AWARENESS', 7],
    ]);
    assign('E', [
        ['STONEWALL', 3],
        ['SELFLESS', 3],
        ['RAD RESISTANT', 4],
        ['IMMORTAL', 4],
        ['BULLET MAGNET', 5],
        ['ODD ANATOMY', 5],
        ['CANNIBAL', 5],
        ['TOUGHNESS', 6],
        ['UNENDING STAMINA', 6],
        ['LIFEGIVER', 7],
    ]);
    assign('C', [
        ['WARDEN', 3],
        ['FAST TALKER', 3],
        ['LIEUTENANT', 4],
        ['INSPIRATIONAL', 4],
        ['LONE WANDERER', 5],
        ['UNASSUMING', 5],
        ['PARTYBOY/GIRL', 5],
        ['INTIMIDATION', 6],
        ['ANIMAL FRIEND', 6],
        ['MANEUVER', 6],
        ['CAP COLLECTOR', 7],
    ]);
    assign('I', [
        ['ADAPTABLE', 3],
        ['SAVANT', 4],
        ['INFORMANT', 4],
        ['SCRAPPER', 4],
        ['CHEMIST', 5],
        ['STRATEGIST', 5],
        ['MEDIC', 6],
        ['TRIGONOMETRY', 6],
        ['CORONER', 6],
        ['DEVIOUS', 5],
        ['PREVIOUS', 5],
        ['GUN NUT', 7],
    ]);
    assign('A', [
        ['SPRINT', 3],
        ['PARTING SHOT', 4],
        ['HIDDEN', 4],
        ['BLITZ', 4],
        ['GUNSLINGER', 5],
        ['FIRE AND MOVE', 6],
        ['HIT THE DECK', 6],
        ['GUNS AKIMBO', 6],
        ['REFLEXES', 7],
        ['MOVING TARGET', 7],
    ]);
    assign('L', [
        ['MALFUNCTION', 2],
        ['RICOCHET', 2],
        ['FORTUNE FINDER', 2],
        ['LEND LUCK', 3],
        ['LUCKY CHARM', 3],
        ['FOUR LEAF CLOVER', 3],
        ['BLOODY MESS', 3],
        ["GRIM REAPER'S SPRINT", 4],
        ['BETTER CRITICALS', 4],
        ['MYSTERIOUS STRANGER', 4],
    ]);

    return perks.map((perk) => {
        const req = reqByName.get(keyOf(perk.name));
        if (!req) return perk;
        return {
            ...perk,
            statKey: perk.statKey ?? req.statKey,
            minValue: perk.minValue ?? req.minValue,
        };
    });
}

/* ========================== MAIN ========================== */

async function main(): Promise<void> {
    const seedCoreData = await isDatabaseEmpty();

    /* 1) ADMIN - zawsze wymuszamy dane administratora */
    const admin = await ensureAdminUser();
    console.log('Admin:', admin.name);
    if (!process.env.ADMIN_PASSWORD) {
        console.warn('WARNING: ADMIN_PASSWORD env is not set. Default admin password is active.');
    }


    /* 1b) PERKI (wbudowane, INNATE) */
    const PERKS: PerkSpec[] = applySpecialRequirements(uniqByName([
        { name: 'EYE CATCHING', description: 'This model always counts as being Wide Open.' },
        { name: 'FLIGHT', description: 'This model is unaffected by the Proximity of Enemy models and can take the Get Moving Action while Engaged. This model does not count vertical movement towards its total allowed when climbing, and is always considered to have an Agility greater than the elevation difference when dropping from a Terrain Feature.', category: 'AUTOMATRON' },
        { name: 'HARDY', description: 'This model cannot Suffer Fatigue. It can still Take Fatigue by performing Actions or other effects.' },
        { name: 'KABOOM!', description: 'This model gains the following Uranium Fever Action. Action: Uranium Fever (Unengaged/Engaged): All models (Friendly and Enemy) within 3â€ť Suffer sufficient Harm to reach their Harm Limit. This model is Incapacitated. This model does not roll on the Aftermath Table; it just rolls on the Serious Injury Table.' },
        { name: 'KEEP UP!', description: 'After a Friendly Champion model in Base contact completes a Back Off or Get Moving Action, this model may move into Base contact with that Friendly Champion model.' },
        { name: 'MACHINE', description: 'This model always Passes any Confusion Test it is required to make. When this model is Incapacitated, it does not trigger Confusion Tests for other models. In addition, Chems cannot be used on this model, and it is unaffected by the Poison (X) and Tranquilize (X) Critical Effects. This model is unaffected by Radiation Tokens.' },
        { name: 'MAKING A WITHDRAWAL', description: 'When this model would cause an Enemy model to Suffer an Injury or Harm, the opposing player may reduce their Stash by 5 Caps per Injury and Harm. For every 5 Caps removed, this modelâ€™s crew gains 5 Caps and the Enemy model Suffers one less Injury or Harm, as appropriate.' },
        { name: 'MIND CONTROL', description: 'This model can make an Open Fire Actions using weapons carried by an Enemy model within its Control Area. Visibility is checked from the Enemy model with the weapon being used by the model with the Mind Control Perk. During this Open Fire Action, this model uses its own Luck statistic and the appropriate Test statistic value from the Enemy model. Weapons with the One & Done Trait cannot be used via this Perk.' },

        { name: 'ALL THE TOYS', description: 'When taking the Crew Training Story Action with this model, spend Parts rather than XP to purchase Upgrades. This model gains Automatron Perks rather than regular Perks. When this model gains a second, fourth, sixth, or eighth Upgrade, it also gains an Automatron Perk.', category: 'REGULAR' },

        { name: "ATOM'S GLOW", description: 'When this model makes an attack against an Enemy model, and either this model or the Target are within 3â€ť of a Radiation Token, treat this modelâ€™s Luck as being 1 higher.' },
        { name: 'BEAST', description: "This model can't become a crew's Leader, nor gain new Perks." },
        { name: 'BURLY', description: 'This modelâ€™s Harm Limit is 4 instead of 3.' },
        { name: 'BURROWING', description: 'This model is unaffected by the proximity of Enemy models and also can move through all Terrain features as long as they do not Climb at any point during that movement.' },
        { name: 'DISPOSABLE', description: 'This model does not caudsse Confusion Tests when removed from the Battlefield.' },
        { name: 'MYTHICAL', description: 'At the start of each Round, this model Takes 2 Fatigue. When this model becomes Confused as a result of Failing a Confusion Test, its controller does not have to choose between Flee or Take Fatigue. Instead it must Take Fatigue if it is able to do so. If it is unable to Take Fatigue, no additional effects happen.' },
        { name: 'NATURAL LEADER', description: 'This model automatically Passes Confusion Tests. When making an Intelligence Test for a Friendly model within this modelâ€™s Control Area, you can choose to use this modelâ€™s Intelligence value instead of the modelâ€™s own value. When choosing a Leader at the start of a game, this model must be chosen if possible. If there is more than one model with this Perk in the crew, the player must choose one of them.' },
        { name: 'OFFERINGS', description: 'This model gains the following additional option when taking the Rummage Action: Find Offerings: Recover Fatigue from a Friendly Holy Mothman model. Discard the results of the two dice used.' },
        { name: 'OMENS', description: 'Enemy models within this modelâ€™s Control Area treat all tests as Unlucky.' },
        { name: 'OUTSIDER', description: 'This modelâ€™s weapons cannot be modified using the Modify Weapons Story Action or Upgraded using the Crew Training Story Action. This model does not count toward or affect any Crew Limits. If this model is a Champion, it does not allow a crew to take 5 more Grunts. In addition, the model does not count as a Friendly model for the purposes of Confusion Tests.' },
        { name: 'POINT BLANK', description: 'This model can take the Open Fire Action while Engaged.' },
        { name: 'POWER ARMOR', description: 'This model gains the following benefits: This model cannot Suffer Fatigue (can still Take Fatigue). This modelâ€™s Harm Limit is 4 instead of 3. This model is unaffected by Radiation Tokens.' },
        { name: 'POWER OF PRAYER', description: 'If a Friendly model is within this modelâ€™s Control Area, treat it as having the Rad Resistant Perk.' },
        { name: 'PRAISE BE!', description: 'While this model is on the Battlefield, the Mythical Innate Perk makes models Take 1 Fatigue rather than Take 2 Fatigue. If a Friendly model chooses Find Offerings as part of a Rummage Action while within this modelâ€™s Control Area, do not remove the Search Token.' },
        { name: 'PROGRAMMED', description: 'This model cannot be a crew Leader, nor take the Crew Training Story Action. It also cannot gain Perks or Experience.' },
        { name: 'PROVE YOUR WORTH', description: 'Friendly Grunt models within this modelâ€™s Control Area gain the Bullet Magnet Perk. If a model has the Unassuming Perk, it cannot gain the Bullet Magnet Perk.' },
        { name: 'SELF-DESTRUCT', description: 'When this model is Incapacitated, each other model within 3â€ť of it Suffers 1 Harm.' },
        { name: "SIC 'EM", description: 'When a Friendly model makes a Get Moving Action, this model can be given Movement Orders even if it is not within the Active modelâ€™s Control Area. All other restrictions still apply.' },
        { name: 'STEALTH BOY', description: 'This model may not be Targeted by Ranged Attacks unless it is within Perception range of the Attacking model.' },
        { name: 'STICKY FINGERS', description: 'When this model makes the Rummage Action to Find a Chem, after adding a Chem to the Crew Roster, they may add a second Chem with a Cap cost no greater than the total result of the two rolled dice.' },
        { name: 'SURVIVALIST', description: 'Whenever this model would Suffer Harm from an attack, and there is another Friendly model within 3â€ť that has no Harm, the Friendly model may Suffer that Harm instead.' },
        { name: 'SWARM', description: 'When this model is taken as a Companion, you may add up to three models to your crew, instead of one, adding the Rating of each individual Companion to your Championâ€™s Rating.' },
        { name: 'TRY OUTS', description: 'When this model makes an Attack Action, increase its Strength and Agility statistics by 2 if this model has line of sight to a Friendly Leader model.' },
        { name: 'VISIONS', description: 'At the beginning of this modelâ€™s first Activation of the Round, you may choose for it to Take Fatigue. If it does, place a Radiation Token anywhere on the Battlefield that is not within 3â€ť of a Search Token, a model, Objective Token, or another Radiation Token.' },
        { name: 'KNOW YOUR ENEMY (FACTION)', description: 'When creating the Dice Pool for an Attack Action against an Enemy model from X Faction, this model gains 1 Bonus Dice. If a model gains this Perk, their controller picks the applicable Faction at that time.' },
        { name: 'PERSONAL STASH', description: 'If a crew has one or more models with this Perk (who are not Absent), when purchasing Common Chems, reduce their costs by 3 Caps.' },
        { name: 'V.A.T.S.', description: 'After declaring an Attack Action with this model, but before creating the Dice Pool, you may declare the number of Hits you expect to roll. During the Remove Duds step, if your declared number matches the number of Hits left in the Pool, then each Hit counts as 2 Hits instead.' },

        // Strength perks
        { name: 'STRONG BACK', description: 'Once per Turn, during its activation, this model may make the Rummage Action without Taking Fatigue.' },
        { name: 'BASHER', description: 'When this model makes a Melee Attack with a Pushback Critical Effect, increase the Pushback value by 2 until the Attack resolves.' },
        { name: 'BIG LEAGUES', description: 'When creating a Dice Pool for a Melee Attack, this model increases its Luck by 1 until the Attack resolves.' },
        { name: 'DRAG', description: 'After this model makes the Back Off Action, it may make a Drag Test and pull an engaged model into Base contact if successful.' },
        { name: 'STEADY AIM', description: 'When this model creates a Dice Pool for a Ranged Attack with a Rifle or Heavy Weapon, if it has not moved this Turn, it gains 1 Bonus Die.' },
        { name: 'MANCATCHER', description: 'After this model Incapacitates an Enemy Champion in a Melee Attack, it may attempt to Capture that model with a Melee Test.' },
        { name: 'CHARGE', description: 'After performing a Get Moving Action, if this model is Engaged with an Enemy model, it may make a Brawl Action without Taking Fatigue.' },
        { name: 'WIDE SWINGS', description: 'When creating a Dice Pool for a Melee Attack, this model gains 1 Bonus Die for each Enemy model it is Engaged with beyond the first.' },
        { name: 'GRENADIER', description: 'This model increases the Effective Range of Grenade Weapons it is armed with by 3 inches.' },
        { name: 'IRON FIST', description: 'In addition to its existing Weapon Sets, this model gains the Iron Fist Weapon profile.' },
        { name: 'FREIGHT TRAIN', description: 'This model can take the Get Moving Action while Engaged.' },

        // Perception perks
        { name: 'WAYFINDER', description: 'When Scouting as part of a Scout Story Action, this model makes the Scout Test at 3P rather than 2P.' },
        { name: 'HOBBLE', description: 'Enemy models Damaged by this model during a Ranged Attack with an Area weapon cannot be activated in the following Turn unless all other Enemy models are Exhausted.' },
        { name: 'SNIPER', description: 'When this model makes a Ranged Attack with a Rifle weapon, Enemy models cannot be Obscured by intervening models.' },
        { name: 'OVERWATCH', description: 'When this model makes a Ranged Attack, if the Target moved in the previous Turn, it is Wide Open until the attack resolves.' },
        { name: 'SPOTTER', description: 'Friendly models within the Control Area of one or more models with this Perk may Re-roll one die when making the Rummage Action.' },
        { name: 'PENETRATOR', description: 'When this model makes a Ranged Attack with a weapon without Area and against a Target with Endurance 5 or more, reduce the Target model Endurance by 1 until the Attack resolves.' },
        { name: 'PICKPOCKET', description: 'This model may make a Pickpocket Test as part of a Back Off Action; on success it steals one Chem from the opposing player.' },
        { name: 'CALLED SHOT', description: 'When this model attacks with a Pistol or Rifle and the weapon has the Aim Trait, increase its value by 2 until the Attack resolves.' },
        { name: 'RIFLEMAN', description: 'When creating a Dice Pool for a Ranged Attack with a Rifle Weapon, this model increases Luck by 1 (up to a maximum of 3) until the Attack resolves.' },
        { name: 'AWARENESS', description: 'When a friendly model makes an Open Fire Action, this model can provide Supporting Fire even if not within the attacking model Control Area.' },

        // Endurance perks
        { name: 'STONEWALL', description: 'This model Proximity area is 2 inches rather than 1 inch.' },
        { name: 'SELFLESS', description: 'If this model is a Target model of an Attack from an Area Trait weapon, it may declare it is Shielding Others before the Attack Test is made.' },
        { name: 'RAD RESISTANT', description: 'This model is unaffected by Radiation Tokens.' },
        { name: 'IMMORTAL', description: 'When a player rolls on the Serious Injury Table for this model, roll an extra die and choose a result.' },
        { name: 'BULLET MAGNET', description: 'When making a Ranged Attack against your models, Enemy models must Target this model if it is the closest visible Friendly model that can be Targeted.' },
        { name: 'ODD ANATOMY', description: 'When this model is the Target of an Enemy Attack, during the Trigger Critical Effect step, it may make a Shrug Test.' },
        { name: 'CANNIBAL', description: 'When a model is Incapacitated while in Base contact with this model, this model Recovers all Harm.' },
        { name: 'TOUGHNESS', description: 'The first time this model would be Incapacitated each Game, it may make a Toughness Test. If passed, it takes Harm up to its Harm Limit instead.' },
        { name: 'UNENDING STAMINA', description: 'Once per Round, when this model is Exhausted, it may declare a Relentless Action to act without Taking Fatigue, then suffers 1 Injury at the end of that Action.' },
        { name: 'LIFEGIVER', description: 'At the start of each Round, this model Recovers 2 Harm.' },

        // Charisma perks
        { name: 'WARDEN', description: 'When a player makes a Captive Story Action and has one or more models with this Perk that are not Absent, they may roll twice when determining the Captive Table score and choose either result.' },
        { name: 'FAST TALKER', description: 'If this model is Captured or becomes a Captive, its controller may make a Charm Test; if passed, it does not become a Captive.' },
        { name: 'LIEUTENANT', description: 'During the Story Phase, if no model in a crew has Natural Leader, this model loses Lieutenant and gains Natural Leader for that phase.' },
        { name: 'INSPIRATIONAL', description: 'Increase this model Control Area by 2 inches.' },
        { name: 'LONE WANDERER', description: 'When creating a Dice Pool for any test for this model, if there are no other Friendly models in its Control Area, add 2 Bonus Dice.' },
        { name: 'UNASSUMING', description: 'When making a Ranged Attack against your models, Enemy models cannot Target this model if there is a closer visible Friendly model that can be Targeted.' },
        { name: 'PARTYBOY/GIRL', description: 'When this model uses a Chem, it may either Recover all Harm or Recover 1 Injury.' },
        { name: 'INTIMIDATION', description: 'When an Enemy model is subjected to a Confusion Test within this model Control Area, reduce the Enemy model Intelligence by 1 until the test resolves.' },
        { name: 'ANIMAL FRIEND', description: 'At the start of a game, you may deploy a Dog in Base contact with this model as a Friendly model for the rest of the game.' },
        { name: 'CAP COLLECTOR', description: 'When this model makes the Rummage Action to Find Caps and Parts, after rolling the die, double the number of Caps received.' },
        { name: 'MANEUVER', description: 'When this model completes its first Get Moving Action in a Round, this model may move another Friendly model within its Control Area up to 2 inches.' },

        // Intelligence perks
        { name: 'ADAPTABLE', description: 'Once per game, when creating this model Dice Pool for a S.P.E.C.I.A.L. Test, you may use this model Intelligence in place of any other statistic for that Test.' },
        { name: 'SAVANT', description: 'When performing the Crew Training Story Action to purchase an Upgrade for this model, reduce the XP cost by 2.' },
        { name: 'INFORMANT', description: 'When setting up a game, after completing the Starting Positions step, this model may reposition a number of Friendly models equal to its Luck.' },
        { name: 'SCRAPPER', description: 'When this model makes the Rummage Action to Find Caps and Parts, after rolling the die, double the number of Caps and Parts added to crew Stash.' },
        { name: 'CHEMIST', description: 'When setting up a game at the Preparing Advantage step, if one or more crew models with this Perk are not Absent, add a single dose of any Common Chem costing 10 caps or less to your roster.' },
        { name: 'STRATEGIST', description: 'When a crew containing one or more models with this Perk spends Scouting Points, the crew controller may make a Strategy Test. If passed, the crew gains 1 Scouting Point.' },
        { name: 'MEDIC', description: 'When this model makes a Patch Up Action, instead of recovering 2 Harm from itself, it may recover 3 Harm, or recover 3 Harm from a Friendly model within 1 inch.' },
        { name: 'TRIGONOMETRY', description: 'When creating this model Dice Pool for a Ranged Attack, if it is at least 2 inches higher in elevation than its target, add 2 Bonus Dice.' },
        { name: 'CORONER', description: 'During the Treat the Wounded step, if one or more models with this Perk are not Absent, whenever a friendly model rolls on Broken or Dead results, its controller may make an Autopsy Test to gain 1XP for each Hit.' },
        { name: 'GUN NUT', description: 'At the end of the Make Story Actions step of the Story Phase, if one or more models with this Perk are not Absent, its controller may spend Parts to Modify a single Weapon.' },
        { name: 'PREVIOUS', description: 'At the end of a Round, before adjusting the Round Tracker, if this model crew has the Initiative Token it may make an Action, Taking Fatigue as normal.' },

        // Agility perks
        { name: 'SPRINT', description: 'When this model uses the Get Moving Action, it may move an extra 2 inches.' },
        { name: 'PARTING SHOT', description: 'After making a Back Off Action to move out of an Enemy model proximity, this model may make a Ranged Attack using a Pistol Weapon against that model without Taking Fatigue.' },
        { name: 'HIDDEN', description: 'This model does not need to be Deployed as normal. At the start of the first Round, this controller may place this model anywhere on the Battlefield not within an Enemy model Control Area.' },
        { name: 'BLITZ', description: 'After this model completes a Brawl Action, its controller may move it up to 3 inches.' },
        { name: 'GUNSLINGER', description: 'This model increases the Effective Range of Pistol Weapons it is armed with by 4 inches.' },
        { name: 'FIRE AND MOVE', description: 'After this model completes an Open Fire Action, its controller may move it up to 4 inches.' },
        { name: 'HIT THE DECK', description: 'When making a Ranged Attack against your models, Enemy models cannot Target this model unless it is either Wide Open or has a Fatigue Token.' },
        { name: 'GUNS AKIMBO', description: 'When this model makes an Attack Action with a Pistol, if that Weapon does not have the Fast Trait, it gains Fast until the Attack resolves.' },
        { name: 'REFLEXES', description: 'When an Enemy model moves into this model Proximity, this model may make a Reaction Test. If passed, this model may make a Ranged Attack with a Weapon without the Slow Trait against the Enemy model.' },
        { name: 'MOVING TARGET', description: 'When this model becomes the Target of an Enemy Attack, it may declare it is Dodging. If it does, this model Takes 1 Fatigue but increases Endurance by 2 until the Attack resolves.' },

        // Luck perks
        { name: 'MALFUNCTION', description: 'If an Enemy Ranged Attack Targeting this model scores 0 Hits, the Attacking model Suffers 1 Harm.' },
        { name: 'RICOCHET', description: 'If an Enemy Ranged Attack Targeting this model scores 0 Hits, this model controller may choose a different model within 6 inches to become the Target of a Ricochet.' },
        { name: 'FORTUNE FINDER', description: 'After this model resolves a Rummage Action, its controller rolls a die and gains Caps equal to its result.' },
        { name: 'LEND LUCK', description: 'Attacks made by Friendly models against Enemy Targets within 3 inches of this model may use this model Luck statistic when creating a Dice Pool.' },
        { name: 'LUCKY CHARM', description: 'When this model controller uses a Ploy and this model is on the Battlefield, if this model crew has no Ploy Tokens left, they may make a Luck Test. If passed, the crew gains 1 Ploy Token.' },
        { name: 'FOUR LEAF CLOVER', description: 'During the Fortune Smiles step of a S.P.E.C.I.A.L. Test, this model rolls 2 Standard Dice for each Luck Die remaining in the pool, instead of one.' },
        { name: 'BLOODY MESS', description: 'If this model Incapacitates an Enemy model with an Attack, each other Enemy model within 2 inches of the Incapacitated model Suffers 1 Harm.' },
        { name: "GRIM REAPER'S SPRINT", description: 'When this model Incapacitates an Enemy model with an Attack, if at least two Luck Dice hit, this model Recovers 1 Fatigue.' },
        { name: 'BETTER CRITICALS', description: 'When this model triggers a Critical Effect with a numerical value, such as Ignite (X), increase that value by 2 until the Attack resolves.' },
        { name: 'MYSTERIOUS STRANGER', description: 'At the start of each Round after the first, this model controller may make a Mysterious Stranger Test. If passed, deploy a friendly Mysterious Stranger model in Base contact with the battlefield edge closest to this model.' },

        // Automatron perks
        { name: 'CLUSTER BOMBS', description: 'After performing a Get Moving Action, this model may use the Cluster Bombs weapon without Taking Fatigue. Weapon profile: Cluster Bombs, Grenade (3"), 2A, Traits: Area (2"), CQB.', category: 'AUTOMATRON' },
        { name: 'FAT MAN LAUNCHER', description: 'This model crew may use the Fat Man Ploy. Ploy: Fat Man. You may enact this Ploy at the end of any Round if a Friendly model with this Perk is on the Battlefield and is not Incapacitated. A Friendly model with this Perk makes a Ranged Attack Action using the Fat Man weapon. Weapon profile: Fat Man, Heavy (18"), 5S, Traits: Area (2"), CQB, Irradiate, One & Done.', category: 'AUTOMATRON' },
        { name: 'GAS LAUNCHER', description: 'When an Enemy model Engages a model with this Perk, the Enemy model controller rolls two dice. If any score higher than the Enemy model Intelligence, it Suffers 1 Fatigue.', category: 'AUTOMATRON' },
        { name: 'HOOK ARM', description: 'This model Melee weapon gains the Duel Trait.', category: 'AUTOMATRON' },
        { name: 'RADIATION COILS', description: 'This model counts as a Radiation Token.', category: 'AUTOMATRON' },
        { name: 'RECON SENSORS', description: 'When another Friendly model within 3" of this model makes a Ranged Attack with a Rifle, it adds an additional Bonus Die to the Dice Pool.', category: 'AUTOMATRON' },
        { name: 'REGENERATION FIELD', description: 'When a Friendly model without the Regeneration Field Perk is selected as the Active model, if that Friendly model is within 3" of a model with this Perk, it Recovers a Harm.', category: 'AUTOMATRON' },
        { name: 'SENSOR ARRAY', description: 'During Step 2 of an Open Fire Action, this model uses the Charisma of the crew Leader instead of its own when declaring Supporting Fire. Models that give Supporting Fire do not Take Fatigue.', category: 'AUTOMATRON' },
        { name: 'UNSTABLE', description: 'This model suffers 1 Harm rather than Taking Fatigue for its first Action each Round.', category: 'AUTOMATRON' },
    ]));

    await Promise.all(PERKS.map(ensurePerk));
    console.log(`Perks seeded: ${PERKS.length}`);


    /* 2) EFEKTY BRONI */
    const EFFECTS: EffectSpec[] = [
        { name: 'Aim', kind: EffectKind.WEAPON, description: "When creating the Dice Pool for an Attack Action with this weapon, the attacking model can Take Fatigue to add X Bonus Dice to the Pool.", requiresValue: true }, // (+X)
        { name: 'Area', kind: EffectKind.WEAPON, description: "When making an Attack Action with this weapon, the Active player nominates a Target point on the Battlefield instead of a Target model. This must be a point Visible to the attacking model on the Battlefield surface, or a Terrain Feature. Each model (from either crew) within X inches of the selected point counts as a Target model for the attack. Make a single Attack Test, to which no Bonus Dice can be applied. Then resolve the Inflict Damage step once for each Target model, in an order chosen by the Active player. If a rule adjusts the amount of Damage inflicted, or affects the Target model (for example, Ignite (X) or Maim), this does not carry over between models, and is instead tracked on each individual model. Do not resolve Confusion until Damage has been applied to all applicable models.", requiresValue: true }, // (X")
        { name: 'Big Swing', kind: EffectKind.WEAPON, description: "When making an Attack Action with this weapon, the attacking model can Take Fatigue to increase its Effective Range by X inches.", requiresValue: true }, // (X)
        { name: 'Bladed', kind: EffectKind.WEAPON, description: "When a model with this weapon uses a Makeshift Weapon to make a Melee Attack, add a Bonus Die to the Pool." },
        { name: 'CQB', kind: EffectKind.WEAPON, description: "This weapon cannot Target models outside of its Effective Range." },
        { name: 'Duel', kind: EffectKind.WEAPON, description: "A model Engaged with a model with this weapon cannot use the Back Off Action." },
        { name: 'Creative Projectiles', kind: EffectKind.WEAPON, description: "When making an Attack Action with this weapon, the attacking model's controller may subtract Parts from the crew's Stash. The amount of Parts subtracted alter the Test and Critical Effect of the Weapon Profile to match the details shown on the Creative Projectiles Table. Once the Attack is Resolved, the Test and Critical Effects are reset." },
        { name: 'Distress Signal', kind: EffectKind.WEAPON, description: "Models with this weapon gain the following Action: SEND HELP! (UNENGAGED MODELS). The Active player chooses a Friendly model other than the model using this Action. That model moves up to 2 inches (this can be used to move into or out of Engagement)." },
        { name: 'Fast', kind: EffectKind.WEAPON, description: "Models with this weapon can make up to two Open Fire or Brawl Actions within the same Turn, as long as both use this weapon." },
        { name: 'Irradiate', kind: EffectKind.WEAPON, description: "After resolving an Attack Action with this weapon, the Active player places a Radiation Token in contact with the Target model, or within 1 inch of the Target point if the weapon also has the Area (X) Trait." },
        { name: 'Non-Lethal', kind: EffectKind.WEAPON, description: "This weapon can never inflict an Injury with an attack, whether via Damage or through Excess Harm." },
        { name: 'One & Done', kind: EffectKind.WEAPON, description: "After making an Attack with this weapon, it cannot be used again this game." },
        { name: 'Overwhelm', kind: EffectKind.WEAPON, description: "When another Friendly model makes a Brawl Action, add one Bonus Die to the Pool Size if this model is Engaged with the Target. This is in addition to any Bonus Dice added during the Make the Attack Test step of a Brawl Action." },
        { name: 'Pulse', kind: EffectKind.WEAPON, description: "When making an Attack Action with this weapon, each model Engaged with the Active model counts as a Target model. Make a single Attack Test to which no Bonus Dice can be applied. Then resolve the Inflict Damage step once for each Target model, in an order chosen by the Active player. If a rule adjusts the amount of Damage inflicted (for example, Ignite (X)), this does not carry over between models. Do not resolve Confusion until Damage has been applied to all applicable models." },
        { name: 'Running Shot', kind: EffectKind.WEAPON, description: "After completing a Get Moving Action, a model with this weapon can use it to make an Open Fire Action without Taking Fatigue." },
        { name: 'Selective Fire', kind: EffectKind.WEAPON, description: "After declaring an Attack Action with this weapon, but before creating a Dice Pool, this model's player picks one of the Traits listed in this weapon's Selective Fire Trait (for example, Selective Fire (Area (1), Storm (3))). This weapon then gains that Trait until the Attack is Resolved." },
        { name: 'Silenced', kind: EffectKind.WEAPON, description: "At the end of the Inflict Damage step, this model can move up to 2 inches. During this move, it cannot move into the Proximity of an Enemy model." },
        { name: 'Slow', kind: EffectKind.WEAPON, description: "Models with this weapon may only use it to make one Attack Action per Round." },
        { name: 'Storm', kind: EffectKind.WEAPON, description: "When creating a Dice Pool for an Attack Action with this weapon, add X Bonus Dice to the Pool if the Target is within half of the weapon's Effective Range. For example, if the weapon has the Rifle (10) Type, the attack will gain X Bonus Dice if its Target is within 5 inches.", requiresValue: true }, // (+X)
        { name: 'Unwieldy', kind: EffectKind.WEAPON, description: "When a model makes an Attack Action with this weapon, if its Strength is lower than X, the Attack Test cannot gain any Bonus Dice.", requiresValue: true }, // (X)
        { name: 'Wind Up', kind: EffectKind.WEAPON, description: "When creating a Dice Pool for an Attack Action with this weapon, add 2 Bonus Dice instead of 1 if the Active model moved into Engagement with the Target model this Turn." },

        // Ä‚â€žĂ˘â‚¬ĹˇÄ‚â€ąĂ‚ÂĂ„â€šĂ‹ÂÄ‚ËĂ˘â€šÂ¬ÄąË‡Ä‚â€šĂ‚Â¬Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă„â€žÄ‚â€žĂ˘â‚¬ĹˇÄ‚â€ąĂ‚ÂĂ„â€šĂ‹ÂÄ‚ËĂ˘â€šÂ¬ÄąË‡Ä‚â€šĂ‚Â¬Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă„â€žÄ‚â€žĂ˘â‚¬ĹˇÄ‚â€ąĂ‚ÂĂ„â€šĂ‹ÂÄ‚ËĂ˘â€šÂ¬ÄąË‡Ä‚â€šĂ‚Â¬Ă„â€šĂ‹ÂÄ‚ËĂ˘â‚¬ĹˇĂ‚Â¬Ă„Ä…Ă„â€ž CRITICAL EFFECTS z obrazkĂłw
        { name: 'Pushback', kind: EffectKind.CRITICAL, description: "At the end of the Inflict Damage step, the opposing player rolls X dice. For each one that scores higher than the Target model's Strength, it is moved 1 inch directly away from the Active model. If the Target model cannot move this full distance, it moves as far as it can.", requiresValue: true },
        { name: 'Tranquilize', kind: EffectKind.CRITICAL, description: "At the end of the Inflict Damage step, the opposing player rolls X dice. For each one that scores higher than the Target model's Endurance, it suffers one Harm, with Excess Harm causing an Injury. Should this Injury Incapacitate the Target model, do not roll for it during the Treat the Wounded step of the Story Phase, it instead gains the Clean Bill of Health result.", requiresValue: true },
        { name: 'Ignite', kind: EffectKind.CRITICAL, description: "At the start of the Inflict Damage step, the opposing player rolls X dice. For each one that scores higher than the Target model's Agility, the amount of Damage inflicted is increased by 1.", requiresValue: true },
        { name: 'Maim', kind: EffectKind.CRITICAL, description: "At the end of the Inflict Damage step, the Target suffers 1 Harm." },
        { name: 'Meltdown', kind: EffectKind.CRITICAL, description: "At the end of the Inflict Damage step, the opposing player makes a Meltdown Test (2E) for the Target model. If the opposing player scores fewer Hits than the amount of Harm the Target model has, it suffers an Injury." },
        { name: 'Pierce', kind: EffectKind.CRITICAL, description: "During the Inflict Damage step, the Target model's Endurance is treated as 1 lower (to a minimum of 1)." },
        { name: 'Poison', kind: EffectKind.CRITICAL, description: "At the end of the Inflict Damage step, the opposing player rolls X dice. For each one that scores higher than the Target model's Endurance, it suffers one Harm, with Excess Harm causing an Injury.", requiresValue: true },
        { name: 'Suppress', kind: EffectKind.CRITICAL, description: "At the end of the Inflict Damage step, the opposing player rolls X dice. If any of them score higher than the Target model's Intelligence, it suffers 1 Fatigue.", requiresValue: true },
        { name: 'Haul', kind: EffectKind.CRITICAL, description: "At the end of the Inflict Damage step, the Active player rolls X dice. For each one that scores equal to or lower than the Active model's Strength, the Target is moved 1 inch directly towards the Active model. If the Target model cannot move this full distance, it moves as far as it can.", requiresValue: true },
        { name: 'Showstopper', kind: EffectKind.CRITICAL, description: "If this attack inflicts an amount of Damage equal to or greater than the Target's Endurance, any Excess Harm caused will result in the model suffering an Injury." },
        { name: 'Seize', kind: EffectKind.CRITICAL, description: "At the end of the Inflict Damage step, the Active model makes a Back Off Action without taking Fatigue. After resolving this Action, move the Target model into contact with the Active model." },
    ];
    const effects = await Promise.all(EFFECTS.map(ensureEffect));
    const effectIds = new Map<string, string>(effects.map((e) => [effectKey(e.name, e.kind), e.id]));

    const wfx = (name: string, valueInt?: number, valueText?: string): ProfileEffectSeed =>
        valueInt == null
            ? { name, kind: EffectKind.WEAPON, valueText: valueText ?? null, effectMode: 'ADD' }
            : { name, kind: EffectKind.WEAPON, valueInt, valueText: valueText ?? null, effectMode: 'ADD' };
    const wfxR = (name: string, valueInt?: number, valueText?: string): ProfileEffectSeed =>
        valueInt == null
            ? { name, kind: EffectKind.WEAPON, valueText: valueText ?? null, effectMode: 'REMOVE' }
            : { name, kind: EffectKind.WEAPON, valueInt, valueText: valueText ?? null, effectMode: 'REMOVE' };
    const cfx = (name: string, valueInt?: number, valueText?: string): ProfileEffectSeed =>
        valueInt == null
            ? { name, kind: EffectKind.CRITICAL, valueText: valueText ?? null, effectMode: 'ADD' }
            : { name, kind: EffectKind.CRITICAL, valueInt, valueText: valueText ?? null, effectMode: 'ADD' };
    const cfxR = (name: string, valueInt?: number, valueText?: string): ProfileEffectSeed =>
        valueInt == null
            ? { name, kind: EffectKind.CRITICAL, valueText: valueText ?? null, effectMode: 'REMOVE' }
            : { name, kind: EffectKind.CRITICAL, valueInt, valueText: valueText ?? null, effectMode: 'REMOVE' };
            

    const weaponBundles: WeaponBundle[] = [
        {
            name: 'Short Hunting Rifle',
            base: { baseType: 'Rifle (14")', baseTest: '3P' },
            baseEffects: [cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (14")', testOverride: '4P', partsOverride: 4, ratingDelta: 6 },
                { order: 2, typeOverride: 'Rifle (14")', testOverride: '4P', partsOverride: 3, ratingDelta: 8, effects: [wfx('Fast')] },
            ],
        },
        {
            name: '10mm Pistol',
            base: { baseType: 'Pistol (10")', baseTest: '3A' },
            baseEffects: [wfx('CQB'), wfx('Fast')],
            profiles: [
                { order: 1, typeOverride: 'Pistol (14")', testOverride: null, partsOverride: 2, ratingDelta: 4 },
                { order: 2, typeOverride: null, testOverride: '4A', partsOverride: 4, ratingDelta: 6 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 5, effects: [cfx('Suppress', 1)] },
            ],
        },
        {
            name: 'Laser Rifle',
            base: { baseType: 'Rifle (18")', baseTest: '4P' },
            baseEffects: [cfx('Ignite', 1)],
            profiles: [
                { order: 1, typeOverride: 'Rifle (22")', testOverride: null, partsOverride: 2, ratingDelta: 7 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 8, effects: [wfx('Fast')] },
            ],
        },
        {
            name: 'Plasma Rifle',
            base: { baseType: 'Rifle (18")', baseTest: '4P' },
            baseEffects: [cfx('Meltdown')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 10, effects: [cfx('Ignite', 2)] },
                { order: 2, typeOverride: 'Rifle (22")', testOverride: null, partsOverride: 3, ratingDelta: 8 },
                { order: 3, typeOverride: null, testOverride: '5P', partsOverride: 4, ratingDelta: 8 },
            ],
        },
        {
            name: 'Baseball Bat',
            base: { baseType: 'Melee', baseTest: '3S' },
            baseEffects: [wfx('Wind Up'), cfx('Suppress', 1)],
            profiles: [{ order: 1, testOverride: '4S', partsOverride: 2, ratingDelta: 5 }],
        },
        {
            name: 'Machete',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [cfx('Maim')],
            profiles: [{ order: 1, testOverride: '5S', partsOverride: 2, ratingDelta: 6 }],
        },
        {
            name: "Officer's Sword",
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Fast'), cfx('Pierce')],
            profiles: [
                { order: 1, testOverride: '5S', partsOverride: 2, ratingDelta: 6 },
                { order: 1, testOverride: null, partsOverride: 3, ratingDelta: 5, effects: [cfx('Suppress', 2)] }
            ],
        },
        {
            name: 'Hand Weapon',
            base: { baseType: 'Melee', baseTest: '3S' },
            baseEffects: [wfx('Fast')],
            profiles: [
                { order: 1, testOverride: '4S', partsOverride: 3, ratingDelta: 4 },
                { order: 2, testOverride: null, partsOverride: 3, ratingDelta: 4, effects: [cfx('Maim')] },
            ],
        },
        {
            name: 'Ripper',
            base: { baseType: 'Melee', baseTest: '5S' },
            baseEffects: [wfx('Fast'), cfx('Maim')],
            profiles: [{ order: 1, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [cfx('Pierce')] }],
        },
        {
            name: 'Sledgehammer',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Unwieldy', 5), wfx('Wind Up'), cfx('Maim')],
            profiles: [
                { order: 1, testOverride: '5S', partsOverride: 2, ratingDelta: 6 },
                { order: 2, testOverride: null, partsOverride: 3, ratingDelta: 6, effects: [cfx('Suppress', 1)] },
            ],
        },
        {
            name: 'Super Sledge',
            base: { baseType: 'Melee', baseTest: '6S' },
            baseEffects: [wfx('Unwieldy', 6), cfx('Maim')],
            profiles: [
                { order: 1, testOverride: null, partsOverride: 3, ratingDelta: 7, effects: [wfx('Wind Up')] },
                { order: 2, testOverride: null, partsOverride: 3, ratingDelta: 7, effects: [cfx('Suppress', 1)] },
            ],
        },
        {
            name: 'Claws & Jaws',
            notes: 'Cannot be modified.',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Fast'), cfx('Suppress', 1)],
        },
        {
            name: 'Deathclaw Gauntlet',
            base: { baseType: 'Melee', baseTest: '5S' },
            baseEffects: [wfx('Wind Up'), cfx('Pierce')],
            profiles: [{ order: 1, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [cfx('Maim')] }],
        },
        {
            name: 'Pole Hook',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Overwhelm'), cfx('Seize')],
            profiles: [{ order: 1, testOverride: null, partsOverride: 3, ratingDelta: 4, effects: [wfx('Wind Up')] }],
        },
        {
            name: 'Shishkebab',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [cfx('Ignite', 2)],
            profiles: [
                { order: 1, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [cfx('Ignite', 3)] },
                { order: 2, testOverride: null, partsOverride: 3, ratingDelta: 6, effects: [wfx('Fast')] },
            ],
        },
        {
            name: 'Shock Hand',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Fast'), wfx('Non-Lethal'), cfx('Suppress', 1)],
            profiles: [
                { order: 1, testOverride: null, partsOverride: 3, ratingDelta: 4, effects: [wfxR('Non-Lethal')] },
                { order: 2, testOverride: null, partsOverride: 2, ratingDelta: 2, effects: [cfx('Suppress', 2)] },
            ],
        },
        {
            name: 'Electro Suppressor',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [cfx('Suppress', 3)],
            profiles: [{ order: 1, testOverride: null, partsOverride: 1, ratingDelta: 3, effects: [wfx('Wind Up')] }],
        },
        {
            name: 'Meat Hook',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [cfx('Pierce')],
            profiles: [{ order: 1, testOverride: null, partsOverride: 3, ratingDelta: 6, effects: [cfx('Seize')] }],
        },
        {
            name: 'Assaultron Claws',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Fast'), cfx('Maim')],
            profiles: [
                { order: 1, testOverride: '5S', partsOverride: 4, ratingDelta: 6 },
                { order: 2, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [cfx('Pierce')] },
            ],
        },
        {
            name: 'Mr. Handy Buzz Blade',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Overwhelm'), wfx('Wind Up'), cfx('Pierce')],
            profiles: [{ order: 1, testOverride: '5S', partsOverride: 4, ratingDelta: 6 }],
        },
        {
            name: 'Various Appendages',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Fast'), cfx('Maim'), cfx('Suppress', 2), cfx('Tranquilize', 1)],
            profiles: [{ order: 1, testOverride: '5S', partsOverride: 4, ratingDelta: 6 }],
        },
        {
            name: 'War Glaive',
            base: { baseType: 'Melee', baseTest: '6S' },
            baseEffects: [wfx('Unwieldy', 6), wfx('Wind Up')],
            profiles: [
                { order: 1, testOverride: null, partsOverride: 5, ratingDelta: 10, effects: [cfx('Ignite', 2)] },
                { order: 2, testOverride: null, partsOverride: 7, ratingDelta: 12, effects: [cfx('Meltdown')] },
                { order: 3, testOverride: null, partsOverride: 3, ratingDelta: 5, effects: [cfx('Suppress', 2)] },
            ],
        },
        {
            name: 'Stunning Claws',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Fast'), cfx('Suppress', 2)],
            profiles: [
                { order: 1, testOverride: '5S', partsOverride: 4, ratingDelta: 6 },
                { order: 2, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [cfx('Maim')] },
            ],
        },
        {
            name: 'Stun Baton',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [cfx('Suppress', 2)],
            profiles: [{ order: 1, testOverride: null, partsOverride: 2, ratingDelta: 6, effects: [wfx('Wind Up')] }],
        },
        {
            name: 'Mothman Sonic Wave',
            notes: 'Cannot be modified.',
            base: { baseType: 'Melee', baseTest: '5S' },
            baseEffects: [wfx('Pulse'), cfx('Maim')],
        },
        {
            name: 'Robot Bash',
            notes: 'Cannot be modified.',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [],
        },
        {
            name: 'Trample',
            notes: 'Cannot be modified.',
            base: { baseType: 'Melee', baseTest: '4S' },
            baseEffects: [wfx('Wind Up'), cfx('Pushback', 3)],
        },
        {
            name: '.44 Pistol',
            base: { baseType: 'Pistol (14")', baseTest: '4A' },
            baseEffects: [wfx('Aim', 1), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Pistol (18")', testOverride: null, partsOverride: 3, ratingDelta: 10 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 6, effects: [wfx('Aim', 2)] },
            ],
        },
        {
            name: 'Crusader Pistol',
            base: { baseType: 'Pistol (12")', baseTest: '4A' },
            baseEffects: [cfx('Maim')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 7, effects: [cfx('Ignite', 1)] },
                { order: 2, typeOverride: null, testOverride: '5A', partsOverride: 2, ratingDelta: 6 },
            ],
        },
        {
            name: 'Heavy Pipe Pistol',
            base: { baseType: 'Pistol (8")', baseTest: '4A' },
            baseEffects: [wfx('CQB'), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Pistol (12")', testOverride: null, partsOverride: 3, ratingDelta: 4 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 4, effects: [wfxR('CQB')] },
            ],
        },
        {
            name: 'Laser Pistol',
            base: { baseType: 'Pistol (10")', baseTest: '3A' },
            baseEffects: [wfx('CQB'), cfx('Ignite', 2)],
            profiles: [
                { order: 1, typeOverride: 'Pistol (14")', testOverride: null, partsOverride: 2, ratingDelta: 3 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 7, effects: [wfx('Fast')] },
            ],
        },
        {
            name: 'Pipe Revolver',
            base: { baseType: 'Pistol (12")', baseTest: '3A' },
            baseEffects: [wfx('Aim', 1), wfx('CQB'), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Pistol (16")', testOverride: null, partsOverride: 2, ratingDelta: 3 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 4, effects: [wfxR('CQB')] },
            ],
        },
        {
            name: 'Pipe Pistol',
            base: { baseType: 'Pistol (8")', baseTest: '4A' },
            baseEffects: [wfx('CQB')],
            profiles: [
                { order: 1, typeOverride: 'Pistol (12")', testOverride: null, partsOverride: 2, ratingDelta: 3 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 3, effects: [wfx('Aim', 1)] },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 3, effects: [cfx('Suppress', 1)] },
            ],
        },
        {
            name: 'Plasma Pistol',
            base: { baseType: 'Pistol (12")', baseTest: '4A' },
            baseEffects: [wfx('CQB'), wfx('Fast'), cfx('Meltdown')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 10, effects: [cfx('Ignite', 2)] },
                { order: 2, typeOverride: 'Pistol (16")', testOverride: null, partsOverride: 3, ratingDelta: 8 },
                { order: 3, typeOverride: null, testOverride: '5A', partsOverride: 4, ratingDelta: 8 },
            ],
        },
        {
            name: 'Gamma Gun',
            base: { baseType: 'Pistol (8")', baseTest: '3A' },
            baseEffects: [wfx('CQB'), cfx('Poison', 2)],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '4A', partsOverride: 3, ratingDelta: 8 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 6, effects: [cfx('Poison', 3)] },
            ],
        },
        {
            name: 'Alien Blaster',
            base: { baseType: 'Pistol (12")', baseTest: '4A' },
            baseEffects: [wfx('Slow'), cfx('Meltdown')],
            profiles: [
                { order: 1, typeOverride: 'Pistol (14")', testOverride: null, partsOverride: 3, ratingDelta: 4 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 10, effects: [wfxR('Slow')] },
            ],
        },
        {
            name: 'Alien Laser',
            base: { baseType: 'Pistol (14")', baseTest: '3A' },
            baseEffects: [cfx('Ignite', 2)],
            profiles: [
                { order: 1, typeOverride: 'Pistol (16")', testOverride: null, partsOverride: 2, ratingDelta: 3 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [wfx('Fast')] },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 10, effects: [cfx('Ignite', 3)] },
            ],
        },
        {
            name: 'Assaultron Eye Beam',
            base: { baseType: 'Pistol (5")', baseTest: '5A' },
            baseEffects: [wfx('CQB'), wfx('Running Shot'), wfx('Slow'), cfx('Maim')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 4, effects: [wfxR('CQB')] },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 4, effects: [wfxR('Slow')]},
            ],
        },
        {
            name: 'Eyebot Laser',
            base: { baseType: 'Pistol (10")', baseTest: '3A' },
            baseEffects: [wfx('CQB'), cfx('Ignite', 1)],
            profiles: [
                { order: 1, typeOverride: 'Pistol (14")', testOverride: null, partsOverride: 2, ratingDelta: 4 },
                { order: 2, typeOverride: null, testOverride: '3A', partsOverride: 2, ratingDelta: 4, effects: [wfxR('CQB')] },
            ],
        },
        {
            name: 'Silenced 10mm Pistol',
            base: { baseType: 'Pistol (10")', baseTest: '3A' },
            baseEffects: [wfx('CQB'), wfx('Fast'), wfx('Silenced')],
            profiles: [
                { order: 1, typeOverride: 'Pistol (14")', testOverride: null, partsOverride: 2, ratingDelta: 4 },
                { order: 2, typeOverride: null, testOverride: '4A', partsOverride: 4, ratingDelta: 6 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 5, effects: [cfx('Suppress', 1)] },
            ],
        },
        {
            name: 'Toxin Blaster',
            base: { baseType: 'Pistol (12")', baseTest: '3A' },
            baseEffects: [wfx('CQB'), cfx('Poison', 2)],
            profiles: [
                { order: 1, typeOverride: 'Pistol (14")', testOverride: null, partsOverride: 2, ratingDelta: 3 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 4, effects: [wfxR('CQB')] },
            ],
        },
        {
            name: 'Cryo Blaster',
            base: { baseType: 'Pistol (12")', baseTest: '2A' },
            baseEffects: [wfx('CQB'), wfx('Fast'), cfx('Suppress', 2)],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '3A', partsOverride: 4, ratingDelta: 6 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 4, effects: [wfx('Fast'), wfxR('CQB')] },
            ],
        },
        {
            name: 'Flame Breath',
            notes: 'Cannot be modified.',
            base: { baseType: 'Pistol (6")', baseTest: '3A' },
            baseEffects: [wfx('Area', 1), wfx('CQB'), cfx('Ignite', 2)],
        },
        {
            name: 'Frost Breath',
            notes: 'Cannot be modified.',
            base: { baseType: 'Pistol (6")', baseTest: '4A' },
            baseEffects: [wfx('Area', 1), wfx('CQB'), cfx('Suppress', 2)],
        },
        {
            name: 'Hatchling Screech',
            notes: 'Cannot be modified.',
            base: { baseType: 'Pistol (8")', baseTest: '4A' },
            baseEffects: [wfx('CQB'), cfx('Pushback', 1)],
        },
        {
            name: 'Mesmetron',
            notes: 'Cannot be modified.',
            base: { baseType: 'Pistol (10")', baseTest: '2A' },
            baseEffects: [wfx('CQB'), wfx('Non-Lethal'), cfx('Suppress', 3)],
        },
        {
            name: 'Mothman Sonic Screech',
            notes: 'Cannot be modified.',
            base: { baseType: 'Pistol (10")', baseTest: '5A' },
            baseEffects: [cfx('Pushback', 1)],
        },
        {
            name: 'Assault Rifle',
            base: { baseType: 'Rifle (20")', baseTest: '4P' },
            baseEffects: [wfx('Storm', 1), cfx('Maim')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '5P', partsOverride: 3, ratingDelta: 8 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 12, effects: [wfx('Fast')] },
            ],
        },
        {
            name: 'Double-Barreled Shotgun',
            base: { baseType: 'Rifle (12")', baseTest: '3P' },
            baseEffects: [wfx('Storm', 2), cfx('Maim')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 6, ratingDelta: 8, effects: [wfx('Storm', 3)] },
            ],
        },
        {
            name: 'Automatic Pipe Rifle',
            base: { baseType: 'Rifle (16")', baseTest: '3P' },
            baseEffects: [wfx('Aim', 1), wfx('Storm', 1), cfx('Suppress', 2)],
            profiles: [
                { order: 1, typeOverride: 'Rifle (20")', testOverride: null, partsOverride: 2, ratingDelta: 5 },
                { order: 2, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
            ],
        },
        {
            name: 'Hunting Rifle',
            base: { baseType: 'Rifle (22")', baseTest: '3P' },
            baseEffects: [wfx('Aim', 1), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (26")', testOverride: null, partsOverride: 2, ratingDelta: 6 },
                { order: 2, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 8, effects: [wfx('Aim', 2)] },
            ],
        },
        {
            name: 'Combat Rifle',
            base: { baseType: 'Rifle (24")', baseTest: '4P' },
            baseEffects: [wfx('Fast'), cfx('Maim')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (30")', testOverride: null, partsOverride: 3, ratingDelta: 9 },
                { order: 2, typeOverride: null, testOverride: '5P', partsOverride: 3, ratingDelta: 10 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 6, effects: [wfx('Bladed')] },
            ],
        },
        {
            name: 'Pipe Rifle',
            base: { baseType: 'Rifle (20")', baseTest: '3P' },
            baseEffects: [wfx('Aim', 1), cfx('Suppress', 1)],
            profiles: [
                { order: 1, typeOverride: 'Rifle (24")', testOverride: null, partsOverride: 3, ratingDelta: 6 },
                { order: 2, typeOverride: null, testOverride: '4P', partsOverride: 3, ratingDelta: 6 },
            ],
        },
        {
            name: 'Recon Hunting Rifle',
            base: { baseType: 'Rifle (24")', baseTest: '4P' },
            baseEffects: [wfx('Aim', 1), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (28")', testOverride: null, partsOverride: 2, ratingDelta: 6 },
                { order: 2, typeOverride: null, testOverride: '5P', partsOverride: 4, ratingDelta: 8 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 8, effects: [wfx('Aim', 2)] },
            ],
        },
        {
            name: 'Pipe Bolt-Action Rifle',
            base: { baseType: 'Rifle (20")', baseTest: '3P' },
            baseEffects: [wfx('Aim', 1), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 6, effects: [wfx('Aim', 2)] },
            ],
        },
        {
            name: 'Sawn-Off Shotgun',
            base: { baseType: 'Rifle (8")', baseTest: '4P' },
            baseEffects: [wfx('CQB'), wfx('Storm', 2), cfx('Maim')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (10")', testOverride: null, partsOverride: 3, ratingDelta: 6 },
                { order: 2, typeOverride: null, testOverride: '5P', partsOverride: 4, ratingDelta: 8, effects: [wfx('Storm', 1)] },
            ],
        },
        {
            name: 'Precision Pipe Rifle',
            base: { baseType: 'Rifle (20")', baseTest: '3P' },
            baseEffects: [wfx('Aim', 2), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (24")', testOverride: null, partsOverride: 3, ratingDelta: 6 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 6, effects: [wfx('Aim', 3)] },
            ],
        },
        {
            name: 'Robot Lasers',
            base: { baseType: 'Rifle (16")', baseTest: '4P' },
            baseEffects: [cfx('Suppress', 1)],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [wfx('Fast')] },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [cfx('Suppress', 2)] },
            ],
        },
        {
            name: 'Syringer',
            base: { baseType: 'Rifle (16")', baseTest: '2P' },
            baseEffects: [wfx('Aim', 2), cfx('Poison', 3)],
            profiles: [
                { order: 1, typeOverride: 'Rifle (20")', testOverride: null, partsOverride: 4, ratingDelta: 15 },
                { order: 2, typeOverride: null, testOverride: '3P', partsOverride: 3, ratingDelta: 8 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 10, effects: [cfx('Suppress', 3)] },
            ],
        },
        {
            name: "Ranger's Hunting Rifle",
            base: { baseType: 'Rifle (18")', baseTest: '3P' },
            baseEffects: [wfx('Aim', 1), wfx('Bladed'), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (22")', testOverride: null, partsOverride: 2, ratingDelta: 7 },
                { order: 2, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 8, effects: [wfx('Aim', 2)] },
            ],
        },
        {
            name: 'Radium Rifle',
            base: { baseType: 'Rifle (14")', baseTest: '3P' },
            baseEffects: [wfx('Storm', 2), cfx('Poison', 2)],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 6, effects: [cfx('Poison', 3)] },
            ],
        },
        {
            name: 'Precision Combat Rifle',
            base: { baseType: 'Rifle (30")', baseTest: '4P' },
            baseEffects: [wfx('Aim', 2), cfx('Suppress', 2)],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '5P', partsOverride: 3, ratingDelta: 10 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 6, effects: [wfx('Bladed')] },
            ],
        },
        {
            name: 'Precision Hunting Rifle',
            base: { baseType: 'Rifle (24")', baseTest: '3P' },
            baseEffects: [wfx('Aim', 2), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (30")', testOverride: null, partsOverride: 3, ratingDelta: 4 },
                { order: 2, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 10, effects: [wfx('Aim', 3)] },
            ],
        },
        {
            name: 'Nail Gun',
            base: { baseType: 'Rifle (12")', baseTest: '3P' },
            baseEffects: [wfx('CQB'), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 2, ratingDelta: 4, effects: [wfxR('CQB')] },
            ],
        },
        {
            name: 'Light Handmade Rifle',
            base: { baseType: 'Rifle (12")', baseTest: '3P' },
            baseEffects: [wfx('Bladed'), cfx('Suppress', 1)],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 5, effects: [cfx('Suppress', 2)] },
                { order: 2, typeOverride: null, testOverride: '4P', partsOverride: 4, ratingDelta: 8 },
            ],
        },
        {
            name: "Marksman's Handmade Rifle",
            base: { baseType: 'Rifle (30")', baseTest: '2P' },
            baseEffects: [wfx('Aim', 3), cfx('Suppress', 3)],
            profiles: [
                { order: 1, typeOverride: 'Rifle (36")', testOverride: null, partsOverride: 2, ratingDelta: 6 },
                { order: 2, typeOverride: null, testOverride: '3P', partsOverride: 4, ratingDelta: 5 },
            ],
        },
        {
            name: 'Hardened Sniper Rifle',
            base: { baseType: 'Rifle (36")', baseTest: '2P' },
            baseEffects: [wfx('Aim', 3), cfx('Showstopper')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '3P', partsOverride: 8, ratingDelta: 10 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 8, ratingDelta: 10, effects: [cfx('Pierce')] },
            ],
        },
        {
            name: 'Lever-Action Rifle',
            base: { baseType: 'Rifle (16")', baseTest: '3P' },
            baseEffects: [wfx('Fast')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '4P', partsOverride: 3, ratingDelta: 8 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 5, effects: [cfx('Pierce')] },
            ],
        },
        {
            name: 'Combat Shotgun',
            base: { baseType: 'Rifle (10")', baseTest: '4P' },
            baseEffects: [wfx('Storm', 1), cfx('Maim')],
            profiles: [
                { order: 1, typeOverride: 'Rifle (14")', testOverride: null, partsOverride: 4, ratingDelta: 10 },
                { order: 2, typeOverride: null, testOverride: '5P', partsOverride: 5, ratingDelta: 12 },
                { order: 3, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 8, effects: [wfx('Fast')] },
            ],
        },
        {
            name: 'Handmade Rifle',
            base: { baseType: 'Rifle (18")', baseTest: '4P' },
            baseEffects: [cfx('Suppress', 2)],
            profiles: [
                { order: 1, typeOverride: 'Rifle (22")', testOverride: null, partsOverride: 2, ratingDelta: 8 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 10, effects: [cfx('Suppress', 3)] },
                { order: 3, typeOverride: null, testOverride: '5P', partsOverride: 3, ratingDelta: 8 },
            ],
        },
        {
            name: 'Alien Disintegrator',
            base: { baseType: 'Rifle (16")', baseTest: '5P' },
            baseEffects: [wfx('CQB'), cfx('Meltdown')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 6, effects: [wfx('Aim', 1)] },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 7, ratingDelta: 12, effects: [wfxR('CQB')] },
            ],
        },
        {
            name: 'Automatic Handmade Rifle',
            base: { baseType: 'Rifle (14")', baseTest: '3P' },
            baseEffects: [wfx('Storm', 2), cfx('Suppress', 2)],
            profiles: [
                { order: 1, typeOverride: 'Rifle (18")', testOverride: null, partsOverride: 2, ratingDelta: 5 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 4, ratingDelta: 8, effects: [cfx('Maim')] },
            ],
        },
        {
            name: 'Flamer',
            base: { baseType: 'Heavy (6")', baseTest: '4S' },
            baseEffects: [wfx('Area', 2), wfx('CQB'), cfx('Ignite', 3)],
            profiles: [
                { order: 1, typeOverride: null, testOverride: '5S', partsOverride: 4, ratingDelta: 11 },
                { order: 2, typeOverride: 'Heavy (9")', testOverride: null, partsOverride: 5, ratingDelta: 12 },
            ],
        },
        {
            name: 'Junk Jet',
            base: { baseType: 'Heavy (10")', baseTest: '3S' },
            baseEffects: [wfx('Creative Projectiles'), cfx('Suppress', 1)],
            profiles: [
                { order: 1, typeOverride: 'Heavy (14")', testOverride: null, partsOverride: 3, ratingDelta: 5 },
                { order: 2, typeOverride: null, testOverride: '4S', partsOverride: 3, ratingDelta: 5, effects: [cfx('Suppress', 2)] },
            ],
        },
        {
            name: 'Gatling Laser',
            base: { baseType: 'Heavy (16")', baseTest: '4S' },
            baseEffects: [wfx('Area', 1), wfx('Slow'), cfx('Ignite', 2)],
            profiles: [
                { order: 1, typeOverride: 'Heavy (20")', testOverride: null, partsOverride: 5, ratingDelta: 12 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 12, effects: [wfx('Selective Fire', undefined, 'Area (1”), Storm (3")'), wfxR('Area', 1)] },
            ],
        },
        {
            name: 'Minigun',
            base: { baseType: 'Heavy (14")', baseTest: '4S' },
            baseEffects: [wfx('Slow'), wfx('Storm', 3), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 12, effects: [wfx('Selective Fire', undefined, 'Area (1”), Storm (3")'), wfxR('Storm', 3)] },
            ],
        },
        {
            name: 'Missile Launcher',
            base: { baseType: 'Heavy (26")', baseTest: '4S' },
            baseEffects: [wfx('Area', 2), wfx('Slow'), cfx('Maim')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 12, effects: [cfx('Suppress', 2)] },
                { order: 2, typeOverride: null, testOverride: '6S', partsOverride: 3, ratingDelta: 6, effects: [wfxR('Area', 2)] },
            ],
        },
        {
            name: 'Harpoon Gun',
            base: { baseType: 'Heavy (16")', baseTest: '5S' },
            baseEffects: [wfx('Aim', 1), wfx('Slow'), cfx('Haul', 3)],
            profiles: [
                { order: 1, typeOverride: 'Heavy (20")', testOverride: null, partsOverride: 5, ratingDelta: 12 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 12, effects: [cfx('Maim')] },
            ],
        },
        {
            name: 'Incinerator',
            base: { baseType: 'Heavy (10")', baseTest: '4S' },
            baseEffects: [wfx('Area', 1), wfx('CQB'), cfx('Ignite', 3)],
            profiles: [
                { order: 1, typeOverride: 'Heavy (14")', testOverride: null, partsOverride: 4, ratingDelta: 11 },
                { order: 2, typeOverride: null, testOverride: '5S', partsOverride: 5, ratingDelta: 12 },
            ],
        },
        {
            name: 'Barbed Harpoon Gun',
            base: { baseType: 'Heavy (16")', baseTest: '6S' },
            baseEffects: [wfx('Aim', 1), wfx('Slow'), cfx('Pierce')],
            profiles: [
                { order: 1, typeOverride: null, testOverride: null, partsOverride: 3, ratingDelta: 8, effects: [wfx('Aim', 2)] },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 12, effects: [cfx('Haul', 2)] },
            ],
        },
        {
            name: 'Flechette Harpoon Gun',
            base: { baseType: 'Heavy (10")', baseTest: '5S' },
            baseEffects: [wfx('Slow'), wfx('Storm', 3)],
            profiles: [
                { order: 1, typeOverride: 'Heavy (12")', testOverride: null, partsOverride: 4, ratingDelta: 10 },
                { order: 2, typeOverride: null, testOverride: null, partsOverride: 5, ratingDelta: 12, effects: [cfx('Maim')] },
            ],
        },
        {
            name: 'Baseball Grenades',
            base: { baseType: 'Grenade (8")', baseTest: '3A' },
            baseEffects: [wfx('Area', 2), wfx('Big Swing', 6), wfx('CQB'), cfx('Suppress', 1)],
        },
        {
            name: 'Molotov Cocktails',
            base: { baseType: 'Grenade (8")', baseTest: '2A' },
            baseEffects: [wfx('Area', 2), wfx('CQB'), cfx('Ignite', 2)],
        },
        {
            name: 'Plasma Grenades',
            base: { baseType: 'Grenade (8")', baseTest: '4A' },
            baseEffects: [wfx('Area', 2), wfx('CQB')],
        },
        {
            name: 'Nuka Grenade',
            base: { baseType: 'Grenade (8")', baseTest: '5A' },
            baseEffects: [wfx('Area', 2), wfx('CQB'), wfx('Irradiate'), wfx('One & Done')],
        },
        {
            name: 'Predator Grenades',
            base: { baseType: 'Grenade (8")', baseTest: '4A' },
            baseEffects: [wfx('Area', 3), wfx('CQB'), cfx('Maim')],
        },
        {
            name: 'Frag Grenades',
            base: { baseType: 'Grenade (10")', baseTest: '3A' },
            baseEffects: [wfx('Area', 1), wfx('CQB'), cfx('Suppress', 2)],
        },
        {
            name: 'Centaur Spit',
            base: { baseType: 'Grenade (10")', baseTest: '2A' },
            baseEffects: [wfx('Area', 1), wfx('CQB'), wfx('Irradiate'), wfx('Slow')],
        },
    ];

    const weaponIds = new Map<string, string>();
    const seenWeaponNames = new Set<string>();
    for (const bundle of weaponBundles) {
        if (seenWeaponNames.has(bundle.name)) {
            throw new Error(`Duplicate weapon in seed: ${bundle.name}`);
        }
        seenWeaponNames.add(bundle.name);
        const template = await upsertWeaponBundle(bundle, effectIds);
        weaponIds.set(bundle.name, template.id);
    }


    const mustWeaponId = (name: string): string => {
        const id = weaponIds.get(name);
        if (!id) throw new Error(`Required seed weapon is missing: ${name}`);
        return id;
    };

    if (!seedCoreData) {
        console.log('INFO: Seed demo factions/units skipped: database is not empty.');
        console.log('INFO: Seed demo factions/units skipped: database is not empty.');
        return;
    }

    /* 4) FACTION */
    const brotherhoodOfSteel = await upsertFactionFull({
        name: 'Brotherhood of Steel',
        goalSets: [
            {
                name: 'AD VICTORIAM',
                goals: [
                    { tier: 1, description: 'You use a standard Ploy.', target: 3 },
                    { tier: 1, description: 'You win a game as the Underdog.', target: 1 },
                    { tier: 1, description: 'Your crew gains at least 4 XP in a single game.', target: 3 },
                    { tier: 2, description: 'One of your models Incapacitates an Enemy model with a Ranged Attack.', target: 10 },
                    { tier: 2, description: 'You play a game as the Attacker.', target: 3 },
                    { tier: 2, description: 'Your crew has at least 6 Reach.', target: 1 },
                    { tier: 3, description: 'One of your models Incapacitates an Enemy Leader with a Ranged Attack.', target: 3 },
                    { tier: 3, description: 'At the end of the Story Phase, you have 6 Facilities on your Home Turf.', target: 3 },
                    { tier: 3, description: 'In a game against you, an Enemy model Fails a Confusion Test.', target: 6 },
                ],
            },
            {
                name: 'BY STEEL',
                goals: [
                    { tier: 1, description: 'You use the Recruit Story Action to purchase a Knight.', target: 1 },
                    { tier: 1, description: 'You use the Vertibird Drop Ploy.', target: 3 },
                    { tier: 1, description: 'You choose to play the Duel Objective.', target: 1 },
                    { tier: 2, description: 'You use the Recruit Story Action to purchase a Knight.', target: 1 },
                    { tier: 2, description: 'You use the Judge Captives Story Action.', target: 1 },
                    { tier: 2, description: 'One of your models passes a Confusion Test.', target: 6 },
                    { tier: 3, description: 'You use the Recruit Story Action to purchase a Knight.', target: 1 },
                    { tier: 3, description: 'At least 5 of your models have a Perk that they did not start the campaign with.', target: 1 },
                    { tier: 3, description: 'One of your models Incapacitates an Enemy Champion with a Ranged Attack.', target: 8 },
                ],
            },
            {
                name: 'PROTECT HUMANITY FROM ITSELF',
                goals: [
                    { tier: 1, description: 'A Scribe ends a game without being Incapacitated.', target: 6 },
                    { tier: 1, description: 'You use the Chain that Binds Ploy.', target: 3 },
                    { tier: 1, description: 'A model in your crew chooses Find Caps and Parts when making a Rummage Action.', target: 8 },
                    { tier: 2, description: 'A Scribe in your crew gains a Perk.', target: 4 },
                    { tier: 2, description: 'You modify a weapon.', target: 4 },
                    { tier: 2, description: 'Your crew Incapacitates a model with at least one Weapon Modification.', target: 4 },
                    { tier: 3, description: 'A Scribe in your crew has 9 Intelligence.', target: 1 },
                    { tier: 3, description: 'A Scribe chooses to gain Caps and Parts when they make the Rummage Action.', target: 8 },
                    { tier: 3, description: 'Your crew has 6 Facilities on their Home Turf.', target: 3 },
                ],
            },
        ],
        upgradeRules: [
            { statKey: 'hp', ratingPerPoint: 12 },
            { statKey: 'S', ratingPerPoint: 7 },
            { statKey: 'P', ratingPerPoint: 7 },
            { statKey: 'E', ratingPerPoint: 9 },
            { statKey: 'C', ratingPerPoint: 5 },
            { statKey: 'I', ratingPerPoint: 5 },
            { statKey: 'A', ratingPerPoint: 7 },
            { statKey: 'L', ratingPerPoint: 9 },
        ],
        limits: [
            { tag: 'UPGRADE LIMIT PER MODEL', tier1: 4, tier2: 6, tier3: 8 },
            { tag: 'CHAMPION LIMIT', tier1: 3, tier2: 4, tier3: 5 },
            { tag: 'FACILITY LIMIT', tier1: 2, tier2: 4, tier3: 6 },
        ],
    });

    /* 5) UNIT TEMPLATES + WEAPON SETS */
    const paladin = await upsertUnitTemplate('Paladin', {
        factionId: brotherhoodOfSteel.id,
        roleTag: 'CHAMPION',
        isLeader: true,
        baseRating: 0,
        hp: 4, s: 7, p: 5, e: 7, c: 6, i: 5, a: 4, l: 2,
    });
    await setUnitStartPerks(paladin.id, ['NATURAL LEADER', 'POWER ARMOR']);
    await replaceUnitOptions(paladin.id, [
        { weapon1Id: mustWeaponId('Flamer'), costCaps: 67, rating: 67 },
        { weapon1Id: mustWeaponId('Gatling Laser'), costCaps: 72, rating: 72 },
        { weapon1Id: mustWeaponId('Minigun'), costCaps: 79, rating: 79 },
    ]);

    const fieldScribe = await upsertUnitTemplate('Field Scribe', {
        factionId: brotherhoodOfSteel.id,
        roleTag: 'CHAMPION',
        isLeader: false,
        baseRating: 0,
        hp: 2, s: 3, p: 4, e: 4, c: 3, i: 6, a: 4, l: 2,
    });
    await setUnitStartPerks(fieldScribe.id, ['SPOTTER']);
    await replaceUnitOptions(fieldScribe.id, [
        { weapon1Id: mustWeaponId('Laser Pistol'), costCaps: 21, rating: 21 },
        { weapon1Id: mustWeaponId('10mm Pistol'), costCaps: 26, rating: 26 },
        { weapon1Id: mustWeaponId('Crusader Pistol'), costCaps: 31, rating: 31 },
    ]);

    const knight = await upsertUnitTemplate('Knight', {
        factionId: brotherhoodOfSteel.id,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 3, s: 6, p: 5, e: 6, c: 4, i: 4, a: 4, l: 2,
    });
    await setUnitStartPerks(knight.id, ['POWER ARMOR']);
    await replaceUnitOptions(knight.id, [
        { weapon1Id: mustWeaponId('Laser Pistol'), weapon2Id: mustWeaponId('Machete'), costCaps: 50, rating: 50 },
        { weapon1Id: mustWeaponId('Ripper'), costCaps: 55, rating: 55 },
        { weapon1Id: mustWeaponId('Laser Rifle'), costCaps: 60, rating: 60 },
    ]);

    const aspirant = await upsertUnitTemplate('Aspirant', {
        factionId: brotherhoodOfSteel.id,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 1, s: 4, p: 5, e: 5, c: 4, i: 4, a: 4, l: 2,
    });
    await setUnitStartPerks(aspirant.id, []);
    await replaceUnitOptions(aspirant.id, [
        { weapon1Id: mustWeaponId('Laser Pistol'), weapon2Id: mustWeaponId('Hand Weapon'), costCaps: 20, rating: 20 },
        { weapon1Id: mustWeaponId('Crusader Pistol'), weapon2Id: mustWeaponId('Hand Weapon'), costCaps: 23, rating: 23 },
        { weapon1Id: mustWeaponId('Combat Rifle'), costCaps: 24, rating: 24 },
        { weapon1Id: mustWeaponId('Laser Rifle'), costCaps: 25, rating: 25 },
    ]);

    const initiate = await upsertUnitTemplate('Initiate', {
        factionId: brotherhoodOfSteel.id,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 1, s: 3, p: 4, e: 4, c: 3, i: 4, a: 4, l: 2,
    });
    await setUnitStartPerks(initiate.id, ['SPRINT']);
    await replaceUnitOptions(initiate.id, [
        { weapon1Id: mustWeaponId('Recon Hunting Rifle'), costCaps: 19, rating: 19 },
        { weapon1Id: mustWeaponId('Laser Rifle'), costCaps: 23, rating: 23 },
        { weapon1Id: mustWeaponId('Combat Rifle'), costCaps: 24, rating: 24 },
    ]);

    /* 6) BROTHERHOOD SUBFACTIONS */
    const bfefPaladin = await upsertUnitTemplate('Paladin (Brotherhood First Expeditionary Force)', {
        factionId: null,
        roleTag: 'CHAMPION',
        isLeader: true,
        baseRating: 0,
        hp: 4, s: 7, p: 5, e: 7, c: 6, i: 5, a: 4, l: 2,
    });
    await setUnitStartPerks(bfefPaladin.id, ['NATURAL LEADER', 'POWER ARMOR']);
    await replaceUnitOptions(bfefPaladin.id, [
        { weapon1Id: mustWeaponId('Flamer'), costCaps: 67, rating: 67 },
        { weapon1Id: mustWeaponId('Gatling Laser'), costCaps: 72, rating: 72 },
        { weapon1Id: mustWeaponId('Laser Pistol'), weapon2Id: mustWeaponId('War Glaive'), costCaps: 64, rating: 64 },
    ]);

    const bfefKnight = await upsertUnitTemplate('Knight (Brotherhood First Expeditionary Force)', {
        factionId: null,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 3, s: 6, p: 5, e: 6, c: 4, i: 4, a: 4, l: 2,
    });
    await setUnitStartPerks(bfefKnight.id, ['POWER ARMOR']);
    await replaceUnitOptions(bfefKnight.id, [
        { weapon1Id: mustWeaponId('Laser Pistol'), weapon2Id: mustWeaponId('War Glaive'), costCaps: 56, rating: 56 },
        { weapon1Id: mustWeaponId('Ripper'), costCaps: 55, rating: 55 },
        { weapon1Id: mustWeaponId('Laser Rifle'), costCaps: 60, rating: 60 },
    ]);

    const hopeful = await upsertUnitTemplate('Hopeful', {
        factionId: null,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 1, s: 3, p: 4, e: 4, c: 3, i: 3, a: 3, l: 1,
    });
    await setUnitStartPerks(hopeful.id, []);
    await replaceUnitOptions(hopeful.id, [
        { weapon1Id: mustWeaponId('Hand Weapon'), costCaps: 8, rating: 8 },
        { weapon1Id: mustWeaponId('Pipe Revolver'), weapon2Id: mustWeaponId('Hand Weapon'), costCaps: 14, rating: 14 },
        { weapon1Id: mustWeaponId('Double-Barreled Shotgun'), costCaps: 15, rating: 15 },
        { weapon1Id: mustWeaponId('Pipe Bolt-Action Rifle'), costCaps: 16, rating: 16 },
    ]);

    const brotherhoodFirstExpeditionaryForce = await upsertSubfaction(brotherhoodOfSteel.id, 'Brotherhood First Expeditionary Force');
    await replaceSubfactionUnitRules(brotherhoodFirstExpeditionaryForce.id, {
        allowUnitIds: [bfefPaladin.id, bfefKnight.id, hopeful.id],
        denyUnitIds: [paladin.id, knight.id, aspirant.id],
    });

    const lyonKnight = await upsertUnitTemplate("Knight (Lyon's Brotherhood)", {
        factionId: null,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 3, s: 6, p: 5, e: 6, c: 4, i: 4, a: 4, l: 2,
    });
    await setUnitStartPerks(lyonKnight.id, ['POWER ARMOR']);
    await replaceUnitOptions(lyonKnight.id, [
        { weapon1Id: mustWeaponId('Laser Pistol'), weapon2Id: mustWeaponId('Machete'), costCaps: 50, rating: 50 },
        { weapon1Id: mustWeaponId('Ripper'), costCaps: 55, rating: 55 },
        { weapon1Id: mustWeaponId('Laser Rifle'), costCaps: 60, rating: 60 },
        { weapon1Id: mustWeaponId('Flamer'), costCaps: 60, rating: 60 },
        { weapon1Id: mustWeaponId('Gatling Laser'), costCaps: 65, rating: 65 },
        { weapon1Id: mustWeaponId('Minigun'), costCaps: 70, rating: 70 },
    ]);

    const headScribe = await upsertUnitTemplate('Head Scribe', {
        factionId: null,
        roleTag: 'CHAMPION',
        isLeader: true,
        baseRating: 0,
        hp: 3, s: 4, p: 5, e: 4, c: 5, i: 7, a: 5, l: 3,
    });
    await setUnitStartPerks(headScribe.id, ['LUCKY CHARM', 'NATURAL LEADER', 'SPOTTER']);
    await replaceUnitOptions(headScribe.id, [
        { weapon1Id: mustWeaponId('Laser Pistol'), costCaps: 32, rating: 32 },
        { weapon1Id: mustWeaponId('10mm Pistol'), costCaps: 37, rating: 37 },
        { weapon1Id: mustWeaponId('Crusader Pistol'), costCaps: 41, rating: 41 },
    ]);

    const lyonsBrotherhood = await upsertSubfaction(brotherhoodOfSteel.id, "Lyon's Brotherhood");
    await replaceSubfactionUnitRules(lyonsBrotherhood.id, {
        allowUnitIds: [lyonKnight.id, headScribe.id],
        denyUnitIds: [paladin.id, knight.id],
    });

    const outcastPaladin = await upsertUnitTemplate('Paladin (Brotherhood Outcasts)', {
        factionId: null,
        roleTag: 'CHAMPION',
        isLeader: true,
        baseRating: 0,
        hp: 4, s: 7, p: 5, e: 7, c: 6, i: 5, a: 4, l: 2,
    });
    await setUnitStartPerks(outcastPaladin.id, ['NATURAL LEADER', 'POWER ARMOR']);
    await replaceUnitOptions(outcastPaladin.id, [
        { weapon1Id: mustWeaponId('Flamer'), costCaps: 67, rating: 67 },
        { weapon1Id: mustWeaponId('Gatling Laser'), costCaps: 72, rating: 72 },
        { weapon1Id: mustWeaponId('Minigun'), costCaps: 79, rating: 79 },
        { weapon1Id: mustWeaponId('Super Sledge'), costCaps: 56, rating: 56 },
        { weapon1Id: mustWeaponId('Missile Launcher'), costCaps: 82, rating: 82 },
    ]);

    const outcastKnight = await upsertUnitTemplate('Knight (Brotherhood Outcasts)', {
        factionId: null,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 3, s: 6, p: 5, e: 6, c: 4, i: 4, a: 4, l: 2,
    });
    await setUnitStartPerks(outcastKnight.id, ['POWER ARMOR']);
    await replaceUnitOptions(outcastKnight.id, [
        { weapon1Id: mustWeaponId('Laser Pistol'), weapon2Id: mustWeaponId('Machete'), costCaps: 50, rating: 50 },
        { weapon1Id: mustWeaponId('Ripper'), costCaps: 55, rating: 55 },
        { weapon1Id: mustWeaponId('Laser Rifle'), costCaps: 60, rating: 60 },
        { weapon1Id: mustWeaponId('Shishkebab'), costCaps: 56, rating: 56 },
        { weapon1Id: mustWeaponId('Combat Shotgun'), costCaps: 47, rating: 47 },
        { weapon1Id: mustWeaponId('Plasma Rifle'), costCaps: 63, rating: 63 },
    ]);

    const defender = await upsertUnitTemplate('Defender', {
        factionId: null,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 2, s: 5, p: 4, e: 5, c: 4, i: 4, a: 4, l: 2,
    });
    await setUnitStartPerks(defender.id, ['POWER ARMOR']);
    await replaceUnitOptions(defender.id, [
        { weapon1Id: mustWeaponId('Combat Shotgun'), costCaps: 34, rating: 34 },
        { weapon1Id: mustWeaponId('Assault Rifle'), costCaps: 40, rating: 40 },
        { weapon1Id: mustWeaponId('Laser Pistol'), weapon2Id: mustWeaponId('Ripper'), costCaps: 44, rating: 44 },
    ]);

    const brotherhoodOutcasts = await upsertSubfaction(brotherhoodOfSteel.id, 'Brotherhood Outcasts');
    await replaceSubfactionUnitRules(brotherhoodOutcasts.id, {
        allowUnitIds: [outcastPaladin.id, outcastKnight.id, defender.id],
        denyUnitIds: [paladin.id, knight.id, initiate.id],
    });

    const knightCaptain = await upsertUnitTemplate('Knight Captain', {
        factionId: null,
        roleTag: 'CHAMPION',
        isLeader: true,
        baseRating: 0,
        hp: 3, s: 4, p: 6, e: 5, c: 5, i: 5, a: 5, l: 3,
    });
    await setUnitStartPerks(knightCaptain.id, ['NATURAL LEADER']);
    await replaceUnitOptions(knightCaptain.id, [
        { weapon1Id: mustWeaponId('Precision Combat Rifle'), costCaps: 39, rating: 39 },
        { weapon1Id: mustWeaponId('Silenced 10mm Pistol'), weapon2Id: mustWeaponId('Hunting Rifle'), costCaps: 44, rating: 44 },
    ]);

    const knightJourneyman = await upsertUnitTemplate('Knight Journeyman', {
        factionId: null,
        roleTag: 'GRUNT',
        isLeader: false,
        baseRating: 0,
        hp: 1, s: 4, p: 4, e: 5, c: 4, i: 4, a: 5, l: 2,
    });
    await setUnitStartPerks(knightJourneyman.id, []);
    await replaceUnitOptions(knightJourneyman.id, [
        { weapon1Id: mustWeaponId('Precision Combat Rifle'), costCaps: 26, rating: 26 },
        { weapon1Id: mustWeaponId('Hand Weapon'), weapon2Id: mustWeaponId('Precision Combat Rifle'), costCaps: 28, rating: 28 },
        { weapon1Id: mustWeaponId('Silenced 10mm Pistol'), weapon2Id: mustWeaponId('Hunting Rifle'), costCaps: 30, rating: 30 },
    ]);

    const brotherhoodReconSquad = await upsertSubfaction(brotherhoodOfSteel.id, 'Brotherhood Recon Squad');
    await replaceSubfactionUnitRules(brotherhoodReconSquad.id, {
        allowUnitIds: [knightCaptain.id, knightJourneyman.id],
        denyUnitIds: [paladin.id, knight.id],
    });

    console.log('Seed OK: admin, effects, weapons, Brotherhood of Steel, unit templates.');
}
main()
    .catch((e) => {
        console.error('Ä‚â€žĂ˘â‚¬ĹˇÄ‚â€ąĂ‚ÂÄ‚â€žĂ„â€¦Ä‚â€žĂ˘â‚¬ĹľÄ‚â€žĂ„â€¦Ă„Ä…Ă‹â€ˇ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
