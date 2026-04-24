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
            console.log('seed-delta-06: DATABASE_URL host rewritten from "db" to "localhost" for local terminal run.');
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

type GoalSeed = {
    tier: number;
    description: string;
    target: number;
};

type GoalSetSeed = {
    name: string;
    aliases: string[];
    goals: GoalSeed[];
};

type Summary = {
    goalSetCreated: number;
    goalSetRenamed: number;
    goalSetRemoved: number;
    goalsCreated: number;
    goalsUpdated: number;
    goalsRemoved: number;
    survivorSetVerified: number;
};

const SUPER_MUTANTS_GOALSETS: GoalSetSeed[] = [
    {
        name: 'SURVIVAL OF THE FITTEST',
        aliases: ['DEAR HEARTS AND GENTLE PEOPLE'],
        goals: [
            { tier: 1, description: "You Upgrade a model's Strength or Endurance.", target: 4 },
            { tier: 1, description: 'You modify a weapon.', target: 3 },
            { tier: 1, description: 'A model in the crew Incapacitates an Enemy Champion.', target: 4 },
            { tier: 2, description: 'A model in the crew gains a Strength or Endurance Perk.', target: 2 },
            { tier: 2, description: 'An Enemy model Fails a Confusion Test.', target: 5 },
            { tier: 2, description: 'You end a game with fewer Incapacitated models than your opponent.', target: 3 },
            { tier: 3, description: 'You use a Super Mutant Ploy.', target: 6 },
            { tier: 3, description: 'You modify a weapon that already has two Modifications.', target: 3 },
            { tier: 3, description: 'You have a model with 8 Upgrades.', target: 1 },
        ],
    },
    {
        name: 'OURS BY RIGHT',
        aliases: ['MY HOME TOWN'],
        goals: [
            { tier: 1, description: 'You build a Facility.', target: 1 },
            { tier: 1, description: 'The crew earns at least 3 XP in a single game.', target: 2 },
            { tier: 1, description: 'A model in the crew passes a Confusion Test.', target: 5 },
            { tier: 2, description: 'Your crew has at least 5 Reach at the end of the Story Phase.', target: 3 },
            { tier: 2, description: 'Your crew finds a dose of Rare Chems.', target: 4 },
            { tier: 2, description: 'You force another player to become Nomadic.', target: 1 },
            { tier: 3, description: 'You have at least 100 Caps in your Stash.', target: 1 },
            { tier: 3, description: 'You play a Raid Objective as the Attacker.', target: 3 },
            { tier: 3, description: 'Your crew has at least 10 Reach.', target: 1 },
        ],
    },
    {
        name: 'DAWN OF A NEW AGE',
        aliases: ['EVERY TIME THAT I RETURN'],
        goals: [
            { tier: 1, description: 'You end a game with a model within 3" of at least 2 Objective or Search Tokens.', target: 2 },
            { tier: 1, description: 'You choose to play the Hunting Party Objective.', target: 1 },
            { tier: 1, description: 'A model in the crew gains a Perk.', target: 4 },
            { tier: 2, description: 'Your crew has at least 6 Scouting Points.', target: 1 },
            { tier: 2, description: 'You take the Devour Captive Story Action.', target: 1 },
            { tier: 2, description: 'A model in the crew Incapacitates an Enemy Champion with a Melee Attack.', target: 4 },
            { tier: 3, description: 'A model in the crew Incapacitates an Enemy Leader.', target: 3 },
            { tier: 3, description: 'You end a Story Phase with a Monument on your Home Turf.', target: 3 },
            { tier: 3, description: 'At least 7 of your models have a Perk that they did not start with.', target: 1 },
        ],
    },
];

const SURVIVOR_EXPECTED_LINES = ['DEAR HEARTS AND GENTLE PEOPLE', 'MY HOME TOWN', 'EVERY TIME THAT I RETURN'];

async function removeGoalSetIfSafe(
    setId: string
): Promise<{ removed: boolean; blockedByProgress: boolean }> {
    const goals = await prisma.factionGoal.findMany({
        where: { setId },
        select: { id: true },
    });
    if (goals.length > 0) {
        const goalIds = goals.map((g) => g.id);
        const progressCount = await prisma.armyGoalProgress.count({
            where: { goalId: { in: goalIds } },
        });
        if (progressCount > 0) {
            return { removed: false, blockedByProgress: true };
        }
        await prisma.factionGoal.deleteMany({
            where: { setId },
        });
    }

    await prisma.factionGoalSet.delete({
        where: { id: setId },
    });
    return { removed: true, blockedByProgress: false };
}

