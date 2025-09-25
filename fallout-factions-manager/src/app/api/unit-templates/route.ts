import { NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const factionId = searchParams.get('factionId');

    const where = factionId
        ? { OR: [{ factionId }, { factionId: null }] } // tylko z danej frakcji + ogólne
        : undefined;

    const rows = await prisma.unitTemplate.findMany({
        where,
        include: {
            options: {
                include: {
                    weapon1: { select: { id: true, name: true } },
                    weapon2: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: [{ factionId: 'asc' }, { name: 'asc' }],
    });

    const data = rows.map(t => ({
        id: t.id,
        name: t.name,
        roleTag: t.roleTag,
        factionId: t.factionId, // zwracamy dla kompletności
        options: t.options.map(o => ({
            id: o.id,
            costCaps: o.costCaps,
            rating: o.rating,
            weapon1Id: o.weapon1Id,
            weapon1Name: o.weapon1?.name ?? '',
            weapon2Id: o.weapon2Id ?? null,
            weapon2Name: o.weapon2?.name ?? null,
        })),
    }));

    return new Response(JSON.stringify(data), { status: 200 });
}
