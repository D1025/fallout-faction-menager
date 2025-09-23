import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { FactionUpsertSchema } from "@/lib/validation/faction";

export async function PATCH(req: Request, ctx: unknown) {
    try {
        const { params } = ctx as { params: { id: string } };
        const id = params.id;

        const session = await auth();
        if (session?.user.role !== "ADMIN") {
            return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
        }

        const body = await req.json().catch(() => null);
        const parsed = FactionUpsertSchema.safeParse(body);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: "VALIDATION", details: parsed.error.flatten() }), { status: 400 });
        }
        const { name, limits } = parsed.data;

        const updated = await prisma.$transaction(async (tx) => {
            await tx.faction.update({ where: { id }, data: { name } });
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
            return tx.faction.findUnique({ where: { id }, include: { limits: true } });
        });

        return new Response(JSON.stringify(updated), { status: 200 });
    } catch (e) {
        console.error("PATCH /admin/factions/[id] error:", e);
        return new Response(JSON.stringify({ error: "SERVER_ERROR" }), { status: 500 });
    }
}

export async function DELETE(_req: Request, ctx: unknown) {
    try {
        const { params } = ctx as { params: { id: string } };
        const id = params.id;

        const session = await auth();
        if (session?.user.role !== "ADMIN") {
            return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
        }

        await prisma.$transaction([
            prisma.factionLimit.deleteMany({ where: { factionId: id } }),
            prisma.faction.delete({ where: { id } }),
        ]);

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e) {
        console.error("DELETE /admin/factions/[id] error:", e);
        return new Response(JSON.stringify({ error: "SERVER_ERROR" }), { status: 500 });
    }
}
