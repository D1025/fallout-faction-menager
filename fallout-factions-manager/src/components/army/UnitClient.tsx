'use client';

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
                               armyId: _armyId, // nieużywane
                               name,
                               roleTag,
                               present: _present, // nieużywane tutaj
                               wounds: _wounds, // nieużywane tutaj
                               special, // bazowe
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

    // ===== Łączne bonusy z ulepszeń =====
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
            body: JSON.stringify({ statKey: upStat, delta: upDelta }),
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

    /* ===== SPECIAL tabela ===== */
    function getBaseByLabel(label: 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L' | '♥'): number {
        switch (label) {
            case 'S':
                return special.S;
            case 'P':
                return special.P;
            case 'E':
                return special.E;
            case 'C':
                return special.C;
            case 'I':
                return special.I;
            case 'A':
                return special.A;
            case 'L':
                return special.L;
            case '♥':
                return special.HP;
        }
    }
    function getFinalByLabel(label: 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L' | '♥'): number {
        switch (label) {
            case 'S':
                return finalStats.S;
            case 'P':
                return finalStats.P;
            case 'E':
                return finalStats.E;
            case 'C':
                return finalStats.C;
            case 'I':
                return finalStats.I;
            case 'A':
                return finalStats.A;
            case 'L':
                return finalStats.L;
            case '♥':
                return finalStats.HP;
        }
    }

    function renderSpecialTable() {
        const labels: Array<'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L' | '♥'> = ['S', 'P', 'E', 'C', 'I', 'A', 'L', '♥'];
        return (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
                <div className="grid grid-cols-8">
                    {labels.map((label) => {
                        const base = getBaseByLabel(label);
                        const val = getFinalByLabel(label);
                        const boosted = val !== base;
                        return (
                            <div key={label} className="grid">
                                <div className="bg-teal-700/70 px-2 py-1 text-center text-[11px] font-semibold tracking-widest text-teal-50">
                                    {label}
                                </div>
                                <div className={'px-2 py-1 text-center text-sm ' + (boosted ? 'font-semibold text-emerald-300' : 'text-zinc-200')}>
                                    {val}
                                    {boosted ? ` (+${val - base})` : ''}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ===== Broń ===== */
    function WeaponCard({ w }: { w: WeaponUI }) {
        const [selected, setSelected] = useState<string[]>(w.selectedProfileIds);

        async function toggle(id: string, checked: boolean) {
            const next = checked ? [...new Set([...selected, id])] : selected.filter((x) => x !== id);
            setSelected(next);
            const ok = await setProfiles(w.id, next);
            if (!ok) setSelected(selected);
            else location.reload();
        }

        // Zsumowane efekty (bazowe + z wybranych profili)
        const allEffects = new Map<string, { name: string; kind: EffectKind; valueInt: number | null }>();
        for (const e of w.baseEffects) {
            const key = `${e.kind}:${e.name}:${e.valueInt ?? ''}`;
            allEffects.set(key, { name: e.name, kind: e.kind, valueInt: e.valueInt ?? null });
        }
        for (const p of w.profiles) {
            if (!selected.includes(p.id)) continue;
            for (const e of p.effects) {
                const key = `${e.kind}:${e.name}:${e.valueInt ?? ''}`;
                allEffects.set(key, { name: e.name, kind: e.kind, valueInt: e.valueInt ?? null });
            }
        }
        const traits = [...allEffects.values()]
            .filter((e) => e.kind === 'WEAPON')
            .map((e) => `${e.name}${e.valueInt != null ? ` (${e.valueInt})` : ''}`);
        const crits = [...allEffects.values()].filter((e) => e.kind === 'CRITICAL').map((e) => e.name);

        // Wyświetlane Type/Test/Parts — bierzemy ostatni zaznaczony (fallback do pierwszego)
        const last =
            selected.length ? w.profiles.find((p) => p.id === selected[selected.length - 1]) ?? w.profiles[0] : w.profiles[0];

        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                {/* Multi-select profili */}
                <div className="mb-2 flex flex-wrap gap-2">
                    {w.profiles.map((p) => {
                        const checked = selected.includes(p.id);
                        return (
                            <label
                                key={p.id}
                                className={
                                    'flex items-center gap-2 rounded-lg border px-2 py-1 text-xs ' +
                                    (checked ? 'border-emerald-400 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-950')
                                }
                            >
                                <input type="checkbox" checked={checked} onChange={(e) => void toggle(p.id, e.target.checked)} />
                                <span>
                  {p.type || 'override'} {p.parts != null ? `(${p.parts} parts)` : ''} {p.rating != null ? `• Δ${p.rating}` : ''}
                </span>
                            </label>
                        );
                    })}
                </div>

                {/* Tabela broni */}
                <div className="overflow-x-auto">
                    <table className="min-w-[560px] w-full text-sm">
                        <thead>
                        <tr className="bg-teal-700/70 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
                            <th className="px-2 py-1 text-left">Weapon</th>
                            <th className="px-2 py-1 text-left">Type</th>
                            <th className="px-2 py-1 text-left">Test</th>
                            <th className="px-2 py-1 text-left">Traits</th>
                            <th className="px-2 py-1 text-left">Critical Effect</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr className="border-t border-zinc-800 align-top">
                            <td className="px-2 py-1">{w.name}</td>
                            <td className="px-2 py-1">{last?.type ?? '—'}</td>
                            <td className="px-2 py-1">{last?.test ?? '—'}</td>
                            <td className="px-2 py-1 text-zinc-300">
                                {traits.length ? (
                                    <ul className="space-y-0.5 list-disc pl-4">
                                        {traits.map((t, i) => (
                                            <li key={i}>{t}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    '—'
                                )}
                            </td>
                            <td className="px-2 py-1 text-zinc-300">
                                {crits.length ? (
                                    <ul className="space-y-0.5 list-disc pl-4">
                                        {crits.map((c, i) => (
                                            <li key={i}>{c}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    '—'
                                )}
                            </td>
                        </tr>
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
                <div className="mt-3">{renderSpecialTable()}</div>
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

            {/* Ulepszenia */}
            <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="text-sm font-medium">Ulepszenia</div>

                <div className="mt-2 flex items-center gap-2">
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
                        className="w-20 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-right"
                    />
                    <button onClick={() => void addUpgrade()} className="rounded-xl bg-emerald-500 px-3 py-1 text-emerald-950">
                        Dodaj
                    </button>
                </div>

                <div className="mt-3 grid gap-1 text-xs text-zinc-300">
                    {upgrades.map((u) => (
                        <div key={u.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1">
                            <div>
                                <span className="font-medium">{u.statKey.toUpperCase()}</span> {u.delta > 0 ? `+${u.delta}` : u.delta}
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
                    {upgrades.length === 0 && <div className="text-zinc-500">Brak ulepszeń</div>}
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
