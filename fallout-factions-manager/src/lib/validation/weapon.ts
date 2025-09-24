import { z } from 'zod';

export const ProfileEffectInput = z.object({
    effectId: z.string().min(1),
    valueInt: z.number().int().nullable().optional(),
});

export const WeaponUpgradeSchema = z.object({
    order: z.number().int().min(0).default(0),
    typeOverride: z.string().trim().nullable().optional(),
    testOverride: z.string().trim().nullable().optional(),
    partsOverride: z.number().int().nullable().optional(),
    ratingDelta: z.number().int().nullable().optional(),
    weaponEffects: z.array(ProfileEffectInput),
    criticalEffects: z.array(ProfileEffectInput),
});

export const WeaponUpsertSchema = z.object({
    name: z.string().min(2),
    imagePath: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    baseType: z.string().trim().default(''),
    baseTest: z.string().trim().default(''),
    baseParts: z.number().int().nullable().optional(),
    baseRating: z.number().int().nullable().optional(),
    profiles: z.array(WeaponUpgradeSchema),
});

export type WeaponUpsertInput = z.infer<typeof WeaponUpsertSchema>;
