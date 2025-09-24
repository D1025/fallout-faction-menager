import { z } from "zod";

export const PerkSchema = z.object({
    name: z.string().trim().min(2),
    description: z.string().trim().min(1),     // używaj X w treści
    requiresValue: z.boolean().default(false),
    startAllowed: z.boolean().default(false),
    behavior: z.enum(["NONE", "COMPANION_ROBOT", "COMPANION_BEAST"]).default("NONE"),
});

export type PerkInput = z.infer<typeof PerkSchema>;
