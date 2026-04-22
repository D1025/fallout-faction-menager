export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { ArmyPageClient } from '@/components/army/ArmyPageClient';
import { auth } from '@/lib/authServer';
import { resolveAvailablePloysForArmy } from '@/lib/army/ploys';
import { getPublicArmySnapshotByToken, type PublicArmySnapshot } from '@/lib/army/publicShare';
import { prisma } from '@/server/prisma';
import { redirect } from 'next/navigation';

type UiBonus = Record<'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number>;

function zeroBonus(): UiBonus {
    return { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
}

function mapSnapshotUnitsToDashboard(snapshot: PublicArmySnapshot) {
    return snapshot.units.map((u) => {
        const bonus = zeroBonus();
        const bonusPositive = zeroBonus();
        const bonusNegative = zeroBonus();

        for (const up of u.upgrades) {
            bonus[up.statKey] += up.delta;
            if (up.delta > 0) bonusPositive[up.statKey] += up.delta;
            if (up.delta < 0) bonusNegative[up.statKey] += Math.abs(up.delta);
        }

        const base = {
            hp: u.special.HP - bonus.HP,
            S: u.special.S - bonus.S,
            P: u.special.P - bonus.P,
            E: u.special.E - bonus.E,
            C: u.special.C - bonus.C,
            I: u.special.I - bonus.I,
            A: u.special.A - bonus.A,
            L: u.special.L - bonus.L,
        };

        return {
            id: u.id,
            templateName: u.name,
            roleTag: u.roleTag,
            base,
            bonus,
            bonusPositive,
            bonusNegative,
            wounds: u.wounds,
            present: u.present,
            upgradesCount: u.upgrades.length,
            perkNames: u.perks.map((p) => p.name),
            startPerkNames: [],
            perks: u.perks.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
            })),
            photoPath: null,
            hasPhoto: false,
            companionOwnerId: null,
            rating: u.rating,
            weapons: u.weapons.map((w, weaponIdx) => ({
                name: w.name,
                selectedProfileIds: [],
                baseType: w.type || '-',
                baseTest: w.test || '-',
                baseEffects: [
                    ...w.traits.map((t, effectIdx) => ({
                        id: `${u.id}:w${weaponIdx}:trait${effectIdx}`,
                        name: t.label,
                        kind: 'WEAPON' as const,
                        valueInt: null,
                        valueText: null,
                    })),
                    ...w.criticals.map((c, effectIdx) => ({
                        id: `${u.id}:w${weaponIdx}:crit${effectIdx}`,
                        name: c.label,
                        kind: 'CRITICAL' as const,
                        valueInt: null,
                        valueText: null,
                    })),
                ],
                profiles: [],
            })),
            isLeader: u.isLeader,
            temporaryLeader: u.temporaryLeader,
            temporary: u.temporary,
        };
    });
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const userMeta = userId
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true, photoEtag: true },
        })
        : null;

    const snapshot = await getPublicArmySnapshotByToken({ token });
    if (!snapshot) {
        return (
            <MobilePageShell title="Shared army" backHref="/">
                <section className="vault-panel mt-3 p-4">
                    <div className="text-base font-semibold text-red-300">Share link is invalid or disabled.</div>
                </section>
            </MobilePageShell>
        );
    }
    const armyMeta = await prisma.army.findUnique({
        where: { id: snapshot.army.id },
        select: { ownerId: true, subfactionId: true },
    });
    const ployReadModel = await resolveAvailablePloysForArmy({
        factionId: snapshot.army.faction.id,
        factionName: snapshot.army.faction.name,
        subfactionId: armyMeta?.subfactionId ?? null,
    });

    let canRedirectToArmyPath = false;
    if (userId) {
        try {
            if (armyMeta && armyMeta.ownerId !== userId) {
                await prisma.armyShare.upsert({
                    where: {
                        armyId_userId: {
                            armyId: snapshot.army.id,
                            userId,
                        },
                    },
                    update: {},
                    create: {
                        armyId: snapshot.army.id,
                        userId,
                        perm: 'READ',
                    },
                });
            }
            canRedirectToArmyPath = Boolean(armyMeta);
        } catch {
            // Never block shared preview because of auto-save errors.
        }
    }

    if (canRedirectToArmyPath) {
        redirect(`/army/${snapshot.army.id}`);
    }

    const units = mapSnapshotUnitsToDashboard(snapshot);
    const userName = userMeta?.name ?? session?.user?.name ?? 'Commander';
    const userRole = (userMeta?.role ?? session?.user?.role ?? 'USER') as 'USER' | 'ADMIN';

    return (
        <ArmyPageClient
            backHref="/"
            userName={userName}
            userRole={userRole}
            userPhotoEtag={userMeta?.photoEtag ?? null}
            showUserMenu={Boolean(userId)}
            readOnly
            armyId={snapshot.army.id}
            armyName={snapshot.army.name}
            tier={snapshot.army.tier}
            factionId={snapshot.army.faction.id}
            factionName={snapshot.army.faction.name}
            factionLimits={snapshot.army.limits.map((l) => ({
                tag: l.tag,
                tier1: l.tier1 ?? null,
                tier2: l.tier2 ?? null,
                tier3: l.tier3 ?? null,
            }))}
            resources={{
                caps: snapshot.army.resources.caps,
                parts: snapshot.army.resources.parts,
                scout: snapshot.army.resources.scout,
                reach: snapshot.army.resources.reach,
                exp: snapshot.army.resources.exp,
                ploys: snapshot.army.resources.ploys,
            }}
            units={units}
            rating={snapshot.army.rating}
            subfactionId={null}
            availablePloys={ployReadModel.ploys.map((ploy) => ({
                id: ploy.id,
                name: ploy.name,
                description: ploy.description,
                sortOrder: ploy.sortOrder,
                source: ploy.source,
            }))}
            ployMode={ployReadModel.mode}
            gunnersResourcePoints={ployReadModel.gunnersResourcePoints}
        />
    );
}
