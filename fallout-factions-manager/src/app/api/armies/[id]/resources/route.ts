import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
    caps: z.number().int().min(0).optional(),
    parts: z.number().int().min(0).optional(),
    reach: z.number().int().min(0).optional(),
    exp:  z.number().int().min(0).optional(),
}).refine(
    (obj) => 'caps' in obj || 'parts' in obj || 'reach' in obj || 'exp' in obj,
    { message: 'At least one of caps/parts/reach/exp must be provided' }
);

async function canWrite(armyId: string, userId: string) {
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

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;
    const army = await prisma.army.findUnique({
        where: { id },
        select: { id: true, caps: true, parts: true, reach: true, exp: true },
    });
    if (!army) return new Response('NOT_FOUND', { status: 404 });
    return new Response(JSON.stringify(army), { status: 200 });
}

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(
            JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }),
            { status: 400 }
        );
    }
    const ok = await canWrite(id, userId);
    if (!ok) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const updated = await prisma.army.update({
        where: { id },
        data: parsed.data,
        select: { id: true, caps: true, parts: true, reach: true, exp: true },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
}
