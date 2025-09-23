// src/app/admin/factions/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from "next/link";
import { prisma } from "@/server/prisma";
import { AdminFactionsClient } from "@/components/AdminFactionsClient";

export default async function FactionsAdminPage() {
    // Pobierz frakcje z limitami (alfabetycznie)
    const factions = await prisma.faction.findMany({
        include: { limits: true },
        orderBy: { name: "asc" },
    });

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <div className="text-base font-semibold">Frakcje (admin)</div>
                    <Link href="/admin" className="text-sm text-zinc-300">
                        ← Wróć
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <AdminFactionsClient initial={factions} />
            </main>
        </div>
    );
}
