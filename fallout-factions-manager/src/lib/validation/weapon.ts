import { z } from "zod";

// element słownika wybierany w profilu
export const ProfileEffectInputSchema = z.object({
    effectId: z.string().min(1),
    valueInt: z.number().int().min(0).nullable().optional(), // użyte gdy requiresValue = true
});

export const WeaponProfileSchema = z.object({
    type: z.string().trim().min(1),
    test: z.string().trim().min(1),
    parts: z.number().int().min(0).nullable().optional(),
    rating: z.number().int().nullable().optional(),
    weaponEffects: z.array(ProfileEffectInputSchema).default([]),   // kind=WEAPON
    criticalEffects: z.array(ProfileEffectInputSchema).default([]), // kind=CRITICAL
});

export const WeaponUpsertSchema = z.object({
    name: z.string().trim().min(2),
    notes: z.string().optional().nullable(),
    imagePath: z.string().optional().nullable(), // ścieżka z uploadu
    profiles: z.array(WeaponProfileSchema).min(1).max(10),
});

export type WeaponUpsert = z.infer<typeof WeaponUpsertSchema>;
export type WeaponProfileInput = z.infer<typeof WeaponProfileSchema>;
