import { z } from 'zod';

export const HomeTurfDefinitionSchema = z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(1).max(20_000),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export type HomeTurfDefinitionInput = z.infer<typeof HomeTurfDefinitionSchema>;

