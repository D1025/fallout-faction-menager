import {
    EffectKind,
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
            console.log('seed-delta-02: DATABASE_URL host rewritten from "db" to "localhost" for local terminal run.');
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

type DeltaLegendOption = {
    weapon1: string;
    weapon2?: string | null;
    costCaps: number;
    rating: number;
};

type DeltaLegend = {
    name: string;
    isLeader: boolean;
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
    options: DeltaLegendOption[];
};

const LEGEND_PERKS: DeltaPerk[] = [
    {
        name: 'KING OF THE CASTLE',
        description:
            "This model's crew may use the Nuka-nuke Launcher Ploy. In addition, this model's crew may use The Pack, Operators, and Disciples Faction Ploys from the Fallout: Factions - Battle for Nuka-World Starter Set.",
    },
    {
        name: 'EVERY MINIMUM ACCEPTABLE SAFETY STANDARD MET',
        description: 'This model has no Harm Limit.',
    },
    {
        name: 'ZIP OF NUKA-COLA',
        description:
            'When this model would be Incapacitated, if a Friendly model is within 2 inches, add one dose of Nuka-Cola to your Crew Roster.',
    },
    {
        name: 'RECRUITER',
        description:
            'If at the end of a game this model was not Incapacitated, its crew may make the Recruit Story Action once for free during the next Story Phase.',
    },
    {
        name: 'ONE RULE',
        description:
            "All Friendly models within this model's Control Area have the Blitz Perk.",
    },
    {
        name: 'CHEATER',
        description:
            'This model can take the Get Moving, Open Fire, Patch Up, and Rummage Actions while Engaged.',
    },
    {
        name: 'UNSTOPPABLE',
        description:
            'At the start of each Round, add the corresponding Perk to this model for the rest of the game: Round 1 Toughness, Round 2 Iron Fist, Round 3 Wide Swings.',
    },
    {
        name: 'GREATER NUMBERS',
        description:
            "When you add a Pack Hound to your Crew Roster, add two models instead of one and pay the Hiring Fee once. Each model acts independently; for Rating references each Pack Hound counts as Rating 21.",
    },
    {
        name: 'ON THE HOUSE (WHISKEY)',
        description:
            "When hiring this model, your crew gains one dose of X Chem/Rare Chem. Whiskey option: spend a dose to increase the Active model's Strength or Endurance by 2 for one Strength or Endurance Test.",
    },
    {
        name: 'SERMONS',
        description:
            "At the beginning of this model's Activation, it may Take Fatigue to grant one temporary sermon bonus until end of Round to another Friendly model within Control Area (rummage without fatigue, sniper-like visibility, shielding others vs Area attacks, or anti-targeting protection).",
    },
    {
        name: 'KNOW YOUR ENEMY (SUPER MUTANTS)',
        description:
            'When creating the Dice Pool for an Attack Action against an Enemy model from the Super Mutants faction, this model gains 1 Bonus Die.',
    },
];

const LEGEND_WEAPONS: DeltaWeapon[] = [
    {
        name: 'Iron Fist',
        notes: 'Legend profile.',
        baseType: 'Melee',
        baseTest: '5S',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Maim', kind: EffectKind.CRITICAL },
        ],
    },
    {
        name: 'Nuka-nuke Launcher',
        notes: 'Legend ploy weapon profile.',
        baseType: 'Heavy (20")',
        baseTest: '5S',
        baseEffects: [
            { name: 'Area', kind: EffectKind.WEAPON, valueInt: 2 },
            { name: 'CQB', kind: EffectKind.WEAPON },
            { name: 'Irradiate', kind: EffectKind.WEAPON },
            { name: 'One & Done', kind: EffectKind.WEAPON },
        ],
    },
    {
        name: 'Splattercannon',
        notes: 'Legend profile.',
        baseType: 'Rifle (22")',
        baseTest: '5P',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Suppress', kind: EffectKind.CRITICAL, valueInt: 3 },
        ],
    },
    {
        name: 'Bladed Commie Whacker',
        notes: 'Legend profile.',
        baseType: 'Melee',
        baseTest: '2S',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Pierce', kind: EffectKind.CRITICAL },
        ],
    },
    {
        name: 'The Red Deal',
        notes: 'Legend profile.',
        baseType: 'Melee',
        baseTest: '4S',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Maim', kind: EffectKind.CRITICAL },
        ],
    },
    {
        name: 'Heavy Combat Shotgun',
        notes: 'Legend profile.',
        baseType: 'Rifle (10")',
        baseTest: '5P',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Storm', kind: EffectKind.WEAPON, valueInt: 1 },
            { name: 'Maim', kind: EffectKind.CRITICAL },
        ],
    },
    {
        name: 'Suppressing Handmade Rifle',
        notes: 'Legend profile.',
        baseType: 'Rifle (22")',
        baseTest: '4P',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Suppress', kind: EffectKind.CRITICAL, valueInt: 3 },
        ],
    },
    {
        name: "Disciple's Blade",
        notes: 'Legend profile.',
        baseType: 'Melee',
        baseTest: '4S',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Maim', kind: EffectKind.CRITICAL },
        ],
    },
    {
        name: 'Powerful Combat Rifle',
        notes: 'Legend profile.',
        baseType: 'Rifle (24")',
        baseTest: '5P',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Maim', kind: EffectKind.CRITICAL },
        ],
    },
    {
        name: 'Upgraded Handmade Rifle',
        notes: 'Legend profile.',
        baseType: 'Rifle (18")',
        baseTest: '5P',
        baseEffects: [
            { name: 'Fast', kind: EffectKind.WEAPON },
            { name: 'Suppress', kind: EffectKind.CRITICAL, valueInt: 2 },
        ],
    },
    {
        name: 'Upgraded Hand Weapon',
        notes: 'Legend profile.',
        baseType: 'Melee',
        baseTest: '4S',
        baseEffects: [{ name: 'Fast', kind: EffectKind.WEAPON }],
    },
    {
        name: 'Trusty Lever-action Rifle',
        notes: 'Legend profile.',
        baseType: 'Rifle (16")',
        baseTest: '4P',
        baseEffects: [{ name: 'Pierce', kind: EffectKind.CRITICAL }],
    },
    {
        name: 'Breaching Harpoon Gun',
        notes: 'Legend profile.',
        baseType: 'Heavy (16")',
        baseTest: '5S',
        baseEffects: [
            { name: 'Aim', kind: EffectKind.WEAPON, valueInt: 1 },
            { name: 'Slow', kind: EffectKind.WEAPON },
            { name: 'Haul', kind: EffectKind.CRITICAL, valueInt: 3 },
            { name: 'Pushback', kind: EffectKind.CRITICAL, valueInt: 3 },
        ],
    },
    {
        name: 'Aeternus',
        notes: 'Legend profile.',
        baseType: 'Heavy (10")',
        baseTest: '4S',
        baseEffects: [
            { name: 'Slow', kind: EffectKind.WEAPON },
            { name: 'Storm', kind: EffectKind.WEAPON, valueInt: 3 },
            { name: 'Ignite', kind: EffectKind.CRITICAL, valueInt: 2 },
        ],
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
];

