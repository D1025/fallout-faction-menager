// app/api/admin/unit-templates/[id]/route.ts
import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { z } from "zod";

export const runtime = "nodejs";

type UnitTemplateFactionDelegate = {
    deleteMany(args: { where: { unitId: string } }): Promise<unknown>;
    createMany(args: { data: Array<{ unitId: string; factionId: string }>; skipDuplicates?: boolean }): Promise<unknown>;
};

type UnitTemplateTag = 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';

type UnitTemplateDelegate = {
    update(args: {
        where: { id: string };
        data: {
            name: string;
            isGlobal: boolean;
            roleTag: UnitTemplateTag | null;
            isLeader: boolean;
            hp: number;
            s: number; p: number; e: number; c: number; i: number; a: number; l: number;
            baseRating: number | null;
        };
    }): Promise<unknown>;
    delete(args: { where: { id: string } }): Promise<unknown>;
};

type UnitWeaponOptionDelegate = {
    deleteMany(args: { where: { unitId: string } }): Promise<unknown>;
    createMany(args: { data: Array<{ unitId: string; weapon1Id: string; weapon2Id: string | null; costCaps: number; rating: number | null }> }): Promise<unknown>;
};

type UnitStartPerkDelegate = {
    deleteMany(args: { where: { unitId: string } }): Promise<unknown>;
    createMany(args: { data: Array<{ unitId: string; perkId: string; valueInt: number | null }> }): Promise<unknown>;
};

type UnitInstanceDelegate = { count(args: { where: { unitId: string } }): Promise<number> };

type Tx = {
    unitTemplate: UnitTemplateDelegate;
    unitTemplateFaction: UnitTemplateFactionDelegate;
    unitWeaponOption: UnitWeaponOptionDelegate;
    unitStartPerk: UnitStartPerkDelegate;
};

const p = prisma as unknown as {
    unitInstance: UnitInstanceDelegate;
    $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
};

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
const UnitTemplateTagSchema = z.enum(['CHAMPION', 'GRUNT', 'COMPANION', 'LEGENDS']);

const UnitTemplateInput = z.object({
    name: z.string().min(1),
    isGlobal: z.boolean().optional().default(false),
    factionIds: z.array(z.string().min(1)).optional().default([]),
    roleTag: UnitTemplateTagSchema.nullable().optional(),
    isLeader: z.boolean().optional().default(false),
    hp: z.number().int().min(1),
    s: z.number().int(), p: z.number().int(), e: z.number().int(),
    c: z.number().int(), i: z.number().int(), a: z.number().int(), l: z.number().int(),
    baseRating: z.number().int().nullable().optional(),
    options: z.array(OptionSchema).min(1),
    startPerks: z.array(StartPerkSchema).optional().default([]),
}).superRefine((v, ctx) => {
    if (!v.isGlobal && v.factionIds.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['factionIds'], message: 'Select at least one faction or set GLOBAL.' });
    }
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

    await p.$transaction(async (tx) => {
        await tx.unitTemplate.update({
            where: { id },
            data: {
                name: v.name,
                isGlobal: v.isGlobal,
                roleTag: v.roleTag ?? null,
                isLeader: v.isLeader,
                hp: v.hp,
                s: v.s,
                p: v.p,
                e: v.e,
                c: v.c,
                i: v.i,
                a: v.a,
                l: v.l,
                baseRating: v.baseRating ?? null,
            },
        });

        // Factions (M:N)
        await tx.unitTemplateFaction.deleteMany({ where: { unitId: id } });
        if (!v.isGlobal && v.factionIds.length) {
            await tx.unitTemplateFaction.createMany({
                data: v.factionIds.map((factionId) => ({ unitId: id, factionId })),
                skipDuplicates: true,
            });
        }

        // Weapon options
        await tx.unitWeaponOption.deleteMany({ where: { unitId: id } });
        await tx.unitWeaponOption.createMany({
            data: v.options.map((opt) => ({
                unitId: id,
                weapon1Id: opt.weapon1Id,
                weapon2Id: opt.weapon2Id ?? null,
                costCaps: opt.costCaps,
                rating: opt.rating ?? null,
            })),
        });

        // Starting perks
        await tx.unitStartPerk.deleteMany({ where: { unitId: id } });
        if (v.startPerks.length > 0) {
            await tx.unitStartPerk.createMany({
                data: v.startPerks.map((sp) => ({
                    unitId: id,
                    perkId: sp.perkId,
                    valueInt: sp.valueInt ?? null,
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

    const inUse = await p.unitInstance.count({ where: { unitId: id } });
    if (inUse > 0) {
        return new Response(JSON.stringify({ error: "Unit template is used by existing armies" }), { status: 409 });
    }

    await p.$transaction(async (tx) => {
        await tx.unitTemplateFaction.deleteMany({ where: { unitId: id } });
        await tx.unitWeaponOption.deleteMany({ where: { unitId: id } });
        await tx.unitStartPerk.deleteMany({ where: { unitId: id } });
        await tx.unitTemplate.delete({ where: { id } });
    });

    return new Response(null, { status: 204 });
}

