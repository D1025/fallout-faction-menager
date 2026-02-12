'use client';

import type React from 'react';
import { BackButton } from '@/components/nav/BackButton';

export function AppHeader({
    title,
    backHref,
    right,
}: {
    title: string;
    backHref?: string;
    right?: React.ReactNode;
}) {
    return (
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0d1117]/95 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-[560px] items-center justify-between px-3">
                <div className="min-w-0">{backHref ? <BackButton fallbackHref={backHref} /> : <div className="w-[64px]" />}</div>
                <div className="min-w-0 flex-1 px-2 text-center">
                    <div className="truncate text-sm font-semibold uppercase tracking-[0.12em] text-amber-300">{title}</div>
                </div>
                <div className="min-w-0 text-right">{right ?? <div className="w-[64px]" />}</div>
            </div>
        </header>
    );
}
