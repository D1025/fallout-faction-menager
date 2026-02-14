'use client';

import { useMemo, useState } from 'react';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { ArmyDashboardClient, type ArmyDashboardActions } from '@/components/army/ArmyDashboardClient';
import { ArmyHeaderControls } from '@/components/army/ArmyHeaderControls';

export function ArmyPageClient(props: React.ComponentProps<typeof ArmyDashboardClient> & { backHref: string }) {
    const [actions, setActions] = useState<ArmyDashboardActions | null>(null);
    const [filtersActive, setFiltersActive] = useState(false);

    const headerRight = useMemo(
        () => (
            <ArmyHeaderControls
                onOpenFiltersAction={() => actions?.openFilters()}
                hasActiveFilters={filtersActive}
            />
        ),
        [actions, filtersActive],
    );

    return (
        <MobilePageShell title={props.armyName} backHref={props.backHref} headerRight={headerRight}>
            <ArmyDashboardClient
                {...props}
                onActionsReadyAction={(a) => setActions(a)}
                onFiltersActiveChangeAction={setFiltersActive}
            />
        </MobilePageShell>
    );
}
