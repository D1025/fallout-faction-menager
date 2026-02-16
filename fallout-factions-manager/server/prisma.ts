import { PrismaClient } from '@prisma/client';

const RUNTIME_DB_URL = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

declare global {
    // Allows singleton reuse in dev (HMR)
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

export const prisma =
    global.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
        // Only set datasource when URL is present, so local tooling keeps working
        datasources: RUNTIME_DB_URL ? { db: { url: RUNTIME_DB_URL } } : undefined,
    });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
