// app/api/admin/unit-templates/route.ts
import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { z } from "zod";

export const runtime = "nodejs";

const OptionSchema = z.object({
    weapon1Id: z.string().min(1),
    weapon2Id: z.string().min(1).nullable().optional(), // może być null/undefined => brak drugiej broni
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

export async function GET() {
    const rows = await prisma.unitTemplate.findMany({
        include: { options: true, startPerks: true },
        orderBy: [{ factionId: "asc" }, { name: "asc" }],
    });

    const data = rows.map(t => ({
        id: t.id,
        name: t.name,
        factionId: t.factionId,
        roleTag: t.roleTag,
        hp: t.hp, s: t.s, p: t.p, e: t.e, c: t.c, i: t.i, a: t.a, l: t.l,
        baseRating: t.baseRating,
        options: t.options.map(o => ({
            weapon1Id: o.weapon1Id,
            weapon2Id: o.weapon2Id,
            costCaps: o.costCaps,
            rating: o.rating,
        })),
        startPerks: t.startPerks.map(sp => ({ perkId: sp.perkId, valueInt: sp.valueInt })),
    }));

    return new Response(JSON.stringify(data), { status: 200 });
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user.role !== "ADMIN") return new Response("FORBIDDEN", { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = UnitTemplateInput.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }
    const v = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
        const ut = await tx.unitTemplate.create({
            data: {
                name: v.name,
                factionId: v.factionId,
                roleTag: v.roleTag ?? null,
                hp: v.hp,
                s: v.s, p: v.p, e: v.e, c: v.c, i: v.i, a: v.a, l: v.l,
                baseRating: v.baseRating ?? null,
            },
            select: { id: true },
        });

        await tx.unitWeaponOption.createMany({
            data: v.options.map(opt => ({
                unitId: ut.id,
                weapon1Id: opt.weapon1Id,
                weapon2Id: opt.weapon2Id ?? null,
                costCaps: opt.costCaps,
                rating: opt.rating ?? null,
            })),
        });

        if (v.startPerks.length > 0) {
            await tx.unitStartPerk.createMany({
                data: v.startPerks.map(sp => ({
                    unitId: ut.id, perkId: sp.perkId, valueInt: sp.valueInt ?? null,
                })),
            });
        }

        return ut;
    });

    return new Response(JSON.stringify({ id: created.id }), { status: 201 });
}
