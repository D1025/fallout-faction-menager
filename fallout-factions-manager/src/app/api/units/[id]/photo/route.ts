import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { createHash } from 'crypto';
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from '@/lib/security/rateLimit';
import { MAX_IMAGE_UPLOAD_BYTES, SUPPORTED_IMAGE_UPLOAD_MIME_TYPES } from '@/lib/images/uploadConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = MAX_IMAGE_UPLOAD_BYTES;
const ALLOWED = new Set<string>(SUPPORTED_IMAGE_UPLOAD_MIME_TYPES);

async function canWriteByUnitId(unitId: string, userId: string): Promise<boolean> {
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
    return row.army.shares.some((s) => s.perm === 'WRITE');
}

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

export async function GET(_req: Request, ctx: Ctx) {
    const { id: unitId } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const ok = await canReadByUnitId(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    const row = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        select: { photoEtag: true, photoBytes: true },
    });
    if (!row) return new Response('NOT_FOUND', { status: 404 });

    return new Response(
        JSON.stringify({
            hasPhoto: Boolean(row.photoBytes),
            etag: row.photoEtag ?? null,
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, no-store',
            },
        },
    );
}

export async function POST(req: Request, ctx: Ctx) {
    const ip = getClientIp(req);
    const ipLimit = checkRateLimit({
        key: `upload:unit:ip:${ip}`,
        limit: 40,
        windowMs: 60_000,
    });
    if (!ipLimit.ok) return tooManyRequestsResponse(ipLimit.retryAfterSec);

    const { id: unitId } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const userLimit = checkRateLimit({
        key: `upload:unit:user:${userId}`,
        limit: 20,
        windowMs: 60_000,
    });
    if (!userLimit.ok) return tooManyRequestsResponse(userLimit.retryAfterSec);

    const ok = await canWriteByUnitId(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
        return new Response('Unsupported Media Type', { status: 415 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return new Response('No file', { status: 400 });

    if (!ALLOWED.has(file.type)) {
        return new Response(JSON.stringify({ error: 'BAD_TYPE', allowed: [...ALLOWED] }), { status: 415 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
        return new Response(JSON.stringify({ error: 'TOO_LARGE', maxBytes: MAX_BYTES }), { status: 413 });
    }

    const etag = createHash('sha1').update(buf).digest('hex');

    const photoUrl = `/api/units/${unitId}/photo/file`;

    await prisma.unitInstance.update({
        where: { id: unitId },
        data: {
            photoBytes: buf,
            photoMime: file.type,
            photoEtag: etag,
            // Clear legacy FS path to avoid state divergence.
            photoPath: null,
        },
    });

    return new Response(JSON.stringify({ url: photoUrl, etag }), { status: 201 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const { id: unitId } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const ok = await canWriteByUnitId(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    await prisma.unitInstance.update({
        where: { id: unitId },
        data: {
            photoBytes: null,
            photoMime: null,
            photoEtag: null,
            photoPath: null,
        },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}


