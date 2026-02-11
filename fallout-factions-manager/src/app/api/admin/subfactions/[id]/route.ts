import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
    name: z.string().trim().min(2),
});

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response('FORBIDDEN', { status: 403 });

    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });

    await prisma.subfaction.update({ where: { id }, data: { name: parsed.data.name } });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response('FORBIDDEN', { status: 403 });

    const { id } = await ctx.params;

    const inUse = await prisma.army.count({ where: { subfactionId: id } });
    if (inUse > 0) {
        return new Response(JSON.stringify({ error: 'Subfaction in use', armies: inUse }), { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
        await tx.subfactionUnitAllow.deleteMany({ where: { subfactionId: id } });
        await tx.subfactionUnitDeny.deleteMany({ where: { subfactionId: id } });
        await tx.subfactionWeaponAllow.deleteMany({ where: { subfactionId: id } });
        await tx.subfactionWeaponDeny.deleteMany({ where: { subfactionId: id } });
        await tx.subfaction.delete({ where: { id } });
    });

    return new Response(null, { status: 204 });
}
