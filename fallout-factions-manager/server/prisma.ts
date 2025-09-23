import { PrismaClient } from '@prisma/client';

const RUNTIME_DB_URL = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

declare global {
    // pozwala na singleton w dev (HMR)
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

export const prisma =
    global.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
        // tylko jeśli mamy URL – dzięki temu nie psujemy local toolingów
        datasources: RUNTIME_DB_URL ? { db: { url: RUNTIME_DB_URL } } : undefined,
    });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
