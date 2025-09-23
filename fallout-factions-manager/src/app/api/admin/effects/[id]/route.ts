import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { EffectUpsertSchema } from "@/lib/validation/effect";

export async function PATCH(req: Request, ctx: unknown) {
    const { params } = ctx as { params: { id: string } };
    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response("FORBIDDEN", { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = EffectUpsertSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });

    const updated = await prisma.effect.update({ where: { id: params.id }, data: parsed.data });
    return new Response(JSON.stringify(updated), { status: 200 });
}

export async function DELETE(_req: Request, ctx: unknown) {
    const { params } = ctx as { params: { id: string } };
    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response("FORBIDDEN", { status: 403 });

    await prisma.effect.delete({ where: { id: params.id } });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
