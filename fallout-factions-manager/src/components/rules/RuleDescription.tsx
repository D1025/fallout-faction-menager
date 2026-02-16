'use client';

import { useMemo } from 'react';

type TextBlock = { kind: 'TEXT'; text: string };
type TableBlock = { kind: 'TABLE'; header: string[]; rows: string[][] };
type Block = TextBlock | TableBlock;

function splitTableRow(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map((part) => part.trim());
}

function isSeparatorRow(line: string): boolean {
    const cells = splitTableRow(line);
    if (cells.length === 0) return false;
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(lines: string[], idx: number): boolean {
    if (idx + 1 >= lines.length) return false;
    const current = lines[idx] ?? '';
    const next = lines[idx + 1] ?? '';
    return current.includes('|') && isSeparatorRow(next);
}

function isTableDataRow(line: string): boolean {
    return line.includes('|');
}

function parseBlocks(text: string): Block[] {
    const lines = text.replace(/\r/g, '').split('\n');
    const blocks: Block[] = [];
    let i = 0;

    while (i < lines.length) {
        if (isTableStart(lines, i)) {
            const header = splitTableRow(lines[i] ?? '');
            i += 2; // header + separator
            const rows: string[][] = [];
            while (i < lines.length && isTableDataRow(lines[i] ?? '')) {
                const row = splitTableRow(lines[i] ?? '');
                const normalized =
                    row.length >= header.length
                        ? row.slice(0, header.length)
                        : [...row, ...Array.from({ length: header.length - row.length }, () => '')];
                rows.push(normalized);
                i++;
            }
            blocks.push({ kind: 'TABLE', header, rows });
            continue;
        }

        if (!(lines[i] ?? '').trim()) {
            i++;
            continue;
        }

        const chunk: string[] = [];
        while (i < lines.length && (lines[i] ?? '').trim() && !isTableStart(lines, i)) {
            chunk.push(lines[i] ?? '');
            i++;
        }
        const paragraph = chunk.join('\n').trim();
        if (paragraph) blocks.push({ kind: 'TEXT', text: paragraph });
    }

    return blocks;
}

export function RuleDescription({ text }: { text: string }) {
    const blocks = useMemo(() => parseBlocks(text), [text]);
    if (!text.trim()) return <div className="text-sm text-zinc-500">No description.</div>;

    return (
        <div className="space-y-2">
            {blocks.map((block, idx) => {
                if (block.kind === 'TEXT') {
                    return (
                        <p key={idx} className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                            {block.text}
                        </p>
                    );
                }
                return (
                    <div key={idx} className="vault-scrollbar overflow-x-auto rounded-xl border border-zinc-800">
                        <table className="min-w-full border-collapse text-xs">
                            <thead>
                                <tr className="bg-teal-700/70 text-teal-50">
                                    {block.header.map((h, hi) => (
                                        <th key={hi} className="border border-zinc-800 px-2 py-1 text-left font-semibold">
                                            {h || '-'}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {block.rows.map((row, ri) => (
                                    <tr key={ri} className="bg-zinc-950 text-zinc-300">
                                        {row.map((cell, ci) => (
                                            <td key={ci} className="border border-zinc-800 px-2 py-1 align-top">
                                                {cell || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}

