// src/app/admin/weapons/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { AdminWeaponsClient } from '@/components/AdminWeaponsClient';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';

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
        <MobilePageShell title="Broń (admin)" backHref="/admin">
            <AdminWeaponsClient initial={list} />
        </MobilePageShell>
    );
}
