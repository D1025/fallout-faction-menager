'use client';

import { useEffect, useState } from 'react';

/* ====== Typy ====== */
export type EffectKind = 'WEAPON' | 'CRITICAL';

export interface DictEffect {
    id: string;
    name: string;
    kind: EffectKind;
    description: string;
    requiresValue: boolean;
}

export interface ProfileEffectInput {
    effectId: string;
    valueInt?: number | null;
}

export interface WeaponProfile {
    type: string;
    test: string;
    parts?: number | null;
    rating?: number | null;
    weaponEffects: ProfileEffectInput[];   // kind = WEAPON
    criticalEffects: ProfileEffectInput[]; // kind = CRITICAL
}

export interface Weapon {
    id: string;
    name: string;
    imagePath?: string | null;
    notes?: string | null;
    profiles: WeaponProfile[];
}

interface WeaponForm {
    id?: string;
    name: string;
    imagePath?: string | null;
    notes?: string | null;
    profiles: WeaponProfile[];
}

/* ====== Komponent ====== */
export function AdminWeaponsClient({ initial }: { initial: Weapon[] }) {
    const [list, setList] = useState<Weapon[]>(initial);
    const [form, setForm] = useState<WeaponForm>({
        name: '',
        imagePath: null,
        notes: null,
        profiles: [],
    });
    const [effects, setEffects] = useState<DictEffect[]>([]);
    const [saving, setSaving] = useState(false);

    // do odświeżania podglądu po uploadzie (cache-buster)
    const [imgVersion, setImgVersion] = useState(0);

    /* ====== Helpers ====== */
    function numOrNull(s: string): number | null {
        const t = s.trim();
        if (!t) return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
    }

    function effectById(id?: string | null): DictEffect | undefined {
        if (!id) return undefined;
        return effects.find((e) => e.id === id);
    }

    function descWithX(desc: string, x?: number | null): string {
        if (x == null) return desc;
        const v = String(x);
        return desc.replaceAll('(X)', `(${v})`).replaceAll('X', v);
    }

    function setProfileAt(index: number, patch: Partial<WeaponProfile>): void {
        setForm((f) => ({
            ...f,
            profiles: f.profiles.map((p, i) => (i === index ? { ...p, ...patch } : p)),
        }));
    }

    function setProfileEffectAt(
        profIndex: number,
        kind: EffectKind,
        effIndex: number,
        patch: Partial<ProfileEffectInput>
    ): void {
        setForm((f) => {
            const nextProfiles = f.profiles.map((p, i) => {
                if (i !== profIndex) return p;
                const key = kind === 'WEAPON' ? 'weaponEffects' : 'criticalEffects';
                const list = [...p[key]];
                list[effIndex] = { ...list[effIndex], ...patch };
                return { ...p, [key]: list } as WeaponProfile;
            });
            return { ...f, profiles: nextProfiles };
        });
    }

    function addProfileEffect(profIndex: number, kind: EffectKind): void {
        setForm((f) => {
            const next = [...f.profiles];
            const key = kind === 'WEAPON' ? 'weaponEffects' : 'criticalEffects';
            const list = [...next[profIndex][key]];
            list.push({ effectId: '' });
            (next[profIndex] as WeaponProfile)[key] = list;
            return { ...f, profiles: next };
        });
    }

    function removeProfileEffect(profIndex: number, kind: EffectKind, effIndex: number): void {
        setForm((f) => {
            const next = [...f.profiles];
            const key = kind === 'WEAPON' ? 'weaponEffects' : 'criticalEffects';
            const list = next[profIndex][key].filter((_, i) => i !== effIndex);
            (next[profIndex] as WeaponProfile)[key] = list;
            return { ...f, profiles: next };
        });
    }

    function removeProfile(profIndex: number): void {
        setForm((f) => ({ ...f, profiles: f.profiles.filter((_, i) => i !== profIndex) }));
    }

    function resetForm(): void {
        setForm({ name: '', imagePath: null, notes: null, profiles: [] });
        setImgVersion((v) => v + 1);
    }

    /* ====== Data ====== */
    useEffect(() => {
        void (async () => {
            const res = await fetch('/api/admin/effects', { cache: 'no-store' });
            if (res.ok) {
                const data: DictEffect[] = await res.json();
                setEffects(data);
            }
        })();
    }, []);

    async function reloadList(): Promise<void> {
        const res = await fetch('/api/admin/weapons', { cache: 'no-store' });
        if (!res.ok) {
            alert('Nie udało się pobrać broni');
            return;
        }
        const data: Weapon[] = await res.json();
        setList(data);
    }

    async function uploadImage(file: File): Promise<void> {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
        if (!res.ok) {
            alert('Upload nieudany');
            return;
        }
        const payload: { path: string } = await res.json();
        setForm((f) => ({ ...f, imagePath: payload.path }));
        setImgVersion((v) => v + 1); // odśwież podgląd
    }

    async function save(): Promise<void> {
        if (!form.name.trim()) {
            alert('Podaj nazwę broni');
            return;
        }
        if (form.profiles.length === 0) {
            alert('Dodaj przynajmniej jeden profil');
            return;
        }

        setSaving(true);
        try {
            const url = form.id ? `/api/admin/weapons/${form.id}` : `/api/admin/weapons`;
            const method: 'POST' | 'PATCH' = form.id ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form satisfies WeaponForm),
            });

            if (!res.ok) {
                const payload = await res
                    .json()
                    .catch(async () => ({ status: res.status, text: await res.text() }));
                alert('Błąd zapisu: ' + JSON.stringify(payload));
                return;
            }

            await reloadList();
            resetForm();
        } finally {
            setSaving(false);
        }
    }

    async function del(id: string): Promise<void> {
        if (!confirm('Usunąć szablon broni?')) return;
        const res = await fetch(`/api/admin/weapons/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const payload = await res
                .json()
                .catch(async () => ({ status: res.status, text: await res.text() }));
            alert('Błąd usuwania: ' + JSON.stringify(payload));
            return;
        }
        if (form.id === id) resetForm();
        await reloadList();
    }

    /* ====== UI ====== */
    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100 p-3 max-w-screen-sm mx-auto">
            <h1 className="text-lg font-semibold">Broń (admin)</h1>

            {/* Lista */}
            <div className="mt-3 grid gap-2">
                {list.map((w) => (
                    <div key={w.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                        <button
                            className="w-full text-left"
                            onClick={() =>
                                setForm({
                                    id: w.id,
                                    name: w.name,
                                    imagePath: w.imagePath ?? null,
                                    notes: w.notes ?? null,
                                    profiles: w.profiles,
                                })
                            }
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="font-medium">{w.name}</div>
                                    {/* MINIATURA w liście */}
                                    {w.imagePath ? (
                                        <div className="mt-2">
                                            <img
                                                src={w.imagePath}
                                                alt={w.name}
                                                className="h-16 w-auto rounded-md border border-zinc-800 object-contain"
                                                loading="lazy"
                                            />
                                        </div>
                                    ) : null}
                                </div>
                                <div className="text-xs text-zinc-400">
                                    {w.profiles.length} profil(e)
                                </div>
                            </div>
                        </button>
                        <div className="mt-2">
                            <button className="text-xs text-red-300" onClick={() => void del(w.id)}>
                                Usuń
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Formularz */}
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                        {form.id ? 'Edytuj szablon broni' : 'Nowy szablon broni'}
                    </div>
                    {form.id ? (
                        <button onClick={resetForm} className="text-xs text-zinc-300">
                            Nowy
                        </button>
                    ) : null}
                </div>

                <label className="mt-2 block text-xs text-zinc-400">Nazwa</label>
                <input
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <label className="mt-3 block text-xs text-zinc-400">Zdjęcie</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadImage(f);
                    }}
                    className="mt-1 w-full text-sm"
                />

                {/* PODGLĄD obrazu w formularzu */}
                {form.imagePath && (
                    <div className="mt-2 flex items-center gap-3">
                        <img
                            src={`${form.imagePath}?v=${imgVersion}`}
                            alt="Podgląd"
                            className="h-24 w-auto rounded-md border border-zinc-800 object-contain"
                        />
                        <button
                            onClick={() => setForm((f) => ({ ...f, imagePath: null }))}
                            className="text-xs text-red-300"
                        >
                            Usuń obraz
                        </button>
                    </div>
                )}

                <label className="mt-3 block text-xs text-zinc-400">Notatki</label>
                <textarea
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    value={form.notes ?? ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                />

                {/* PROFILE */}
                <div className="mt-3">
                    <div className="text-xs text-zinc-400 mb-1">Profile</div>

                    {form.profiles.map((p, i) => (
                        <div key={i} className="mb-3 rounded-xl border border-zinc-800 p-2">
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    value={p.type}
                                    onChange={(e) => setProfileAt(i, { type: e.target.value })}
                                    placeholder="Typ (np. Pistol (12”))"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                />
                                <input
                                    value={p.test}
                                    onChange={(e) => setProfileAt(i, { test: e.target.value })}
                                    placeholder="Test (np. 4A)"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                />
                                <input
                                    inputMode="numeric"
                                    value={p.parts ?? ''}
                                    onChange={(e) => setProfileAt(i, { parts: numOrNull(e.target.value) })}
                                    placeholder="Parts"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                />
                                <input
                                    inputMode="numeric"
                                    value={p.rating ?? ''}
                                    onChange={(e) => setProfileAt(i, { rating: numOrNull(e.target.value) })}
                                    placeholder="Rating"
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                />
                            </div>

                            {/* Efekty broni */}
                            <div className="mt-2">
                                <div className="text-xs text-zinc-400 mb-1">Efekty</div>
                                {p.weaponEffects.map((we, j) => {
                                    const ef = effectById(we.effectId);
                                    const tooltip = ef ? descWithX(ef.description, we.valueInt ?? undefined) : '';
                                    return (
                                        <div key={`we-${j}`} className="mb-1 grid grid-cols-5 gap-2 items-center">
                                            <select
                                                value={we.effectId}
                                                onChange={(e) =>
                                                    setProfileEffectAt(i, 'WEAPON', j, { effectId: e.target.value })
                                                }
                                                className="col-span-3 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                                title={tooltip}
                                            >
                                                <option value="">-- wybierz --</option>
                                                {effects
                                                    .filter((e) => e.kind === 'WEAPON')
                                                    .map((e) => (
                                                        <option key={e.id} value={e.id}>
                                                            {e.name}
                                                        </option>
                                                    ))}
                                            </select>
                                            {ef?.requiresValue ? (
                                                <input
                                                    inputMode="numeric"
                                                    placeholder="X"
                                                    value={we.valueInt ?? ''}
                                                    onChange={(e) =>
                                                        setProfileEffectAt(i, 'WEAPON', j, {
                                                            valueInt: numOrNull(e.target.value),
                                                        })
                                                    }
                                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                                    title={tooltip}
                                                />
                                            ) : (
                                                <div className="text-xs text-zinc-500">—</div>
                                            )}
                                            <button
                                                className="text-xs text-red-300"
                                                onClick={() => removeProfileEffect(i, 'WEAPON', j)}
                                            >
                                                Usuń
                                            </button>
                                        </div>
                                    );
                                })}
                                <button
                                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm"
                                    onClick={() => addProfileEffect(i, 'WEAPON')}
                                >
                                    Dodaj efekt
                                </button>
                            </div>

                            {/* Efekty krytyczne */}
                            <div className="mt-3">
                                <div className="text-xs text-zinc-400 mb-1">Efekty krytyczne</div>
                                {p.criticalEffects.map((ce, j) => {
                                    const ef = effectById(ce.effectId);
                                    const tooltip = ef ? descWithX(ef.description, ce.valueInt ?? undefined) : '';
                                    return (
                                        <div key={`ce-${j}`} className="mb-1 grid grid-cols-5 gap-2 items-center">
                                            <select
                                                value={ce.effectId}
                                                onChange={(e) =>
                                                    setProfileEffectAt(i, 'CRITICAL', j, { effectId: e.target.value })
                                                }
                                                className="col-span-3 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                                title={tooltip}
                                            >
                                                <option value="">-- wybierz --</option>
                                                {effects
                                                    .filter((e) => e.kind === 'CRITICAL')
                                                    .map((e) => (
                                                        <option key={e.id} value={e.id}>
                                                            {e.name}
                                                        </option>
                                                    ))}
                                            </select>
                                            {ef?.requiresValue ? (
                                                <input
                                                    inputMode="numeric"
                                                    placeholder="X"
                                                    value={ce.valueInt ?? ''}
                                                    onChange={(e) =>
                                                        setProfileEffectAt(i, 'CRITICAL', j, {
                                                            valueInt: numOrNull(e.target.value),
                                                        })
                                                    }
                                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                                    title={tooltip}
                                                />
                                            ) : (
                                                <div className="text-xs text-zinc-500">—</div>
                                            )}
                                            <button
                                                className="text-xs text-red-300"
                                                onClick={() => removeProfileEffect(i, 'CRITICAL', j)}
                                            >
                                                Usuń
                                            </button>
                                        </div>
                                    );
                                })}
                                <button
                                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm"
                                    onClick={() => addProfileEffect(i, 'CRITICAL')}
                                >
                                    Dodaj krytyk
                                </button>
                            </div>

                            <div className="mt-2">
                                <button
                                    className="text-xs text-red-300"
                                    onClick={() => removeProfile(i)}
                                >
                                    Usuń profil
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={() =>
                            setForm((f) => ({
                                ...f,
                                profiles: [
                                    ...f.profiles,
                                    {
                                        type: '',
                                        test: '',
                                        parts: null,
                                        rating: null,
                                        weaponEffects: [],
                                        criticalEffects: [],
                                    },
                                ],
                            }))
                        }
                        className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    >
                        Dodaj profil
                    </button>
                </div>

                <div className="mt-3 flex gap-2">
                    <button
                        onClick={resetForm}
                        className="flex-1 h-10 rounded-xl border border-zinc-700"
                    >
                        Wyczyść
                    </button>
                    <button
                        onClick={() => void save()}
                        disabled={saving}
                        className="flex-1 h-10 rounded-xl bg-emerald-500 text-emerald-950 font-semibold disabled:opacity-50"
                    >
                        {saving ? 'Zapisywanie…' : 'Zapisz'}
                    </button>
                </div>
            </div>
        </div>
    );
}
