import { randomBytes } from 'crypto';
import { z } from 'zod';
import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

async function canManageShare(armyId: string, userId: string) {
    const row = await prisma.army.findUnique({
        where: { id: armyId },
        select: { ownerId: true },
    });
    if (!row) return { ok: false as const, found: false as const };
    if (row.ownerId !== userId) return { ok: false as const, found: true as const };
    return { ok: true as const, found: true as const };
}

function sharePath(token: string): string {
    return `/share/army/${token}`;
}

async function generateUniqueToken(): Promise<string> {
    for (let i = 0; i < 6; i++) {
        const token = randomBytes(24).toString('base64url');
        const existing = await prisma.armyPublicShare.findUnique({
            where: { token },
            select: { id: true },
        });
        if (!existing) return token;
    }
    throw new Error('TOKEN_GENERATION_FAILED');
}

function payloadFromRow(row: { enabled: boolean; token: string } | null) {
    if (!row || !row.enabled) return { enabled: false, token: null as string | null, path: null as string | null };
    return { enabled: true, token: row.token, path: sharePath(row.token) };
}

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const guard = await canManageShare(armyId, userId);
    if (!guard.found) return new Response('NOT_FOUND', { status: 404 });
    if (!guard.ok) return new Response('FORBIDDEN', { status: 403 });

    const share = await prisma.armyPublicShare.findUnique({
        where: { armyId },
        select: { enabled: true, token: true },
    });

    return new Response(JSON.stringify(payloadFromRow(share)), { status: 200 });
}

const PostSchema = z.object({
    action: z.enum(['ENABLE', 'REGENERATE']).default('ENABLE'),
});

export async function POST(req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const guard = await canManageShare(armyId, userId);
    if (!guard.found) return new Response('NOT_FOUND', { status: 404 });
    if (!guard.ok) return new Response('FORBIDDEN', { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(body ?? {});
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    const existing = await prisma.armyPublicShare.findUnique({
        where: { armyId },
        select: { id: true, token: true },
    });

    let updated: { enabled: boolean; token: string } | null = null;
    if (!existing) {
        const token = await generateUniqueToken();
        updated = await prisma.armyPublicShare.create({
            data: { armyId, token, enabled: true },
            select: { enabled: true, token: true },
        });
    } else if (parsed.data.action === 'REGENERATE') {
        const token = await generateUniqueToken();
        updated = await prisma.armyPublicShare.update({
            where: { id: existing.id },
            data: { token, enabled: true },
            select: { enabled: true, token: true },
        });
    } else {
        updated = await prisma.armyPublicShare.update({
            where: { id: existing.id },
            data: { enabled: true },
            select: { enabled: true, token: true },
        });
    }

    return new Response(JSON.stringify(payloadFromRow(updated)), { status: 200 });
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const guard = await canManageShare(armyId, userId);
    if (!guard.found) return new Response('NOT_FOUND', { status: 404 });
    if (!guard.ok) return new Response('FORBIDDEN', { status: 403 });

    const existing = await prisma.armyPublicShare.findUnique({
        where: { armyId },
        select: { id: true },
    });
    if (!existing) return new Response(JSON.stringify({ enabled: false, token: null, path: null }), { status: 200 });

    await prisma.armyPublicShare.update({
        where: { id: existing.id },
        data: { enabled: false },
    });

    return new Response(JSON.stringify({ enabled: false, token: null, path: null }), { status: 200 });
}

