import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

type ArmyAccessRow = {
    id: string;
    ownerId: string;
    deleted: boolean;
};

const RenameArmySchema = z.object({
    name: z.string().trim().min(3).max(120),
});

async function getArmyAccessRow(armyId: string): Promise<ArmyAccessRow | null> {
    return (await prisma.army.findUnique({
        where: { id: armyId },
        select: { id: true, ownerId: true, deleted: true },
    })) as ArmyAccessRow | null;
}

async function hasArmyNameConflict(ownerId: string, name: string, excludeArmyId?: string): Promise<boolean> {
    const found = await prisma.army.findFirst({
        where: {
            ownerId,
            deleted: false,
            ...(excludeArmyId ? { id: { not: excludeArmyId } } : {}),
            name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
    });
    return Boolean(found);
}

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const army = await getArmyAccessRow(armyId);
    if (!army || army.deleted) return new Response('NOT_FOUND', { status: 404 });
    if (army.ownerId !== userId) return new Response('FORBIDDEN', { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = RenameArmySchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }
    const { name } = parsed.data;

    if (await hasArmyNameConflict(userId, name, armyId)) {
        return new Response(
            JSON.stringify({
                error: 'ARMY_NAME_EXISTS',
                details: 'You already have an active army with this name.',
                field: 'name',
            }),
            { status: 409 },
        );
    }

    await prisma.army.update({
        where: { id: armyId },
        data: { name },
    });

    return new Response(JSON.stringify({ ok: true, id: armyId, name }), { status: 200 });
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const army = await getArmyAccessRow(armyId);
    if (!army || army.deleted) return new Response('NOT_FOUND', { status: 404 });
    if (army.ownerId !== userId) return new Response('FORBIDDEN', { status: 403 });

    await prisma.$transaction([
        prisma.army.update({
            where: { id: armyId },
            data: { deleted: true },
        }),
        prisma.armyPublicShare.updateMany({
            where: { armyId, enabled: true },
            data: { enabled: false },
        }),
    ]);

    return new Response(JSON.stringify({ ok: true, deleted: true }), { status: 200 });
}
