import {
    EffectKind,
    PerkBehavior,
    PerkCategory,
    PrismaClient,
    UnitTemplateTag,
} from '@prisma/client';
import { existsSync } from 'node:fs';

function loadEnvForNodeScript(): void {
    const runtimeProcess = process as unknown as { loadEnvFile?: (path?: string) => void };
    if (typeof runtimeProcess.loadEnvFile === 'function') {
        runtimeProcess.loadEnvFile('.env');
    }
}

function expandEnvVariables(value: string): string {
    return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_match, key: string) => process.env[key] ?? '');
}

function resolveDatabaseUrlForLocalRun(): void {
    const raw = process.env.DATABASE_URL;
    if (!raw) return;

    const expanded = expandEnvVariables(raw);
    const isDocker = existsSync('/.dockerenv');

    let normalized = expanded;
    try {
        const parsed = new URL(expanded);
        if (!isDocker && parsed.hostname === 'db') {
            parsed.hostname = 'localhost';
            normalized = parsed.toString();
            console.log('seed-delta-01: DATABASE_URL host rewritten from "db" to "localhost" for local terminal run.');
        }
    } catch {
        if (!isDocker) {
            normalized = expanded.replace('@db:5432', '@localhost:5432');
        }
    }

    process.env.DATABASE_URL = normalized;
}

loadEnvForNodeScript();
resolveDatabaseUrlForLocalRun();

const prisma = new PrismaClient();

type DeltaPerk = {
    name: string;
    description: string;
    behavior: PerkBehavior;
};

type DeltaWeaponEffect = {
    name: string;
    kind: EffectKind;
    valueInt?: number | null;
    valueText?: string | null;
};

type DeltaWeapon = {
    name: string;
    notes?: string | null;
    baseType: string;
    baseTest: string;
    baseEffects: DeltaWeaponEffect[];
};

type DeltaUnitOption = {
    weapon1: string;
    weapon2?: string | null;
    costCaps: number;
    rating: number;
};

type DeltaCompanion = {
    name: string;
    stats: {
        hp: number;
        s: number;
        p: number;
        e: number;
        c: number;
        i: number;
        a: number;
        l: number;
    };
    startPerks: string[];
    options: DeltaUnitOption[];
};

const DELTA_PERKS: DeltaPerk[] = [
    {
        name: 'ROBOTEER',
        description:
            'Companion Perk. When recruiting a Champion, it may gain this Perk and add one Robot Companion to the crew. The selected Companion Rating is added to this Champion Rating.',
        behavior: PerkBehavior.COMPANION_ROBOT,
    },
    {
        name: 'CREATURE TAMER',
        description:
            'Companion Perk. When recruiting a Champion, it may gain this Perk and add one Creature Companion to the crew. The selected Companion Rating is added to this Champion Rating.',
        behavior: PerkBehavior.COMPANION_BEAST,
    },
];

