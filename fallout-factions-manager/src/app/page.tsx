export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { Button } from 'antd';
import { LoginOutlined, UserOutlined } from '@ant-design/icons';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { SectionCard } from '@/components/ui/antd/SectionCard';
import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { HomeClient } from '@/components/home/HomeClient';

type ArmyMeta = {
  id: string;
  name: string;
  tier: number;
  factionName: string;
  subfactionName: string | null;
  rating: number;
};

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <MobilePageShell title="Fallout Army Tracker">
        <SectionCard>
          <div className="text-center">
            <div className="text-3xl text-amber-300"><UserOutlined /></div>
            <div className="mt-2 text-lg font-semibold">Login required</div>
            <p className="mt-2 text-sm vault-muted">To track your army, you must first enter the command terminal.</p>
            <Link href="/login">
              <Button type="primary" className="mt-4" icon={<LoginOutlined />}>Go to login</Button>
            </Link>
          </div>
        </SectionCard>
      </MobilePageShell>
    );
  }

  const userMeta = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true, photoEtag: true },
  });
  const userName = userMeta?.name ?? session?.user?.name ?? 'Commander';
  const userRole = (userMeta?.role ?? session?.user?.role ?? 'USER') as 'USER' | 'ADMIN';

  let myArmies: ArmyMeta[] = [];
  let shared:
      | { id: string; perm: 'READ' | 'WRITE'; army: ArmyMeta }[]
      | [] = [];
  let factions: {
    id: string;
    name: string;
    limits: { tag: string; tier1: number | null; tier2: number | null; tier3: number | null }[];
    goalSets: { id: string; name: string; goals: { tier: 1 | 2 | 3; description: string; target: number; order: number }[] }[];
  }[] = [];

  try {
    const [armies, sharedRows, factionRows] = await Promise.all([
      prisma.army.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        include: {
          faction: { select: { name: true } },
          units: {
            include: {
              unit: true,
              upgrades: true,
              weapons: true,
              selectedOption: true,
            },
          },
        },
      }),
      prisma.armyShare.findMany({
        where: { userId },
        include: {
          army: {
            include: {
              faction: { select: { name: true } },
              units: {
                include: {
                  unit: true,
                  upgrades: true,
                  weapons: true,
                  selectedOption: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.faction.findMany({
        include: {
          limits: true,
          goalSets: { include: { goals: true }, orderBy: { name: 'asc' } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Subfactions by id -> name (without relying on typed Prisma relation)
    const subIds = Array.from(new Set([
      ...armies.map((a) => (a as unknown as { subfactionId?: string | null }).subfactionId ?? null),
      ...sharedRows.map((s) => (s.army as unknown as { subfactionId?: string | null }).subfactionId ?? null),
    ].filter((x): x is string => Boolean(x))));

    const subRows = subIds.length
      ? await prisma.$queryRaw<{ id: string; name: string }[]>`SELECT id, name FROM "Subfaction" WHERE id = ANY(${subIds}::text[])`
      : [];
    const subById = new Map<string, string>(subRows.map((s: { id: string; name: string }) => [s.id, s.name]));

    // rules do ratingu
    const allFactionIds = Array.from(new Set([
      ...armies.map((a) => a.factionId),
      ...sharedRows.map((s) => s.army.factionId),
    ]));
    const rules = allFactionIds.length
      ? await prisma.factionUpgradeRule.findMany({
          where: { factionId: { in: allFactionIds } },
          select: { factionId: true, statKey: true, ratingPerPoint: true },
        })
      : [];
    const ruleByFaction = new Map<string, Map<string, number>>();
    for (const r of rules) {
      if (!ruleByFaction.has(r.factionId)) ruleByFaction.set(r.factionId, new Map());
      ruleByFaction.get(r.factionId)!.set(r.statKey, r.ratingPerPoint);
    }

    // weapon profile ratingDelta
    const allTemplateIds = Array.from(new Set([
      ...armies.flatMap((a) => a.units.flatMap((u) => u.weapons.map((w) => w.templateId))),
      ...sharedRows.flatMap((s) => s.army.units.flatMap((u) => u.weapons.map((w) => w.templateId))),
    ]));

    const templates = allTemplateIds.length
      ? await prisma.weaponTemplate.findMany({
          where: { id: { in: allTemplateIds } },
          include: { profiles: true },
        })
      : [];
    const weaponById = new Map(templates.map((t) => [t.id, t] as const));

    function calcArmyRating(army: typeof armies[number]): number {
      const ruleByKey = ruleByFaction.get(army.factionId) ?? new Map<string, number>();

      return army.units.reduce((sum: number, u) => {
        const baseFromTemplate = u.unit.baseRating ?? 0;
        const optionRating = u.selectedOption?.rating ?? 0;

        const weaponDelta = u.weapons.reduce((acc: number, w) => {
          const t = weaponById.get(w.templateId);
          if (!t) return acc;
          const selected = new Set(w.activeMods.filter((m) => m.startsWith('__profile:')).map((m) => m.slice(10)));
          const pSum = t.profiles.reduce((a: number, p) => (selected.has(p.id) ? a + (p.ratingDelta ?? 0) : a), 0);
          return acc + pSum;
        }, 0);

        const statsDelta = u.upgrades.reduce((acc: number, up) => {
          if (up.delta <= 0) return acc;
          const key = up.statKey === 'hp' ? 'hp' : up.statKey;
          const per = ruleByKey.get(key) ?? 0;
          return acc + up.delta * per;
        }, 0);

        return sum + baseFromTemplate + optionRating + weaponDelta + statsDelta;
      }, 0);
    }

    myArmies = armies.map((a) => {
      const subId = (a as unknown as { subfactionId?: string | null }).subfactionId ?? null;
      return {
        id: a.id,
        name: a.name,
        tier: a.tier,
        factionName: a.faction.name,
        subfactionName: subId ? (subById.get(subId) ?? null) : null,
        rating: calcArmyRating(a),
      };
    });

    shared = sharedRows.map((s) => {
      const a = s.army;
      const subId = (a as unknown as { subfactionId?: string | null }).subfactionId ?? null;
      return {
        id: s.id,
        perm: (s.perm === 'WRITE' ? 'WRITE' : 'READ') as 'READ' | 'WRITE',
        army: {
          id: a.id,
          name: a.name,
          tier: a.tier,
          factionName: a.faction.name,
          subfactionName: subId ? (subById.get(subId) ?? null) : null,
          rating: calcArmyRating(a as typeof armies[number]),
        },
      };
    });

    factions = factionRows.map(f => ({
      id: f.id,
      name: f.name,
      limits: f.limits.map(l => ({
        tag: l.tag,
        tier1: l.tier1 ?? null,
        tier2: l.tier2 ?? null,
        tier3: l.tier3 ?? null,
      })),
      goalSets: f.goalSets.map(s => ({
        id: s.id,
        name: s.name,
        goals: s.goals.map(g => ({
          tier: (g.tier as 1 | 2 | 3),
          description: g.description,
          target: g.target,
          order: g.order,
        })),
      })),
    }));
  } catch {
    myArmies = [];
    shared = [];
    factions = [];
  }

  return (
    <HomeClient
      userName={userName}
      userRole={userRole}
      userPhotoEtag={userMeta?.photoEtag ?? null}
      myArmies={myArmies}
      shared={shared}
      factions={factions}
    />
  );
}
