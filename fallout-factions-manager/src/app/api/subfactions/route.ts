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

// Uwaga: po zmianie schema.prisma trzeba uruchomić `prisma generate`.
// W edytorze mogą być stare typy, więc delegat `subfaction` może chwilowo nie istnieć w typach TS.
const p = prisma as unknown as { subfaction: SubfactionDelegate };

/**
 * GET /api/subfactions?factionId=...
 * Zwraca subfrakcje dla wybranej frakcji.
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
