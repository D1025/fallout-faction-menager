'use client';

import { CloseOutlined } from '@ant-design/icons';

export type ActiveFilterChip = {
    key: string;
    label: string;
    onRemove: () => void;
};

export function FilterChips({ chips }: { chips: ActiveFilterChip[] }) {
    if (!chips.length) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
                <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200"
                >
                    <span>{chip.label}</span>
                    <CloseOutlined className="text-[10px] text-zinc-400" />
                </button>
            ))}
        </div>
    );
}
