import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/prisma';
import { auth } from "@/lib/authServer";

const CreateArmySchema = z.object({
    name: z.string().min(3),
    factionId: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const parsed = CreateArmySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

    const { name, factionId, tier } = parsed.data;
    const army = await prisma.army.create({
        data: { name, factionId, tier, ownerId: session.user.id },
        select: { id: true },
    });
    return NextResponse.json(army, { status: 201 });
}
