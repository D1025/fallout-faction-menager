// src/app/admin/weapons/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from "next/link";
import { prisma } from "@/server/prisma";
import { AdminWeaponsClient } from "@/components/AdminWeaponsClient";

// Typ wejścia klienta (zgodny z komponentem)
type ProfileEffect = { effectId: string; valueInt?: number | null };
type WeaponProfile = {
    type: string;
    test: string;
    parts?: number | null;
    rating?: number | null;
    weaponEffects: ProfileEffect[];
    criticalEffects: ProfileEffect[];
};
type Weapon = {
    id: string;
    name: string;
    imagePath?: string | null;
    notes?: string | null;
    profiles: WeaponProfile[];
};

export default async function WeaponsAdminPage() {
    // Pobieramy profile wraz z łącznikami efektów i samymi efektami (żeby znać kind)
    const raw = await prisma.weaponTemplate.findMany({
        include: {
            profiles: {
                include: {
                    effects: {               // WeaponProfileEffect[]
                        include: { effect: true }, // do rozdzielenia na WEAPON/CRITICAL
                    },
                },
            },
        },
        orderBy: { name: "asc" },
    });

    // Mapowanie do struktury oczekiwanej przez AdminWeaponsClient
    const list: Weapon[] = raw.map((w) => ({
        id: w.id,
        name: w.name,
        imagePath: w.imagePath,
        notes: w.notes ?? null,
        profiles: w.profiles.map((p) => {
            const weaponEffects: ProfileEffect[] = [];
            const criticalEffects: ProfileEffect[] = [];
            for (const pe of p.effects) {
                const item = { effectId: pe.effectId, valueInt: pe.valueInt ?? null };
                if (pe.effect.kind === "WEAPON") weaponEffects.push(item);
                else if (pe.effect.kind === "CRITICAL") criticalEffects.push(item);
            }
            return {
                type: p.type,
                test: p.test,
                parts: p.parts ?? null,
                rating: p.rating ?? null,
                weaponEffects,
                criticalEffects,
            };
        }),
    }));

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <div className="text-base font-semibold">Broń (admin)</div>
                    <Link href="/admin" className="text-sm text-zinc-300">← Wróć</Link>
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <AdminWeaponsClient initial={list} />
            </main>
        </div>
    );
}
