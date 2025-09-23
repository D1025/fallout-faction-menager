import { z } from "zod";

export const FactionLimitSchema = z.object({
    tag: z.string().trim().min(1, "Tag jest wymagany"),
    tier1: z.number().int().min(0).nullable().optional(),
    tier2: z.number().int().min(0).nullable().optional(),
    tier3: z.number().int().min(0).nullable().optional(),
});

export const FactionUpsertSchema = z.object({
    name: z.string().trim().min(2, "Nazwa min. 2 znaki"),
    limits: z.array(FactionLimitSchema).max(20, "Za dużo limitów"),
});

export type FactionUpsert = z.infer<typeof FactionUpsertSchema>;
