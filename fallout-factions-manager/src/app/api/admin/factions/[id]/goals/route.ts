// app/api/admin/factions/[id]/goals/route.ts
import { auth } from "@/lib/authServer";
import { prisma } from "@/server/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const GoalSchema = z.object({
    id: z.string().optional(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    description: z.string().trim().min(1),
    target: z.number().int().min(1),
    order: z.number().int().min(0).max(2),
});

const GoalSetSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    goals: z.array(GoalSchema).min(1),
});

const PayloadSchema = z.object({
    sets: z.array(GoalSetSchema).max(20),
});

// Uwaga: w tej instalacji Next.js kontekst ma params jako Promise
type AsyncCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { id: factionId } = await ctx.params;

    const rows = await prisma.factionGoalSet.findMany({
        where: { factionId },
        include: { goals: true },
        orderBy: { name: "asc" },
    });

    const data = rows.map((s) => ({
        id: s.id,
        name: s.name,
        goals: s.goals
            .sort((a, b) => a.tier - b.tier || a.order - b.order)
            .map((g) => ({
                id: g.id,
                tier: g.tier as 1 | 2 | 3,
                description: g.description,
                target: g.target,
                order: g.order,
            })),
    }));

    return new Response(JSON.stringify({ sets: data }), { status: 200 });
}

export async function PUT(req: Request, ctx: AsyncCtx) {
    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response("FORBIDDEN", { status: 403 });

    const { id: factionId } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parsed = PayloadSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }
    const { sets } = parsed.data;

    await prisma.$transaction(async (tx) => {
        const old = await tx.factionGoalSet.findMany({ where: { factionId }, select: { id: true } });
        if (old.length) {
            await tx.factionGoal.deleteMany({ where: { setId: { in: old.map((o) => o.id) } } });
            await tx.factionGoalSet.deleteMany({ where: { factionId } });
        }

        for (const s of sets) {
            const set = await tx.factionGoalSet.create({ data: { factionId, name: s.name } });
            if (s.goals?.length) {
                await tx.factionGoal.createMany({
                    data: s.goals.map((g) => ({
                        setId: set.id,
                        tier: g.tier,
                        description: g.description,
                        target: g.target,
                        order: g.order ?? 0,
                    })),
                });
            }
        }
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
