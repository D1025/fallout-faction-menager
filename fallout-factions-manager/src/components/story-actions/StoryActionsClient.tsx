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
import { SectionCard } from '@/components/ui/antd/SectionCard';

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
        <div className="grid gap-3">
            <SectionCard title="Story Actions">
                <p className="text-xs leading-relaxed text-zinc-300">{STORY_ACTIONS_INTRO}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">{CAPTIVE_STORY_ACTIONS_INTRO}</p>
                <div className="mt-3">
                    <Input
                        allowClear
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        prefix={<SearchOutlined className="text-zinc-500" />}
                        placeholder="Search by title (e.g. Recruit, Barter, Judge Captive)"
                        aria-label="Search story actions by title"
                    />
                </div>
                <div className="mt-2 text-xs text-zinc-400">
                    Results: <span className="font-semibold text-zinc-100">{filteredActions.length}</span>/{STORY_ACTIONS.length}
                </div>
            </SectionCard>

            {filteredActions.length === 0 ? (
                <SectionCard>
                    <div className="text-sm text-zinc-400">No Story Action title matches your search.</div>
                </SectionCard>
            ) : null}

            {filteredActions.map((entry) => (
                <details key={entry.id} className="ff-story-action-card">
                    <summary className="ff-story-action-card__summary">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold tracking-wide text-zinc-100">{entry.title}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                <span className="ff-story-action-badge ff-story-action-badge--category">
                                    {entry.category}
                                </span>
                                {entry.faction ? (
                                    <span className="ff-story-action-badge ff-story-action-badge--faction">
                                        {entry.faction}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <span className="ff-story-action-card__hint">expand</span>
                    </summary>
                    <div className="ff-story-action-card__body">
                        <RuleDescription text={entry.rules} />
                    </div>
                </details>
            ))}
        </div>
    );
}
