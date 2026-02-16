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

const PostSchema = z.object({ name: z.string().min(1).max(500) });
const PatchSchema = z.object({
    facilityId: z.string().cuid(),
    selected: z.boolean(),
});

export async function POST(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });
    if (!(await canWrite(id, userId))) return new Response('FORBIDDEN', { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

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

    const def = await prisma.homeFacilityDefinition.findUnique({
        where: { id: parsed.data.facilityId },
        select: { id: true, name: true },
    });
    if (!def) return new Response(JSON.stringify({ error: 'FACILITY_NOT_FOUND' }), { status: 404 });

    const turf = await prisma.homeTurf.upsert({
        where: { armyId: id },
        update: {},
        create: { armyId: id, hazard: '' },
        select: { id: true },
    });

    if (parsed.data.selected) {
        const existing = await prisma.homeFacility.findFirst({
            where: { turfId: turf.id, facilityDefId: def.id },
            select: { id: true },
        });
        if (!existing) {
            await prisma.homeFacility.create({
                data: {
                    turfId: turf.id,
                    name: def.name,
                    facilityDefId: def.id,
                },
            });
        }
    } else {
        await prisma.homeFacility.deleteMany({
            where: {
                turfId: turf.id,
                facilityDefId: def.id,
            },
        });
    }

    const selectedRows = await prisma.homeFacility.findMany({
        where: { turfId: turf.id, facilityDefId: { not: null } },
        select: { facilityDefId: true },
    });

    const selectedFacilityIds = Array.from(
        new Set(selectedRows.map((row) => row.facilityDefId).filter((v): v is string => Boolean(v))),
    );

    return new Response(JSON.stringify({ selectedFacilityIds }), { status: 200 });
}
