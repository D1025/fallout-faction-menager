import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function canReadByUnitId(unitId: string, userId: string): Promise<boolean> {
    const row = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        select: {
            army: {
                select: {
                    ownerId: true,
                    shares: { where: { userId }, select: { perm: true } },
                },
            },
        },
    });

    if (!row?.army) return false;
    if (row.army.ownerId === userId) return true;
    return row.army.shares.some((s) => s.perm === 'READ' || s.perm === 'WRITE');
}

export async function GET(req: Request, ctx: Ctx) {
    const { id: unitId } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const ok = await canReadByUnitId(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    const row = (await prisma.$queryRaw<
        { photoBytes: Uint8Array | null; photoMime: string | null; photoEtag: string | null }[]
    >`SELECT "photoBytes", "photoMime", "photoEtag" FROM "UnitInstance" WHERE id = ${unitId} LIMIT 1`)[0];

    if (!row?.photoBytes) return new Response('NOT_FOUND', { status: 404 });

    const etag = row.photoEtag ?? undefined;
    if (etag) {
        const inm = req.headers.get('if-none-match');
        if (inm && inm.replace(/"/g, '') === etag) {
            return new Response(null, {
                status: 304,
                headers: {
                    ETag: `"${etag}"`,
                    'Cache-Control': 'private, max-age=3600',
                },
            });
        }
    }

    const body = new Uint8Array(row.photoBytes);

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': row.photoMime || 'application/octet-stream',
            'Cache-Control': 'private, max-age=3600',
            ...(etag ? { ETag: `"${etag}"` } : {}),
        },
    });
}
