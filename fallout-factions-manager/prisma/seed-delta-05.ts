import { PrismaClient } from '@prisma/client';
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
            console.log('seed-delta-05: DATABASE_URL host rewritten from "db" to "localhost" for local terminal run.');
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

type BruteTargetOptionSpec = {
    weapon1Name: string;
    weapon2Name: string | null;
    costCaps: number;
    rating: number;
};

type BruteOptionRow = {
    id: string;
    weapon1Id: string;
    weapon2Id: string | null;
    costCaps: number;
    rating: number | null;
};

type BruteTargetOption = BruteOptionRow & {
    weapon1Name: string;
    weapon2Name: string | null;
    ratingTarget: number;
};

const BRUTE_TARGET_OPTIONS: BruteTargetOptionSpec[] = [
    { weapon1Name: 'Laser Rifle', weapon2Name: null, costCaps: 32, rating: 32 },
    { weapon1Name: 'Sledgehammer', weapon2Name: null, costCaps: 37, rating: 37 },
    { weapon1Name: 'Minigun', weapon2Name: null, costCaps: 48, rating: 48 },
];

function optionKey(weapon1Id: string, weapon2Id: string | null): string {
    return `${weapon1Id}|${weapon2Id ?? ''}`;
}

function chooseClosestTargetOption(
    sourceOption: BruteOptionRow | undefined,
    targets: BruteTargetOption[]
): BruteTargetOption {
    const sourceValue = sourceOption?.rating ?? sourceOption?.costCaps ?? 0;
    return [...targets].sort((a, b) => {
        const d1 = Math.abs((a.rating ?? a.costCaps) - sourceValue);
        const d2 = Math.abs((b.rating ?? b.costCaps) - sourceValue);
        if (d1 !== d2) return d1 - d2;
        return a.ratingTarget - b.ratingTarget;
    })[0]!;
}

