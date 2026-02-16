import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

type AsyncCtx = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const share = await prisma.armyShare.findUnique({
        where: { id },
        select: { id: true, userId: true },
    });
    if (!share) return new Response('NOT_FOUND', { status: 404 });
    if (share.userId !== userId) return new Response('FORBIDDEN', { status: 403 });

    await prisma.armyShare.delete({ where: { id } });
    return new Response(null, { status: 204 });
}

