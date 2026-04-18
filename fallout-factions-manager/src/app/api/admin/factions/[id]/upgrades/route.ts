// app/api/admin/factions/[id]/upgrades/route.ts
import { auth } from "@/lib/authServer";
import { prisma } from "@/server/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const p = prisma as unknown as {
    factionUpgradeRule: {
        findMany: (args: unknown) => Promise<unknown[]>;
    };
    $transaction: <T>(fn: (tx: {
        factionUpgradeRule: {
            deleteMany: (args: unknown) => Promise<unknown>;
            createMany: (args: unknown) => Promise<unknown>;
        };
    }) => Promise<T>) => Promise<T>;
};

const RuleSchema = z.object({
    statKey: z.enum(["hp", "S", "P", "E", "C", "I", "A", "L"]),
    ratingPerPoint: z.number().int().min(0),
    ratingPerPointChampion: z.number().int().min(0).optional().nullable(),
});

const PayloadSchema = z.object({
    rules: z.array(RuleSchema).max(20),
});

function defaultChampionRating(statKey: string): number {
    const key = statKey === "hp" ? "HP" : statKey.toUpperCase();
    if (key === "HP") return 20;
    if (key === "S" || key === "P" || key === "A") return 10;
    if (key === "E" || key === "L") return 15;
    if (key === "C" || key === "I") return 8;
    return 0;
}

// Note: params are Promise-based in this setup
type AsyncCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { id: factionId } = await ctx.params;

    const rows = await p.factionUpgradeRule.findMany({
        where: { factionId },
        orderBy: { statKey: "asc" },
    }) as Array<{ statKey: string; ratingPerPoint: number; ratingPerPointChampion?: number | null }>;

    return new Response(
        JSON.stringify({
            rules: rows.map((r) => ({
                statKey: r.statKey,
                ratingPerPoint: r.ratingPerPoint,
                ratingPerPointChampion: r.ratingPerPointChampion ?? defaultChampionRating(r.statKey),
            })),
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
    const rules = parsed.data.rules.map((r) => ({
        ...r,
        ratingPerPointChampion: r.ratingPerPointChampion ?? defaultChampionRating(r.statKey),
    }));

    await p.$transaction(async (tx) => {
        await tx.factionUpgradeRule.deleteMany({ where: { factionId } });
        if (rules.length) {
            await tx.factionUpgradeRule.createMany({
                data: rules.map((r) => ({
                    factionId,
                    statKey: r.statKey,
                    ratingPerPoint: r.ratingPerPoint,
                    ratingPerPointChampion: r.ratingPerPointChampion,
                })),
            });
        }
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