async function main(): Promise<void> {
    const counters = {
        targetOptionsCreated: 0,
        targetOptionsUpdated: 0,
        duplicateOptionsFound: 0,
        legacyOptionsDeleted: 0,
        unitOptionsReassigned: 0,
        unitWeaponInstancesReset: 0,
        removedActiveModEntries: 0,
    };
    const warnings: string[] = [];

    const bruteTemplate = await prisma.unitTemplate.findFirst({
        where: { name: 'Brute' },
        select: { id: true },
    });

    if (!bruteTemplate) {
        console.log('seed-delta-05 completed.');
        console.log('Brute template not found - no changes applied.');
        return;
    }

    const requiredWeaponNames = Array.from(new Set(BRUTE_TARGET_OPTIONS.flatMap((o) => [o.weapon1Name, o.weapon2Name]).filter((v): v is string => Boolean(v))));
    const weaponRows = await prisma.weaponTemplate.findMany({
        where: { name: { in: requiredWeaponNames } },
        select: { id: true, name: true },
    });
    const weaponIdByName = new Map(weaponRows.map((w) => [w.name, w.id] as const));
    const missingWeapons = requiredWeaponNames.filter((name) => !weaponIdByName.has(name));
    if (missingWeapons.length > 0) {
        throw new Error(`Missing required weapons for seed-delta-05: ${missingWeapons.join(', ')}`);
    }

    const existingOptions = await prisma.unitWeaponOption.findMany({
        where: { unitId: bruteTemplate.id },
        select: {
            id: true,
            weapon1Id: true,
            weapon2Id: true,
            costCaps: true,
            rating: true,
        },
        orderBy: { id: 'asc' },
    });

    const optionsByKey = new Map<string, BruteOptionRow[]>();
    for (const row of existingOptions) {
        const key = optionKey(row.weapon1Id, row.weapon2Id);
        const list = optionsByKey.get(key) ?? [];
        list.push(row);
        optionsByKey.set(key, list);
    }

    const canonicalTargetOptions: BruteTargetOption[] = [];
    const duplicateOptionIds: string[] = [];

    for (const target of BRUTE_TARGET_OPTIONS) {
        const weapon1Id = weaponIdByName.get(target.weapon1Name)!;
        const weapon2Id = target.weapon2Name ? weaponIdByName.get(target.weapon2Name)! : null;
        const key = optionKey(weapon1Id, weapon2Id);
        const matches = optionsByKey.get(key) ?? [];

        let canonical: BruteOptionRow;
        if (matches.length === 0) {
            const created = await prisma.unitWeaponOption.create({
                data: {
                    unitId: bruteTemplate.id,
                    weapon1Id,
                    weapon2Id,
                    costCaps: target.costCaps,
                    rating: target.rating,
                },
                select: {
                    id: true,
                    weapon1Id: true,
                    weapon2Id: true,
                    costCaps: true,
                    rating: true,
                },
            });
            counters.targetOptionsCreated += 1;
            canonical = created;
        } else {
            canonical = matches[0]!;
            if (matches.length > 1) {
                const duplicates = matches.slice(1).map((m) => m.id);
                duplicateOptionIds.push(...duplicates);
                counters.duplicateOptionsFound += duplicates.length;
            }

            if (canonical.costCaps !== target.costCaps || canonical.rating !== target.rating) {
                canonical = await prisma.unitWeaponOption.update({
                    where: { id: canonical.id },
                    data: {
                        costCaps: target.costCaps,
                        rating: target.rating,
                    },
                    select: {
                        id: true,
                        weapon1Id: true,
                        weapon2Id: true,
                        costCaps: true,
                        rating: true,
                    },
                });
                counters.targetOptionsUpdated += 1;
            }
        }

        canonicalTargetOptions.push({
            ...canonical,
            weapon1Name: target.weapon1Name,
            weapon2Name: target.weapon2Name,
            ratingTarget: target.rating,
        });
    }

    const canonicalTargetOptionIdSet = new Set(canonicalTargetOptions.map((o) => o.id));
    const refreshedOptions = await prisma.unitWeaponOption.findMany({
        where: { unitId: bruteTemplate.id },
        select: {
            id: true,
            weapon1Id: true,
            weapon2Id: true,
            costCaps: true,
            rating: true,
        },
    });

    const legacyOptions = refreshedOptions.filter((o) => !canonicalTargetOptionIdSet.has(o.id));
    const forcedLegacyOptionIds = new Set<string>([...legacyOptions.map((o) => o.id), ...duplicateOptionIds]);
    const legacyOptionById = new Map(legacyOptions.map((o) => [o.id, o] as const));

    if (forcedLegacyOptionIds.size > 0) {
        const unitsToReassign = await prisma.unitInstance.findMany({
            where: {
                unitId: bruteTemplate.id,
                optionId: { in: [...forcedLegacyOptionIds] },
            },
            select: { id: true, optionId: true },
        });

        for (const unit of unitsToReassign) {
            const sourceOption = unit.optionId ? legacyOptionById.get(unit.optionId) : undefined;
            const targetOption = chooseClosestTargetOption(sourceOption, canonicalTargetOptions);

            await prisma.$transaction(async (tx) => {
                await tx.unitInstance.update({
                    where: { id: unit.id },
                    data: { optionId: targetOption.id },
                });

                const currentWeapons = await tx.weaponInstance.findMany({
                    where: { unitId: unit.id },
                    select: { id: true, activeMods: true },
                });
                counters.removedActiveModEntries += currentWeapons.reduce((sum, w) => sum + w.activeMods.length, 0);

                await tx.weaponInstance.deleteMany({
                    where: { unitId: unit.id },
                });

                const weaponTemplates = [targetOption.weapon1Id, targetOption.weapon2Id].filter((v): v is string => Boolean(v));
                for (const templateId of weaponTemplates) {
                    await tx.weaponInstance.create({
                        data: {
                            unitId: unit.id,
                            templateId,
                            activeMods: [],
                        },
                    });
                }
            });

            counters.unitOptionsReassigned += 1;
            counters.unitWeaponInstancesReset += 1;
        }
    }

    if (forcedLegacyOptionIds.size > 0) {
        const stillReferenced = await prisma.unitInstance.count({
            where: { optionId: { in: [...forcedLegacyOptionIds] } },
        });
        if (stillReferenced > 0) {
            warnings.push(
                `Legacy Brute options are still referenced by ${stillReferenced} unit instances - option cleanup skipped for safety.`
            );
        } else {
            const deleted = await prisma.unitWeaponOption.deleteMany({
                where: { id: { in: [...forcedLegacyOptionIds] } },
            });
            counters.legacyOptionsDeleted += deleted.count;
        }
    }

    console.log('seed-delta-05 completed.');
    console.log(
        [
            `Brute target options created: ${counters.targetOptionsCreated}, updated: ${counters.targetOptionsUpdated}`,
            `Duplicate target options found: ${counters.duplicateOptionsFound}, legacy options deleted: ${counters.legacyOptionsDeleted}`,
            `Brute unit instances reassigned: ${counters.unitOptionsReassigned}`,
            `Weapon instances reset: ${counters.unitWeaponInstancesReset}`,
            `Removed weapon active mod entries: ${counters.removedActiveModEntries}`,
        ].join('\n')
    );

    if (warnings.length > 0) {
        console.log('seed-delta-05 warnings:');
        for (const warning of warnings) {
            console.log(`- ${warning}`);
        }
    }
}

main()
    .catch((error) => {
        console.error('seed-delta-05 failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
