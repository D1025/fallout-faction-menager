import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

// dopasowane do nazwy folderu: [id]
type Ctx = { params: Promise<{ id: string }> };

const Input = z.object({ perkId: z.string().min(1) });

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
    const unitId = id; // <-- nazwę ujednolicamy lokalnie

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = Input.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    const { perkId } = parsed.data;

    const ok = await canWriteByUnit(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    const perk = await prisma.perk.findUnique({ where: { id: perkId } });
    if (!perk) return new Response('NOT_FOUND', { status: 404 });
    if (perk.requiresValue) {
        return new Response(JSON.stringify({ error: 'Perk requires value and is not supported for chosenPerkIds' }), { status: 400 });
    }

    const u = await prisma.unitInstance.findUnique({ where: { id: unitId }, select: { chosenPerkIds: true } });
    if (!u) return new Response('NOT_FOUND', { status: 404 });

    if (u.chosenPerkIds.includes(perkId)) {
        return new Response(JSON.stringify({ ok: true, duplicated: true }), { status: 200 });
    }

    const updated = await prisma.unitInstance.update({
        where: { id: unitId },
        data: { chosenPerkIds: { push: perkId } },
        select: { id: true, chosenPerkIds: true },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
}
