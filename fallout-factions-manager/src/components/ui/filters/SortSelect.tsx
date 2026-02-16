'use client';

export type SortOption = { label: string; value: string };

export function SortSelect({
    value,
    onChange,
    options,
    label = 'Sort',
}: {
    value: string;
    onChange: (next: string) => void;
    options: SortOption[];
    label?: string;
}) {
    return (
        <label className="block min-w-0">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
