'use client';

import { ClearOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Drawer, Grid, Tooltip } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { FilterChips, type ActiveFilterChip } from './FilterChips';

export function FilterBar({
    search,
    onSearchAction,
    searchPlaceholder,
    controls,
    quickToggles,
    activeChips,
    onClearAllAction,
    moreFilters,
    onActiveChangeAction,
    open,
    onOpenChangeAction,
    showTrigger = true,
}: {
    search?: string;
    onSearchAction?: (next: string) => void;
    searchPlaceholder?: string;
    controls?: React.ReactNode;
    quickToggles?: React.ReactNode;
    activeChips?: ActiveFilterChip[];
    onClearAllAction?: () => void;
    moreFilters?: React.ReactNode;
    onActiveChangeAction?: (active: boolean) => void;
    open?: boolean;
    onOpenChangeAction?: (next: boolean) => void;
    showTrigger?: boolean;
}) {
    const chips = activeChips ?? [];
    const hasActive = useMemo(() => chips.length > 0, [chips.length]);

    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = open != null;
    const drawerOpen = isControlled ? Boolean(open) : internalOpen;

    const setOpen = (next: boolean) => {
        if (!isControlled) setInternalOpen(next);
        onOpenChangeAction?.(next);
    };

    useEffect(() => {
        onActiveChangeAction?.(hasActive);
    }, [hasActive, onActiveChangeAction]);

    const drawerBody = (
        <div className="grid gap-3">
            {onSearchAction ? (
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <SearchOutlined className="text-zinc-400" />
                    <input
                        value={search}
                        onChange={(e) => onSearchAction(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                        placeholder={searchPlaceholder ?? 'Search'}
                    />
                </div>
            ) : null}

            {controls ? <div className="min-w-0">{controls}</div> : null}
            {quickToggles ? <div className="flex flex-wrap gap-2">{quickToggles}</div> : null}
            {moreFilters ? <div className="grid gap-3">{moreFilters}</div> : null}
            <FilterChips chips={chips} />

            {onClearAllAction ? (
                <Button
                    block
                    type={hasActive ? 'primary' : 'default'}
                    icon={<ClearOutlined />}
                    disabled={!hasActive}
                    onClick={onClearAllAction}
                >
                    Clear filters
                </Button>
            ) : null}
        </div>
    );

    const screens = Grid.useBreakpoint();
    const isDesktop = Boolean(screens.lg);
    const mobileMaxHeight = '105dvh';

    return (
        <>
            {showTrigger ? (
                <div className="flex items-center justify-end gap-2">
                    <Tooltip title={hasActive ? 'Filters (active)' : 'Filters'}>
                        <Button
                            type={hasActive ? 'primary' : 'default'}
                            size="middle"
                            icon={<FilterOutlined />}
                            onClick={() => setOpen(true)}
                            aria-label="Filters"
                        />
                    </Tooltip>
                </div>
            ) : null}

            <Drawer
                title="Filters"
                open={drawerOpen}
                onClose={() => setOpen(false)}
                placement={isDesktop ? 'right' : 'bottom'}
                size="default"
                closable
                styles={{
                    section: {
                        maxWidth: '100vw',
                    },
                    body: {
                        maxHeight: isDesktop ? 'calc(100dvh - 112px)' : mobileMaxHeight,
                        overflow: 'auto',
                        paddingInline: 16,
                    },
                }}
            >
                {drawerBody}
            </Drawer>
        </>
    );
}
