import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

async function canWrite(armyId: string, userId: string) {
    const army = await prisma.army.findUnique({ where: { id: armyId }, select: { ownerId: true } });
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

    const turf = await prisma.homeTurf.findUnique({
        where: { armyId: id },
        include: { facilities: { select: { id: true, name: true } } },
    });

    if (!turf) {
        // Brak rekordu – zwróć “puste” dane
        return new Response(
            JSON.stringify({ hazard: '', facilities: [] as { id: string; name: string }[] }),
            { status: 200 },
        );
    }

    return new Response(
        JSON.stringify({ hazard: turf.hazard, facilities: turf.facilities }),
        { status: 200 },
    );
}

const PatchSchema = z.object({
    hazard: z.string().max(2000).optional(), // dowolny string, może być pusty
});

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });
    if (!(await canWrite(id, userId))) return new Response('FORBIDDEN', { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    // Utwórz turf jeśli brak
    const updated = await prisma.homeTurf.upsert({
        where: { armyId: id },
        create: { armyId: id, hazard: parsed.data.hazard ?? '' },
        update: { hazard: parsed.data.hazard ?? '' },
        include: { facilities: { select: { id: true, name: true } } },
    });

    return new Response(
        JSON.stringify({ hazard: updated.hazard, facilities: updated.facilities }),
        { status: 200 },
    );
}
