'use client';

import { useEffect, useState } from 'react';

/* ===== Typy słownika efektów ===== */
export type EffectKind = 'WEAPON' | 'CRITICAL';

export interface DictEffect {
    id: string;
    name: string;
    kind: EffectKind;
    description: string;
    requiresValue: boolean;
}

/* ===== Typy formularza (wejście/wyjście API admina) ===== */
type EffectRef = { effectId: string; valueInt?: number | null };

type ProfileForm = {
    order: number;
    typeOverride?: string | null;
    testOverride?: string | null;
    partsOverride?: number | null;
    ratingDelta?: number | null;
    effects: EffectRef[];
};

type WeaponForm = {
    id?: string;
    name: string;
    imagePath?: string | null;
    notes?: string | null;
    baseType: string;
    baseTest: string;
    baseParts?: number | null;
    baseRating?: number | null;
    baseEffects: EffectRef[];
    profiles: ProfileForm[];
};

/* ===== Typ odpowiedzi GET /api/admin/weapons (lista) ===== */
type WeaponListItem = {
    id: string;
    name: string;
    imagePath: string | null;
    notes: string | null;
    baseType: string;
    baseTest: string;
    baseParts: number | null;
    baseRating: number | null;
    baseEffects: { effectId: string; valueInt: number | null; effect: DictEffect }[];
    profiles: {
        id: string;
        order: number;
        typeOverride: string | null;
        testOverride: string | null;
        partsOverride: number | null;
        ratingDelta: number | null;
        effects: { effectId: string; valueInt: number | null; effect: DictEffect }[];
    }[];
};

