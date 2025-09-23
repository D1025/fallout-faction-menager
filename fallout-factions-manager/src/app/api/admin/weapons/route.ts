import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { WeaponUpsertSchema } from "@/lib/validation/weapon";

export async function GET() {
    const list = await prisma.weaponTemplate.findMany({
        include: {
            profiles: {
                include: { effects: { include: { effect: true } } }
            }
        },
        orderBy: { name: "asc" },
    });
    return new Response(JSON.stringify(list), { status: 200 });
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = WeaponUpsertSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: "VALIDATION", details: parsed.error.flatten() }), { status: 400 });
    }
    const { name, notes, imagePath, profiles } = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
        const t = await tx.weaponTemplate.create({ data: { name, notes: notes ?? null, imagePath: imagePath ?? null } });

        for (const p of profiles) {
            const profile = await tx.weaponProfile.create({
                data: { weaponId: t.id, type: p.type, test: p.test, parts: p.parts ?? null, rating: p.rating ?? null },
            });

            // weapon effects (kind=WEAPON) + criticals (kind=CRITICAL)
            const all = [
                ...p.weaponEffects.map(e => ({ ...e, profileId: profile.id })),
                ...p.criticalEffects.map(e => ({ ...e, profileId: profile.id })),
            ];
            if (all.length) {
                // walidacja: zgodność z kind zostawiamy po stronie UI; opcjonalnie można sprawdzić w DB
                await tx.weaponProfileEffect.createMany({
                    data: all.map(e => ({ profileId: e.profileId, effectId: e.effectId, valueInt: e.valueInt ?? null })),
                });
            }
        }

        return tx.weaponTemplate.findUnique({
            where: { id: t.id },
            include: { profiles: { include: { effects: { include: { effect: true } } } } },
        });
    });

    return new Response(JSON.stringify(created), { status: 201 });
}
