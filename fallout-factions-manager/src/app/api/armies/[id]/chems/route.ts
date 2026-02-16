import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
    chemId: z.string().min(1),
    quantity: z.number().int().min(0).max(3),
});

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
    const { id: armyId } = await ctx.params;

    const army = await prisma.army.findUnique({
        where: { id: armyId },
        select: { id: true },
    });
    if (!army) return new Response('NOT_FOUND', { status: 404 });

    const [defs, owned] = await Promise.all([
        prisma.chem.findMany({
            orderBy: [{ rarity: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
            select: {
                id: true,
                name: true,
                rarity: true,
                costCaps: true,
                effect: true,
                sortOrder: true,
            },
        }),
        prisma.armyChem.findMany({
            where: { armyId },
            select: { chemId: true, quantity: true },
        }),
    ]);

    const qtyByChemId = new Map(owned.map((row) => [row.chemId, row.quantity]));
    const chems = defs.map((chem) => ({
        ...chem,
        quantity: qtyByChemId.get(chem.id) ?? 0,
    }));

    return new Response(JSON.stringify({ armyId, chems }), { status: 200 });
}

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(
            JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }),
            { status: 400 },
        );
    }

    const allowed = await canWrite(armyId, userId);
    if (!allowed) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const { chemId, quantity } = parsed.data;
    const chem = await prisma.chem.findUnique({ where: { id: chemId }, select: { id: true } });
    if (!chem) return new Response(JSON.stringify({ error: 'CHEM_NOT_FOUND' }), { status: 404 });

    const updated = await prisma.armyChem.upsert({
        where: { armyId_chemId: { armyId, chemId } },
        create: { armyId, chemId, quantity },
        update: { quantity },
        select: { armyId: true, chemId: true, quantity: true },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
}