const DELTA_WEAPONS: DeltaWeapon[] = [
    {
        name: 'Bloodbug Proboscis',
        notes: 'Cannot be modified.',
        baseType: 'Melee',
        baseTest: '4S',
        baseEffects: [{ name: 'Poison', kind: EffectKind.CRITICAL, valueInt: 2 }],
    },
    {
        name: 'Claws and Jaws',
        notes: 'Cannot be modified.',
        baseType: 'Melee',
        baseTest: '4S',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Suppress', kind: EffectKind.CRITICAL, valueInt: 1 },
        ],
    },
    {
        name: 'Deathclaw Claws',
        notes: 'Cannot be modified.',
        baseType: 'Melee',
        baseTest: '5S',
        baseEffects: [
            { name: 'Maim', kind: EffectKind.CRITICAL },
            { name: 'Pushback', kind: EffectKind.CRITICAL, valueInt: 1 },
        ],
    },
    {
        name: 'Doe Shove',
        notes: 'Cannot be modified.',
        baseType: 'Melee',
        baseTest: '2S',
        baseEffects: [],
    },
    {
        name: 'Mirelurk Claws',
        notes: 'Cannot be modified.',
        baseType: 'Melee',
        baseTest: '2S',
        baseEffects: [{ name: 'Maim', kind: EffectKind.CRITICAL }],
    },
    {
        name: 'Radstag Antlers',
        notes: 'Cannot be modified.',
        baseType: 'Melee',
        baseTest: '4S',
        baseEffects: [
            { name: 'Wind Up', kind: EffectKind.WEAPON },
            { name: 'Pierce', kind: EffectKind.CRITICAL },
        ],
    },
    {
        name: 'Yao Guai Claws and Jaws',
        notes: 'Cannot be modified.',
        baseType: 'Melee',
        baseTest: '5S',
        baseEffects: [
            { name: 'Maim', kind: EffectKind.CRITICAL },
            { name: 'Pushback', kind: EffectKind.CRITICAL, valueInt: 2 },
        ],
    },
    {
        name: 'Nuka Dispenser',
        notes: 'Cannot be modified.',
        baseType: 'Pistol (8")',
        baseTest: '4A',
        baseEffects: [{ name: 'Suppress', kind: EffectKind.CRITICAL, valueInt: 1 }],
    },
    {
        name: 'Bloatfly Larvae',
        notes: 'Cannot be modified.',
        baseType: 'Pistol (10")',
        baseTest: '2A',
        baseEffects: [{ name: 'Fast', kind: EffectKind.WEAPON }],
    },
    {
        name: 'Securitron SMG',
        notes: 'Cannot be modified.',
        baseType: 'Rifle (12")',
        baseTest: '3P',
        baseEffects: [
            { name: 'Storm', kind: EffectKind.WEAPON, valueInt: 3 },
            { name: 'Suppress', kind: EffectKind.CRITICAL, valueInt: 2 },
        ],
    },
    {
        name: 'Shoulder Launchers',
        notes: 'Cannot be modified.',
        baseType: 'Heavy (12")',
        baseTest: '3S',
        baseEffects: [
            { name: 'Area', kind: EffectKind.WEAPON, valueInt: 2 },
            { name: 'Maim', kind: EffectKind.CRITICAL },
        ],
    },
];

