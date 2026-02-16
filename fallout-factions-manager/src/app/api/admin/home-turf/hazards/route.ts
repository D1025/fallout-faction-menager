import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';
import { HomeTurfDefinitionSchema } from '@/lib/validation/homeTurf';

export const runtime = 'nodejs';

export async function GET() {
    const list = await prisma.homeHazardDefinition.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return new Response(JSON.stringify(list), { status: 200 });
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response('FORBIDDEN', { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = HomeTurfDefinitionSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    const created = await prisma.homeHazardDefinition.create({ data: parsed.data });
    return new Response(JSON.stringify(created), { status: 201 });
}

