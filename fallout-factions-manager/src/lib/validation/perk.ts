import { z } from "zod";

const StatKeySpecialSchema = z.enum(["S", "P", "E", "C", "I", "A", "L"]);
const PerkCategorySchema = z.enum(["REGULAR", "AUTOMATRON"]);

export const PerkSchema = z
    .object({
        name: z.string().trim().min(2),
        description: z.string().trim().min(1), // use X in content

        category: PerkCategorySchema.optional().default("REGULAR"),

        // SPECIAL requirements (optional)
        statKey: StatKeySpecialSchema.nullable().optional().default(null),
        minValue: z.number().int().min(0).nullable().optional().default(null),

        // INNATE perk (template-only)
        isInnate: z.boolean().optional().default(false),

        requiresValue: z.boolean().default(false),
        startAllowed: z.boolean().default(false),
        behavior: z.enum(["NONE", "COMPANION_ROBOT", "COMPANION_BEAST"]).default("NONE"),
    })
    .superRefine((v, ctx) => {
        if (v.minValue != null && v.statKey == null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["statKey"], message: "Set SPECIAL when min value is provided." });
        }
    });

export type PerkInput = z.infer<typeof PerkSchema>;
