import { prisma } from '@/server/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.getAll('id').filter(Boolean);

    // zabezpieczenie przed bardzo długimi URLami / nadużyciem
    const limited = ids.slice(0, 100);

    const rows = limited.length
        ? await prisma.effect.findMany({
              where: { id: { in: limited } },
              select: { id: true, name: true, kind: true, description: true, requiresValue: true },
          })
        : [];

    return new Response(JSON.stringify({ items: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
