import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

type TurfPayload = {
    hazardId: string | null;
    hazardLegacy: string;
    hazards: { id: string; name: string; description: string; sortOrder: number }[];
    facilities: { id: string; name: string; description: string; sortOrder: number }[];
    selectedFacilityIds: string[];
    legacyFacilities: { id: string; name: string }[];
};

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

async function loadTurfPayload(armyId: string): Promise<TurfPayload> {
    const [turf, hazards, facilities] = await Promise.all([
        prisma.homeTurf.findUnique({
            where: { armyId },
            include: {
                facilities: {
                    select: {
                        id: true,
                        name: true,
                        facilityDefId: true,
                    },
                },
            },
        }),
        prisma.homeHazardDefinition.findMany({
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, description: true, sortOrder: true },
        }),
        prisma.homeFacilityDefinition.findMany({
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, description: true, sortOrder: true },
        }),
    ]);

    const selectedFacilityIds = Array.from(
        new Set(
            (turf?.facilities ?? [])
                .map((f) => f.facilityDefId)
                .filter((id): id is string => Boolean(id)),
        ),
    );

    const legacyFacilities = (turf?.facilities ?? [])
        .filter((f) => !f.facilityDefId)
        .map((f) => ({ id: f.id, name: f.name }));

    return {
        hazardId: turf?.hazardDefId ?? null,
        hazardLegacy: turf?.hazard ?? '',
        hazards,
        facilities,
        selectedFacilityIds,
        legacyFacilities,
    };
}

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;
    const payload = await loadTurfPayload(id);
    return new Response(JSON.stringify(payload), { status: 200 });
}

const PatchSchema = z.object({
    hazardId: z.string().cuid().nullable(),
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

    if (parsed.data.hazardId) {
        const exists = await prisma.homeHazardDefinition.findUnique({
            where: { id: parsed.data.hazardId },
            select: { id: true },
        });
        if (!exists) {
            return new Response(JSON.stringify({ error: 'HAZARD_NOT_FOUND' }), { status: 404 });
        }
    }

    await prisma.homeTurf.upsert({
        where: { armyId: id },
        create: { armyId: id, hazard: '', hazardDefId: parsed.data.hazardId },
        update: { hazardDefId: parsed.data.hazardId },
    });

    const payload = await loadTurfPayload(id);
    return new Response(JSON.stringify(payload), { status: 200 });
}
