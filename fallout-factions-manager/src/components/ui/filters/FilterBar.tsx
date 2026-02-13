'use client';

import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
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
    /** Sterowanie z zewnątrz (np. przycisk w headerze). */
    open,
    onOpenChangeAction,
    /** Czy pokazywać wewnętrzny przycisk otwierający Drawer. */
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

    // Jeśli user ma aktywne filtry, nie utrudniaj — drawer może być szybciej dostępny.
    // (Nie otwieramy automatycznie, ale trigger dostaje stan "primary".)
    useEffect(() => {
        // no-op — zostawione na przyszłość jeśli będziemy zapamiętywać stan
    }, [hasActive]);

    const drawerBody = (
        <div className="grid gap-3">
            {onSearchAction ? (
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <SearchOutlined className="text-zinc-400" />
                    <input
                        value={search}
                        onChange={(e) => onSearchAction(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                        placeholder={searchPlaceholder ?? 'Szukaj'}
                    />
                </div>
            ) : null}

            {controls ? <div className="min-w-0">{controls}</div> : null}
            {quickToggles ? <div className="flex flex-wrap gap-2">{quickToggles}</div> : null}
            {moreFilters ? <div className="grid gap-3">{moreFilters}</div> : null}
            <FilterChips chips={chips} />
        </div>
    );

    const screens = Grid.useBreakpoint();
    const isDesktop = Boolean(screens.lg);

    const desktopWidth = 520;
    const mobileMaxHeight = '70dvh';

    return (
        <>
            {showTrigger || onClearAllAction ? (
                <div className="flex items-center justify-end gap-2">
                    {showTrigger ? (
                        <Tooltip title={hasActive ? 'Filtry (aktywne)' : 'Filtry'}>
                            <Button
                                type={hasActive ? 'primary' : 'default'}
                                size="middle"
                                icon={<FilterOutlined />}
                                onClick={() => setOpen(true)}
                                aria-label="Filtry"
                            />
                        </Tooltip>
                    ) : null}
                </div>
            ) : null}

            <Drawer
                title="Filtry"
                open={drawerOpen}
                onClose={() => setOpen(false)}
                placement={isDesktop ? 'right' : 'bottom'}
                size={isDesktop ? 'default' : 'default'}
                closable
                styles={{
                    section: {
                        ...({}),
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
