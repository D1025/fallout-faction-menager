import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { FactionUpsertSchema } from '@/lib/validation/faction';

export async function GET() {
    const list = await prisma.faction.findMany({ include: { limits: true }, orderBy: { name: 'asc' } });
    return new Response(JSON.stringify(list), { status: 200 });
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = FactionUpsertSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }
    const { name, limits } = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
        const f = await tx.faction.create({ data: { name } });
        if (limits.length) {
            await tx.factionLimit.createMany({
                data: limits.map((l) => ({
                    factionId: f.id,
                    tag: l.tag,
                    tier1: l.tier1 ?? null,
                    tier2: l.tier2 ?? null,
                    tier3: l.tier3 ?? null,
                })),
            });
        }
        return tx.faction.findUnique({ where: { id: f.id }, include: { limits: true } });
    });

    return new Response(JSON.stringify(created), { status: 201 });
}
