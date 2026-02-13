'use client';

import Link from 'next/link';
import { Button } from 'antd';
import { ClearOutlined, FilterOutlined, ToolOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { SectionCard } from '@/components/ui/antd/SectionCard';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { CreateArmySheet } from '@/components/home/CreateArmySheet';
import { HomeArmiesTabs } from '@/components/home/HomeArmiesTabs';

type ArmyMeta = {
    id: string;
    name: string;
    tier: number;
    factionName: string;
    subfactionName: string | null;
    rating: number;
};

type SharedMeta = { id: string; perm: 'READ' | 'WRITE'; army: ArmyMeta };

type FactionDTO = {
    id: string;
    name: string;
    limits: { tag: string; tier1: number | null; tier2: number | null; tier3: number | null }[];
    goalSets: {
        id: string;
        name: string;
        goals: { tier: 1 | 2 | 3; description: string; target: number; order: number }[];
    }[];
};

export function HomeClient({
    isAdmin,
    myArmies,
    shared,
    factions,
}: {
    isAdmin: boolean;
    myArmies: ArmyMeta[];
    shared: SharedMeta[];
    factions: FactionDTO[];
}) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [clearTick, setClearTick] = useState(0);

    const headerRight = useMemo(
        () => (
            <div className="flex items-center gap-2">
                <Button
                    size="small"
                    icon={<FilterOutlined />}
                    onClick={() => setFiltersOpen(true)}
                    aria-label="Filtry"
                    title="Filtry"
                />
                <Button
                    size="small"
                    icon={<ClearOutlined />}
                    onClick={() => setClearTick((x) => x + 1)}
                    aria-label="Wyczyść filtry"
                    title="Wyczyść filtry"
                />
                {isAdmin ? (
                    <Link href="/admin">
                        <Button size="small" icon={<ToolOutlined />}>
                            Admin
                        </Button>
                    </Link>
                ) : null}
                <SignOutButton />
            </div>
        ),
        [isAdmin],
    );

    return (
        <MobilePageShell title="Fallout Army Tracker" headerRight={headerRight}>
            <SectionCard>
                <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Pip-Boy Dowódcy</p>
                <p className="mt-1 text-sm vault-muted">
                    Zarządzaj oddziałami, celami kampanii i zasobami armii pod mobile-first gameplay.
                </p>
            </SectionCard>

            <div className="mt-3">
                <HomeArmiesTabs
                    myArmies={myArmies}
                    shared={shared}
                    filtersOpen={filtersOpen}
                    onFiltersOpenChangeAction={setFiltersOpen}
                    clearFromHeaderTick={clearTick}
                    onClearFromHeaderAction={() => {
                        // UX: po wyczyszczeniu zazwyczaj chcemy ukryć drawer
                        setFiltersOpen(false);
                    }}
                >
                    <CreateArmySheet factions={factions} />
                </HomeArmiesTabs>
            </div>
        </MobilePageShell>
    );
}
