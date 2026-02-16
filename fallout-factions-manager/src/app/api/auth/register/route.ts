import { z } from 'zod';
import { prisma } from '@/server/prisma';
import { hashPassword } from '@/lib/password';
import { normalizePasswordTransportHash, PASSWORD_TRANSPORT_HEX_LENGTH } from '@/lib/auth/passwordTransport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters.')
        .max(32, 'Username can be at most 32 characters.')
        .regex(/^[A-Za-z0-9._ -]+$/, 'Allowed characters: letters, digits, space, dot, underscore, hyphen.'),
    passwordHash: z.string().length(PASSWORD_TRANSPORT_HEX_LENGTH, 'Invalid password hash.'),
});

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return new Response(JSON.stringify({ error: issue?.message ?? 'Invalid registration data.' }), { status: 400 });
    }

    const name = parsed.data.name.replace(/\s+/g, ' ');
    const passwordHashPayload = normalizePasswordTransportHash(parsed.data.passwordHash);
    if (!passwordHashPayload) {
        return new Response(JSON.stringify({ error: 'Invalid password hash.' }), { status: 400 });
    }

    const adminName = (process.env.ADMIN_USERNAME ?? 'admin').trim();
    if (name.toLowerCase() === adminName.toLowerCase()) {
        return new Response(JSON.stringify({ error: 'This username is reserved.' }), { status: 400 });
    }

    const existing = await prisma.user.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
    });
    if (existing) {
        return new Response(JSON.stringify({ error: 'A user with this username already exists.' }), { status: 409 });
    }

    const passwordHash = await hashPassword(passwordHashPayload);

    try {
        const user = await prisma.user.create({
            data: {
                name,
                passwordHash,
                role: 'USER',
            },
            select: { id: true, name: true },
        });
        return new Response(JSON.stringify(user), { status: 201 });
    } catch {
        return new Response(JSON.stringify({ error: 'Failed to create account.' }), { status: 500 });
    }
}
