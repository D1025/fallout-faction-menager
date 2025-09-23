import { z } from "zod";

export const EffectUpsertSchema = z.object({
    name: z.string().trim().min(2),
    kind: z.enum(["WEAPON", "CRITICAL"]),
    description: z.string().trim().min(1), // np. "Ignite (X): ..."
    requiresValue: z.boolean().default(false),
});

export type EffectUpsert = z.infer<typeof EffectUpsertSchema>;
