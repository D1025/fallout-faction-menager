import { z } from "zod";

export const FactionLimitSchema = z.object({
    tag: z.string().trim().min(1, "Tag is required"),
    tier1: z.number().int().min(0).nullable().optional(),
    tier2: z.number().int().min(0).nullable().optional(),
    tier3: z.number().int().min(0).nullable().optional(),
});

export const FactionUpsertSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    limits: z.array(FactionLimitSchema).max(20, "Too many limits"),
});

export type FactionUpsert = z.infer<typeof FactionUpsertSchema>;
