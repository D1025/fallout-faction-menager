// src/app/admin/weapons/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { prisma } from '@/server/prisma';
import { AdminWeaponsClient } from '@/components/AdminWeaponsClient';

export default async function WeaponsAdminPage() {
    const raw = await prisma.weaponTemplate.findMany({
        include: {
            baseEffects: { include: { effect: true } }, // <-- bazowe efekty
            profiles: {
                include: { effects: { include: { effect: true } } },
                orderBy: { order: 'asc' },
            },
        },
        orderBy: { name: 'asc' },
    });

    const list = raw.map((w) => ({
        id: w.id,
        name: w.name,
        imagePath: w.imagePath ?? null,
        notes: w.notes ?? null,
        baseType: w.baseType ?? '',
        baseTest: w.baseTest ?? '',
        baseParts: w.baseParts ?? null,
        baseRating: w.baseRating ?? null,

        // mapowanie bazowych efektów z efektami słownikowymi
        baseEffects: (w.baseEffects ?? []).map((be) => ({
            effectId: be.effectId,
            valueInt: be.valueInt ?? null,
            effect: {
                id: be.effect.id,
                name: be.effect.name,
                kind: be.effect.kind,
                description: be.effect.description,
                requiresValue: be.effect.requiresValue,
            },
        })),

        // profile: z id + wszystkie efekty z wpiętym obiektem effect
        profiles: w.profiles.map((p) => ({
            id: p.id,
            order: p.order ?? 0,
            typeOverride: p.typeOverride ?? null,
            testOverride: p.testOverride ?? null,
            partsOverride: p.partsOverride ?? null,
            ratingDelta: p.ratingDelta ?? null,
            effects: p.effects.map((e) => ({
                effectId: e.effectId,
                valueInt: e.valueInt ?? null,
                effect: {
                    id: e.effect.id,
                    name: e.effect.name,
                    kind: e.effect.kind,
                    description: e.effect.description,
                    requiresValue: e.effect.requiresValue,
                },
            })),
        })),
    }));

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-between px-3">
                    <div className="text-base font-semibold">Broń (admin)</div>
                    <Link href="/admin" className="text-sm text-zinc-300">
                        ← Wróć
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <AdminWeaponsClient initial={list} />
            </main>
        </div>
    );
}
