// app/api/admin/unit-templates/route.ts
import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { z } from "zod";

export const runtime = "nodejs";

type UnitTemplateTag = 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';

type UnitTemplateRow = {
    id: string;
    name: string;
    isGlobal: boolean;
    roleTag: UnitTemplateTag | null;
    isLeader?: boolean;
    hp: number;
    s: number; p: number; e: number; c: number; i: number; a: number; l: number;
    baseRating: number | null;
    factions: Array<{ factionId: string }>;
    options: Array<{ weapon1Id: string; weapon2Id: string | null; costCaps: number; rating: number | null }>;
    startPerks: Array<{ perkId: string; valueInt: number | null }>;
};

type UnitTemplateDelegate = {
    findMany(args: {
        include: { options: true; startPerks: true, factions: true };
        orderBy: Array<{ name: 'asc' | 'desc' }>;
    }): Promise<UnitTemplateRow[]>;
    create(args: {
        data: {
            name: string;
            isGlobal: boolean;
            roleTag: string | null;
            isLeader: boolean;
            hp: number;
            s: number; p: number; e: number; c: number; i: number; a: number; l: number;
            baseRating: number | null;
        };
        select: { id: true };
    }): Promise<{ id: string }>;
};

type UnitTemplateFactionDelegate = {
    createMany(args: { data: Array<{ unitId: string; factionId: string }>; skipDuplicates?: boolean }): Promise<unknown>;
};

type UnitWeaponOptionDelegate = {
    createMany(args: { data: Array<{ unitId: string; weapon1Id: string; weapon2Id: string | null; costCaps: number; rating: number | null }> }): Promise<unknown>;
};

type UnitStartPerkDelegate = {
    createMany(args: { data: Array<{ unitId: string; perkId: string; valueInt: number | null }> }): Promise<unknown>;
};

const p = prisma as unknown as {
    unitTemplate: UnitTemplateDelegate;
    unitTemplateFaction: UnitTemplateFactionDelegate;
    unitWeaponOption: UnitWeaponOptionDelegate;
    unitStartPerk: UnitStartPerkDelegate;
    $transaction<T>(fn: (tx: {
        unitTemplate: UnitTemplateDelegate;
        unitTemplateFaction: UnitTemplateFactionDelegate;
        unitWeaponOption: UnitWeaponOptionDelegate;
        unitStartPerk: UnitStartPerkDelegate;
    }) => Promise<T>): Promise<T>;
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

export async function GET() {
    const rows = await p.unitTemplate.findMany({
        include: { options: true, startPerks: true, factions: true },
        orderBy: [{ name: "asc" }],
    });

    const sorted = [...rows].sort((a, b) => {
        if (a.isGlobal !== b.isGlobal) return a.isGlobal ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    const data = sorted.map((t) => ({
        id: t.id,
        name: t.name,
        isGlobal: t.isGlobal,
        factionIds: t.factions.map((f) => f.factionId),
        roleTag: t.roleTag,
        isLeader: Boolean((t as unknown as { isLeader?: boolean }).isLeader ?? false),
        hp: t.hp, s: t.s, p: t.p, e: t.e, c: t.c, i: t.i, a: t.a, l: t.l,
        baseRating: t.baseRating,
        options: t.options.map((o) => ({
            weapon1Id: o.weapon1Id,
            weapon2Id: o.weapon2Id,
            costCaps: o.costCaps,
            rating: o.rating,
        })),
        startPerks: t.startPerks.map((sp) => ({ perkId: sp.perkId, valueInt: sp.valueInt })),
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

    const created = await p.$transaction(async (tx) => {
        const ut = await tx.unitTemplate.create({
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
            select: { id: true },
        });

        if (!v.isGlobal && v.factionIds.length) {
            await tx.unitTemplateFaction.createMany({
                data: v.factionIds.map((factionId) => ({ unitId: ut.id, factionId })),
                skipDuplicates: true,
            });
        }

        await tx.unitWeaponOption.createMany({
            data: v.options.map((opt) => ({
                unitId: ut.id,
                weapon1Id: opt.weapon1Id,
                weapon2Id: opt.weapon2Id ?? null,
                costCaps: opt.costCaps,
                rating: opt.rating ?? null,
            })),
        });

        if (v.startPerks.length > 0) {
            await tx.unitStartPerk.createMany({
                data: v.startPerks.map((sp) => ({
                    unitId: ut.id,
                    perkId: sp.perkId,
                    valueInt: sp.valueInt ?? null,
                })),
            });
        }

        return ut;
    });

    return new Response(JSON.stringify({ id: created.id }), { status: 201 });
}
