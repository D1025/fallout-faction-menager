import { prisma } from '@/server/prisma';

export type ArmyPloySource = 'STANDARD' | 'FACTION' | 'SUBFACTION';

export type ArmyAvailablePloy = {
    id: string;
    name: string;
    description: string;
    sortOrder: number;
    source: ArmyPloySource;
};

export type GunnersResourcePointOption = {
    name: string;
    cost: number;
    description: string;
};

export type ArmyPloyReadModel = {
    mode: 'PLOYS' | 'GUNNERS_RESOURCE_POINTS';
    ploys: ArmyAvailablePloy[];
    gunnersResourcePoints: GunnersResourcePointOption[];
};

type PloyDefinitionRow = {
    id: string;
    name: string;
    description: string;
    sortOrder: number;
};

type FactionPloyRow = {
    ploy: PloyDefinitionRow;
};

type SubfactionPloyRules = {
    id: string;
    factionId: string;
    ployAllows: Array<{ ploy: PloyDefinitionRow }>;
    ployDenies: Array<{ ployId: string }>;
};

type PloyDefinitionDelegate = {
    findMany(args: {
        where: { isStandard?: boolean };
        select: { id: true; name: true; description: true; sortOrder: true };
        orderBy: Array<{ sortOrder: 'asc' | 'desc' } | { name: 'asc' | 'desc' }>;
    }): Promise<PloyDefinitionRow[]>;
};

type FactionPloyDelegate = {
    findMany(args: {
        where: { factionId: string };
        select: {
            ploy: {
                select: { id: true; name: true; description: true; sortOrder: true };
            };
        };
        orderBy: Array<{ ploy: { sortOrder: 'asc' | 'desc' } } | { ploy: { name: 'asc' | 'desc' } }>;
    }): Promise<FactionPloyRow[]>;
};

type SubfactionDelegate = {
    findUnique(args: {
        where: { id: string };
        select: {
            id: true;
            factionId: true;
            ployAllows: {
                select: {
                    ploy: {
                        select: { id: true; name: true; description: true; sortOrder: true };
                    };
                };
            };
            ployDenies: {
                select: {
                    ployId: true;
                };
            };
        };
    }): Promise<SubfactionPloyRules | null>;
};

const p = prisma as unknown as {
    ployDefinition: PloyDefinitionDelegate;
    factionPloy: FactionPloyDelegate;
    subfaction: SubfactionDelegate;
};

const GUNNERS_RESOURCE_POINTS: GunnersResourcePointOption[] = [
    {
        name: 'Radio Beacon',
        cost: 4,
        description:
            'Allows the crew to use a single Standard Ploy (or another external Ploy source) once per game.',
    },
    {
        name: 'Turret',
        cost: 3,
        description:
            'Friendly Grunt model with the Machine Perk. Cannot suffer Harm and can only make Open Fire Actions.',
    },
    {
        name: 'Forward Deployment Point',
        cost: 3,
        description:
            'Minor terrain feature; your models can Deploy within 3" as if this area were your Deployment Zone.',
    },
    {
        name: 'Minefield',
        cost: 2,
        description:
            '3" area hazard that can inflict Harm after movement unless models avoid or disable it.',
    },
    {
        name: 'Large Wall',
        cost: 2,
        description: 'Minor terrain wall that can Obscure Visibility.',
    },
    {
        name: 'Rad Barrels',
        cost: 2,
        description: 'Radiation token terrain option.',
    },
    {
        name: 'Small Wall',
        cost: 1,
        description: 'Minor terrain wall that can Obscure Visibility.',
    },
];

function isGunnersFactionName(name: string): boolean {
    return /\bgunners?\b/i.test(name);
}

export async function resolveAvailablePloysForArmy(input: {
    factionId: string;
    factionName: string;
    subfactionId?: string | null;
}): Promise<ArmyPloyReadModel> {
    if (isGunnersFactionName(input.factionName)) {
        return {
            mode: 'GUNNERS_RESOURCE_POINTS',
            ploys: [],
            gunnersResourcePoints: GUNNERS_RESOURCE_POINTS,
        };
    }

    const [standardRows, factionRows, subfaction] = await Promise.all([
        p.ployDefinition.findMany({
            where: { isStandard: true },
            select: { id: true, name: true, description: true, sortOrder: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        p.factionPloy.findMany({
            where: { factionId: input.factionId },
            select: {
                ploy: { select: { id: true, name: true, description: true, sortOrder: true } },
            },
            orderBy: [{ ploy: { sortOrder: 'asc' } }, { ploy: { name: 'asc' } }],
        }),
        input.subfactionId
            ? p.subfaction.findUnique({
                where: { id: input.subfactionId },
                select: {
                    id: true,
                    factionId: true,
                    ployAllows: { select: { ploy: { select: { id: true, name: true, description: true, sortOrder: true } } } },
                    ployDenies: { select: { ployId: true } },
                },
            })
            : Promise.resolve(null),
    ]);

    const byId = new Map<string, ArmyAvailablePloy>();

    for (const row of standardRows) {
        byId.set(row.id, {
            id: row.id,
            name: row.name,
            description: row.description,
            sortOrder: row.sortOrder,
            source: 'STANDARD',
        });
    }

    for (const row of factionRows) {
        const ploy = row.ploy;
        if (byId.has(ploy.id)) continue;
        byId.set(ploy.id, {
            id: ploy.id,
            name: ploy.name,
            description: ploy.description,
            sortOrder: ploy.sortOrder,
            source: 'FACTION',
        });
    }

    if (subfaction && subfaction.factionId === input.factionId) {
        for (const deny of subfaction.ployDenies) {
            byId.delete(deny.ployId);
        }
        for (const allow of subfaction.ployAllows) {
            const ploy = allow.ploy;
            const existing = byId.get(ploy.id);
            if (existing) continue;
            byId.set(ploy.id, {
                id: ploy.id,
                name: ploy.name,
                description: ploy.description,
                sortOrder: ploy.sortOrder,
                source: 'SUBFACTION',
            });
        }
    }

    const ploys = [...byId.values()].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
    });

    return {
        mode: 'PLOYS',
        ploys,
        gunnersResourcePoints: [],
    };
}
