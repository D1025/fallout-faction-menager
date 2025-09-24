// app/api/admin/factions/[id]/upgrades/route.ts
import { auth } from "@/lib/authServer";
import { prisma } from "@/server/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const RuleSchema = z.object({
    statKey: z.enum(["hp", "S", "P", "E", "C", "I", "A", "L"]),
    ratingPerPoint: z.number().int().min(0),
});

const PayloadSchema = z.object({
    rules: z.array(RuleSchema).max(20),
});

// Uwaga: params jako Promise
type AsyncCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { id: factionId } = await ctx.params;

    const rows = await prisma.factionUpgradeRule.findMany({
        where: { factionId },
        orderBy: { statKey: "asc" },
    });

    return new Response(
        JSON.stringify({
            rules: rows.map((r) => ({ statKey: r.statKey, ratingPerPoint: r.ratingPerPoint })),
        }),
        { status: 200 },
    );
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
    const { rules } = parsed.data;

    await prisma.$transaction(async (tx) => {
        await tx.factionUpgradeRule.deleteMany({ where: { factionId } });
        if (rules.length) {
            await tx.factionUpgradeRule.createMany({
                data: rules.map((r) => ({
                    factionId,
                    statKey: r.statKey,
                    ratingPerPoint: r.ratingPerPoint,
                })),
            });
        }
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
