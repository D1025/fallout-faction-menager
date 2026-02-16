import { createHash } from 'crypto';
import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

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
    await prisma.user.update({
        where: { id: userId },
        data: {
            photoBytes: buf,
            photoMime: file.type,
            photoEtag: etag,
        },
    });

    return new Response(JSON.stringify({ url: '/api/profile/photo/file', etag }), { status: 201 });
}

export async function DELETE() {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    await prisma.user.update({
        where: { id: userId },
        data: {
            photoBytes: null,
            photoMime: null,
            photoEtag: null,
        },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