const LEGENDS: DeltaLegend[] = [
    {
        name: 'King of the Park',
        isLeader: true,
        stats: { hp: 4, s: 7, p: 5, e: 7, c: 6, i: 5, a: 5, l: 3 },
        startPerks: ['IRON FIST', 'KING OF THE CASTLE', 'NATURAL LEADER', 'POWER ARMOR'],
        options: [{ weapon1: 'Iron Fist', costCaps: 87, rating: 87 }],
    },
    {
        name: 'Bottle and Cappy, All Fizzed Up',
        isLeader: false,
        stats: { hp: 2, s: 4, p: 4, e: 4, c: 6, i: 5, a: 4, l: 4 },
        startPerks: ['EVERY MINIMUM ACCEPTABLE SAFETY STANDARD MET', 'FOUR LEAF CLOVER', 'HIDDEN', 'ZIP OF NUKA-COLA'],
        options: [{ weapon1: 'Splattercannon', weapon2: 'Bladed Commie Whacker', costCaps: 48, rating: 48 }],
    },
    {
        name: 'Redeye',
        isLeader: false,
        stats: { hp: 2, s: 5, p: 5, e: 4, c: 6, i: 5, a: 5, l: 2 },
        startPerks: ['INSPIRATIONAL', 'INTIMIDATION', 'RECRUITER'],
        options: [{ weapon1: 'The Red Deal', costCaps: 50, rating: 50 }],
    },
    {
        name: 'Mason',
        isLeader: true,
        stats: { hp: 3, s: 5, p: 5, e: 5, c: 6, i: 6, a: 5, l: 3 },
        startPerks: ['INSPIRATIONAL', 'NATURAL LEADER', 'SURVIVALIST', 'TOUGHNESS'],
        options: [{ weapon1: 'Heavy Combat Shotgun', costCaps: 63, rating: 63 }],
    },
    {
        name: 'Mags Black',
        isLeader: true,
        stats: { hp: 3, s: 5, p: 6, e: 5, c: 5, i: 6, a: 5, l: 2 },
        startPerks: ['MAKING A WITHDRAWAL', 'NATURAL LEADER', 'RIFLEMAN'],
        options: [{ weapon1: 'Suppressing Handmade Rifle', costCaps: 61, rating: 61 }],
    },
    {
        name: 'Nisha',
        isLeader: true,
        stats: { hp: 3, s: 6, p: 5, e: 5, c: 6, i: 6, a: 6, l: 3 },
        startPerks: ['BLITZ', 'ONE RULE', 'NATURAL LEADER'],
        options: [{ weapon1: "Disciple's Blade", weapon2: 'Plasma Pistol', costCaps: 68, rating: 68 }],
    },
    {
        name: 'Overboss Colter',
        isLeader: true,
        stats: { hp: 4, s: 7, p: 5, e: 7, c: 2, i: 3, a: 4, l: 1 },
        startPerks: ['CHEATER', 'NATURAL LEADER', 'POWER ARMOR'],
        options: [{ weapon1: 'Powerful Combat Rifle', weapon2: 'Iron Fist', costCaps: 72, rating: 72 }],
    },
    {
        name: 'Nick Valentine',
        isLeader: false,
        stats: { hp: 2, s: 4, p: 5, e: 5, c: 6, i: 7, a: 4, l: 3 },
        startPerks: ['ADAPTABLE', 'INFORMANT', 'RAD RESISTANT'],
        options: [{ weapon1: 'Pipe Revolver', costCaps: 37, rating: 37 }],
    },
    {
        name: 'Fist',
        isLeader: true,
        stats: { hp: 4, s: 7, p: 5, e: 6, c: 5, i: 5, a: 5, l: 2 },
        startPerks: ['BURLY', 'NATURAL LEADER', 'RAD RESISTANT', 'TOUGHNESS', 'UNENDING STAMINA'],
        options: [{ weapon1: 'Minigun', costCaps: 72, rating: 72 }],
    },
    {
        name: 'Paladin Danse',
        isLeader: true,
        stats: { hp: 4, s: 6, p: 6, e: 7, c: 5, i: 5, a: 4, l: 3 },
        startPerks: ['KNOW YOUR ENEMY (SUPER MUTANTS)', 'NATURAL LEADER', 'ODD ANATOMY', 'POWER ARMOR'],
        options: [{ weapon1: 'Laser Rifle', costCaps: 78, rating: 78 }],
    },
    {
        name: 'The Rogue Knight',
        isLeader: false,
        stats: { hp: 3, s: 6, p: 5, e: 6, c: 4, i: 4, a: 4, l: 2 },
        startPerks: ['POWER ARMOR', 'UNSTOPPABLE'],
        options: [{ weapon1: 'Aeternus', costCaps: 76, rating: 76 }],
    },
    {
        name: 'Pack Hounds',
        isLeader: false,
        stats: { hp: 2, s: 4, p: 3, e: 5, c: 3, i: 3, a: 4, l: 1 },
        startPerks: ['BEAST', 'CANNIBAL', 'GREATER NUMBERS', "SIC 'EM", 'SPRINT'],
        options: [{ weapon1: 'Claws and Jaws', costCaps: 42, rating: 42 }],
    },
    {
        name: 'William Black',
        isLeader: false,
        stats: { hp: 2, s: 4, p: 5, e: 5, c: 4, i: 5, a: 5, l: 2 },
        startPerks: ['SNIPER'],
        options: [{ weapon1: 'Upgraded Handmade Rifle', costCaps: 50, rating: 50 }],
    },
    {
        name: 'Dixie',
        isLeader: false,
        stats: { hp: 2, s: 4, p: 4, e: 4, c: 5, i: 5, a: 5, l: 2 },
        startPerks: ['HIDDEN', 'LONE WANDERER'],
        options: [{ weapon1: 'Upgraded Hand Weapon', weapon2: '.44 Pistol', costCaps: 34, rating: 34 }],
    },
    {
        name: 'Old Longfellow',
        isLeader: false,
        stats: { hp: 2, s: 4, p: 6, e: 5, c: 3, i: 5, a: 3, l: 3 },
        startPerks: ['HOBBLE', 'ON THE HOUSE (WHISKEY)', 'PENETRATOR'],
        options: [{ weapon1: 'Trusty Lever-action Rifle', costCaps: 54, rating: 54 }],
    },
    {
        name: 'Bilge',
        isLeader: true,
        stats: { hp: 3, s: 6, p: 5, e: 6, c: 5, i: 5, a: 5, l: 2 },
        startPerks: ['NATURAL LEADER', 'POWER ARMOR'],
        options: [{ weapon1: 'Breaching Harpoon Gun', costCaps: 64, rating: 64 }],
    },
    {
        name: 'High Confessor Tektus',
        isLeader: true,
        stats: { hp: 3, s: 3, p: 5, e: 5, c: 7, i: 6, a: 5, l: 3 },
        startPerks: ['INSPIRATIONAL', 'NATURAL LEADER', 'RAD RESISTANT', 'SERMONS'],
        options: [{ weapon1: 'Gamma Gun', costCaps: 48, rating: 48 }],
    },
    {
        name: 'Grand Zealot Richter',
        isLeader: false,
        stats: { hp: 2, s: 4, p: 5, e: 7, c: 4, i: 5, a: 5, l: 3 },
        startPerks: ['LIFEGIVER', 'RAD RESISTANT', 'TOUGHNESS'],
        options: [{ weapon1: 'Radium Rifle', costCaps: 65, rating: 65 }],
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
                category: PerkCategory.REGULAR,
                isInnate: true,
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
            category: PerkCategory.REGULAR,
            isInnate: true,
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
            `Missing effects required by seed-delta-02: ${missing.join(', ')}. Run "npm run seed" first.`
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
        throw new Error(`Missing perks required by seed-delta-02: ${missing.join(', ')}. Run "npm run seed" first.`);
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
        throw new Error(`Missing weapons required by seed-delta-02: ${missing.join(', ')}. Run "npm run seed" first.`);
    }

    return weaponIdByName;
}

