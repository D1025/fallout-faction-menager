// lib/validation/unitTemplate.ts
import { z } from "zod";

export const StartPerkSchema = z.object({
    perkId: z.string().min(1),
    valueInt: z.number().int().min(0).nullable().optional(),
});

export const LoadoutSchema = z.object({
    weapon1Id: z.string().min(1),
    weapon2Id: z.string().min(1).nullable().optional(),
    costCaps: z.number().int().min(0),
    rating: z.number().int().nullable().optional(),
});

const UnitTemplateTagSchema = z.enum(['CHAMPION', 'GRUNT', 'COMPANION', 'LEGENDS']);

export const UnitTemplateUpsertSchema = z.object({
    name: z.string().trim().min(2),
    factionId: z.string().nullable().optional(), // null = global
    roleTag: UnitTemplateTagSchema.optional().nullable(),
    // Statystyki bazowe profilu jednostki:
    hp: z.number().int().min(1).max(8),
    s: z.number().int().min(1).max(10),
    p: z.number().int().min(1).max(10),
    e: z.number().int().min(1).max(10),
    c: z.number().int().min(1).max(10),
    i: z.number().int().min(1).max(10),
    a: z.number().int().min(1).max(10),
    l: z.number().int().min(1).max(10),
    imagePath: z.string().optional().nullable(),
    baseRating: z.number().int().min(0).nullable().optional(),

    options: z.array(LoadoutSchema).min(1),
    startPerks: z.array(StartPerkSchema).default([]),
});

export type UnitTemplateInput = z.infer<typeof UnitTemplateUpsertSchema>;
export type LoadoutInput = z.infer<typeof LoadoutSchema>;
export type StartPerkInput = z.infer<typeof StartPerkSchema>;
