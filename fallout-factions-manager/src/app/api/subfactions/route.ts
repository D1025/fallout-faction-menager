import { NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

type SubfactionRow = { id: string; name: string; factionId: string };

type SubfactionDelegate = {
    findMany(args: {
        where: { factionId: string };
        orderBy: { name: 'asc' | 'desc' };
        select: { id: true; name: true; factionId: true };
    }): Promise<SubfactionRow[]>;
};

// Note: after schema.prisma changes, run `prisma generate`.
// Editor type cache may be stale, so `subfaction` delegate may be temporarily missing in TS types.
const p = prisma as unknown as { subfaction: SubfactionDelegate };

/**
 * GET /api/subfactions?factionId=...
 * Returns subfactions for the selected faction.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const factionId = searchParams.get('factionId');

    if (!factionId) {
        return new Response(JSON.stringify({ error: 'factionId is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const rows = await p.subfaction.findMany({
        where: { factionId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, factionId: true },
    });

    return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
