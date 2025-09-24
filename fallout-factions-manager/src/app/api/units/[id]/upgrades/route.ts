import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

// dopasowane do nazwy folderu: [id]
type Ctx = { params: Promise<{ id: string }> };

const Input = z.object({
    statKey: z.enum(['S', 'P', 'E', 'C', 'I', 'A', 'L', 'hp']),
    delta: z.number().int(),
});

async function canWriteByUnit(unitId: string, userId: string) {
    const u = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        include: { army: true },
    });
    if (!u) return false;
    if (u.army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId: u.armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function POST(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const unitId = id;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = Input.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    const ok = await canWriteByUnit(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    const created = await prisma.statUpgrade.create({
        data: { unitId, statKey: parsed.data.statKey, delta: parsed.data.delta },
    });

    return new Response(JSON.stringify({ id: created.id }), { status: 201 });
}