export function AdminWeaponsClient({ initial }: { initial?: WeaponListItem[] }) {
    const [effects, setEffects] = useState<DictEffect[]>([]);
    const [list, setList] = useState<WeaponListItem[]>(initial ?? []);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<WeaponForm>({
        name: '',
        imagePath: null,
        notes: null,
        baseType: '',
        baseTest: '',
        baseParts: null,
        baseRating: null,
        baseEffects: [],
        profiles: [],
    });

    useEffect(() => {
        void (async () => {
            const e = (await fetch('/api/admin/effects', { cache: 'no-store' }).then((r) => r.json())) as DictEffect[];
            setEffects(e);
            if (!initial) {
                const w = (await fetch('/api/admin/weapons', { cache: 'no-store' }).then((r) => r.json())) as WeaponListItem[];
                setList(w);
            }
        })();
    }, [initial]);

    const numOrNull = (s: string): number | null => {
        const t = s.trim();
        if (!t) return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
    };

    async function reload(): Promise<void> {
        const w = (await fetch('/api/admin/weapons', { cache: 'no-store' }).then((r) => r.json())) as WeaponListItem[];
        setList(w);
    }

    /* ----- Bazowe efekty (formularz) ----- */
    function addBaseEffect(): void {
        setForm((f) => ({ ...f, baseEffects: [...f.baseEffects, { effectId: '' }] }));
    }
    function patchBaseEffect(i: number, patch: Partial<EffectRef>): void {
        setForm((f) => {
            const next = [...f.baseEffects];
            next[i] = { ...next[i], ...patch };
            return { ...f, baseEffects: next };
        });
    }
    function removeBaseEffect(i: number): void {
        setForm((f) => ({ ...f, baseEffects: f.baseEffects.filter((_, idx) => idx !== i) }));
    }

    /* ----- Profile (formularz) ----- */
    function addProfile(): void {
        setForm((f) => ({
            ...f,
            profiles: [
                ...f.profiles,
                { order: f.profiles.length, typeOverride: null, testOverride: null, partsOverride: null, ratingDelta: null, effects: [] },
            ],
        }));
    }
    function removeProfile(i: number): void {
        setForm((f) => ({ ...f, profiles: f.profiles.filter((_, idx) => idx !== i) }));
    }
    function patchProfile(i: number, patch: Partial<ProfileForm>): void {
        setForm((f) => {
            const list = [...f.profiles];
            list[i] = { ...list[i], ...patch };
            return { ...f, profiles: list };
        });
    }
    function addProfileEffect(i: number): void {
        setForm((f) => {
            const list = [...f.profiles];
            list[i] = { ...list[i], effects: [...list[i].effects, { effectId: '' }] };
            return { ...f, profiles: list };
        });
    }
    function patchProfileEffect(i: number, j: number, patch: Partial<EffectRef>): void {
        setForm((f) => {
            const list = [...f.profiles];
            const effs = [...list[i].effects];
            effs[j] = { ...effs[j], ...patch };
            list[i] = { ...list[i], effects: effs };
            return { ...f, profiles: list };
        });
    }
    function removeProfileEffect(i: number, j: number): void {
        setForm((f) => {
            const list = [...f.profiles];
            list[i] = { ...list[i], effects: list[i].effects.filter((_, idx) => idx !== j) };
            return { ...f, profiles: list };
        });
    }

    /* ----- CRUD ----- */
    async function save(): Promise<void> {
        if (!form.name.trim()) return alert('Podaj nazwę');

        setSaving(true);
        try {
            const url = form.id ? `/api/admin/weapons/${form.id}` : `/api/admin/weapons`;
            const method: 'POST' | 'PATCH' = form.id ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const txt = await res.text();
                alert('Błąd: ' + txt);
                return;
            }
            await reload();
            setForm({
                name: '',
                imagePath: null,
                notes: null,
                baseType: '',
                baseTest: '',
                baseParts: null,
                baseRating: null,
                baseEffects: [],
                profiles: [],
            });
        } finally {
            setSaving(false);
        }
    }

    async function del(id: string): Promise<void> {
        if (!confirm('Usunąć?')) return;
        const r = await fetch(`/api/admin/weapons/${id}`, { method: 'DELETE' });
        if (!r.ok) {
            alert('Nie udało się usunąć');
            return;
        }
        await reload();
    }

    return (
        <div className="space-y-4">
            {/* Lista */}
            <div className="grid gap-2">
                {list.map((w) => (
                    <div key={w.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                        <div className="flex items-start justify-between">
                            <button
                                onClick={() =>
                                    setForm({
                                        id: w.id,
                                        name: w.name,
                                        imagePath: w.imagePath ?? null,
                                        notes: w.notes ?? null,
                                        baseType: w.baseType ?? '',
                                        baseTest: w.baseTest ?? '',
                                        baseParts: w.baseParts ?? null,
                                        baseRating: w.baseRating ?? null,
                                        baseEffects: w.baseEffects.map((be) => ({ effectId: be.effectId, valueInt: be.valueInt })),
                                        profiles: w.profiles
                                            .slice()
                                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                            .map((p) => ({
                                                order: p.order ?? 0,
                                                typeOverride: p.typeOverride ?? null,
                                                testOverride: p.testOverride ?? null,
                                                partsOverride: p.partsOverride ?? null,
                                                ratingDelta: p.ratingDelta ?? null,
                                                effects: p.effects.map((e) => ({ effectId: e.effectId, valueInt: e.valueInt })),
                                            })),
                                    })
                                }
                                className="text-left font-medium"
                            >
                                {w.name}
                            </button>
                            <button onClick={() => void del(w.id)} className="text-xs text-red-300">
                                Usuń
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Formularz */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{form.id ? 'Edytuj' : 'Nowa broń'}</div>
                    {form.id && (
                        <button
                            onClick={() =>
                                setForm({
                                    name: '',
                                    imagePath: null,
                                    notes: null,
                                    baseType: '',
                                    baseTest: '',
                                    baseParts: null,
                                    baseRating: null,
                                    baseEffects: [],
                                    profiles: [],
                                })
                            }
                            className="text-xs text-zinc-300"
                        >
                            Nowa
                        </button>
                    )}
                </div>

                <label className="mt-2 block text-xs text-zinc-400">Nazwa</label>
                <input
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                {/* Baza */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <input
                        placeholder="Base Type"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                        value={form.baseType}
                        onChange={(e) => setForm({ ...form, baseType: e.target.value })}
                    />
                    <input
                        placeholder="Base Test"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                        value={form.baseTest}
                        onChange={(e) => setForm({ ...form, baseTest: e.target.value })}
                    />
                    <input
                        placeholder="Base Parts"
                        inputMode="numeric"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                        value={form.baseParts ?? ''}
                        onChange={(e) => setForm({ ...form, baseParts: numOrNull(e.target.value) })}
                    />
                    <input
                        placeholder="Base Rating"
                        inputMode="numeric"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                        value={form.baseRating ?? ''}
                        onChange={(e) => setForm({ ...form, baseRating: numOrNull(e.target.value) })}
                    />
                </div>

                {/* Bazowe efekty */}
                <div className="mt-3">
                    <div className="mb-1 text-xs text-zinc-400">Bazowe efekty</div>
                    {form.baseEffects.map((be, i) => {
                        const ef = effects.find((e) => e.id === be.effectId);
                        return (
                            <div key={i} className="mb-1 grid grid-cols-5 items-center gap-2">
                                <select
                                    className="col-span-3 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    value={be.effectId}
                                    onChange={(e) => patchBaseEffect(i, { effectId: e.target.value })}
                                >
                                    <option value="">— wybierz —</option>
                                    {effects.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.name} {e.kind === 'CRITICAL' ? '(crit)' : ''}
                                        </option>
                                    ))}
                                </select>
                                {ef?.requiresValue ? (
                                    <input
                                        inputMode="numeric"
                                        placeholder="X"
                                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                        value={be.valueInt ?? ''}
                                        onChange={(e) => patchBaseEffect(i, { valueInt: numOrNull(e.target.value) })}
                                    />
                                ) : (
                                    <div className="text-xs text-zinc-500">—</div>
                                )}
                                <button className="text-xs text-red-300" onClick={() => removeBaseEffect(i)}>
                                    Usuń
                                </button>
                            </div>
                        );
                    })}
                    <button className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm" onClick={addBaseEffect}>
                        Dodaj efekt
                    </button>
                </div>

                {/* Profile */}
                <div className="mt-4">
                    <div className="mb-1 text-xs text-zinc-400">Profile (upgrade’y)</div>
                    {form.profiles.map((p, i) => (
                        <div key={i} className="mb-3 rounded-xl border border-zinc-800 p-2">
                            <div className="grid grid-cols-5 gap-2">
                                <input
                                    inputMode="numeric"
                                    placeholder="Order"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    value={p.order}
                                    onChange={(e) => patchProfile(i, { order: Number(e.target.value) || 0 })}
                                />
                                <input
                                    placeholder="Type override"
                                    className="col-span-2 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    value={p.typeOverride ?? ''}
                                    onChange={(e) => patchProfile(i, { typeOverride: e.target.value || null })}
                                />
                                <input
                                    placeholder="Test override"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    value={p.testOverride ?? ''}
                                    onChange={(e) => patchProfile(i, { testOverride: e.target.value || null })}
                                />
                                <input
                                    placeholder="Parts override"
                                    inputMode="numeric"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    value={p.partsOverride ?? ''}
                                    onChange={(e) => patchProfile(i, { partsOverride: numOrNull(e.target.value) })}
                                />
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <input
                                    placeholder="Rating Δ (delta)"
                                    inputMode="numeric"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                    value={p.ratingDelta ?? ''}
                                    onChange={(e) => patchProfile(i, { ratingDelta: numOrNull(e.target.value) })}
                                />
                            </div>

                            <div className="mt-2">
                                <div className="mb-1 text-xs text-zinc-400">Efekty profilu</div>
                                {p.effects.map((ef, j) => {
                                    const def = effects.find((e) => e.id === ef.effectId);
                                    return (
                                        <div key={j} className="mb-1 grid grid-cols-5 items-center gap-2">
                                            <select
                                                className="col-span-3 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                                value={ef.effectId}
                                                onChange={(e) => patchProfileEffect(i, j, { effectId: e.target.value })}
                                            >
                                                <option value="">— wybierz —</option>
                                                {effects.map((e) => (
                                                    <option key={e.id} value={e.id}>
                                                        {e.name} {e.kind === 'CRITICAL' ? '(crit)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {def?.requiresValue ? (
                                                <input
                                                    inputMode="numeric"
                                                    placeholder="X"
                                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                                    value={ef.valueInt ?? ''}
                                                    onChange={(e) => patchProfileEffect(i, j, { valueInt: numOrNull(e.target.value) })}
                                                />
                                            ) : (
                                                <div className="text-xs text-zinc-500">—</div>
                                            )}
                                            <button className="text-xs text-red-300" onClick={() => removeProfileEffect(i, j)}>
                                                Usuń
                                            </button>
                                        </div>
                                    );
                                })}
                                <button className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm" onClick={() => addProfileEffect(i)}>
                                    Dodaj efekt
                                </button>
                            </div>

                            <div className="mt-2">
                                <button className="text-xs text-red-300" onClick={() => removeProfile(i)}>
                                    Usuń profil
                                </button>
                            </div>
                        </div>
                    ))}
                    <button className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" onClick={addProfile}>
                        Dodaj profil
                    </button>
                </div>

                <div className="mt-3 flex gap-2">
                    <button
                        onClick={() => void save()}
                        disabled={saving}
                        className="h-10 flex-1 rounded-xl bg-emerald-500 font-semibold text-emerald-950 disabled:opacity-50"
                    >
                        {saving ? 'Zapisywanie…' : 'Zapisz'}
                    </button>
                </div>
            </div>
        </div>
    );
}