const DELTA_COMPANIONS: DeltaCompanion[] = [
    {
        name: 'Eyebot (Companion)',
        stats: { hp: 1, s: 2, p: 4, e: 4, c: 1, i: 1, a: 4, l: 1 },
        startPerks: ['BULLET MAGNET', 'EYE CATCHING', 'FLIGHT', 'MACHINE', 'PROGRAMMED'],
        options: [{ weapon1: 'Eyebot Laser', costCaps: 15, rating: 15 }],
    },
    {
        name: 'Mr. Frothy (Companion)',
        stats: { hp: 3, s: 5, p: 5, e: 6, c: 1, i: 1, a: 4, l: 1 },
        startPerks: ['HARDY', 'MACHINE', 'PROGRAMMED', 'SELF-DESTRUCT'],
        options: [{ weapon1: 'Nuka Dispenser', weapon2: 'Robot Bash', costCaps: 40, rating: 40 }],
    },
    {
        name: 'Mr. Handy (Companion)',
        stats: { hp: 3, s: 5, p: 5, e: 5, c: 1, i: 1, a: 4, l: 1 },
        startPerks: ['HARDY', 'MACHINE', 'MEDIC', 'PROGRAMMED'],
        options: [
            { weapon1: 'Robot Lasers', weapon2: 'Various Appendages', costCaps: 52, rating: 52 },
            { weapon1: 'Robot Lasers', weapon2: 'Various Appendages', costCaps: 57, rating: 57 },
            { weapon1: 'Flamer', weapon2: 'Robot Lasers', costCaps: 60, rating: 60 },
        ],
    },
    {
        name: 'Nukatron (Companion)',
        stats: { hp: 2, s: 4, p: 5, e: 5, c: 1, i: 1, a: 2, l: 1 },
        startPerks: ['HARDY', 'MACHINE', 'PROGRAMMED', 'SELF-DESTRUCT'],
        options: [
            { weapon1: 'Robot Bash', costCaps: 20, rating: 20 },
            { weapon1: 'Nuka Dispenser', weapon2: 'Robot Bash', costCaps: 25, rating: 25 },
            { weapon1: 'Robot Lasers', weapon2: 'Robot Bash', costCaps: 30, rating: 30 },
        ],
    },
    {
        name: 'Protectron (Companion)',
        stats: { hp: 2, s: 4, p: 5, e: 5, c: 1, i: 1, a: 2, l: 1 },
        startPerks: ['HARDY', 'MACHINE', 'MEDIC', 'PROGRAMMED', 'SELF-DESTRUCT'],
        options: [
            { weapon1: 'Nail Gun', weapon2: 'Robot Bash', costCaps: 30, rating: 30 },
            { weapon1: 'Robot Lasers', weapon2: 'Robot Bash', costCaps: 32, rating: 32 },
            { weapon1: 'Robot Bash', costCaps: 33, rating: 33 },
            { weapon1: 'Hand Cryojet', weapon2: 'Robot Bash', costCaps: 35, rating: 35 },
            { weapon1: 'Robot Lasers', weapon2: 'Shock Hand', costCaps: 35, rating: 35 },
        ],
    },
    {
        name: 'Securitron MK 1.0 (Companion)',
        stats: { hp: 2, s: 5, p: 5, e: 6, c: 1, i: 1, a: 2, l: 2 },
        startPerks: ['BURLY', 'HARDY', 'MACHINE', 'PROGRAMMED'],
        options: [{ weapon1: 'Robot Lasers', weapon2: 'Securitron SMG', costCaps: 45, rating: 45 }],
    },
    {
        name: 'Securitron MK 2.0 (Companion)',
        stats: { hp: 2, s: 5, p: 5, e: 7, c: 1, i: 1, a: 2, l: 2 },
        startPerks: ['BURLY', 'HARDY', 'LIFEGIVER', 'MACHINE', 'PROGRAMMED'],
        options: [{ weapon1: 'Securitron SMG', weapon2: 'Shoulder Launchers', costCaps: 70, rating: 70 }],
    },
    {
        name: 'Brahmin (Companion)',
        stats: { hp: 2, s: 4, p: 3, e: 5, c: 1, i: 1, a: 2, l: 1 },
        startPerks: ['BEAST', 'RAD RESISTANT'],
        options: [{ weapon1: 'Trample', costCaps: 15, rating: 15 }],
    },
    {
        name: 'Bloodbug (Companion)',
        stats: { hp: 1, s: 3, p: 2, e: 3, c: 1, i: 1, a: 3, l: 1 },
        startPerks: ['BEAST', 'DISPOSABLE', 'FLIGHT', 'RAD RESISTANT', 'SWARM'],
        options: [{ weapon1: 'Bloodbug Proboscis', costCaps: 5, rating: 5 }],
    },
    {
        name: 'Bloatfly (Companion)',
        stats: { hp: 1, s: 2, p: 3, e: 2, c: 1, i: 1, a: 3, l: 1 },
        startPerks: ['BEAST', 'DISPOSABLE', 'FLIGHT', 'RAD RESISTANT', 'SWARM'],
        options: [{ weapon1: 'Bloatfly Larvae', costCaps: 5, rating: 5 }],
    },
    {
        name: 'Deathclaw (Companion)',
        stats: { hp: 3, s: 7, p: 2, e: 7, c: 1, i: 1, a: 5, l: 1 },
        startPerks: ['BEAST', 'BLITZ', 'BURLY', 'HARDY', 'RAD RESISTANT', 'WIDE SWINGS'],
        options: [{ weapon1: 'Deathclaw Claws', costCaps: 70, rating: 70 }],
    },
    {
        name: 'Mirelurk (Companion)',
        stats: { hp: 2, s: 5, p: 2, e: 4, c: 1, i: 1, a: 3, l: 1 },
        startPerks: ['BEAST', 'BURLY', 'RAD RESISTANT'],
        options: [{ weapon1: 'Mirelurk Claws', costCaps: 17, rating: 17 }],
    },
    {
        name: 'Radstag (Companion)',
        stats: { hp: 1, s: 4, p: 3, e: 4, c: 1, i: 1, a: 3, l: 1 },
        startPerks: ['BEAST', 'RAD RESISTANT'],
        options: [{ weapon1: 'Radstag Antlers', costCaps: 10, rating: 10 }],
    },
    {
        name: 'Radstag Doe (Companion)',
        stats: { hp: 1, s: 3, p: 3, e: 3, c: 1, i: 1, a: 3, l: 1 },
        startPerks: ['BEAST', 'RAD RESISTANT', 'SWARM'],
        options: [{ weapon1: 'Doe Shove', costCaps: 5, rating: 5 }],
    },
    {
        name: 'Mole Rat (Companion)',
        stats: { hp: 1, s: 3, p: 2, e: 3, c: 1, i: 1, a: 3, l: 1 },
        startPerks: ['BEAST', 'BURROWING', 'DISPOSABLE', 'RAD RESISTANT', 'SWARM'],
        options: [{ weapon1: 'Claws and Jaws', costCaps: 6, rating: 6 }],
    },
    {
        name: 'Mongrel (Companion)',
        stats: { hp: 1, s: 4, p: 4, e: 4, c: 1, i: 2, a: 4, l: 1 },
        startPerks: ['BEAST', 'RAD RESISTANT', 'SPRINT', 'SWARM'],
        options: [{ weapon1: 'Claws and Jaws', costCaps: 10, rating: 10 }],
    },
    {
        name: 'Yao Guai (Companion)',
        stats: { hp: 3, s: 7, p: 3, e: 6, c: 1, i: 1, a: 4, l: 1 },
        startPerks: ['BEAST', 'FREIGHT TRAIN', 'HARDY', 'RAD RESISTANT'],
        options: [{ weapon1: 'Yao Guai Claws and Jaws', costCaps: 60, rating: 60 }],
    },
];

