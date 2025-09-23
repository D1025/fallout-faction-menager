import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { WeaponUpsertSchema } from "@/lib/validation/weapon";

export async function PATCH(req: Request, ctx: unknown) {
    const { params } = ctx as { params: { id: string } };
    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = WeaponUpsertSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: "VALIDATION", details: parsed.error.flatten() }), { status: 400 });
    }
    const { name, notes, imagePath, profiles } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
        await tx.weaponTemplate.update({ where: { id: params.id }, data: { name, notes: notes ?? null, imagePath: imagePath ?? null } });

        // wyczyść stare profile + łączniki
        const oldProfiles = await tx.weaponProfile.findMany({ where: { weaponId: params.id }, select: { id: true } });
        await tx.weaponProfileEffect.deleteMany({ where: { profileId: { in: oldProfiles.map(p => p.id) } } });
        await tx.weaponProfile.deleteMany({ where: { weaponId: params.id } });

        // wstaw nowe
        for (const p of profiles) {
            const profile = await tx.weaponProfile.create({
                data: { weaponId: params.id, type: p.type, test: p.test, parts: p.parts ?? null, rating: p.rating ?? null },
            });
            const all = [
                ...p.weaponEffects.map(e => ({ ...e, profileId: profile.id })),
                ...p.criticalEffects.map(e => ({ ...e, profileId: profile.id })),
            ];
            if (all.length) {
                await tx.weaponProfileEffect.createMany({
                    data: all.map(e => ({ profileId: e.profileId, effectId: e.effectId, valueInt: e.valueInt ?? null })),
                });
            }
        }

        return tx.weaponTemplate.findUnique({
            where: { id: params.id },
            include: { profiles: { include: { effects: { include: { effect: true } } } } },
        });
    });

    return new Response(JSON.stringify(updated), { status: 200 });
}

export async function DELETE(_req: Request, ctx: unknown) {
    const { params } = ctx as { params: { id: string } };
    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });

    const profileIds = (await prisma.weaponProfile.findMany({ where: { weaponId: params.id }, select: { id: true } })).map(p => p.id);
    await prisma.$transaction([
        prisma.weaponProfileEffect.deleteMany({ where: { profileId: { in: profileIds } } }),
        prisma.weaponProfile.deleteMany({ where: { weaponId: params.id } }),
        prisma.weaponTemplate.delete({ where: { id: params.id } }),
    ]);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
