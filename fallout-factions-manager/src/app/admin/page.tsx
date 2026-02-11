export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from "next/link";
import { auth } from "@/lib/authServer";

export default async function AdminHome() {
    const session = await auth();
    if (session?.user.role !== "ADMIN") return <div className="p-4 text-red-300">Brak uprawnień.</div>;

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <div className="text-base font-semibold">Panel admina</div>
                    <Link href="/" className="text-sm text-zinc-300">← Wróć</Link>
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <div className="mt-4 grid gap-2">
                    <Link href="/admin/factions" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 active:scale-[0.99]">Frakcje</Link>
                    <Link href="/admin/subfactions" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 active:scale-[0.99]">Subfrakcje</Link>
                    <Link href="/admin/templates" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 active:scale-[0.99]">Szablony jednostek</Link>
                    <Link href="/admin/perks" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 active:scale-[0.99]">Perki</Link>
                    <Link href="/admin/weapons" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 active:scale-[0.99]">Broń i zestawy</Link>
                    <Link href="/admin/effects" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 active:scale-[0.99]">Efekty broni</Link>
                </div>
            </main>
        </div>
    );
}
