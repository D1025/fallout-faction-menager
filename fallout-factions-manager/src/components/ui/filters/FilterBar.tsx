'use client';

import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Drawer } from 'antd';
import { useState } from 'react';
import { FilterChips, type ActiveFilterChip } from './FilterChips';

export function FilterBar({
    search,
    onSearch,
    searchPlaceholder,
    controls,
    quickToggles,
    activeChips,
    onClearAll,
    moreFilters,
}: {
    search?: string;
    onSearch?: (next: string) => void;
    searchPlaceholder?: string;
    controls?: React.ReactNode;
    quickToggles?: React.ReactNode;
    activeChips?: ActiveFilterChip[];
    onClearAll?: () => void;
    moreFilters?: React.ReactNode;
}) {
    const [drawerOpen, setDrawerOpen] = useState(false);

    return (
        <div className="grid gap-2">
            {onSearch ? (
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <SearchOutlined className="text-zinc-400" />
                    <input
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                        placeholder={searchPlaceholder ?? 'Szukaj'}
                    />
                </div>
            ) : null}

            <div className="flex gap-2 overflow-x-auto md:grid md:grid-cols-[1fr_auto_auto] md:overflow-visible">
                <div className="min-w-[260px] md:min-w-0">{controls}</div>
                {quickToggles ? <div className="grid auto-cols-max grid-flow-col gap-2">{quickToggles}</div> : null}
                <div className="grid auto-cols-max grid-flow-col gap-2">
                    {moreFilters ? (
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                        >
                            <FilterOutlined /> Więcej filtrów
                        </button>
                    ) : null}
                    {onClearAll ? (
                        <button
                            type="button"
                            onClick={onClearAll}
                            className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
                        >
                            Wyczyść wszystko
                        </button>
                    ) : null}
                </div>
            </div>

            <FilterChips chips={activeChips ?? []} />

            {moreFilters ? (
                <Drawer
                    title="Więcej filtrów"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    placement="bottom"
                    height="auto"
                    extra={
                        <Button type="text" onClick={() => setDrawerOpen(false)}>
                            Zamknij
                        </Button>
                    }
                >
                    <div className="grid gap-3">{moreFilters}</div>
                </Drawer>
            ) : null}
        </div>
    );
}
