import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type UnitChosenPerkDelegate = {
    create(args: { data: { unitId: string; perkId: string; valueInt: number | null }; select: { id: true } }): Promise<{ id: string }>;
    findMany(args: { where: { unitId: string }; select: { perkId: true; valueInt: true }; orderBy: { perkId: 'asc' | 'desc' } }): Promise<Array<{ perkId: string; valueInt: number | null }>>;
};

const p = prisma as unknown as { unitChosenPerk: UnitChosenPerkDelegate };

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
        return new Response(
            JSON.stringify({ error: 'Perk requires value. Użyj endpointu z valueInt (TODO).' }),
            { status: 400 },
        );
    }

    // upewniamy się, że unit istnieje
    const exists = await prisma.unitInstance.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!exists) return new Response('NOT_FOUND', { status: 404 });

    try {
        await p.unitChosenPerk.create({
            data: { unitId, perkId, valueInt: null },
            select: { id: true },
        });
    } catch {
        // @@unique([unitId, perkId]) -> duplikat
        return new Response(JSON.stringify({ ok: true, duplicated: true }), { status: 200 });
    }

    const chosen = await p.unitChosenPerk.findMany({
        where: { unitId },
        select: { perkId: true, valueInt: true },
        orderBy: { perkId: 'asc' },
    });

    return new Response(JSON.stringify({ ok: true, unitId, chosenPerks: chosen }), { status: 200 });
}
