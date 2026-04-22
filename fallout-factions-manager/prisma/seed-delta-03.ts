import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { FACTION_PLOY_NAMES, PLOY_DEFINITIONS, STANDARD_PLOY_NAMES, SUBFACTION_PLOY_RULES } from './ploys-catalog.ts';

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
            console.log('seed-delta-03: DATABASE_URL host rewritten from "db" to "localhost" for local terminal run.');
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

type DeltaPloyRow = {
    id: string;
    name: string;
    description: string;
    sortOrder: number;
    isStandard: boolean;
};

type DeltaPloyDelegate = {
    findFirst(args: { where: { name: string } }): Promise<DeltaPloyRow | null>;
    findMany(args: { where: { name: { in: string[] } }; select: { id: true; name: true } }): Promise<Array<{ id: string; name: string }>>;
    create(args: { data: { name: string; description: string; sortOrder: number; isStandard: boolean } }): Promise<DeltaPloyRow>;
    update(args: {
        where: { id: string };
        data: { description: string; sortOrder: number; isStandard: boolean };
    }): Promise<DeltaPloyRow>;
};

type DeltaFactionNameRow = { id: string; name: string };
type DeltaSubfactionNameRow = { id: string; name: string };

type DeltaFactionsDelegate = {
    findMany(args: { where: { name: { in: string[] } }; select: { id: true; name: true } }): Promise<DeltaFactionNameRow[]>;
};

type DeltaSubfactionsDelegate = {
    findMany(args: { where: { name: { in: string[] } }; select: { id: true; name: true } }): Promise<DeltaSubfactionNameRow[]>;
};

type DeltaFactionPloyDelegate = {
    deleteMany(args: { where: { factionId: string } }): Promise<{ count: number }>;
    createMany(args: { data: Array<{ factionId: string; ployId: string }>; skipDuplicates?: boolean }): Promise<{ count: number }>;
};

type DeltaSubfactionPloyAllowDelegate = {
    deleteMany(args: { where: { subfactionId: string } }): Promise<{ count: number }>;
    createMany(args: { data: Array<{ subfactionId: string; ployId: string }>; skipDuplicates?: boolean }): Promise<{ count: number }>;
};

type DeltaSubfactionPloyDenyDelegate = {
    deleteMany(args: { where: { subfactionId: string } }): Promise<{ count: number }>;
    createMany(args: { data: Array<{ subfactionId: string; ployId: string }>; skipDuplicates?: boolean }): Promise<{ count: number }>;
};

const p = prisma as unknown as {
    ployDefinition: DeltaPloyDelegate;
    faction: DeltaFactionsDelegate;
    subfaction: DeltaSubfactionsDelegate;
    factionPloy: DeltaFactionPloyDelegate;
    subfactionPloyAllow: DeltaSubfactionPloyAllowDelegate;
    subfactionPloyDeny: DeltaSubfactionPloyDenyDelegate;
};

async function upsertPloyDefinition(input: {
    name: string;
    description: string;
    sortOrder: number;
    isStandard: boolean;
}): Promise<'created' | 'updated' | 'unchanged'> {
    const existing = await p.ployDefinition.findFirst({ where: { name: input.name } });
    if (!existing) {
        await p.ployDefinition.create({ data: input });
        return 'created';
    }

    const hasChanges =
        existing.description !== input.description ||
        existing.sortOrder !== input.sortOrder ||
        existing.isStandard !== input.isStandard;

    if (!hasChanges) return 'unchanged';

    await p.ployDefinition.update({
        where: { id: existing.id },
        data: {
            description: input.description,
            sortOrder: input.sortOrder,
            isStandard: input.isStandard,
        },
    });
    return 'updated';
}

