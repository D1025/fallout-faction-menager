import { prisma } from "@/server/prisma";
import { auth } from "@/lib/authServer";
import { PerkSchema } from "@/lib/validation/perk";

// (opcjonalnie) wymuś node runtime
export const runtime = 'nodejs';

export async function GET() {
    const list = await prisma.perk.findMany({
        orderBy: [{ behavior: 'asc' }, { name: 'asc' }],
    });
    return new Response(JSON.stringify(list), { status: 200 });
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user.role !== 'ADMIN') return new Response("FORBIDDEN", { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = PerkSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    const created = await prisma.perk.create({ data: parsed.data });
    return new Response(JSON.stringify(created), { status: 201 });
}
