'use client';

import { useEffect, useMemo, useState } from 'react';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { ArmyDashboardClient, type ArmyDashboardActions } from '@/components/army/ArmyDashboardClient';
import { ArmyHeaderControls } from '@/components/army/ArmyHeaderControls';

export function ArmyPageClient(props: React.ComponentProps<typeof ArmyDashboardClient> & { backHref: string }) {
    const [actions, setActions] = useState<ArmyDashboardActions | null>(null);

    const headerRight = useMemo(
        () => (
            <ArmyHeaderControls
                onOpenFiltersAction={() => actions?.openFilters()}
                onClearFiltersAction={() => actions?.clearFilters()}
            />
        ),
        [actions],
    );

    return (
        <MobilePageShell title={props.armyName} backHref={props.backHref} headerRight={headerRight}>
            <ArmyDashboardClient
                {...props}
                onActionsReadyAction={(a) => setActions(a)}
            />
        </MobilePageShell>
    );
}