async function main(): Promise<void> {
    const counters = {
        ploysCreated: 0,
        ploysUpdated: 0,
        ploysUnchanged: 0,
        factionLinksCreated: 0,
        subfactionAllowLinksCreated: 0,
        subfactionDenyLinksCreated: 0,
    };
    const warnings: string[] = [];

    const standardNames = new Set<string>(STANDARD_PLOY_NAMES);

    for (const def of PLOY_DEFINITIONS) {
        const result = await upsertPloyDefinition({
            name: def.name,
            description: def.description,
            sortOrder: def.sortOrder,
            isStandard: standardNames.has(def.name),
        });
        if (result === 'created') counters.ploysCreated += 1;
        else if (result === 'updated') counters.ploysUpdated += 1;
        else counters.ploysUnchanged += 1;
    }

    const allPloyNames = [
        ...PLOY_DEFINITIONS.map((item) => item.name),
        ...Object.values(FACTION_PLOY_NAMES).flatMap((names) => names),
        ...SUBFACTION_PLOY_RULES.flatMap((rule) => [...rule.allow, ...rule.deny]),
    ];
    const uniquePloyNames = [...new Set(allPloyNames)];
    const ployRows = await p.ployDefinition.findMany({
        where: { name: { in: uniquePloyNames } },
        select: { id: true, name: true },
    });
    const ployIdByName = new Map(ployRows.map((row) => [row.name, row.id] as const));
    const missingPloys = uniquePloyNames.filter((name) => !ployIdByName.has(name));
    if (missingPloys.length > 0) {
        throw new Error(`Missing ploy definitions after upsert: ${missingPloys.join(', ')}`);
    }

    const factionNames = Object.keys(FACTION_PLOY_NAMES);
    const factionRows = await p.faction.findMany({
        where: { name: { in: factionNames } },
        select: { id: true, name: true },
    });
    const factionIdByName = new Map(factionRows.map((row) => [row.name, row.id] as const));

    for (const factionName of factionNames) {
        const factionId = factionIdByName.get(factionName);
        if (!factionId) {
            warnings.push(`Missing faction "${factionName}" - faction ploy links skipped.`);
            continue;
        }
        const names = FACTION_PLOY_NAMES[factionName] ?? [];
        const data = names
            .map((name) => {
                const ployId = ployIdByName.get(name);
                if (!ployId) return null;
                return { factionId, ployId };
            })
            .filter((row): row is { factionId: string; ployId: string } => Boolean(row));

        await p.factionPloy.deleteMany({ where: { factionId } });
        if (data.length > 0) {
            const created = await p.factionPloy.createMany({
                data,
                skipDuplicates: true,
            });
            counters.factionLinksCreated += created.count;
        }
    }

    const subfactionNames = SUBFACTION_PLOY_RULES.map((rule) => rule.subfactionName);
    const subfactionRows = await p.subfaction.findMany({
        where: { name: { in: subfactionNames } },
        select: { id: true, name: true },
    });
    const subfactionIdByName = new Map(subfactionRows.map((row) => [row.name, row.id] as const));

    for (const rule of SUBFACTION_PLOY_RULES) {
        const subfactionId = subfactionIdByName.get(rule.subfactionName);
        if (!subfactionId) {
            warnings.push(`Missing subfaction "${rule.subfactionName}" - subfaction ploy rules skipped.`);
            continue;
        }

        const allowData = rule.allow
            .map((name) => {
                const ployId = ployIdByName.get(name);
                if (!ployId) return null;
                return { subfactionId, ployId };
            })
            .filter((row): row is { subfactionId: string; ployId: string } => Boolean(row));

        const denyData = rule.deny
            .map((name) => {
                const ployId = ployIdByName.get(name);
                if (!ployId) return null;
                return { subfactionId, ployId };
            })
            .filter((row): row is { subfactionId: string; ployId: string } => Boolean(row));

        await p.subfactionPloyAllow.deleteMany({ where: { subfactionId } });
        await p.subfactionPloyDeny.deleteMany({ where: { subfactionId } });

        if (allowData.length > 0) {
            const created = await p.subfactionPloyAllow.createMany({
                data: allowData,
                skipDuplicates: true,
            });
            counters.subfactionAllowLinksCreated += created.count;
        }
        if (denyData.length > 0) {
            const created = await p.subfactionPloyDeny.createMany({
                data: denyData,
                skipDuplicates: true,
            });
            counters.subfactionDenyLinksCreated += created.count;
        }
    }

    console.log('seed-delta-03 completed.');
    console.log(
        [
            `Ploys created: ${counters.ploysCreated}, updated: ${counters.ploysUpdated}, unchanged: ${counters.ploysUnchanged}`,
            `Faction ploy links created: ${counters.factionLinksCreated}`,
            `Subfaction allow links created: ${counters.subfactionAllowLinksCreated}`,
            `Subfaction deny links created: ${counters.subfactionDenyLinksCreated}`,
        ].join('\n')
    );

    if (warnings.length > 0) {
        console.log('seed-delta-03 warnings:');
        for (const w of warnings) console.log(`- ${w}`);
    }
}

main()
    .catch((error) => {
        console.error('seed-delta-03 failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
