import {
    EffectKind,
    PrismaClient,
    WeaponProfileEffectMode,
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
            console.log('seed-delta-04: DATABASE_URL host rewritten from "db" to "localhost" for local terminal run.');
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

type Summary = {
    perkDescriptionsUpdated: number;
    effectDescriptionsUpdated: number;
    ployDescriptionsUpdated: number;
    chemEffectsUpdated: number;
    unitStatsUpdated: number;
    unitPerksAdded: number;
    unitPerksRemoved: number;
    weaponFastTraitsRemoved: number;
    weaponProfilesUpdated: number;
    weaponProfilesRemoved: number;
    weaponBaseEffectsAdded: number;
    weaponBaseEffectsUpdated: number;
    weaponProfileEffectsAdded: number;
    weaponProfileEffectsUpdated: number;
    weaponProfileEffectsRemoved: number;
    weaponOptionsUpdated: number;
    factionGoalsUpdated: number;
};

type UnitStatPatch = Partial<Record<'hp' | 's' | 'p' | 'e' | 'c' | 'i' | 'a' | 'l', number>>;

async function updatePerkDescription(name: string, description: string): Promise<'updated' | 'unchanged' | 'missing'> {
    const perk = await prisma.perk.findFirst({
        where: { name },
        select: { id: true, description: true },
    });
    if (!perk) return 'missing';
    if (perk.description === description) return 'unchanged';
    await prisma.perk.update({
        where: { id: perk.id },
        data: { description },
    });
    return 'updated';
}

async function updateEffectDescription(
    name: string,
    kind: EffectKind,
    description: string
): Promise<'updated' | 'unchanged' | 'missing'> {
    const effects = await prisma.effect.findMany({
        where: { name, kind },
        select: { id: true, description: true },
    });
    if (effects.length === 0) return 'missing';

    const toUpdate = effects.filter((row) => row.description !== description);
    if (toUpdate.length === 0) return 'unchanged';

    for (const row of toUpdate) {
        await prisma.effect.update({
            where: { id: row.id },
            data: { description },
        });
    }
    return 'updated';
}

async function updateChemEffect(name: string, effect: string): Promise<'updated' | 'unchanged' | 'missing'> {
    const chem = await prisma.chem.findUnique({
        where: { name },
        select: { id: true, effect: true },
    });
    if (!chem) return 'missing';
    if (chem.effect === effect) return 'unchanged';
    await prisma.chem.update({
        where: { id: chem.id },
        data: { effect },
    });
    return 'updated';
}

async function updatePloyDescription(name: string, description: string): Promise<'updated' | 'unchanged' | 'missing'> {
    const ploy = await (prisma as unknown as {
        ployDefinition: {
            findFirst: (args: { where: { name: string }; select: { id: true; description: true } }) => Promise<{ id: string; description: string } | null>;
            update: (args: { where: { id: string }; data: { description: string } }) => Promise<unknown>;
        };
    }).ployDefinition.findFirst({
        where: { name },
        select: { id: true, description: true },
    });
    if (!ploy) return 'missing';
    if (ploy.description === description) return 'unchanged';
    await (prisma as unknown as {
        ployDefinition: {
            update: (args: { where: { id: string }; data: { description: string } }) => Promise<unknown>;
        };
    }).ployDefinition.update({
        where: { id: ploy.id },
        data: { description },
    });
    return 'updated';
}

async function ensureUnitHasPerk(unitName: string, perkName: string): Promise<'created' | 'unchanged' | 'missing_unit' | 'missing_perk'> {
    const [unit, perk] = await Promise.all([
        prisma.unitTemplate.findFirst({ where: { name: unitName }, select: { id: true } }),
        prisma.perk.findFirst({ where: { name: perkName }, select: { id: true } }),
    ]);
    if (!unit) return 'missing_unit';
    if (!perk) return 'missing_perk';

    const existing = await prisma.unitStartPerk.findFirst({
        where: { unitId: unit.id, perkId: perk.id },
        select: { id: true },
    });
    if (existing) return 'unchanged';

    await prisma.unitStartPerk.create({
        data: {
            unitId: unit.id,
            perkId: perk.id,
        },
    });
    return 'created';
}

async function removeUnitPerk(unitName: string, perkName: string): Promise<'removed' | 'unchanged' | 'missing_unit' | 'missing_perk'> {
    const [unit, perk] = await Promise.all([
        prisma.unitTemplate.findFirst({ where: { name: unitName }, select: { id: true } }),
        prisma.perk.findFirst({ where: { name: perkName }, select: { id: true } }),
    ]);
    if (!unit) return 'missing_unit';
    if (!perk) return 'missing_perk';

    const removed = await prisma.unitStartPerk.deleteMany({
        where: { unitId: unit.id, perkId: perk.id },
    });
    return removed.count > 0 ? 'removed' : 'unchanged';
}

async function patchUnitStats(unitName: string, patch: UnitStatPatch): Promise<'updated' | 'unchanged' | 'missing'> {
    const unit = await prisma.unitTemplate.findFirst({
        where: { name: unitName },
        select: {
            id: true,
            hp: true,
            s: true,
            p: true,
            e: true,
            c: true,
            i: true,
            a: true,
            l: true,
        },
    });
    if (!unit) return 'missing';

    const data: UnitStatPatch = {};
    if (patch.hp != null && unit.hp !== patch.hp) data.hp = patch.hp;
    if (patch.s != null && unit.s !== patch.s) data.s = patch.s;
    if (patch.p != null && unit.p !== patch.p) data.p = patch.p;
    if (patch.e != null && unit.e !== patch.e) data.e = patch.e;
    if (patch.c != null && unit.c !== patch.c) data.c = patch.c;
    if (patch.i != null && unit.i !== patch.i) data.i = patch.i;
    if (patch.a != null && unit.a !== patch.a) data.a = patch.a;
    if (patch.l != null && unit.l !== patch.l) data.l = patch.l;

    if (Object.keys(data).length === 0) return 'unchanged';

    await prisma.unitTemplate.update({
        where: { id: unit.id },
        data,
    });
    return 'updated';
}

async function getEffectId(name: string, kind: EffectKind): Promise<string | null> {
    const effect = await prisma.effect.findFirst({
        where: { name, kind },
        select: { id: true },
    });
    return effect?.id ?? null;
}

async function removeFastTraitFromWeapon(
    weaponName: string
): Promise<{ missing: boolean; baseRemoved: number; profileRemoved: number }> {
    const weapon = await prisma.weaponTemplate.findFirst({
        where: { name: weaponName },
        select: { id: true },
    });
    if (!weapon) {
        return { missing: true, baseRemoved: 0, profileRemoved: 0 };
    }

    const [baseRemoved, profileRemoved] = await Promise.all([
        prisma.weaponBaseEffect.deleteMany({
            where: {
                weaponId: weapon.id,
                effect: { name: 'Fast', kind: EffectKind.WEAPON },
            },
        }),
        prisma.weaponProfileEffect.deleteMany({
            where: {
                profile: { weaponId: weapon.id },
                effect: { name: 'Fast', kind: EffectKind.WEAPON },
            },
        }),
    ]);

    return {
        missing: false,
        baseRemoved: baseRemoved.count,
        profileRemoved: profileRemoved.count,
    };
}

async function ensureBaseWeaponEffect(
    weaponName: string,
    effectName: string,
    kind: EffectKind,
    valueInt: number | null,
    valueText: string | null
): Promise<'created' | 'updated' | 'unchanged' | 'missing_weapon' | 'missing_effect'> {
    const weapon = await prisma.weaponTemplate.findFirst({
        where: { name: weaponName },
        select: { id: true },
    });
    if (!weapon) return 'missing_weapon';

    const existing = await prisma.weaponBaseEffect.findFirst({
        where: {
            weaponId: weapon.id,
            effect: { name: effectName, kind },
        },
        select: { id: true, valueInt: true, valueText: true },
    });

    if (existing) {
        const unchanged =
            (existing.valueInt ?? null) === valueInt &&
            (existing.valueText ?? null) === valueText;
        if (unchanged) return 'unchanged';

        await prisma.weaponBaseEffect.update({
            where: { id: existing.id },
            data: { valueInt, valueText },
        });
        return 'updated';
    }

    const effectId = await getEffectId(effectName, kind);
    if (!effectId) return 'missing_effect';

    await prisma.weaponBaseEffect.create({
        data: {
            weaponId: weapon.id,
            effectId,
            valueInt,
            valueText,
        },
    });
    return 'created';
}

async function ensureProfileEffect(
    weaponName: string,
    profileOrder: number,
    effectName: string,
    kind: EffectKind,
    mode: WeaponProfileEffectMode,
    valueInt: number | null,
    valueText: string | null
): Promise<{
    created: number;
    updated: number;
    unchanged: number;
    missingWeapon: boolean;
    missingEffect: boolean;
    missingProfiles: boolean;
}> {
    const weapon = await prisma.weaponTemplate.findFirst({
        where: { name: weaponName },
        select: { id: true },
    });
    if (!weapon) {
        return {
            created: 0,
            updated: 0,
            unchanged: 0,
            missingWeapon: true,
            missingEffect: false,
            missingProfiles: false,
        };
    }

    const profiles = await prisma.weaponProfile.findMany({
        where: {
            weaponId: weapon.id,
            order: profileOrder,
        },
        select: { id: true },
    });
    if (profiles.length === 0) {
        return {
            created: 0,
            updated: 0,
            unchanged: 0,
            missingWeapon: false,
            missingEffect: false,
            missingProfiles: true,
        };
    }

    const effectId = await getEffectId(effectName, kind);
    if (!effectId) {
        return {
            created: 0,
            updated: 0,
            unchanged: 0,
            missingWeapon: false,
            missingEffect: true,
            missingProfiles: false,
        };
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const profile of profiles) {
        const existing = await prisma.weaponProfileEffect.findFirst({
            where: {
                profileId: profile.id,
                effect: { name: effectName, kind },
                effectMode: mode,
            },
            select: { id: true, valueInt: true, valueText: true },
        });

        if (!existing) {
            await prisma.weaponProfileEffect.create({
                data: {
                    profileId: profile.id,
                    effectId,
                    effectMode: mode,
                    valueInt,
                    valueText,
                },
            });
            created += 1;
            continue;
        }

        const isUnchanged =
            (existing.valueInt ?? null) === valueInt &&
            (existing.valueText ?? null) === valueText;
        if (isUnchanged) {
            unchanged += 1;
            continue;
        }

        await prisma.weaponProfileEffect.update({
            where: { id: existing.id },
            data: {
                valueInt,
                valueText,
            },
        });
        updated += 1;
    }

    return {
        created,
        updated,
        unchanged,
        missingWeapon: false,
        missingEffect: false,
        missingProfiles: false,
    };
}

async function updateCombatRifleThirdProfileRating(newRatingDelta: number): Promise<'updated' | 'unchanged' | 'missing'> {
    const profiles = await prisma.weaponProfile.findMany({
        where: {
            weapon: { name: 'Combat Rifle' },
            order: 3,
        },
        select: { id: true, ratingDelta: true },
    });
    if (profiles.length === 0) return 'missing';

    let changed = 0;
    for (const profile of profiles) {
        if (profile.ratingDelta === newRatingDelta) continue;
        await prisma.weaponProfile.update({
            where: { id: profile.id },
            data: { ratingDelta: newRatingDelta },
        });
        changed += 1;
    }

    return changed > 0 ? 'updated' : 'unchanged';
}

async function removeCrusaderPistolSecondModification(): Promise<'removed' | 'unchanged' | 'missing'> {
    const profiles = await prisma.weaponProfile.findMany({
        where: {
            weapon: { name: 'Crusader Pistol' },
            order: 2,
        },
        select: { id: true },
    });
    if (profiles.length === 0) return 'missing';

    let removed = 0;
    for (const profile of profiles) {
        await prisma.weaponProfileEffect.deleteMany({ where: { profileId: profile.id } });
        await prisma.weaponProfile.delete({ where: { id: profile.id } });
        removed += 1;
    }

    return removed > 0 ? 'removed' : 'unchanged';
}

async function clearRipperModificationTestOverride(): Promise<'updated' | 'unchanged' | 'missing'> {
    const profiles = await prisma.weaponProfile.findMany({
        where: {
            weapon: { name: 'Ripper' },
            testOverride: '5S',
        },
        select: { id: true },
    });
    if (profiles.length === 0) {
        const anyRipper = await prisma.weaponProfile.findFirst({
            where: { weapon: { name: 'Ripper' } },
            select: { id: true },
        });
        return anyRipper ? 'unchanged' : 'missing';
    }

    for (const profile of profiles) {
        await prisma.weaponProfile.update({
            where: { id: profile.id },
            data: { testOverride: null },
        });
    }
    return 'updated';
}

async function removeProfileEffect(
    weaponName: string,
    profileOrder: number,
    effectName: string,
    kind: EffectKind
): Promise<{ missingWeapon: boolean; removed: number }> {
    const weapon = await prisma.weaponTemplate.findFirst({
        where: { name: weaponName },
        select: { id: true },
    });
    if (!weapon) return { missingWeapon: true, removed: 0 };

    const removed = await prisma.weaponProfileEffect.deleteMany({
        where: {
            profile: { weaponId: weapon.id, order: profileOrder },
            effect: { name: effectName, kind },
        },
    });

    return { missingWeapon: false, removed: removed.count };
}

async function patchBruteLaserRifleOptionValue(newValue: number): Promise<'updated' | 'unchanged' | 'missing'> {
    const options = await prisma.unitWeaponOption.findMany({
        where: {
            unit: { name: { startsWith: 'Brute' } },
            OR: [
                { weapon1: { name: 'Laser Rifle' } },
                { weapon2: { name: 'Laser Rifle' } },
            ],
        },
        select: { id: true, rating: true, costCaps: true },
    });
    if (options.length === 0) return 'missing';

    let changed = 0;
    for (const option of options) {
        if (option.rating === newValue && option.costCaps === newValue) continue;
        await prisma.unitWeaponOption.update({
            where: { id: option.id },
            data: { rating: newValue, costCaps: newValue },
        });
        changed += 1;
    }
    return changed > 0 ? 'updated' : 'unchanged';
}

async function updateFactionGoalDescription(
    fromDescription: string,
    toDescription: string
): Promise<number> {
    const goals = await prisma.factionGoal.findMany({
        where: { description: fromDescription },
        select: { id: true },
    });
    for (const goal of goals) {
        await prisma.factionGoal.update({
            where: { id: goal.id },
            data: { description: toDescription },
        });
    }
    return goals.length;
}

async function updateOursByRightBuildFacilityTarget(): Promise<{ found: number; updated: number }> {
    const goals = await prisma.factionGoal.findMany({
        where: {
            set: {
                name: {
                    contains: 'Ours By Right',
                    mode: 'insensitive',
                },
            },
            description: {
                contains: 'You build a Facility',
                mode: 'insensitive',
            },
        },
        select: { id: true, target: true },
    });

    let updated = 0;
    for (const goal of goals) {
        if (goal.target !== 1) {
            await prisma.factionGoal.update({
                where: { id: goal.id },
                data: { target: 1 },
            });
            updated += 1;
        }
    }

    return { found: goals.length, updated };
}

async function main(): Promise<void> {
    const summary: Summary = {
        perkDescriptionsUpdated: 0,
        effectDescriptionsUpdated: 0,
        ployDescriptionsUpdated: 0,
        chemEffectsUpdated: 0,
        unitStatsUpdated: 0,
        unitPerksAdded: 0,
        unitPerksRemoved: 0,
        weaponFastTraitsRemoved: 0,
        weaponProfilesUpdated: 0,
        weaponProfilesRemoved: 0,
        weaponBaseEffectsAdded: 0,
        weaponBaseEffectsUpdated: 0,
        weaponProfileEffectsAdded: 0,
        weaponProfileEffectsUpdated: 0,
        weaponProfileEffectsRemoved: 0,
        weaponOptionsUpdated: 0,
        factionGoalsUpdated: 0,
    };

    const warnings: string[] = [];

    const perkUpdates: Array<{ name: string; description: string }> = [
        {
            name: 'HOBBLE',
            description:
                'Enemy models Damaged by this model during a Ranged Attack, with a Weapon without the Area (X") Trait, cannot be activated in the following Turn, unless all other models in the Enemy crew are Exhausted or have also been affected by the Hobble Perk.',
        },
        {
            name: 'STONEWALL',
            description: 'A model Engaged with a model with this Perk cannot use the Back Off Action.',
        },
        {
            name: 'CAP COLLECTOR',
            description:
                'When this model makes the Rummage Action to Find Caps and Parts, after rolling the die, double the number of Caps received. If a model has the Scrapper Perk, it cannot take this Perk.',
        },
        {
            name: 'SCRAPPER',
            description:
                'When this model makes the Rummage Action to Find Caps and Parts, after rolling the die, double the number of Caps and Parts added to crew Stash. If a model has the Cap Collector Perk, it cannot take this Perk.',
        },
        {
            name: 'LEND LUCK',
            description:
                'Attacks without the Area (X") Trait made by Friendly models against Enemy Targets within 3" of this model may use this model\'s Luck statistic when creating a Dice Pool, instead of their own Luck.',
        },
        {
            name: 'LUCKY CHARM',
            description:
                'When this model\'s controller uses a Ploy when this model is on the Battlefield, if this model\'s crew has no Ploy Tokens, they may make a Luck Test (4L). If Passed, the crew gains 1 Ploy Token.',
        },
        {
            name: 'SPRINT',
            description:
                'When this model makes a Get Moving Action, or moves during a Movement Order, it may move an extra 2".',
        },
        {
            name: 'STEADY AIM',
            description:
                'When this model creates a Dice Pool for a Ranged Attack with a Rifle or Heavy Weapon, if it has not moved this Turn, it gains 1 Bonus Die.',
        },
        {
            name: 'LONE WANDERER',
            description:
                'When creating a Dice Pool for any Test for this model, if there are no other Friendly models in its Control Area, add 2 Bonus Dice.',
        },
        {
            name: 'INTIMIDATION',
            description:
                'When an Enemy model is subjected to a Confusion Test within this model\'s Control Area, reduce the Enemy model\'s Intelligence by 1 until the Test resolves.',
        },
        {
            name: 'FORTUNE FINDER',
            description:
                'After this model resolves a Rummage Action, its controller rolls a die and gains Caps equal to its result.',
        },
    ];

    for (const row of perkUpdates) {
        const status = await updatePerkDescription(row.name, row.description);
        if (status === 'updated') summary.perkDescriptionsUpdated += 1;
        if (status === 'missing') warnings.push(`Missing perk "${row.name}" - description patch skipped.`);
    }

    const effectUpdates: Array<{ name: string; kind: EffectKind; description: string }> = [
        {
            name: 'Meltdown',
            kind: EffectKind.CRITICAL,
            description:
                'At the end of the Inflict Damage step, the opposing player makes a Meltdown Test (2E) for the Target model. If the opposing player scores fewer Hits than the amount of Harm the Target model has, it Suffers an Injury.',
        },
        {
            name: 'Aim',
            kind: EffectKind.WEAPON,
            description:
                'When creating the Dice Pool for an Attack Action with this Weapon, the Attacking model can Take Fatigue to add X Bonus Dice to the Pool.',
        },
        {
            name: 'Area',
            kind: EffectKind.WEAPON,
            description:
                'When making an Attack Action with this Weapon, the Active player nominates a Target point on the Battlefield instead of a Target model. This must be a point Visible to the Attacking model on the Battlefield surface, or a Terrain Feature. Each model (from either crew) within X" of the chosen Target point counts as a Target model for the Attack. Make a single Attack Test, to which no Bonus Dice can be applied. Then resolve the Inflict Damage step once for each Target model, in an order chosen by the Active player. If a rule adjusts the amount of Damage inflicted, or affects the Target model (for example, the Ignite (X) Critical Effect), this does not carry over between models, and is instead tracked on each individual model. Do not resolve Confusion until Damage has been applied to all models.',
        },
    ];

    for (const row of effectUpdates) {
        const status = await updateEffectDescription(row.name, row.kind, row.description);
        if (status === 'updated') summary.effectDescriptionsUpdated += 1;
        if (status === 'missing') warnings.push(`Missing effect "${row.name}" (${row.kind}) - description patch skipped.`);
    }

    const ployUpdates = [
        {
            name: 'Vertibird Drop',
            description:
                'You may enact this Ploy before Deploying models onto the Battlefield.\n\nChoose one of your models. That model is not deployed following the Starting Positions rules of this game. Instead, when you become the Active player for the first time in Round 2, place the model in Base contact of a Battlefield edge of your choice.',
        },
        {
            name: 'Some Rain Must Fall',
            description:
                'You may enact this Ploy when a Friendly model is Incapacitated by an Enemy model, after any Confusion Tests are made.\n\nEach Friendly model may take an Open Fire or Brawl Action without taking Fatigue. These Actions must be made to Target the Enemy model whose Action Incapacitated the Friendly model. If any other restrictions would not allow this model to be targeted by a Friendly model, then that Friendly model cannot take the Action.',
        },
    ];

    for (const row of ployUpdates) {
        const status = await updatePloyDescription(row.name, row.description);
        if (status === 'updated') summary.ployDescriptionsUpdated += 1;
        if (status === 'missing') warnings.push(`Missing ploy "${row.name}" - description patch skipped.`);
    }

    const chemUpdates = [
        {
            name: 'Mentats',
            effect:
                'When one of your models Fails a Confusion Test, you may spend a dose of Mentats to have that model instead Pass the Confusion Test.',
        },
        {
            name: 'Hydra',
            effect:
                'During the Story Phase, when rolling on the Serious Injury Table, you may spend a dose of Hydra to Re-Roll a result. You can spend up to three doses of Hydra this way for each model you roll for on the Serious Injury Table. This does allow dice to be Re-Rolled multiple times but you cannot use the result of a previously Re-Rolled dice if you use multiple doses.',
        },
    ];

    for (const row of chemUpdates) {
        const status = await updateChemEffect(row.name, row.effect);
        if (status === 'updated') summary.chemEffectsUpdated += 1;
        if (status === 'missing') warnings.push(`Missing chem "${row.name}" - effect patch skipped.`);
    }

    const weaponsRemovingFast = [
        'Automatic Handmade Rifle',
        'Combat Rifle',
        'Handmade Rifle',
        'Plasma Pistol',
        'Splattercannon',
        'Suppressing Handmade Rifle',
        'Heavy Combat Shotgun',
        'Powerful Combat Rifle',
    ];

    for (const weaponName of weaponsRemovingFast) {
        const result = await removeFastTraitFromWeapon(weaponName);
        if (result.missing) {
            warnings.push(`Missing weapon "${weaponName}" - Fast trait removal skipped.`);
            continue;
        }
        summary.weaponFastTraitsRemoved += result.baseRemoved + result.profileRemoved;
        summary.weaponProfileEffectsRemoved += result.profileRemoved;
    }

    const ghoulRifleFastPatch = await removeFastTraitFromWeapon("The Ghoul's Rifle");
    if (ghoulRifleFastPatch.missing) {
        warnings.push('Missing weapon "The Ghoul\'s Rifle" - Fast trait removal skipped.');
    } else {
        summary.weaponFastTraitsRemoved += ghoulRifleFastPatch.baseRemoved + ghoulRifleFastPatch.profileRemoved;
        summary.weaponProfileEffectsRemoved += ghoulRifleFastPatch.profileRemoved;
    }

    const ghoulOneAndDone = await ensureBaseWeaponEffect(
        "The Ghoul's Rifle",
        'One & Done',
        EffectKind.WEAPON,
        null,
        null
    );
    if (ghoulOneAndDone === 'created') summary.weaponBaseEffectsAdded += 1;
    if (ghoulOneAndDone === 'updated') summary.weaponBaseEffectsUpdated += 1;
    if (ghoulOneAndDone === 'missing_weapon') warnings.push('Missing weapon "The Ghoul\'s Rifle" - One & Done add skipped.');
    if (ghoulOneAndDone === 'missing_effect') warnings.push('Missing effect "One & Done" (WEAPON) - cannot patch The Ghoul\'s Rifle.');

    const combatProfileRating = await updateCombatRifleThirdProfileRating(3);
    if (combatProfileRating === 'updated') summary.weaponProfilesUpdated += 1;
    if (combatProfileRating === 'missing') warnings.push('Combat Rifle third modification not found - rating patch skipped.');

    const missileTest = await prisma.weaponTemplate.updateMany({
        where: { name: 'Missile Launcher' },
        data: { baseTest: '4S' },
    });
    if (missileTest.count === 0) {
        warnings.push('Missing weapon "Missile Launcher" - base Test patch skipped.');
    } else {
        summary.weaponProfilesUpdated += 1;
    }

    const missileBaseArea = await ensureBaseWeaponEffect(
        'Missile Launcher',
        'Area',
        EffectKind.WEAPON,
        2,
        null
    );
    if (missileBaseArea === 'created') summary.weaponBaseEffectsAdded += 1;
    if (missileBaseArea === 'updated') summary.weaponBaseEffectsUpdated += 1;
    if (missileBaseArea === 'missing_weapon') warnings.push('Missing weapon "Missile Launcher" - Area(2) base patch skipped.');
    if (missileBaseArea === 'missing_effect') warnings.push('Missing effect "Area" (WEAPON) - cannot patch Missile Launcher.');

    const removeMissileAreaAdd = await prisma.weaponProfileEffect.deleteMany({
        where: {
            profile: { weapon: { name: 'Missile Launcher' }, order: 2 },
            effect: { name: 'Area', kind: EffectKind.WEAPON },
            effectMode: WeaponProfileEffectMode.ADD,
        },
    });
    summary.weaponProfileEffectsRemoved += removeMissileAreaAdd.count;

    const ensureMissileAreaRemove = await ensureProfileEffect(
        'Missile Launcher',
        2,
        'Area',
        EffectKind.WEAPON,
        WeaponProfileEffectMode.REMOVE,
        2,
        null
    );
    summary.weaponProfileEffectsAdded += ensureMissileAreaRemove.created;
    summary.weaponProfileEffectsUpdated += ensureMissileAreaRemove.updated;
    if (ensureMissileAreaRemove.missingWeapon) {
        warnings.push('Missing weapon "Missile Launcher" - profile Area removal patch skipped.');
    } else if (ensureMissileAreaRemove.missingProfiles) {
        warnings.push('Missing second modification for "Missile Launcher" - profile Area removal patch skipped.');
    } else if (ensureMissileAreaRemove.missingEffect) {
        warnings.push('Missing effect "Area" (WEAPON) - cannot patch Missile Launcher profile removal.');
    }

    const ripperPatch = await clearRipperModificationTestOverride();
    if (ripperPatch === 'updated') summary.weaponProfilesUpdated += 1;
    if (ripperPatch === 'missing') warnings.push('Missing weapon "Ripper" - modification Test patch skipped.');

    const removeCrusaderSecondMod = await removeCrusaderPistolSecondModification();
    if (removeCrusaderSecondMod === 'removed') summary.weaponProfilesRemoved += 1;
    if (removeCrusaderSecondMod === 'missing') warnings.push('Second modification for "Crusader Pistol" not found.');

    const huntingRifleAimBase = await ensureBaseWeaponEffect(
        'Hunting Rifle',
        'Aim',
        EffectKind.WEAPON,
        1,
        null
    );
    if (huntingRifleAimBase === 'created') summary.weaponBaseEffectsAdded += 1;
    if (huntingRifleAimBase === 'updated') summary.weaponBaseEffectsUpdated += 1;
    if (huntingRifleAimBase === 'missing_weapon') warnings.push('Missing weapon "Hunting Rifle" - base Aim patch skipped.');
    if (huntingRifleAimBase === 'missing_effect') warnings.push('Missing effect "Aim" (WEAPON) - cannot patch Hunting Rifle.');

    const huntingProfileAimRemove = await removeProfileEffect(
        'Hunting Rifle',
        1,
        'Aim',
        EffectKind.WEAPON
    );
    if (huntingProfileAimRemove.missingWeapon) {
        warnings.push('Missing weapon "Hunting Rifle" - profile Aim patch skipped.');
    } else {
        summary.weaponProfileEffectsRemoved += huntingProfileAimRemove.removed;
    }

    const packUnits = [
        'Alpha (The Pack)',
        'Psycho (The Pack)',
        'Scavver (The Pack)',
        'Waster (The Pack)',
        'Top Dog (The Pack)',
    ];
    for (const unitName of packUnits) {
        const status = await ensureUnitHasPerk(unitName, 'SPRINT');
        if (status === 'created') summary.unitPerksAdded += 1;
        if (status === 'missing_unit') warnings.push(`Missing unit "${unitName}" - Sprint add skipped.`);
        if (status === 'missing_perk') warnings.push('Missing perk "SPRINT" - cannot patch The Pack models.');
    }

    const topDogStats = await patchUnitStats('Top Dog (The Pack)', { e: 5 });
    if (topDogStats === 'updated') summary.unitStatsUpdated += 1;
    if (topDogStats === 'missing') warnings.push('Missing unit "Top Dog (The Pack)" - Endurance patch skipped.');

    const disciplesWasterStats = await patchUnitStats('Waster (The Disciples)', {
        p: 3,
        e: 3,
        c: 3,
        i: 3,
        a: 3,
        l: 1,
    });
    if (disciplesWasterStats === 'updated') summary.unitStatsUpdated += 1;
    if (disciplesWasterStats === 'missing') warnings.push('Missing unit "Waster (The Disciples)" - stat patch skipped.');

    const bottleRemovePerk = await removeUnitPerk('Bottle and Cappy, All Fizzed Up', 'FOUR LEAF CLOVER');
    if (bottleRemovePerk === 'removed') summary.unitPerksRemoved += 1;
    if (bottleRemovePerk === 'missing_unit') warnings.push('Missing unit "Bottle and Cappy, All Fizzed Up" - perk removal skipped.');
    if (bottleRemovePerk === 'missing_perk') warnings.push('Missing perk "FOUR LEAF CLOVER" - legend perk removal skipped.');

    const ghoulStats = await patchUnitStats('The Ghoul', { p: 5, a: 5 });
    if (ghoulStats === 'updated') summary.unitStatsUpdated += 1;
    if (ghoulStats === 'missing') warnings.push('Missing unit "The Ghoul" - stat patch skipped.');

    const ghoulRemovePerk = await removeUnitPerk('The Ghoul', 'BLOODY MESS');
    if (ghoulRemovePerk === 'removed') summary.unitPerksRemoved += 1;
    if (ghoulRemovePerk === 'missing_unit') warnings.push('Missing unit "The Ghoul" - BLOODY MESS removal skipped.');
    if (ghoulRemovePerk === 'missing_perk') warnings.push('Missing perk "BLOODY MESS" - The Ghoul perk removal skipped.');

    const bruteRating = await patchBruteLaserRifleOptionValue(40);
    if (bruteRating === 'updated') summary.weaponOptionsUpdated += 1;
    if (bruteRating === 'missing') warnings.push('No Brute Laser Rifle weapon option found - rating/cost patch skipped.');

    const partyTimeGoalUpdates = await updateFactionGoalDescription(
        'You use a Raiders Ploy.',
        'You use a Wasteland Raiders Ploy.'
    );
    summary.factionGoalsUpdated += partyTimeGoalUpdates;

    const oursByRightTargetResult = await updateOursByRightBuildFacilityTarget();
    summary.factionGoalsUpdated += oursByRightTargetResult.updated;
    if (oursByRightTargetResult.found === 0) {
        warnings.push('No "Ours By Right" Tier 1 "You build a Facility" goal was found.');
    }

    console.log('seed-delta-04 completed.');
    console.log(
        [
            `Perk descriptions updated: ${summary.perkDescriptionsUpdated}`,
            `Effect descriptions updated: ${summary.effectDescriptionsUpdated}`,
            `Ploy descriptions updated: ${summary.ployDescriptionsUpdated}`,
            `Chem effects updated: ${summary.chemEffectsUpdated}`,
            `Unit stats updated: ${summary.unitStatsUpdated}`,
            `Unit perks added: ${summary.unitPerksAdded}, removed: ${summary.unitPerksRemoved}`,
            `Weapon Fast traits removed: ${summary.weaponFastTraitsRemoved}`,
            `Weapon profiles updated: ${summary.weaponProfilesUpdated}, removed: ${summary.weaponProfilesRemoved}`,
            `Weapon base effects added: ${summary.weaponBaseEffectsAdded}, updated: ${summary.weaponBaseEffectsUpdated}`,
            `Weapon profile effects added: ${summary.weaponProfileEffectsAdded}, updated: ${summary.weaponProfileEffectsUpdated}, removed: ${summary.weaponProfileEffectsRemoved}`,
            `Weapon option ratings updated: ${summary.weaponOptionsUpdated}`,
            `Faction goals updated: ${summary.factionGoalsUpdated}`,
        ].join('\n')
    );

    if (warnings.length > 0) {
        console.log('seed-delta-04 warnings:');
        for (const warning of warnings) {
            console.log(`- ${warning}`);
        }
    }
}

main()
    .catch((error) => {
        console.error('seed-delta-04 failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
