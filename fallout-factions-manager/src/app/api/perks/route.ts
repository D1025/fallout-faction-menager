import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

export async function GET() {
    const rows = await prisma.perk.findMany({
        select: { id: true, name: true, requiresValue: true },
        orderBy: [{ name: 'asc' }],
    });
    return new Response(JSON.stringify(rows), { status: 200 });
}
