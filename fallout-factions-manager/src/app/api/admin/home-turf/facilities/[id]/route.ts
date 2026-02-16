import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { HomeTurfDefinitionSchema } from '@/lib/validation/homeTurf';

type AsyncCtx = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response('FORBIDDEN', { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = HomeTurfDefinitionSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    const updated = await prisma.homeFacilityDefinition.update({
        where: { id },
        data: parsed.data,
    });
    return new Response(JSON.stringify(updated), { status: 200 });
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response('FORBIDDEN', { status: 403 });

    await prisma.homeFacilityDefinition.delete({ where: { id } });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

