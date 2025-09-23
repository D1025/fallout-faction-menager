// src/app/api/armies/[id]/route.ts
import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";

export async function DELETE(_req: Request, ctx: unknown) {
    // Bezpieczne rzutowanie kontekstu na oczekiwany kształt
    const { params } = ctx as { params: { id: string } };
    const id = params.id;

    const session = await auth();
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
    }

    const army = await prisma.army.findUnique({
        where: { id },
        select: { ownerId: true },
    });

    if (!army || army.ownerId !== session.user.id) {
        return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
    }

    await prisma.$transaction([
        prisma.armyShare.deleteMany({ where: { armyId: id } }),
        prisma.unitInstance.deleteMany({ where: { armyId: id } }),
        prisma.resourceChange.deleteMany({ where: { armyId: id } }),
        prisma.army.delete({ where: { id } }),
    ]);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
