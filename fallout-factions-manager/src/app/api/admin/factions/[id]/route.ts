import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { FactionUpsertSchema } from '@/lib/validation/faction';

export const runtime = 'nodejs';

// W tej instalacji Next.js kontekst ma params jako Promise:
type AsyncCtx = { params: Promise<{ id: string }> };
type UnitTemplateFactionDelegate = {
    count(args: { where: { factionId: string } }): Promise<number>;
};

const p = prisma as unknown as { unitTemplateFaction: UnitTemplateFactionDelegate };

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const session = await auth();
    if (session?.user.role !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = FactionUpsertSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }
    const { name, limits } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
        await tx.faction.update({ where: { id }, data: { name } });

        // podmień limity 1:1
        await tx.factionLimit.deleteMany({ where: { factionId: id } });
        if (limits.length) {
            await tx.factionLimit.createMany({
                data: limits.map((l) => ({
                    factionId: id,
                    tag: l.tag,
                    tier1: l.tier1 ?? null,
                    tier2: l.tier2 ?? null,
                    tier3: l.tier3 ?? null,
                })),
            });
        }

        return tx.faction.findUnique({
            where: { id },
            include: { limits: true },
        });
    });

    return new Response(JSON.stringify(updated), { status: 200 });
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const session = await auth();
    if (session?.user.role !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
    }

    // Bezpiecznik: jeśli frakcja w użyciu, zwróć 409
    const [armies, templates] = await Promise.all([
        prisma.army.count({ where: { factionId: id } }),
        p.unitTemplateFaction.count({ where: { factionId: id } }),
    ]);
    if (armies > 0 || templates > 0) {
        return new Response(
            JSON.stringify({ error: 'Faction in use', armies, templates }),
            { status: 409 },
        );
    }

    // Usuń powiązane encje (limits, goal sets/goals, upgrade rules), potem frakcję
    await prisma.$transaction(async (tx) => {
        await tx.factionLimit.deleteMany({ where: { factionId: id } });

        const sets = await tx.factionGoalSet.findMany({
            where: { factionId: id },
            select: { id: true },
        });
        if (sets.length) {
            await tx.factionGoal.deleteMany({ where: { setId: { in: sets.map((s) => s.id) } } });
            await tx.factionGoalSet.deleteMany({ where: { factionId: id } });
        }

        await tx.factionUpgradeRule.deleteMany({ where: { factionId: id } });

        await tx.faction.delete({ where: { id } });
    });

    return new Response(null, { status: 204 });
}