async function ensureLegendTemplate(spec: DeltaLegend): Promise<{ id: string; created: boolean }> {
    const existing = await prisma.unitTemplate.findFirst({ where: { name: spec.name } });
    const data = {
        isGlobal: true,
        roleTag: UnitTemplateTag.LEGENDS,
        isLeader: spec.isLeader,
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

    // Legends in this delta are global.
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
    options: DeltaLegendOption[]
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
        legendsCreated: 0,
        legendsUpdated: 0,
        startPerksCreated: 0,
        optionsCreated: 0,
        optionsUpdated: 0,
    };

    for (const perk of LEGEND_PERKS) {
        const created = await ensurePerk(perk);
        if (created) counters.perksCreated += 1;
        else counters.perksUpdated += 1;
    }

    const weaponEffects = LEGEND_WEAPONS.flatMap((weapon) => weapon.baseEffects);
    const effectIds = await loadEffectIds(weaponEffects);

    for (const weapon of LEGEND_WEAPONS) {
        const created = await ensureWeapon(weapon, effectIds);
        if (created) counters.weaponsCreated += 1;
        else counters.weaponsUpdated += 1;
    }

    const legendPerkNames = uniqueNames(LEGENDS.flatMap((legend) => legend.startPerks));
    const legendWeaponNames = uniqueNames(
        LEGENDS.flatMap((legend) =>
            legend.options.flatMap((option) => [option.weapon1, option.weapon2 ?? null].filter((value): value is string => Boolean(value)))
        )
    );

    const perkIdByName = await loadPerkIds(legendPerkNames);
    const weaponIdByName = await loadWeaponIds(legendWeaponNames);

    for (const legend of LEGENDS) {
        const unit = await ensureLegendTemplate(legend);
        if (unit.created) counters.legendsCreated += 1;
        else counters.legendsUpdated += 1;

        counters.startPerksCreated += await ensureUnitStartPerks(unit.id, perkIdByName, legend.startPerks);
        const optionCounters = await ensureUnitOptions(unit.id, weaponIdByName, legend.options);
        counters.optionsCreated += optionCounters.created;
        counters.optionsUpdated += optionCounters.updated;
    }

    console.log('seed-delta-02 completed.');
    console.log(
        [
            `Perks created: ${counters.perksCreated}, updated: ${counters.perksUpdated}`,
            `Weapons created: ${counters.weaponsCreated}, updated: ${counters.weaponsUpdated}`,
            `Legends created: ${counters.legendsCreated}, updated: ${counters.legendsUpdated}`,
            `Unit start perks inserted: ${counters.startPerksCreated}`,
            `Unit options created: ${counters.optionsCreated}, updated: ${counters.optionsUpdated}`,
        ].join('\n')
    );
}

main()
    .catch((error) => {
        console.error('seed-delta-02 failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
