import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

export async function GET() {
    const rows = await prisma.unitTemplate.findMany({
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
