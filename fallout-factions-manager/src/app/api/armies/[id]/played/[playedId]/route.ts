import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string; playedId: string }> };
const p = prisma as unknown as {
    armyPlayed: {
        findFirst: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
        delete: (args: unknown) => Promise<unknown>;
    };
};

const UpdatePlayedArmySchema = z
    .object({
        boxesTotal: z.number().int().min(1).max(20).optional(),
        boxesChecked: z.number().int().min(0).optional(),
    })
    .refine((v) => v.boxesTotal != null || v.boxesChecked != null, {
        message: 'At least one field must be provided.',
    });

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

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id: armyId, playedId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const canWrite = await canWriteArmy(armyId, userId);
    if (!canWrite) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const parsed = UpdatePlayedArmySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }

    const row = await p.armyPlayed.findFirst({
        where: { id: playedId, armyId },
        select: { id: true, boxesTotal: true, boxesChecked: true },
    }) as { id: string; boxesTotal: number; boxesChecked: number } | null;
    if (!row) return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 });

    const nextBoxesTotal = parsed.data.boxesTotal ?? row.boxesTotal;
    const rawBoxesChecked = parsed.data.boxesChecked ?? row.boxesChecked;
    const nextBoxesChecked = Math.max(0, Math.min(nextBoxesTotal, rawBoxesChecked));

    const updated = await p.armyPlayed.update({
        where: { id: row.id },
        data: {
            boxesTotal: nextBoxesTotal,
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
    };

    return new Response(JSON.stringify({ ok: true, entry: mapPlayedEntry(updated) }), { status: 200 });
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id: armyId, playedId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const canWrite = await canWriteArmy(armyId, userId);
    if (!canWrite) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const row = await p.armyPlayed.findFirst({
        where: { id: playedId, armyId },
        select: { id: true },
    }) as { id: string } | null;
    if (!row) return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 });

    await p.armyPlayed.delete({ where: { id: row.id } });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
