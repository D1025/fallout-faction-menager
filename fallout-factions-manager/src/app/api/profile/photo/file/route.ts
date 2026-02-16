import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const row = (await prisma.$queryRaw<
        { photoBytes: Uint8Array | null; photoMime: string | null; photoEtag: string | null }[]
    >`SELECT "photoBytes", "photoMime", "photoEtag" FROM "User" WHERE id = ${userId} LIMIT 1`)[0];

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

    return new Response(new Uint8Array(row.photoBytes), {
        status: 200,
        headers: {
            'Content-Type': row.photoMime || 'application/octet-stream',
            'Cache-Control': 'private, max-age=3600',
            ...(etag ? { ETag: `"${etag}"` } : {}),
        },
    });
}

