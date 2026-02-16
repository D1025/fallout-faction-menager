'use client';

import { useMemo, useState } from 'react';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { ArmyDashboardClient, type ArmyDashboardActions } from '@/components/army/ArmyDashboardClient';
import { ArmyHeaderControls } from '@/components/army/ArmyHeaderControls';
import { UserAccountMenu } from '@/components/auth/UserAccountMenu';

export function ArmyPageClient(
    props: React.ComponentProps<typeof ArmyDashboardClient> & {
        backHref: string;
        userName: string;
        userRole: 'USER' | 'ADMIN';
        userPhotoEtag?: string | null;
    },
) {
    const [actions, setActions] = useState<ArmyDashboardActions | null>(null);
    const [filtersActive, setFiltersActive] = useState(false);

    const headerRight = useMemo(
        () => (
            <div className="flex items-center gap-2">
                <ArmyHeaderControls
                    onOpenFiltersAction={() => actions?.openFilters()}
                    hasActiveFilters={filtersActive}
                />
                <UserAccountMenu
                    name={props.userName}
                    role={props.userRole}
                    photoEtag={props.userPhotoEtag}
                />
            </div>
        ),
        [actions, filtersActive, props.userName, props.userPhotoEtag, props.userRole],
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
