import { z } from 'zod';
import { auth } from '@/lib/authServer';
import { hashPassword, verifyPassword } from '@/lib/password';
import { normalizePasswordTransportHash, PASSWORD_TRANSPORT_HEX_LENGTH } from '@/lib/auth/passwordTransport';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ProfilePatchSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters.')
        .max(32, 'Username can be at most 32 characters.')
        .regex(/^[A-Za-z0-9._ -]+$/, 'Allowed characters: letters, digits, space, dot, underscore, hyphen.')
        .optional(),
    currentPasswordHash: z.string().length(PASSWORD_TRANSPORT_HEX_LENGTH, 'Invalid current password hash.').optional(),
    newPasswordHash: z.string().length(PASSWORD_TRANSPORT_HEX_LENGTH, 'Invalid new password hash.').optional(),
});

export async function GET() {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const profile = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            role: true,
            createdAt: true,
            photoEtag: true,
        },
    });
    if (!profile) return new Response('NOT_FOUND', { status: 404 });

    return new Response(
        JSON.stringify({
            ...profile,
            hasPhoto: Boolean(profile.photoEtag),
        }),
        { status: 200 },
    );
}

export async function PATCH(req: Request) {
    const session = await auth();
    const userId = session?.user?.id;
    const role = session?.user?.role;
    if (!userId || !role) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = ProfilePatchSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return new Response(JSON.stringify({ error: issue?.message ?? 'Invalid data.' }), { status: 400 });
    }

    const updates: { name?: string; passwordHash?: string } = {};

    const nextName = parsed.data.name?.replace(/\s+/g, ' ');
    if (nextName) {
        if (role === 'ADMIN') {
            return new Response(JSON.stringify({ error: 'Administrator profile data is fixed.' }), { status: 403 });
        }
        const adminName = (process.env.ADMIN_USERNAME ?? 'admin').trim();
        if (nextName.toLowerCase() === adminName.toLowerCase()) {
            return new Response(JSON.stringify({ error: 'This username is reserved.' }), { status: 400 });
        }

        const duplicate = await prisma.user.findFirst({
            where: {
                id: { not: userId },
                name: { equals: nextName, mode: 'insensitive' },
            },
            select: { id: true },
        });
        if (duplicate) {
            return new Response(JSON.stringify({ error: 'A user with this username already exists.' }), { status: 409 });
        }
        updates.name = nextName;
    }

    if (parsed.data.newPasswordHash) {
        if (role === 'ADMIN') {
            return new Response(JSON.stringify({ error: 'Administrator profile data is fixed.' }), { status: 403 });
        }

        const currentPasswordHash = normalizePasswordTransportHash(parsed.data.currentPasswordHash ?? '');
        const newPasswordHash = normalizePasswordTransportHash(parsed.data.newPasswordHash);
        if (!currentPasswordHash) {
            return new Response(JSON.stringify({ error: 'Provide current password.' }), { status: 400 });
        }
        if (!newPasswordHash) {
            return new Response(JSON.stringify({ error: 'Provide new password.' }), { status: 400 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true },
        });
        if (!currentUser?.passwordHash) {
            return new Response(JSON.stringify({ error: 'Cannot change password for this account.' }), { status: 409 });
        }

        const validCurrent = await verifyPassword(currentPasswordHash, currentUser.passwordHash).catch(() => false);
        if (!validCurrent) {
            return new Response(JSON.stringify({ error: 'Current password is incorrect.' }), { status: 400 });
        }

        updates.passwordHash = await hashPassword(newPasswordHash);
    }

    if (!Object.keys(updates).length) {
        return new Response(JSON.stringify({ error: 'No changes to save.' }), { status: 400 });
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: updates,
        select: {
            id: true,
            name: true,
            role: true,
            createdAt: true,
            photoEtag: true,
        },
    });

    return new Response(
        JSON.stringify({
            ...updated,
            hasPhoto: Boolean(updated.photoEtag),
        }),
        { status: 200 },
    );
}
