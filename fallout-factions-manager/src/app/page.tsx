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
import {
  buildTrainingRuleLookup,
  getUpgradeRatingPerPointForUnit,
  resolveEffectiveTrainingFactionId,
} from '@/lib/rules/trainingTable';

const p = prisma as unknown as {
  army: {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
  armyShare: {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
  factionUpgradeRule: {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
};

type ArmyListUnit = {
  present: boolean;
  selectedOption: { rating: number | null } | null;
  unit: {
    baseRating: number | null;
    roleTag: string | null;
    startPerks: Array<{ perk: { name: string } }>;
  };
  chosenPerks: Array<{ perk: { name: string } }>;
  weapons: Array<{ templateId: string; activeMods: string[] }>;
  upgrades: Array<{ statKey: string; delta: number; trainingFactionId?: string | null }>;
};

type ArmyListRow = {
  id: string;
  name: string;
  tier: number;
  factionId: string;
  subfactionId: string | null;
  faction: { id: string; name: string };
  playedOpponents: Array<{
    boxesChecked: number;
    updatedAt: Date;
    opponentArmy: {
      factionId: string;
      faction: { name: string };
    };
  }>;
  units: ArmyListUnit[];
};

type SharedArmyRow = {
  id: string;
  perm: 'READ' | 'WRITE';
  army: ArmyListRow;
};

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
    const [armiesRaw, sharedRowsRaw, factionRows] = await Promise.all([
      p.army.findMany({
        where: { ownerId: userId, deleted: false },
        orderBy: { updatedAt: 'desc' },
        include: {
          faction: { select: { id: true, name: true } },
          playedOpponents: {
            where: { boxesChecked: { gt: 0 } },
            orderBy: { updatedAt: 'desc' },
            include: {
              opponentArmy: {
                select: {
                  factionId: true,
                  faction: { select: { name: true } },
                },
              },
            },
          },
          units: {
            include: {
              unit: {
                include: {
                  startPerks: {
                    select: {
                      perk: { select: { name: true } },
                    },
                  },
                },
              },
              chosenPerks: { select: { perk: { select: { name: true } } } },
              upgrades: true,
              weapons: true,
              selectedOption: true,
            },
          },
        },
      }),
      p.armyShare.findMany({
        where: { userId, army: { deleted: false } },
        include: {
          army: {
            include: {
              faction: { select: { id: true, name: true } },
              playedOpponents: {
                where: { boxesChecked: { gt: 0 } },
                orderBy: { updatedAt: 'desc' },
                include: {
                  opponentArmy: {
                    select: {
                      factionId: true,
                      faction: { select: { name: true } },
                    },
                  },
                },
              },
              units: {
                include: {
                  unit: {
                    include: {
                      startPerks: {
                        select: {
                          perk: { select: { name: true } },
                        },
                      },
                    },
                  },
                  chosenPerks: { select: { perk: { select: { name: true } } } },
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
    const armies = armiesRaw as ArmyListRow[];
    const sharedRows = sharedRowsRaw as SharedArmyRow[];

    // Subfactions by id -> name (without relying on typed Prisma relation)
    const subIds = Array.from(new Set([
      ...armies.map((a) => (a as unknown as { subfactionId?: string | null }).subfactionId ?? null),
      ...sharedRows.map((s) => (s.army as unknown as { subfactionId?: string | null }).subfactionId ?? null),
    ].filter((x): x is string => Boolean(x))));

    const subRows = subIds.length
      ? await prisma.$queryRaw<{ id: string; name: string }[]>`SELECT id, name FROM "Subfaction" WHERE id = ANY(${subIds}::text[])`
      : [];
    const subById = new Map<string, string>(subRows.map((s: { id: string; name: string }) => [s.id, s.name]));

    const effectiveTrainingFactionByArmyId = new Map<string, string>();
    for (const army of armies) {
      effectiveTrainingFactionByArmyId.set(
        army.id,
        resolveEffectiveTrainingFactionId({
          ownFactionId: army.factionId,
          ownFactionName: army.faction.name,
          playedOpponents: army.playedOpponents.map((row) => ({
            boxesChecked: row.boxesChecked,
            updatedAt: row.updatedAt,
            opponentFactionId: row.opponentArmy.factionId,
            opponentFactionName: row.opponentArmy.faction.name,
          })),
        }),
      );
    }
    for (const sharedRow of sharedRows) {
      const army = sharedRow.army;
      effectiveTrainingFactionByArmyId.set(
        army.id,
        resolveEffectiveTrainingFactionId({
          ownFactionId: army.factionId,
          ownFactionName: army.faction.name,
          playedOpponents: army.playedOpponents.map((row) => ({
            boxesChecked: row.boxesChecked,
            updatedAt: row.updatedAt,
            opponentFactionId: row.opponentArmy.factionId,
            opponentFactionName: row.opponentArmy.faction.name,
          })),
        }),
      );
    }

    const explicitTrainingFactionIds = [
      ...armies.flatMap((a) => a.units.flatMap((u) => u.upgrades.map((up) => up.trainingFactionId ?? null))),
      ...sharedRows.flatMap((s) => s.army.units.flatMap((u) => u.upgrades.map((up) => up.trainingFactionId ?? null))),
    ].filter((id): id is string => Boolean(id));

    const allTrainingFactionIds = Array.from(
      new Set([...effectiveTrainingFactionByArmyId.values(), ...explicitTrainingFactionIds]),
    );
    const rules = allTrainingFactionIds.length
      ? await p.factionUpgradeRule.findMany({
        where: { factionId: { in: allTrainingFactionIds } },
        select: { factionId: true, statKey: true, ratingPerPoint: true, ratingPerPointChampion: true },
      }) as Array<{
        factionId: string;
        statKey: string;
        ratingPerPoint: number;
        ratingPerPointChampion?: number | null;
      }>
      : [];

    const ruleLookupByFaction = new Map<string, ReturnType<typeof buildTrainingRuleLookup>>();
    for (const factionId of allTrainingFactionIds) {
      const factionRules = rules.filter((r) => r.factionId === factionId);
      ruleLookupByFaction.set(factionId, buildTrainingRuleLookup(factionRules));
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

    function calcArmyRating(army: {
      id: string;
      faction: { name: string };
      units: Array<{
        present: boolean;
        selectedOption: { rating: number | null } | null;
        unit: { baseRating: number | null; roleTag: string | null; startPerks: Array<{ perk: { name: string } }> };
        chosenPerks: Array<{ perk: { name: string } }>;
        weapons: Array<{ templateId: string; activeMods: string[] }>;
        upgrades: Array<{ statKey: string; delta: number; trainingFactionId?: string | null }>;
      }>;
    }): number {
      const effectiveTrainingFactionId = effectiveTrainingFactionByArmyId.get(army.id) ?? null;
      const defaultRuleLookup = effectiveTrainingFactionId
        ? ruleLookupByFaction.get(effectiveTrainingFactionId) ?? new Map()
        : new Map();

      return army.units.reduce((sum: number, u) => {
        if (!u.present) return sum;

        const baseFromTemplate = u.unit.baseRating ?? 0;
        const optionRating = u.selectedOption?.rating ?? 0;

        const weaponDelta = u.weapons.reduce((acc: number, w) => {
          const t = weaponById.get(w.templateId);
          if (!t) return acc;
          const selected = new Set(w.activeMods.filter((m) => m.startsWith('__profile:')).map((m) => m.slice(10)));
          const pSum = t.profiles.reduce((a: number, p) => (selected.has(p.id) ? a + (p.ratingDelta ?? 0) : a), 0);
          return acc + pSum;
        }, 0);
        const unitPerkNames = [
          ...u.unit.startPerks.map((sp) => sp.perk.name),
          ...u.chosenPerks.map((cp) => cp.perk.name),
        ];

        const statsDelta = u.upgrades.reduce((acc: number, up) => {
          if (up.delta <= 0) return acc;
          const ruleLookup = up.trainingFactionId
            ? ruleLookupByFaction.get(up.trainingFactionId) ?? defaultRuleLookup
            : defaultRuleLookup;
          const per = getUpgradeRatingPerPointForUnit({
            statKey: up.statKey,
            roleTag: u.unit.roleTag,
            unitPerkNames,
            crewFactionName: army.faction.name,
            rulesLookup: ruleLookup,
          });
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
          rating: calcArmyRating(a),
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
