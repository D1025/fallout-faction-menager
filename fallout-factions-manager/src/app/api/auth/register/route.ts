import { z } from 'zod';
import { prisma } from '@/server/prisma';
import { getPasswordValidationError, hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, 'Nazwa uzytkownika musi miec co najmniej 3 znaki.')
        .max(32, 'Nazwa uzytkownika moze miec maksymalnie 32 znaki.')
        .regex(/^[A-Za-z0-9._ -]+$/, 'Dozwolone znaki: litery, cyfry, spacja, kropka, podkreslenie, myslnik.'),
    password: z
        .string()
        .min(PASSWORD_MIN_LENGTH, `Haslo musi miec co najmniej ${PASSWORD_MIN_LENGTH} znakow.`)
        .max(PASSWORD_MAX_LENGTH, `Haslo moze miec maksymalnie ${PASSWORD_MAX_LENGTH} znakow.`),
});

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return new Response(JSON.stringify({ error: issue?.message ?? 'Niepoprawne dane rejestracji.' }), { status: 400 });
    }

    const name = parsed.data.name.replace(/\s+/g, ' ');
    const password = parsed.data.password;

    const passwordValidation = getPasswordValidationError(password);
    if (passwordValidation) {
        return new Response(JSON.stringify({ error: passwordValidation }), { status: 400 });
    }

    const adminName = (process.env.ADMIN_USERNAME ?? 'admin').trim();
    if (name.toLowerCase() === adminName.toLowerCase()) {
        return new Response(JSON.stringify({ error: 'Ta nazwa uzytkownika jest zarezerwowana.' }), { status: 400 });
    }

    const existing = await prisma.user.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
    });
    if (existing) {
        return new Response(JSON.stringify({ error: 'Uzytkownik o takiej nazwie juz istnieje.' }), { status: 409 });
    }

    const passwordHash = await hashPassword(password);

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
        return new Response(JSON.stringify({ error: 'Nie udalo sie utworzyc konta.' }), { status: 500 });
    }
}