const effectKey = (name: string, kind: EffectKind): string => `${name}:${kind}`;

function uniqueNames(values: string[]): string[] {
    return [...new Set(values)];
}

async function ensurePerk(spec: DeltaPerk): Promise<boolean> {
    const existing = await prisma.perk.findFirst({ where: { name: spec.name } });
    if (existing) {
        await prisma.perk.update({
            where: { id: existing.id },
            data: {
                description: spec.description,
                behavior: spec.behavior,
                category: PerkCategory.REGULAR,
                isInnate: false,
                requiresValue: false,
                startAllowed: false,
            },
        });
        return false;
    }

    await prisma.perk.create({
        data: {
            name: spec.name,
            description: spec.description,
            behavior: spec.behavior,
            category: PerkCategory.REGULAR,
            isInnate: false,
            requiresValue: false,
            startAllowed: false,
        },
    });
    return true;
}

async function loadEffectIds(effects: DeltaWeaponEffect[]): Promise<Map<string, string>> {
    const uniqueEffectKeys = [...new Set(effects.map((e) => effectKey(e.name, e.kind)))];
    const result = new Map<string, string>();
    const missing: string[] = [];

    for (const key of uniqueEffectKeys) {
        const [name, kindRaw] = key.split(':');
        const kind = kindRaw as EffectKind;
        const effect = await prisma.effect.findFirst({
            where: { name, kind },
            select: { id: true },
        });
        if (!effect) {
            missing.push(`${name} (${kind})`);
            continue;
        }
        result.set(key, effect.id);
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing effects required by seed-delta-01: ${missing.join(', ')}. Run "npm run seed" first.`
        );
    }

    return result;
}

async function ensureWeapon(spec: DeltaWeapon, effectIds: Map<string, string>): Promise<boolean> {
    const existing = await prisma.weaponTemplate.findFirst({ where: { name: spec.name } });
    const weapon = existing
        ? await prisma.weaponTemplate.update({
            where: { id: existing.id },
            data: {
                baseType: spec.baseType,
                baseTest: spec.baseTest,
                notes: spec.notes ?? existing.notes ?? null,
            },
        })
        : await prisma.weaponTemplate.create({
            data: {
                name: spec.name,
                notes: spec.notes ?? null,
                baseType: spec.baseType,
                baseTest: spec.baseTest,
            },
        });

    for (const baseEffect of spec.baseEffects) {
        const id = effectIds.get(effectKey(baseEffect.name, baseEffect.kind));
        if (!id) {
            throw new Error(`Cannot resolve effect ${baseEffect.name} (${baseEffect.kind}) for weapon ${spec.name}.`);
        }

        const current = await prisma.weaponBaseEffect.findFirst({
            where: { weaponId: weapon.id, effectId: id },
            select: { id: true },
        });
        if (current) {
            await prisma.weaponBaseEffect.update({
                where: { id: current.id },
                data: {
                    valueInt: baseEffect.valueInt ?? null,
                    valueText: baseEffect.valueText ?? null,
                },
            });
        } else {
            await prisma.weaponBaseEffect.create({
                data: {
                    weaponId: weapon.id,
                    effectId: id,
                    valueInt: baseEffect.valueInt ?? null,
                    valueText: baseEffect.valueText ?? null,
                },
            });
        }
    }

    return !existing;
}

async function loadPerkIds(names: string[]): Promise<Map<string, string>> {
    const perks = await prisma.perk.findMany({
        where: { name: { in: names } },
        select: { id: true, name: true },
    });

    const perkIdByName = new Map<string, string>();
    for (const perk of perks) {
        if (!perkIdByName.has(perk.name)) {
            perkIdByName.set(perk.name, perk.id);
        }
    }

    const missing = names.filter((name) => !perkIdByName.has(name));
    if (missing.length > 0) {
        throw new Error(`Missing perks required by seed-delta-01: ${missing.join(', ')}. Run "npm run seed" first.`);
    }

    return perkIdByName;
}

async function loadWeaponIds(names: string[]): Promise<Map<string, string>> {
    const weapons = await prisma.weaponTemplate.findMany({
        where: { name: { in: names } },
        select: { id: true, name: true },
    });

    const weaponIdByName = new Map<string, string>();
    for (const weapon of weapons) {
        if (!weaponIdByName.has(weapon.name)) {
            weaponIdByName.set(weapon.name, weapon.id);
        }
    }

    const missing = names.filter((name) => !weaponIdByName.has(name));
    if (missing.length > 0) {
        throw new Error(`Missing weapons required by seed-delta-01: ${missing.join(', ')}. Run "npm run seed" first.`);
    }

    return weaponIdByName;
}

async function ensureCompanionTemplate(spec: DeltaCompanion): Promise<{ id: string; created: boolean }> {
    const existing = await prisma.unitTemplate.findFirst({ where: { name: spec.name } });
    const data = {
        isGlobal: true,
        roleTag: UnitTemplateTag.COMPANION,
        isLeader: false,
        baseRating: 0,
        hp: spec.stats.hp,
        s: spec.stats.s,
        p: spec.stats.p,
        e: spec.stats.e,
        c: spec.stats.c,
        i: spec.stats.i,
        a: spec.stats.a,
        l: spec.stats.l,
    };

    const unit = existing
        ? await prisma.unitTemplate.update({ where: { id: existing.id }, data })
        : await prisma.unitTemplate.create({ data: { name: spec.name, ...data } });

    // Companion templates are global - remove faction links if present.
    await prisma.unitTemplateFaction.deleteMany({ where: { unitId: unit.id } });

    return { id: unit.id, created: !existing };
}

async function ensureUnitStartPerks(unitId: string, perkIdByName: Map<string, string>, perkNames: string[]): Promise<number> {
    const createPayload = perkNames.map((name) => {
        const perkId = perkIdByName.get(name);
        if (!perkId) {
            throw new Error(`Missing perk "${name}" for unit template ${unitId}.`);
        }
        return { unitId, perkId };
    });

    const created = await prisma.unitStartPerk.createMany({
        data: createPayload,
        skipDuplicates: true,
    });
    return created.count;
}

async function ensureUnitOptions(
    unitId: string,
    weaponIdByName: Map<string, string>,
    options: DeltaUnitOption[]
): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    const normalizedOptions = [
        ...new Map(
            options.map((option) => [`${option.weapon1}|${option.weapon2 ?? ''}`, option] as const)
        ).values(),
    ];

    for (const option of normalizedOptions) {
        const weapon1Id = weaponIdByName.get(option.weapon1);
        if (!weapon1Id) {
            throw new Error(`Missing weapon "${option.weapon1}" for unit template ${unitId}.`);
        }

        const weapon2Name = option.weapon2 ?? null;
        const weapon2Id = weapon2Name ? weaponIdByName.get(weapon2Name) ?? null : null;
        if (weapon2Name && !weapon2Id) {
            throw new Error(`Missing weapon "${weapon2Name}" for unit template ${unitId}.`);
        }

        const existing = await prisma.unitWeaponOption.findFirst({
            where: {
                unitId,
                weapon1Id,
                weapon2Id: weapon2Id ?? null,
            },
            select: {
                id: true,
                costCaps: true,
                rating: true,
            },
        });

        if (!existing) {
            await prisma.unitWeaponOption.create({
                data: {
                    unitId,
                    weapon1Id,
                    weapon2Id: weapon2Id ?? null,
                    costCaps: option.costCaps,
                    rating: option.rating,
                },
            });
            created += 1;
            continue;
        }

        if (existing.costCaps !== option.costCaps || existing.rating !== option.rating) {
            await prisma.unitWeaponOption.update({
                where: { id: existing.id },
                data: {
                    costCaps: option.costCaps,
                    rating: option.rating,
                },
            });
            updated += 1;
        }
    }

    return { created, updated };
}

async function main(): Promise<void> {
    const counters = {
        perksCreated: 0,
        perksUpdated: 0,
        weaponsCreated: 0,
        weaponsUpdated: 0,
        companionsCreated: 0,
        companionsUpdated: 0,
        startPerksCreated: 0,
        optionsCreated: 0,
        optionsUpdated: 0,
    };

    for (const perk of DELTA_PERKS) {
        const created = await ensurePerk(perk);
        if (created) counters.perksCreated += 1;
        else counters.perksUpdated += 1;
    }

    const weaponEffects = DELTA_WEAPONS.flatMap((weapon) => weapon.baseEffects);
    const effectIds = await loadEffectIds(weaponEffects);

    for (const weapon of DELTA_WEAPONS) {
        const created = await ensureWeapon(weapon, effectIds);
        if (created) counters.weaponsCreated += 1;
        else counters.weaponsUpdated += 1;
    }

    const companionPerkNames = uniqueNames(DELTA_COMPANIONS.flatMap((companion) => companion.startPerks));
    const companionWeaponNames = uniqueNames(
        DELTA_COMPANIONS.flatMap((companion) =>
            companion.options.flatMap((option) => [option.weapon1, option.weapon2 ?? null].filter((value): value is string => Boolean(value)))
        )
    );

    const perkIdByName = await loadPerkIds(companionPerkNames);
    const weaponIdByName = await loadWeaponIds(companionWeaponNames);

    for (const companion of DELTA_COMPANIONS) {
        const unit = await ensureCompanionTemplate(companion);
        if (unit.created) counters.companionsCreated += 1;
        else counters.companionsUpdated += 1;

        counters.startPerksCreated += await ensureUnitStartPerks(unit.id, perkIdByName, companion.startPerks);
        const optionCounters = await ensureUnitOptions(unit.id, weaponIdByName, companion.options);
        counters.optionsCreated += optionCounters.created;
        counters.optionsUpdated += optionCounters.updated;
    }

    console.log('seed-delta-01 completed.');
    console.log(
        [
            `Perks created: ${counters.perksCreated}, updated: ${counters.perksUpdated}`,
            `Weapons created: ${counters.weaponsCreated}, updated: ${counters.weaponsUpdated}`,
            `Companions created: ${counters.companionsCreated}, updated: ${counters.companionsUpdated}`,
            `Unit start perks inserted: ${counters.startPerksCreated}`,
            `Unit options created: ${counters.optionsCreated}, updated: ${counters.optionsUpdated}`,
        ].join('\n')
    );
}

main()
    .catch((error) => {
        console.error('seed-delta-01 failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
