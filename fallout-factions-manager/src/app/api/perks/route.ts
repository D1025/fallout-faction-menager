import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

export async function GET() {
    const rows = await prisma.perk.findMany({
        select: {
            id: true,
            name: true,
            requiresValue: true,
            statKey: true,
            minValue: true,
            isInnate: true,
            category: true,
        },
        orderBy: [{ name: 'asc' }],
    });
    return new Response(JSON.stringify(rows), { status: 200 });
}
