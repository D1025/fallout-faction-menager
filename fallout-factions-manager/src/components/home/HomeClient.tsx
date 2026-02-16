'use client';

import { Button } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { UserAccountMenu } from '@/components/auth/UserAccountMenu';
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
    userName,
    userRole,
    userPhotoEtag,
    myArmies,
    shared,
    factions,
}: {
    userName: string;
    userRole: 'USER' | 'ADMIN';
    userPhotoEtag?: string | null;
    myArmies: ArmyMeta[];
    shared: SharedMeta[];
    factions: FactionDTO[];
}) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filtersActive, setFiltersActive] = useState(false);

    const headerRight = useMemo(
        () => (
            <div className="flex items-center gap-2">
                <Button
                    type={filtersActive ? 'primary' : 'default'}
                    icon={<FilterOutlined />}
                    onClick={() => setFiltersOpen(true)}
                    aria-label="Filters"
                    title="Filters"
                />
                <UserAccountMenu name={userName} role={userRole} photoEtag={userPhotoEtag} />
            </div>
        ),
        [filtersActive, userName, userPhotoEtag, userRole],
    );

    return (
        <MobilePageShell title="Fallout Army Tracker" headerRight={headerRight}>
            <HomeArmiesTabs
                myArmies={myArmies}
                shared={shared}
                filtersOpen={filtersOpen}
                onFiltersOpenChangeAction={setFiltersOpen}
                onFiltersActiveChangeAction={setFiltersActive}
            >
                <CreateArmySheet factions={factions} />
            </HomeArmiesTabs>
        </MobilePageShell>
    );
}