async function syncGoalSet(
    factionId: string,
    seed: GoalSetSeed,
    summary: Summary,
    warnings: string[]
): Promise<void> {
    const candidateNames = [seed.name, ...seed.aliases];
    const candidates = await prisma.factionGoalSet.findMany({
        where: {
            factionId,
            name: { in: candidateNames },
        },
        orderBy: [{ createdAt: 'asc' }],
        select: { id: true, name: true },
    });

    let primary = candidates.find((c) => c.name === seed.name) ?? candidates[0] ?? null;
    if (!primary) {
        primary = await prisma.factionGoalSet.create({
            data: {
                factionId,
                name: seed.name,
            },
            select: { id: true, name: true },
        });
        summary.goalSetCreated += 1;
    } else if (primary.name !== seed.name) {
        primary = await prisma.factionGoalSet.update({
            where: { id: primary.id },
            data: { name: seed.name },
            select: { id: true, name: true },
        });
        summary.goalSetRenamed += 1;
    }

    const duplicates = candidates.filter((c) => c.id !== primary!.id);
    for (const duplicate of duplicates) {
        const removeResult = await removeGoalSetIfSafe(duplicate.id);
        if (removeResult.removed) {
            summary.goalSetRemoved += 1;
        } else if (removeResult.blockedByProgress) {
            warnings.push(
                `Cannot remove duplicate Super Mutants goal set "${duplicate.name}" (${duplicate.id}) because campaign progress exists.`
            );
        }
    }

    const existingGoals = await prisma.factionGoal.findMany({
        where: { setId: primary.id },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
            id: true,
            tier: true,
            description: true,
            target: true,
            order: true,
        },
    });

    for (let i = 0; i < seed.goals.length; i += 1) {
        const next = seed.goals[i]!;
        const current = existingGoals[i];

        if (!current) {
            await prisma.factionGoal.create({
                data: {
                    setId: primary.id,
                    tier: next.tier,
                    description: next.description,
                    target: next.target,
                    order: i,
                },
            });
            summary.goalsCreated += 1;
            continue;
        }

        const changed =
            current.tier !== next.tier ||
            current.description !== next.description ||
            current.target !== next.target ||
            current.order !== i;

        if (!changed) continue;

        await prisma.factionGoal.update({
            where: { id: current.id },
            data: {
                tier: next.tier,
                description: next.description,
                target: next.target,
                order: i,
            },
        });
        summary.goalsUpdated += 1;
    }

    const extras = existingGoals.slice(seed.goals.length);
    for (const extra of extras) {
        const progressCount = await prisma.armyGoalProgress.count({
            where: { goalId: extra.id },
        });
        if (progressCount > 0) {
            warnings.push(
                `Cannot remove extra goal "${extra.description}" (${extra.id}) in set "${seed.name}" because campaign progress exists.`
            );
            continue;
        }
        await prisma.factionGoal.delete({
            where: { id: extra.id },
        });
        summary.goalsRemoved += 1;
    }
}

async function main(): Promise<void> {
    const summary: Summary = {
        goalSetCreated: 0,
        goalSetRenamed: 0,
        goalSetRemoved: 0,
        goalsCreated: 0,
        goalsUpdated: 0,
        goalsRemoved: 0,
        survivorSetVerified: 0,
    };
    const warnings: string[] = [];

    const superMutants = await prisma.faction.findFirst({
        where: { name: 'Super Mutants' },
        select: { id: true },
    });
    if (!superMutants) {
        console.log('seed-delta-06 completed.');
        console.log('Missing "Super Mutants" faction - no questline changes applied.');
        return;
    }

    for (const seed of SUPER_MUTANTS_GOALSETS) {
        await syncGoalSet(superMutants.id, seed, summary, warnings);
    }

    const survivors = await prisma.faction.findFirst({
        where: { name: 'Survivors' },
        select: { id: true },
    });
    if (!survivors) {
        warnings.push('Missing "Survivors" faction - cannot verify Survivor questline names.');
    } else {
        const survivorSets = await prisma.factionGoalSet.findMany({
            where: { factionId: survivors.id },
            select: { name: true },
        });
        const survivorNames = new Set(survivorSets.map((s) => s.name));
        for (const expectedName of SURVIVOR_EXPECTED_LINES) {
            if (survivorNames.has(expectedName)) {
                summary.survivorSetVerified += 1;
            } else {
                warnings.push(`Survivors quest line missing: "${expectedName}".`);
            }
        }
    }

    console.log('seed-delta-06 completed.');
    console.log(
        [
            `Goal sets created: ${summary.goalSetCreated}, renamed: ${summary.goalSetRenamed}, removed duplicates: ${summary.goalSetRemoved}`,
            `Goals created: ${summary.goalsCreated}, updated: ${summary.goalsUpdated}, removed extras: ${summary.goalsRemoved}`,
            `Survivors quest lines verified: ${summary.survivorSetVerified}/${SURVIVOR_EXPECTED_LINES.length}`,
        ].join('\n')
    );

    if (warnings.length > 0) {
        console.log('seed-delta-06 warnings:');
        for (const warning of warnings) {
            console.log(`- ${warning}`);
        }
    }
}

main()
    .catch((error) => {
        console.error('seed-delta-06 failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
