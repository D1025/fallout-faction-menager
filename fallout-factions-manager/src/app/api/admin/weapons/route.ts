import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { z } from 'zod';

const EffectRef = z.object({ effectId: z.string(), valueInt: z.number().nullable().optional() });
const ProfileInput = z.object({
    order: z.number().int().min(0).default(0),
    typeOverride: z.string().nullable().optional(),
    testOverride: z.string().nullable().optional(),
    partsOverride: z.number().int().nullable().optional(),
    ratingDelta: z.number().int().nullable().optional(),
    effects: z.array(EffectRef),
});
const WeaponUpsertSchema = z.object({
    name: z.string().min(1),
    imagePath: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    baseType: z.string().default(''),
    baseTest: z.string().default(''),
    baseParts: z.number().int().nullable().optional(),
    baseRating: z.number().int().nullable().optional(),
    baseEffects: z.array(EffectRef).default([]),
    profiles: z.array(ProfileInput).default([]),
});

export async function GET() {
    const list = await prisma.weaponTemplate.findMany({
        include: {
            baseEffects: { include: { effect: true } },
            profiles: { include: { effects: { include: { effect: true } } }, orderBy: { order: 'asc' } },
        },
        orderBy: { name: 'asc' },
    });
    return new Response(JSON.stringify(list), { status: 200 });
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = WeaponUpsertSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }

    const { name, imagePath, notes, baseType, baseTest, baseParts, baseRating, baseEffects, profiles } = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
        const t = await tx.weaponTemplate.create({
            data: { name, imagePath: imagePath ?? null, notes: notes ?? null, baseType, baseTest, baseParts, baseRating },
        });

        if (baseEffects.length) {
            await tx.weaponBaseEffect.createMany({
                data: baseEffects.map((e) => ({ weaponId: t.id, effectId: e.effectId, valueInt: e.valueInt ?? null })),
            });
        }

        for (const p of profiles) {
            const prof = await tx.weaponProfile.create({
                data: {
                    weaponId: t.id,
                    order: p.order ?? 0,
                    typeOverride: p.typeOverride ?? null,
                    testOverride: p.testOverride ?? null,
                    partsOverride: p.partsOverride ?? null,
                    ratingDelta: p.ratingDelta ?? null,
                },
            });
            if (p.effects.length) {
                await tx.weaponProfileEffect.createMany({
                    data: p.effects.map((e) => ({ profileId: prof.id, effectId: e.effectId, valueInt: e.valueInt ?? null })),
                });
            }
        }

        return tx.weaponTemplate.findUnique({
            where: { id: t.id },
            include: {
                baseEffects: { include: { effect: true } },
                profiles: { include: { effects: { include: { effect: true } } }, orderBy: { order: 'asc' } },
            },
        });
    });

    return new Response(JSON.stringify(created), { status: 201 });
}
