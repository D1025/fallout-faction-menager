// app/api/admin/unit-templates/[id]/route.ts
import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { z } from "zod";

export const runtime = "nodejs";

const OptionSchema = z.object({
    weapon1Id: z.string().min(1),
    weapon2Id: z.string().min(1).nullable().optional(),
    costCaps: z.number().int().nonnegative(),
    rating: z.number().int().nullable().optional(),
});
const StartPerkSchema = z.object({
    perkId: z.string().min(1),
    valueInt: z.number().int().nullable().optional(),
});
const UnitTemplateInput = z.object({
    name: z.string().min(1),
    factionId: z.string().min(1).nullable(),
    roleTag: z.string().min(1).nullable().optional(),
    hp: z.number().int().min(1),
    s: z.number().int(), p: z.number().int(), e: z.number().int(),
    c: z.number().int(), i: z.number().int(), a: z.number().int(), l: z.number().int(),
    baseRating: z.number().int().nullable().optional(),
    options: z.array(OptionSchema).min(1),
    startPerks: z.array(StartPerkSchema).optional().default([]),
});

type AsyncCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response("FORBIDDEN", { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = UnitTemplateInput.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }
    const v = parsed.data;

    await prisma.$transaction(async (tx) => {
        await tx.unitTemplate.update({
            where: { id },
            data: {
                name: v.name,
                factionId: v.factionId,
                roleTag: v.roleTag ?? null,
                hp: v.hp,
                s: v.s, p: v.p, e: v.e, c: v.c, i: v.i, a: v.a, l: v.l,
                baseRating: v.baseRating ?? null,
            },
        });

        // wyczyść istniejące opcje i zapisz nowe (wprost z weapon1/weapon2)
        await tx.unitWeaponOption.deleteMany({ where: { unitId: id } });

        await tx.unitWeaponOption.createMany({
            data: v.options.map(opt => ({
                unitId: id,
                weapon1Id: opt.weapon1Id,
                weapon2Id: opt.weapon2Id ?? null,
                costCaps: opt.costCaps,
                rating: opt.rating ?? null,
            })),
        });

        // startowe perki
        await tx.unitStartPerk.deleteMany({ where: { unitId: id } });
        if (v.startPerks.length > 0) {
            await tx.unitStartPerk.createMany({
                data: v.startPerks.map(sp => ({
                    unitId: id, perkId: sp.perkId, valueInt: sp.valueInt ?? null,
                })),
            });
        }
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response("FORBIDDEN", { status: 403 });

    const inUse = await prisma.unitInstance.count({ where: { unitId: id } });
    if (inUse > 0) {
        return new Response(JSON.stringify({ error: "Unit template is used by existing armies" }), { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
        await tx.unitWeaponOption.deleteMany({ where: { unitId: id } });
        await tx.unitStartPerk.deleteMany({ where: { unitId: id } });
        await tx.unitTemplate.delete({ where: { id } });
    });

    return new Response(null, { status: 204 });
}
