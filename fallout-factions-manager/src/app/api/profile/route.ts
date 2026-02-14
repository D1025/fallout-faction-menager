import { z } from 'zod';
import { auth } from '@/lib/authServer';
import { getPasswordValidationError, hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ProfilePatchSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, 'Nazwa uzytkownika musi miec co najmniej 3 znaki.')
        .max(32, 'Nazwa uzytkownika moze miec maksymalnie 32 znaki.')
        .regex(/^[A-Za-z0-9._ -]+$/, 'Dozwolone znaki: litery, cyfry, spacja, kropka, podkreslenie, myslnik.')
        .optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
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
        return new Response(JSON.stringify({ error: issue?.message ?? 'Niepoprawne dane.' }), { status: 400 });
    }

    const updates: { name?: string; passwordHash?: string } = {};

    const nextName = parsed.data.name?.replace(/\s+/g, ' ');
    if (nextName) {
        if (role === 'ADMIN') {
            return new Response(JSON.stringify({ error: 'Dane administratora sa odgornie ustalone.' }), { status: 403 });
        }
        const adminName = (process.env.ADMIN_USERNAME ?? 'admin').trim();
        if (nextName.toLowerCase() === adminName.toLowerCase()) {
            return new Response(JSON.stringify({ error: 'Ta nazwa uzytkownika jest zarezerwowana.' }), { status: 400 });
        }

        const duplicate = await prisma.user.findFirst({
            where: {
                id: { not: userId },
                name: { equals: nextName, mode: 'insensitive' },
            },
            select: { id: true },
        });
        if (duplicate) {
            return new Response(JSON.stringify({ error: 'Uzytkownik o takiej nazwie juz istnieje.' }), { status: 409 });
        }
        updates.name = nextName;
    }

    if (parsed.data.newPassword) {
        if (role === 'ADMIN') {
            return new Response(JSON.stringify({ error: 'Dane administratora sa odgornie ustalone.' }), { status: 403 });
        }

        const currentPassword = parsed.data.currentPassword ?? '';
        if (!currentPassword) {
            return new Response(JSON.stringify({ error: 'Podaj aktualne haslo.' }), { status: 400 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true },
        });
        if (!currentUser?.passwordHash) {
            return new Response(JSON.stringify({ error: 'Nie mozna zmienic hasla dla tego konta.' }), { status: 409 });
        }

        const validCurrent = await verifyPassword(currentPassword, currentUser.passwordHash).catch(() => false);
        if (!validCurrent) {
            return new Response(JSON.stringify({ error: 'Aktualne haslo jest niepoprawne.' }), { status: 400 });
        }

        const passwordValidation = getPasswordValidationError(parsed.data.newPassword);
        if (passwordValidation) {
            return new Response(JSON.stringify({ error: passwordValidation }), { status: 400 });
        }
        updates.passwordHash = await hashPassword(parsed.data.newPassword);
    }

    if (!Object.keys(updates).length) {
        return new Response(JSON.stringify({ error: 'Brak zmian do zapisania.' }), { status: 400 });
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

