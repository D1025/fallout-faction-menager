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

const BodySchema = z.object({ name: z.string().min(1).max(500) });

export async function POST(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });
    if (!(await canWrite(id, userId))) return new Response('FORBIDDEN', { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    // Upewnij się, że turf istnieje
    const turf = await prisma.homeTurf.upsert({
        where: { armyId: id },
        update: {},
        create: { armyId: id, hazard: '' },
    });

    const fac = await prisma.homeFacility.create({
        data: { turfId: turf.id, name: parsed.data.name },
        select: { id: true, name: true },
    });

    return new Response(JSON.stringify(fac), { status: 201 });
}
