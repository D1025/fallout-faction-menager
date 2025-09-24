// src/components/army/UnitClient.tsx
'use client';

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';

type EffectKind = 'WEAPON' | 'CRITICAL';
type StatKey = 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L' | 'hp';
type UiStatKey = 'HP' | 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';

type WeaponProfileUI = {
    id: string;
    type: string;
    test: string;
    parts: number | null;
    rating: number | null; // delta
    effects: { id: string; name: string; valueInt: number | null; kind: EffectKind }[];
};

type WeaponUI = {
    id: string; // WeaponInstance.id
    name: string;
    selectedProfileIds: string[]; // multi
    baseEffects: { id: string; name: string; valueInt: number | null; kind: EffectKind }[];
    profiles: WeaponProfileUI[];
};

type UpgradeUI = { id: string; statKey: StatKey; delta: number; at: string };
type Perk = { id: string; name: string; requiresValue: boolean };

export function UnitClient({
                               unitId,
                               armyId: _armyId,
                               name,
                               roleTag,
                               present: _present,
                               wounds: _wounds,
                               special,
                               upgrades,
                               weapons,
                           }: {
    unitId: string;
    armyId: string;
    name: string;
    roleTag: string | null;
    present: boolean;
    wounds: number;
    special: Record<UiStatKey, number>;
    upgrades: UpgradeUI[];
    weapons: WeaponUI[];
}) {
    void _armyId;
    void _present;
    void _wounds;

    // ===== Perki (lista do dodawania) =====
    const [perks, setPerks] = useState<Perk[]>([]);
    const [perkId, setPerkId] = useState<string>('');
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/perks', { cache: 'no-store' });
                if (res.ok) setPerks(await res.json());
            } catch {
                // noop
            }
        })();
    }, []);

    // ===== Łączne bonusy z ulepszeń (w tym rany – ujemne) =====
    const bonus = useMemo(() => {
        const b: Record<UiStatKey, number> = { HP: 0, S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
        for (const u of upgrades) {
            if (u.statKey === 'hp') b.HP += u.delta;
            else b[u.statKey as Exclude<StatKey, 'hp'>] += u.delta;
        }
        return b;
    }, [upgrades]);

    const finalStats = useMemo(
        () => ({
            HP: special.HP + bonus.HP,
            S: special.S + bonus.S,
            P: special.P + bonus.P,
            E: special.E + bonus.E,
            C: special.C + bonus.C,
            I: special.I + bonus.I,
            A: special.A + bonus.A,
            L: special.L + bonus.L,
        }),
        [special, bonus]
    );

    // ===== Akcje =====
    async function setProfiles(weaponInstanceId: string, profileIds: string[]) {
        const res = await fetch(`/api/weapons/${weaponInstanceId}/profiles`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileIds }),
        });
        if (!res.ok) {
            alert('Nie udało się zmienić profili');
            return false;
        }
        return true;
    }

    const [upStat, setUpStat] = useState<StatKey>('S');
    const [upDelta, setUpDelta] = useState<number>(1);

    async function addUpgrade() {
        const res = await fetch(`/api/units/${unitId}/upgrades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statKey: upStat, delta: upDelta }), // może być ujemny
        });
        if (!res.ok) {
            alert('Nie udało się dodać ulepszenia');
            return;
        }
        location.reload();
    }

    async function deleteUpgrade(upgradeId: string) {
        const res = await fetch(`/api/units/${unitId}/upgrades/${upgradeId}`, { method: 'DELETE' });
        if (!res.ok) {
            alert('Nie udało się cofnąć ulepszenia');
            return;
        }
        location.reload();
    }

    async function addPerk() {
        if (!perkId) return;
        const selected = perks.find((p) => p.id === perkId);
        if (selected?.requiresValue) {
            alert('Ten perk wymaga wartości – na razie nieobsługiwane dla chosenPerkIds.');
            return;
        }
        const res = await fetch(`/api/units/${unitId}/perks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ perkId }),
        });
        if (!res.ok) {
            alert('Nie udało się dodać perka');
            return;
        }
        setPerkId('');
        location.reload();
    }

    /* ===== SPECIAL kompakt z poprawnym +/− ===== */
    function renderSpecialCompact() {
        const HEAD = ['S', 'P', 'E', 'C', 'I', 'A', 'L', '♥'] as const;
        const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
        return (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="grid grid-cols-8 bg-teal-700/70 text-teal-50 text-[11px] font-semibold tracking-widest">
                    {HEAD.map((h) => (
                        <div key={h} className="px-2 py-1 text-center">
                            {h === '♥' ? 'HP' : h}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-8 bg-zinc-950 text-sm text-zinc-100">
                    {HEAD.map((h) => {
                        const base = h === '♥' ? special.HP : special[h as Exclude<typeof h, '♥'>];
                        const fin = h === '♥' ? finalStats.HP : finalStats[h as Exclude<typeof h, '♥'>];
                        const delta = fin - base;
                        return (
                            <div key={h} className="px-2 py-1 text-center tabular-nums">
                <span className={delta !== 0 ? (delta > 0 ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold') : ''}>
                  {fin}
                </span>
                                {delta !== 0 && (
                                    <sup className={'ml-0.5 align-super text-[10px] ' + (delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                                        {sign(delta)}
                                    </sup>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ===== helper do efektów: X → valueInt ===== */
    function formatEffect(name: string, valueInt: number | null): string {
        if (valueInt == null) return name;
        let replaced = name.replace(/\(\s*X\s*\)/g, String(valueInt));
        replaced = replaced.replace(/\bX\b/g, String(valueInt));
        if (replaced !== name) return replaced;
        return `${name} (${valueInt})`;
    }

    /* ===== Karta broni (bez zmian funkcjonalnych) ===== */
    function WeaponCard({ w }: { w: WeaponUI }) {
        const [selected, setSelected] = useState<string[]>(w.selectedProfileIds);

        async function toggle(id: string, checked: boolean) {
            const next = checked ? [...new Set([...selected, id])] : selected.filter((x) => x !== id);
            setSelected(next);
            const ok = await setProfiles(w.id, next);
            if (!ok) setSelected(selected);
            else location.reload();
        }

        const baseTraits = w.baseEffects
            .filter((e) => e.kind === 'WEAPON')
            .map((e) => formatEffect(e.name, e.valueInt));
        const baseCrits = w.baseEffects
            .filter((e) => e.kind === 'CRITICAL')
            .map((e) => formatEffect(e.name, e.valueInt));

        type Row =
            | {
            kind: 'BASE';
            type: string;
            test: string | null;
            traits: string[];
            crits: string[];
            parts: number | null;
            rating: number | null;
            profileId?: undefined;
        }
            | {
            kind: 'PROFILE';
            type: string;
            test: string | null;
            traits: string[];
            crits: string[];
            parts: number | null;
            rating: number | null;
            profileId: string;
        };

        const rows: Row[] = [];

        if (baseTraits.length || baseCrits.length) {
            const t = w.profiles[0]?.type ?? '—';
            rows.push({
                kind: 'BASE',
                type: t,
                test: null,
                traits: baseTraits,
                crits: baseCrits,
                parts: null,
                rating: null,
            });
        }

        for (const p of w.profiles) {
            const traits = p.effects
                .filter((e) => e.kind === 'WEAPON')
                .map((e) => formatEffect(e.name, e.valueInt));
            const crits = p.effects
                .filter((e) => e.kind === 'CRITICAL')
                .map((e) => formatEffect(e.name, e.valueInt));
            rows.push({
                kind: 'PROFILE',
                profileId: p.id,
                type: p.type,
                test: p.test || null,
                traits,
                crits,
                parts: p.parts,
                rating: p.rating,
            });
        }

        const allSameType = rows.every((r) => r.type === rows[0]?.type);
        const mergedType = allSameType && rows.length > 0;

        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="mb-1 font-medium">{w.name}</div>

                {/* < 400px: pionowe karty */}
                <div className="block min-[400px]:hidden">
                    <div className="grid gap-2">
                        {rows.map((r, idx) => {
                            const isSel = r.kind === 'PROFILE' ? selected.includes(r.profileId) : false;
                            return (
                                <div key={idx} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                                    <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1.5">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-teal-50 bg-teal-700/70 px-2 py-0.5 rounded">
                                            {r.kind === 'BASE' ? 'BASE' : r.type || '—'}
                                        </div>
                                        {r.kind === 'PROFILE' ? (
                                            <button
                                                onClick={() => void toggle(r.profileId, !isSel)}
                                                className={
                                                    'h-7 w-7 rounded-lg text-lg leading-none ' +
                                                    (isSel ? 'bg-emerald-600 text-emerald-50' : 'bg-emerald-500 text-emerald-950')
                                                }
                                                title={isSel ? 'Usuń profil' : 'Dodaj profil'}
                                                aria-label={isSel ? 'Usuń profil' : 'Dodaj profil'}
                                            >
                                                {isSel ? '✓' : '+'}
                                            </button>
                                        ) : (
                                            <div className="h-7 w-7" />
                                        )}
                                    </div>
                                    {[
                                        ['Test', r.test ?? '—'],
                                        ['Traits', r.traits.join(', ') || '—'],
                                        ['Critical Effect', r.crits.join(', ') || '—'],
                                        ['Parts', r.parts != null ? String(r.parts) : '—'],
                                        ['Rating', r.rating != null ? String(r.rating) : '—'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="grid grid-cols-[36%_64%] border-t first:border-t-0 border-zinc-800">
                                            <div className="bg-zinc-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                                                {label}
                                            </div>
                                            <div className="px-2 py-1 text-sm whitespace-normal break-words">{value}</div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ≥ 400px: tabela horyzontalna */}
                <div className="hidden min-[400px]:block overflow-x-auto">
                    <table className="w-full table-auto text-sm">
                        <thead>
                        <tr className="bg-teal-700/70 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
                            <th className="px-2 py-1 text-left">Type</th>
                            <th className="px-2 py-1 text-left">Test</th>
                            <th className="px-2 py-1 text-left">Traits</th>
                            <th className="px-2 py-1 text-left">Critical Effect</th>
                            <th className="px-2 py-1 text-left">Parts</th>
                            <th className="px-2 py-1 text-left">Rating</th>
                            <th className="px-2 py-1 text-left"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((r, idx) => {
                            const isSel = r.kind === 'PROFILE' ? selected.includes(r.profileId) : false;
                            return (
                                <tr key={idx} className="border-t border-zinc-800 align-top bg-zinc-950">
                                    {mergedType ? (
                                        idx === 0 ? (
                                            <td className="px-2 py-1 whitespace-normal break-words" rowSpan={rows.length}>
                                                {r.type || '—'}
                                            </td>
                                        ) : null
                                    ) : (
                                        <td className="px-2 py-1 whitespace-normal break-words">{r.type || '—'}</td>
                                    )}
                                    <td className="px-2 py-1 whitespace-normal break-words">{r.test ?? '—'}</td>
                                    <td className="px-2 py-1 whitespace-normal break-words text-zinc-300">
                                        {r.traits.length ? (
                                            <ul className="list-disc pl-4 space-y-0.5">
                                                {r.traits.map((t, i) => (
                                                    <li key={i}>{t}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-2 py-1 whitespace-normal break-words text-zinc-300">
                                        {r.crits.length ? (
                                            <ul className="list-disc pl-4 space-y-0.5">
                                                {r.crits.map((c, i) => (
                                                    <li key={i}>{c}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-2 py-1">{r.parts != null ? r.parts : '—'}</td>
                                    <td className="px-2 py-1">{r.rating != null ? r.rating : '—'}</td>
                                    <td className="px-2 py-1">
                                        {r.kind === 'PROFILE' ? (
                                            <button
                                                onClick={() => void toggle(r.profileId, !isSel)}
                                                className={
                                                    'h-8 w-8 rounded-lg text-lg leading-none ' +
                                                    (isSel ? 'bg-emerald-600 text-emerald-50' : 'bg-emerald-500 text-emerald-950')
                                                }
                                                title={isSel ? 'Usuń profil' : 'Dodaj profil'}
                                                aria-label={isSel ? 'Usuń profil' : 'Dodaj profil'}
                                            >
                                                {isSel ? '✓' : '+'}
                                            </button>
                                        ) : (
                                            <span className="text-zinc-500">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <main className="mx-auto max-w-screen-sm px-3 pb-24 text-sm">
            {/* Nagłówek + SPECIAL */}
            <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between">
                    <div className="font-semibold">{name}</div>
                    <div className="text-xs text-zinc-400">{roleTag ?? ''}</div>
                </div>
                <div className="mt-3">{renderSpecialCompact()}</div>
            </section>

            {/* Broń */}
            <section className="mt-4">
                <div className="text-sm font-medium">Broń</div>
                <div className="mt-2 grid gap-3">
                    {weapons.map((w) => (
                        <WeaponCard key={w.id} w={w} />
                    ))}
                    {weapons.length === 0 && <div className="text-zinc-500">Brak broni</div>}
                </div>
            </section>

            {/* Ulepszenia (+ Rany) */}
            <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="text-sm font-medium">Ulepszenia</div>

                {/* Panel dodawania – pozwala na wartości ujemne */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                        value={upStat}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUpStat(e.target.value as StatKey)}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1"
                    >
                        {(['S', 'P', 'E', 'C', 'I', 'A', 'L', 'hp'] as StatKey[]).map((k) => (
                            <option key={k} value={k}>
                                {k.toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <input
                        inputMode="numeric"
                        value={upDelta}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setUpDelta(Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0)
                        }
                        className="w-24 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-right"
                        placeholder="np. -1, 2"
                    />
                    <div className="flex gap-1">
                        {[-3, -2, -1, +1, +2, +3].map((d) => (
                            <button
                                key={d}
                                onClick={() => setUpDelta(d)}
                                className={
                                    'rounded-lg border px-2 py-1 text-xs ' +
                                    (d < 0 ? 'border-red-700/60 bg-red-900/20 text-red-300' : 'border-emerald-700/60 bg-emerald-900/20 text-emerald-300')
                                }
                                title={d < 0 ? 'Rana (ujemny modyfikator)' : 'Ulepszenie (dodatni)'}
                            >
                                {d > 0 ? `+${d}` : d}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => void addUpgrade()} className="rounded-xl bg-emerald-500 px-3 py-1 text-emerald-950">
                        Dodaj
                    </button>
                </div>

                <div className="mt-2 text-[11px] text-zinc-500">
                    * Ujemne modyfikacje (rany) <span className="text-red-400 font-medium">nie wliczają się do ratingu</span>.
                </div>

                {/* Listy: dodatnie / zerowe */}
                <div className="mt-3 grid gap-1 text-xs text-zinc-300">
                    {upgrades.filter((u) => u.delta >= 0).map((u) => (
                        <div
                            key={u.id}
                            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1"
                        >
                            <div>
                                <span className="font-medium">{u.statKey.toUpperCase()}</span>{' '}
                                {u.delta > 0 ? `+${u.delta}` : u.delta}
                                <span className="text-zinc-500"> • {new Date(u.at).toLocaleString()}</span>
                            </div>
                            <button
                                onClick={() => void deleteUpgrade(u.id)}
                                className="rounded-md border border-zinc-700 px-2 py-0.5 text-zinc-200 hover:bg-zinc-800"
                                aria-label="Cofnij ulepszenie"
                                title="Cofnij"
                            >
                                Cofnij
                            </button>
                        </div>
                    ))}
                    {upgrades.filter((u) => u.delta >= 0).length === 0 && (
                        <div className="text-zinc-500">Brak dodatnich ulepszeń</div>
                    )}
                </div>

                {/* Rany (ujemne) */}
                <div className="mt-4">
                    <div className="text-sm font-medium text-red-300">Rany (ujemne)</div>
                    <div className="mt-2 grid gap-1 text-xs">
                        {upgrades.filter((u) => u.delta < 0).map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center justify-between rounded-lg border border-red-800 bg-red-950/40 px-2 py-1 text-red-200"
                            >
                                <div>
                                    <span className="font-semibold">{u.statKey.toUpperCase()}</span> {u.delta}
                                    <span className="ml-1 text-red-300/70">• {new Date(u.at).toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => void deleteUpgrade(u.id)}
                                    className="rounded-md border border-red-700/70 px-2 py-0.5 hover:bg-red-900/30"
                                    aria-label="Usuń ranę"
                                    title="Cofnij"
                                >
                                    Cofnij
                                </button>
                            </div>
                        ))}
                        {upgrades.filter((u) => u.delta < 0).length === 0 && (
                            <div className="text-zinc-500">Brak ran</div>
                        )}
                    </div>
                </div>
            </section>

            {/* Perki */}
            <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="text-sm font-medium">Perki</div>
                <div className="mt-2 flex items-center gap-2">
                    <select
                        value={perkId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPerkId(e.target.value)}
                        className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1"
                    >
                        <option value="">— wybierz perka —</option>
                        {perks.map((p) => (
                            <option key={p.id} value={p.id} disabled={p.requiresValue}>
                                {p.name}
                                {p.requiresValue ? ' (wymaga wartości — nieobsługiwane)' : ''}
                            </option>
                        ))}
                    </select>
                    <button onClick={() => void addPerk()} className="rounded-xl bg-emerald-500 px-3 py-1 text-emerald-950">
                        Dodaj
                    </button>
                </div>
                <div className="mt-2 text-[11px] text-zinc-500">
                    * Perki wymagające wartości (X) są teraz wyłączone dla dodawania — w schemacie zapisujemy jedynie ID w
                    <code> chosenPerkIds</code>.
                </div>
            </section>
        </main>
    );
}
