'use client';

import { useMemo, useState } from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { RuleDescription } from '@/components/rules/RuleDescription';
import {
    CAPTIVE_STORY_ACTIONS_INTRO,
    STORY_ACTIONS,
    STORY_ACTIONS_INTRO,
    type StoryActionEntry,
} from '@/lib/storyActions';

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function matchesTitle(entry: StoryActionEntry, query: string): boolean {
    if (!query) return true;
    return normalize(entry.title).includes(normalize(query));
}

export function StoryActionsClient() {
    const [query, setQuery] = useState('');

    const filteredActions = useMemo(
        () => STORY_ACTIONS.filter((entry) => matchesTitle(entry, query)),
        [query],
    );

    return (
        <div className="space-y-4">
            <section className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-100">Rules</div>
                <h2 className="text-sm font-semibold text-zinc-100">Story Actions</h2>
                <p className="text-xs leading-relaxed text-zinc-300">{STORY_ACTIONS_INTRO}</p>
                <p className="text-xs leading-relaxed text-zinc-400">{CAPTIVE_STORY_ACTIONS_INTRO}</p>
                <Input
                    allowClear
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    prefix={<SearchOutlined className="text-zinc-500" />}
                    className="mt-3 !border-none !bg-zinc-900/80 !shadow-none"
                    placeholder="Search by title (e.g. Recruit, Barter, Judge Captive)"
                    aria-label="Search story actions by title"
                />
                <div className="mt-2 text-xs text-zinc-400">
                    Results: <span className="font-semibold text-zinc-100">{filteredActions.length}</span>/{STORY_ACTIONS.length}
                </div>
            </section>

            {filteredActions.length === 0 ? (
                <section className="border-b border-zinc-800/70 py-2">
                    <div className="text-sm text-zinc-400">No Story Action title matches your search.</div>
                </section>
            ) : null}

            {filteredActions.map((entry) => (
                <details key={entry.id} className="border-b border-zinc-800/70 py-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-100">{entry.title}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200">
                                    {entry.category}
                                </span>
                                {entry.faction ? (
                                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200">
                                        {entry.faction}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Open</span>
                    </summary>
                    <div className="pt-2">
                        <RuleDescription text={entry.rules} />
                    </div>
                </details>
            ))}
        </div>
    );
}
