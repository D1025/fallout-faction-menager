import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };
const p = prisma as unknown as {
    armyPlayed: {
        findMany: (args: unknown) => Promise<unknown[]>;
        findUnique: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
        create: (args: unknown) => Promise<unknown>;
    };
    armyShare: {
        findMany: (args: unknown) => Promise<unknown[]>;
        findFirst: (args: unknown) => Promise<unknown>;
    };
    unitInstance: {
        findMany: (args: unknown) => Promise<unknown[]>;
    };
};

const CreatePlayedArmySchema = z.object({
    opponentArmyId: z.string().min(1),
    boxesTotal: z.number().int().min(1).max(20).default(3),
});

async function canReadArmy(armyId: string, userId: string): Promise<boolean> {
    const army = await prisma.army.findUnique({
        where: { id: armyId },
        select: { ownerId: true },
    });
    if (!army) return false;
    if (army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId, userId },
        select: { id: true },
    });
    return Boolean(share);
}

async function canWriteArmy(armyId: string, userId: string): Promise<boolean> {
    const army = await prisma.army.findUnique({
        where: { id: armyId },
        select: { ownerId: true },
    });
    if (!army) return false;
    if (army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

function mapPlayedEntry(entry: {
    id: string;
    boxesTotal: number;
    boxesChecked: number;
    opponentArmy: {
        id: string;
        name: string;
        faction: { name: string };
        owner: { id: string; name: string; photoEtag: string | null };
    };
}) {
    return {
        id: entry.id,
        boxesTotal: entry.boxesTotal,
        boxesChecked: entry.boxesChecked,
        opponentArmy: {
            id: entry.opponentArmy.id,
            name: entry.opponentArmy.name,
            factionName: entry.opponentArmy.faction.name,
            owner: {
                id: entry.opponentArmy.owner.id,
                name: entry.opponentArmy.owner.name,
                photoEtag: entry.opponentArmy.owner.photoEtag,
            },
        },
    };
}

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const canRead = await canReadArmy(armyId, userId);
    if (!canRead) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const [entries, sharedArmies, capturedByUs] = await Promise.all([
        p.armyPlayed.findMany({
            where: { armyId },
            include: {
                opponentArmy: {
                    select: {
                        id: true,
                        name: true,
                        faction: { select: { name: true } },
                        owner: { select: { id: true, name: true, photoEtag: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        }),
        p.armyShare.findMany({
            where: { userId },
            include: {
                army: {
                    select: {
                        id: true,
                        name: true,
                        faction: { select: { name: true } },
                        owner: { select: { id: true, name: true, photoEtag: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        }),
        p.unitInstance.findMany({
            where: { capturedByArmyId: armyId },
            select: {
                id: true,
                capturedAt: true,
                unit: { select: { name: true } },
                army: {
                    select: {
                        id: true,
                        name: true,
                        faction: { select: { name: true } },
                        owner: { select: { id: true, name: true, photoEtag: true } },
                    },
                },
            },
            orderBy: { capturedAt: 'desc' },
        }),
    ]);

    const sharedCandidates = (sharedArmies as Array<{
        army: {
            id: string;
            name: string;
            faction: { name: string };
            owner: { id: string; name: string; photoEtag: string | null };
        };
    }>)
        .map((row) => row.army)
        .filter((a) => a.id !== armyId)
        .map((a) => ({
            id: a.id,
            name: a.name,
            factionName: a.faction.name,
            owner: {
                id: a.owner.id,
                name: a.owner.name,
                photoEtag: a.owner.photoEtag,
            },
        }));

    return new Response(
        JSON.stringify({
            played: (entries as Array<{
                id: string;
                boxesTotal: number;
                boxesChecked: number;
                opponentArmy: {
                    id: string;
                    name: string;
                    faction: { name: string };
                    owner: { id: string; name: string; photoEtag: string | null };
                };
            }>).map(mapPlayedEntry),
            sharedCandidates,
            capturedByUs: (capturedByUs as Array<{
                id: string;
                capturedAt: Date | null;
                unit: { name: string };
                army: {
                    id: string;
                    name: string;
                    faction: { name: string };
                    owner: { id: string; name: string; photoEtag: string | null };
                };
            }>).map((u) => ({
                unitId: u.id,
                unitName: u.unit.name,
                ownerArmy: {
                    id: u.army.id,
                    name: u.army.name,
                    factionName: u.army.faction.name,
                    owner: {
                        id: u.army.owner.id,
                        name: u.army.owner.name,
                        photoEtag: u.army.owner.photoEtag,
                    },
                },
                capturedAt: u.capturedAt?.toISOString() ?? null,
            })),
        }),
        { status: 200 },
    );
}

export async function POST(req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const canWrite = await canWriteArmy(armyId, userId);
    if (!canWrite) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const parsed = CreatePlayedArmySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }

    const { opponentArmyId, boxesTotal } = parsed.data;
    if (opponentArmyId === armyId) {
        return new Response(JSON.stringify({ error: 'ARMY_CANNOT_PLAY_AGAINST_ITSELF' }), { status: 400 });
    }

    const sharedCandidate = await p.armyShare.findFirst({
        where: { userId, armyId: opponentArmyId },
        select: { id: true },
    }) as { id: string } | null;
    if (!sharedCandidate) {
        return new Response(JSON.stringify({ error: 'OPPONENT_NOT_IN_SHARED_LIST' }), { status: 400 });
    }

    const existing = await p.armyPlayed.findUnique({
        where: {
            armyId_opponentArmyId: {
                armyId,
                opponentArmyId,
            },
        },
        select: { id: true, boxesChecked: true },
    }) as { id: string; boxesChecked: number } | null;

    const nextBoxesChecked = existing ? Math.min(existing.boxesChecked, boxesTotal) : 0;

    const row = existing
        ? await p.armyPlayed.update({
            where: { id: existing.id },
            data: {
                boxesTotal,
                boxesChecked: nextBoxesChecked,
            },
            include: {
                opponentArmy: {
                    select: {
                        id: true,
                        name: true,
                        faction: { select: { name: true } },
                        owner: { select: { id: true, name: true, photoEtag: true } },
                    },
                },
            },
        }) as {
            id: string;
            boxesTotal: number;
            boxesChecked: number;
            opponentArmy: {
                id: string;
                name: string;
                faction: { name: string };
                owner: { id: string; name: string; photoEtag: string | null };
            };
        }
        : await p.armyPlayed.create({
            data: {
                armyId,
                opponentArmyId,
                boxesTotal,
                boxesChecked: 0,
            },
            include: {
                opponentArmy: {
                    select: {
                        id: true,
                        name: true,
                        faction: { select: { name: true } },
                        owner: { select: { id: true, name: true, photoEtag: true } },
                    },
                },
            },
        }) as {
            id: string;
            boxesTotal: number;
            boxesChecked: number;
            opponentArmy: {
                id: string;
                name: string;
                faction: { name: string };
                owner: { id: string; name: string; photoEtag: string | null };
            };
        };

    return new Response(JSON.stringify({ ok: true, entry: mapPlayedEntry(row) }), { status: 201 });
}
