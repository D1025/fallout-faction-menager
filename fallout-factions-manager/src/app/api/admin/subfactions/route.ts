import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { z } from 'zod';

export const runtime = 'nodejs';

type SubRow = {
    id: string;
    name: string;
    factionId: string;
    unitAllows: Array<{ unitId: string }>;
    unitDenies: Array<{ unitId: string }>;
};

type SubfactionDelegate = {
    findMany(args: {
        where?: { factionId: string };
        select: {
            id: true;
            name: true;
            factionId: true;
            unitAllows: { select: { unitId: true } };
            unitDenies: { select: { unitId: true } };
        };
        orderBy: Array<{ factionId: 'asc' | 'desc' } | { name: 'asc' | 'desc' }>;
    }): Promise<SubRow[]>;
    create(args: { data: { factionId: string; name: string }; select: { id: true; name: true; factionId: true } }): Promise<{ id: string; name: string; factionId: string }>;
};

const p = prisma as unknown as { subfaction: SubfactionDelegate };

const CreateSchema = z.object({
    factionId: z.string().min(1),
    name: z.string().trim().min(2),
});

export async function GET(req: Request) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const factionId = searchParams.get('factionId');

    const rows = await p.subfaction.findMany({
        where: factionId ? { factionId } : undefined,
        select: {
            id: true,
            name: true,
            factionId: true,
            unitAllows: { select: { unitId: true } },
            unitDenies: { select: { unitId: true } },
        },
        orderBy: [{ factionId: 'asc' }, { name: 'asc' }],
    });

    const data = rows.map((s: SubRow) => ({
        id: s.id,
        name: s.name,
        factionId: s.factionId,
        unitAllowIds: s.unitAllows.map((x) => x.unitId),
        unitDenyIds: s.unitDenies.map((x) => x.unitId),
    }));

    return new Response(JSON.stringify(data), { status: 200 });
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    const { factionId, name } = parsed.data;

    const created = await p.subfaction.create({
        data: { factionId, name },
        select: { id: true, name: true, factionId: true },
    });

    return new Response(
        JSON.stringify({
            id: created.id,
            name: created.name,
            factionId: created.factionId,
            unitAllowIds: [],
            unitDenyIds: [],
        }),
        { status: 201 },
    );
}
