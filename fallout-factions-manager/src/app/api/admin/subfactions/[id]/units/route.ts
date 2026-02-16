import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

const Payload = z.object({
    allowIds: z.array(z.string().min(1)).default([]),
    denyIds: z.array(z.string().min(1)).default([]),
}).superRefine((v, ctx) => {
    const overlap = v.allowIds.filter((x) => v.denyIds.includes(x));
    if (overlap.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['denyIds'],
            message: 'The same unit cannot be in both allow and deny: ' + overlap.slice(0, 5).join(', '),
        });
    }
});

export async function PUT(req: Request, ctx: AsyncCtx) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response('FORBIDDEN', { status: 403 });

    const { id: subfactionId } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parsed = Payload.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });

    const { allowIds, denyIds } = parsed.data;

    await prisma.$transaction(async (tx) => {
        await tx.subfactionUnitAllow.deleteMany({ where: { subfactionId } });
        await tx.subfactionUnitDeny.deleteMany({ where: { subfactionId } });

        if (allowIds.length) {
            await tx.subfactionUnitAllow.createMany({
                data: allowIds.map((unitId) => ({ subfactionId, unitId })),
                skipDuplicates: true,
            });
        }
        if (denyIds.length) {
            await tx.subfactionUnitDeny.createMany({
                data: denyIds.map((unitId) => ({ subfactionId, unitId })),
                skipDuplicates: true,
            });
        }
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
