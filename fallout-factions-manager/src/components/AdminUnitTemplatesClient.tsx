'use client';

import { FilterOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { FilterBar, QuickToggle, SortSelect, type ActiveFilterChip } from '@/components/ui/filters';
import type { FactionDTO, PerkDTO, WeaponDTO, UnitTemplateDTO } from '@/app/admin/templates/page';
import { notifyApiError, notifyWarning } from '@/lib/ui/notify';

/** Option: 1-2 weapons + cost + optional rating */
type FormOption = { weapon1Id: string; weapon2Id: string | null; costCaps: number; rating: number | null };
type FormStartPerk = { perkId: string; valueInt: number | null };

type UnitTemplateTag = 'CHAMPION' | 'GRUNT' | 'COMPANION' | 'LEGENDS';

type FormState = {
    id?: string;
    name: string;
    isGlobal: boolean;
    factionIds: string[];
    roleTag: UnitTemplateTag | null;
    isLeader: boolean;

    hp: number;
    s: number; p: number; e: number; c: number; i: number; a: number; l: number;
    baseRating: number | null;

    options: FormOption[];
    startPerks: FormStartPerk[];
};

export function AdminUnitTemplatesClient({
                                             initial, factions, perks, weapons,
                                         }: {
    initial: UnitTemplateDTO[];
    factions: FactionDTO[];
    perks: PerkDTO[];
    weapons: WeaponDTO[];
}) {
    const [list, setList] = useState<UnitTemplateDTO[]>(initial);
    const [form, setForm] = useState<FormState>(blankForm());
    const [saving, setSaving] = useState(false);

    // starting perks picker
    const [perkQ, setPerkQ] = useState('');
    const [perkCategory, setPerkCategory] = useState<'ALL' | 'REGULAR' | 'AUTOMATRON'>('ALL');
    const [perkInnate, setPerkInnate] = useState<'ALL' | 'INNATE' | 'NON_INNATE'>('ALL');

    const perkById = useMemo(() => new Map(perks.map((p) => [p.id, p])), [perks]);

    const filteredPerks = useMemo(() => {
        const q = perkQ.trim().toLowerCase();
        return perks
            .filter((p) => {
                if (perkCategory !== 'ALL' && p.category !== perkCategory) return false;
                if (perkInnate === 'INNATE' && !p.isInnate) return false;
                if (perkInnate === 'NON_INNATE' && p.isInnate) return false;
                if (!q) return true;
                return p.name.toLowerCase().includes(q);
            })
            .slice(0, 60);
    }, [perks, perkQ, perkCategory, perkInnate]);

    const pickedSet = useMemo(() => new Set(form.startPerks.map((x) => x.perkId).filter(Boolean)), [form.startPerks]);

    function addStartPerk(perkId: string) {
        if (!perkId) return;
        if (pickedSet.has(perkId)) return;
        setForm((f) => ({ ...f, startPerks: [...f.startPerks, { perkId, valueInt: null }] }));
    }

    function blankForm(): FormState {
        return {
            name: '',
            isGlobal: false,
            factionIds: [],
            roleTag: null,
            isLeader: false,
            hp: 3,
            s: 5, p: 5, e: 5, c: 5, i: 5, a: 5, l: 5,
            baseRating: null,
            options: [],
            startPerks: [],
        };
    }
    function n(v: string, def = 0){ const x = Number(v); return Number.isFinite(x) ? x : def; }
    function nOrNull(v: string){ const t=v.trim(); if(!t) return null; const x=Number(t); return Number.isFinite(x)? x : null; }

    const primaryKeys = ['s','p','e','c'] as const;
    type PrimaryKey = typeof primaryKeys[number];
    const secondaryKeys = ['i','a','l'] as const;
    type SecondaryKey = typeof secondaryKeys[number];
    function updateStat<K extends PrimaryKey|SecondaryKey>(key:K, value:number){
        setForm(prev => ({...prev, [key]: value}));
    }

    async function reload(): Promise<void> {
        const res = await fetch('/api/admin/unit-templates', { cache: 'no-store' });
        if (!res.ok) { notifyApiError('Failed to fetch unit templates'); return; }
        const data: UnitTemplateDTO[] = await res.json();
        setList(data);
    }

    function validateOptions(): string | null {
        if (form.options.length === 0) return 'Add at least one loadout package.';
        for (const [idx, o] of form.options.entries()) {
            if (!o.weapon1Id) return `Package #${idx + 1}: select at least one weapon.`;
            if (o.weapon2Id && o.weapon2Id === o.weapon1Id) return `Package #${idx + 1}: second weapon cannot be the same as the first one.`;
            if (!Number.isFinite(o.costCaps) || o.costCaps < 0) return `Package #${idx + 1}: cost must be non-negative.`;
        }
        return null;
    }

    async function save(): Promise<void> {
        if (!form.name.trim()) { notifyWarning('Enter unit name'); return; }
        const optErr = validateOptions();
        if (optErr) { notifyWarning(optErr); return; }
        if (!form.isGlobal && form.factionIds.length === 0) {
            notifyWarning('Select at least one faction or enable GLOBAL.');
            return;
        }

        setSaving(true);
        try {
            const url = form.id ? `/api/admin/unit-templates/${form.id}` : `/api/admin/unit-templates`;
            const method: 'POST' | 'PATCH' = form.id ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Typee': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    isGlobal: form.isGlobal,
                    factionIds: form.factionIds,
                    roleTag: form.roleTag,
                    isLeader: form.isLeader,
                    hp: form.hp,
                    s: form.s, p: form.p, e: form.e, c: form.c, i: form.i, a: form.a, l: form.l,
                    baseRating: form.baseRating,
                    options: form.options,
                    startPerks: form.startPerks,
                }),
            });
            if (!res.ok) {
                const pld = await res.json().catch(async()=>({status:res.status, text:await res.text()}));
                notifyApiError(JSON.stringify(pld), 'Failed to save units');
                return;
            }
            await reload();
            setForm(blankForm());
        } finally {
            setSaving(false);
        }
    }

    function addOption(){
        setForm(f => ({...f, options: [...f.options, { weapon1Id: '', weapon2Id: null, costCaps: 0, rating: null }]}));
    }
    function removeOption(i:number){
        setForm(f=> ({...f, options: f.options.filter((_,idx)=> idx!==i)}));
    }
    function setOptionWeapon(i:number, which: 1 | 2, id: string){
        setForm(f=> ({
            ...f,
            options: f.options.map((o, idx) => {
                if (idx !== i) return o;
                if (which === 1) {
                    // if second weapon matches new first weapon, clear second weapon
                    const weapon2Id = o.weapon2Id === id ? null : o.weapon2Id;
                    return { ...o, weapon1Id: id, weapon2Id };
                }
                // which === 2
                return { ...o, weapon2Id: id || null };
            }),
        }));
    }
    function setOptionCost(i:number, cost: number){
        setForm(f=> ({...f, options: f.options.map((o,idx)=> idx===i ? ({...o, costCaps: cost}) : o)}));
    }
    function setOptionRating(i:number, rating: number|null){
        setForm(f=> ({...f, options: f.options.map((o,idx)=> idx===i ? ({...o, rating}) : o)}));
    }

    const weaponName = (id?: string | null) => weapons.find(w=>w.id===id)?.name ?? '-';

    function toggleFaction(id: string) {
        setForm((f) => {
            const has = f.factionIds.includes(id);
            return { ...f, factionIds: has ? f.factionIds.filter((x) => x !== id) : [...f.factionIds, id] };
        });
    }

    // list controls
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [q, setQ] = useState('');
    const [onlyGlobal, setOnlyGlobal] = useState(false);
    const [onlyLeader, setOnlyLeader] = useState(false);
    const [sort, setSort] = useState<'NAME:ASC' | 'NAME:DESC'>('NAME:ASC');

    const filteredSorted = useMemo(() => {
        const query = q.trim().toLowerCase();
        let arr = list;
        if (query) arr = arr.filter((u) => u.name.toLowerCase().includes(query));
        if (onlyGlobal) arr = arr.filter((u) => u.isGlobal);
        if (onlyLeader) arr = arr.filter((u) => Boolean((u as unknown as { isLeader?: boolean }).isLeader ?? false));
        const dir = sort === 'NAME:ASC' ? 1 : -1;
        return [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pl') * dir);
    }, [list, q, onlyGlobal, onlyLeader, sort]);

    const chips: ActiveFilterChip[] = [
        ...(q ? [{ key: 'q', label: `Search: ${q}`, onRemove: () => setQ('') }] : []),
        ...(onlyGlobal ? [{ key: 'global', label: 'Only GLOBAL', onRemove: () => setOnlyGlobal(false) }] : []),
        ...(onlyLeader ? [{ key: 'leader', label: 'Only LEADER', onRemove: () => setOnlyLeader(false) }] : []),
        ...(sort !== 'NAME:ASC' ? [{ key: 'sort', label: `Sort: ${sort}`, onRemove: () => setSort('NAME:ASC') }] : []),
    ];

    const clearAll = () => {
        setQ('');
        setOnlyGlobal(false);
        setOnlyLeader(false);
        setSort('NAME:ASC');
    };

    return (
        <div className="app-shell pt-3">
            <div className="vault-panel p-3">
                <p className="ff-panel-headline">Admin / Templates</p>
                <h1 className="ff-panel-title">Units and starting configurations</h1>
                <p className="mt-1 text-sm vault-muted">
                    Define unit roles, SPECIAL stats, loadout options and starting perks.
                </p>
            </div>

            {/* FORM */}
            <div className="mt-4 vault-panel p-3">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{form.id ? 'Edit unit' : 'New unit'}</div>
                    {form.id && <button onClick={()=>setForm(blankForm())} className="text-xs text-zinc-300">New</button>}
                </div>

                <label className="block mt-2 text-xs text-zinc-400">Name</label>
                <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}
                       className="w-full vault-input px-3 py-2 text-sm"/>

                <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.isGlobal}
                            onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })}
                        />
                        <span className="font-medium">GLOBAL (available to all factions)</span>
                    </label>

                    {!form.isGlobal && (
                        <div className="mt-2">
                            <div className="text-xs text-zinc-400">Assign to faction(s)</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {factions.map((f) => {
                                    const active = form.factionIds.includes(f.id);
                                    return (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => toggleFaction(f.id)}
                                            className={
                                                'h-9 rounded-xl border px-3 text-xs font-medium ' +
                                                (active
                                                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                                    : 'border-zinc-700 bg-zinc-900 text-zinc-300')
                                            }
                                        >
                                            {f.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <label className="block mt-2 text-xs text-zinc-400">Role tag (optional)</label>
                <select
                    value={form.roleTag ?? ''}
                    onChange={(e) => setForm({ ...form, roleTag: (e.target.value || null) as UnitTemplateTag | null })}
                    className="w-full vault-input px-3 py-2 text-sm"
                >
                    <option value="">(none)</option>
                    <option value="CHAMPION">CHAMPION</option>
                    <option value="GRUNT">GRUNT</option>
                    <option value="COMPANION">COMPANION</option>
                    <option value="LEGENDS">LEGENDS</option>
                </select>

                <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.isLeader} onChange={(e) => setForm({ ...form, isLeader: e.target.checked })} />
                        <span className="font-medium">LEADER (this template can be a leader)</span>
                    </label>
                </div>

                {/* SPECIAL + HP */}
                <div className="mt-3 grid grid-cols-4 gap-2">
                    <div>
                        <label className="block text-[10px] text-zinc-400">HP</label>
                        <input inputMode="numeric" value={form.hp} onChange={e=>setForm({...form, hp:n(e.target.value,3)})}
                               className="w-full vault-input px-2 py-1 text-sm"/>
                    </div>
                    {primaryKeys.map(k=>(
                        <div key={k}>
                            <label className="block text-[10px] text-zinc-400">{k.toUpperCase()}</label>
                            <input inputMode="numeric" value={form[k]} onChange={e=>updateStat(k, n(e.target.value,5))}
                                   className="w-full vault-input px-2 py-1 text-sm"/>
                        </div>
                    ))}
                    {secondaryKeys.map(k=>(
                        <div key={k}>
                            <label className="block text-[10px] text-zinc-400">{k.toUpperCase()}</label>
                            <input inputMode="numeric" value={form[k]} onChange={e=>updateStat(k, n(e.target.value,5))}
                                   className="w-full vault-input px-2 py-1 text-sm"/>
                        </div>
                    ))}
                </div>

                <label className="block mt-3 text-xs text-zinc-400">Base Rating (optional)</label>
                <input inputMode="numeric" value={form.baseRating ?? ''} onChange={e=>setForm({...form, baseRating:nOrNull(e.target.value)})}
                       placeholder="e.g. 6" className="w-full vault-input px-3 py-2 text-sm"/>

                {/* LOADOUT OPTIONS */}
                <div className="mt-4">
                    <div className="text-xs text-zinc-400 mb-1">Loadout packages (max 2 weapons)</div>

                    {form.options.map((o, i)=>(
                        <div key={i} className="mb-3 rounded-xl border border-zinc-800 p-2">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-400">Package #{i+1}</div>
                                <button onClick={()=>removeOption(i)} className="text-xs text-red-300">Delete</button>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <select
                                    value={o.weapon1Id}
                                    onChange={e=>setOptionWeapon(i, 1, e.target.value)}
                                    className="vault-input px-2 py-1 text-sm"
                                >
                                    <option value="">- select weapon #1 -</option>
                                    {weapons.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>

                                <select
                                    value={o.weapon2Id ?? ''}
                                    onChange={e=>setOptionWeapon(i, 2, e.target.value)}
                                    className="vault-input px-2 py-1 text-sm"
                                >
                                    <option value="">(optional) weapon #2</option>
                                    {weapons
                                        .filter(w => w.id !== o.weapon1Id) // do not allow selecting the same weapon
                                        .map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <input inputMode="numeric" placeholder="Cost (caps)" value={o.costCaps}
                                       onChange={e=>setOptionCost(i, n(e.target.value, 0))}
                                       className="vault-input px-2 py-1 text-sm"/>
                                <input inputMode="numeric" placeholder="Rating (opt.)" value={o.rating ?? ''}
                                       onChange={e=>setOptionRating(i, nOrNull(e.target.value))}
                                       className="vault-input px-2 py-1 text-sm"/>
                            </div>
                        </div>
                    ))}

                    <div className="flex gap-2">
                        <button onClick={addOption}
                                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
                            Add package
                        </button>
                    </div>
                </div>

                {/* Starting perks (optional) */}
                <div className="mt-4">
                    <div className="text-xs text-zinc-400 mb-2">Starting perks (optional)</div>

                    {/* Picker */}
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                        <div className="flex items-center gap-2 vault-panel px-3 py-2">
                            <SearchOutlined className="text-zinc-400" />
                            <input
                                value={perkQ}
                                onChange={(e) => setPerkQ(e.target.value)}
                                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                                placeholder="Search perk..."
                            />
                            {perkQ ? (
                                <button type="button" onClick={() => setPerkQ('')} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Clear">
                                    <CloseOutlined />
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] text-zinc-400">Category</label>
                                <select
                                    value={perkCategory}
                                    onChange={(e) => setPerkCategory(e.target.value as 'ALL' | 'REGULAR' | 'AUTOMATRON')}
                                    className="mt-1 w-full vault-input px-2 py-1 text-sm"
                                >
                                    <option value="ALL">All</option>
                                    <option value="REGULAR">Regular</option>
                                    <option value="AUTOMATRON">Automatron</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] text-zinc-400">Type</label>
                                <select
                                    value={perkInnate}
                                    onChange={(e) => setPerkInnate(e.target.value as 'ALL' | 'INNATE' | 'NON_INNATE')}
                                    className="mt-1 w-full vault-input px-2 py-1 text-sm"
                                >
                                    <option value="ALL">All</option>
                                    <option value="INNATE">INNATE only</option>
                                    <option value="NON_INNATE">Non-INNATE only</option>
                                </select>
                            </div>
                        </div>

                        <div className="vault-scrollbar mt-3 max-h-56 overflow-y-auto rounded-xl border border-zinc-800">
                            {filteredPerks.length === 0 ? (
                                <div className="p-3 text-sm text-zinc-500">No results.</div>
                            ) : (
                                <div className="divide-y divide-zinc-800">
                                    {filteredPerks.map((p) => {
                                        const picked = pickedSet.has(p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                disabled={picked}
                                                onClick={() => addStartPerk(p.id)}
                                                className={
                                                    'w-full text-left px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50 ' +
                                                    (picked ? 'cursor-not-allowed' : '')
                                                }
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-medium text-zinc-100">{p.name}</div>
                                                    <div className="flex items-center gap-2 text-[10px]">
                                                        {p.category === 'AUTOMATRON' ? (
                                                            <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 font-semibold text-purple-200">AUTOMATRON</span>
                                                        ) : (
                                                            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-semibold text-zinc-200">REGULAR</span>
                                                        )}
                                                        {p.isInnate ? (
                                                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-200">INNATE</span>
                                                        ) : null}
                                                        {p.requiresValue ? (
                                                            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-300">X</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-2 text-[11px] text-zinc-500">
                            Click a perk in the list to add it to starting perks. Duplicates are blocked.
                        </div>
                    </div>

                    {/* Selected perks */}
                    <div className="mt-3">
                        {form.startPerks.length === 0 ? (
                            <div className="text-sm text-zinc-500">No starting perks.</div>
                        ) : (
                            form.startPerks.map((sp, i) => {
                                const perk = perkById.get(sp.perkId);
                                return (
                                    <div key={`${sp.perkId}_${i}`} className="mb-2 rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-medium truncate">{perk?.name ?? '- select -'}</div>
                                                    {perk?.category === 'AUTOMATRON' ? (
                                                        <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-200">AUTOMATRON</span>
                                                    ) : (
                                                        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-zinc-200">REGULAR</span>
                                                    )}
                                                    {perk?.isInnate ? (
                                                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">INNATE</span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-1 text-[11px] text-zinc-500">ID: {sp.perkId || '-'}</div>
                                            </div>

                                            <button
                                                type="button"
                                                className="text-xs text-red-300"
                                                onClick={() => setForm((f) => ({ ...f, startPerks: f.startPerks.filter((_, idx) => idx !== i) }))}
                                            >
                                                Delete
                                            </button>
                                        </div>

                                        <div className="mt-2 grid grid-cols-5 gap-2 items-center">
                                            <select
                                                value={sp.perkId}
                                                onChange={(e) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        startPerks: f.startPerks.map((x, idx) => (idx === i ? { ...x, perkId: e.target.value } : x)),
                                                    }))
                                                }
                                                className="col-span-3 vault-input px-2 py-1 text-sm"
                                            >
                                                <option value="">- select -</option>
                                                {perks.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>

                                            {perk?.requiresValue ? (
                                                <input
                                                    inputMode="numeric"
                                                    placeholder="X"
                                                    value={sp.valueInt ?? ''}
                                                    onChange={(e) =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            startPerks: f.startPerks.map((x, idx) =>
                                                                idx === i ? { ...x, valueInt: nOrNull(e.target.value) } : x,
                                                            ),
                                                        }))
                                                    }
                                                    className="vault-input px-2 py-1 text-sm"
                                                />
                                            ) : (
                                                <div className="text-xs text-zinc-500">-</div>
                                            )}

                                            <div className="text-xs text-zinc-400">{perk?.requiresValue ? 'requires X' : ''}</div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <button onClick={()=>setForm(blankForm())}
                            className="flex-1 h-10 rounded-xl border border-zinc-700">
                        Clear
                    </button>
                    <button
                        disabled={saving}
                        onClick={() => void save()}
                        className="flex-1 h-10 rounded-xl bg-emerald-500 text-emerald-950 font-semibold disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* LIST */}
            <div className="mt-3 grid gap-2">
                <div className="flex items-start justify-between gap-2 rounded-xl border border-zinc-800 p-3">
                    <div>
                        <div className="text-sm font-medium">Unit list</div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                            Results: <span className="font-semibold text-zinc-200">{filteredSorted.length}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(true)}
                            className={
                                'grid h-9 w-9 place-items-center rounded-xl border ' +
                                (chips.length > 0
                                    ? 'border-amber-300/50 bg-amber-300/10 text-amber-100'
                                    : 'border-zinc-700 bg-zinc-900 text-zinc-200')
                            }
                            aria-label="Filters"
                            title="Filters"
                        >
                            <FilterOutlined />
                        </button>
                    </div>
                </div>

                <FilterBar
                    showTrigger={false}
                    open={filtersOpen}
                    onOpenChangeAction={setFiltersOpen}
                    search={q}
                    onSearchAction={setQ}
                    searchPlaceholder="Search units..."
                    quickToggles={
                        <div className="flex flex-wrap gap-2">
                            <QuickToggle checked={onlyGlobal} onChangeAction={setOnlyGlobal} label="Only GLOBAL" />
                            <QuickToggle checked={onlyLeader} onChangeAction={setOnlyLeader} label="Only LEADER" />
                        </div>
                    }
                    controls={
                        <SortSelect
                            value={sort}
                            onChange={(v) => setSort(v as typeof sort)}
                            options={[
                                { value: 'NAME:ASC', label: 'Sort: name A-Z' },
                                { value: 'NAME:DESC', label: 'Sort: name Z-A' },
                            ]}
                        />
                    }
                    activeChips={chips}
                    onClearAllAction={clearAll}
                />

                {filteredSorted.map(u => (
                    <div key={u.id} className="vault-panel p-3">
                        <button
                            className="w-full text-left"
                            onClick={()=> setForm({
                                id: u.id,
                                name: u.name,
                                isGlobal: u.isGlobal,
                                factionIds: u.factionIds,
                                roleTag: u.roleTag,
                                isLeader: Boolean((u as unknown as { isLeader?: boolean }).isLeader ?? false),
                                hp: u.hp, s:u.s,p:u.p,e:u.e,c:u.c,i:u.i,a:u.a,l:u.l,
                                baseRating: u.baseRating,
                                options: u.options.map(o=> ({
                                    weapon1Id: o.weapon1Id,
                                    weapon2Id: o.weapon2Id,
                                    costCaps: o.costCaps,
                                    rating: o.rating
                                })),
                                startPerks: u.startPerks,
                            })}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{u.name}</div>
                                    <div className="mt-1 text-xs text-zinc-400">
                                        {u.isGlobal ? 'GLOBAL' : (u.factionIds.length ? `Factions: ${u.factionIds.length}` : 'No faction')} | HP {u.hp} | S{u.s} P{u.p} E{u.e} C{u.c} I{u.i} A{u.a} L{u.l}
                                    </div>
                                </div>
                                <div className="text-xs text-zinc-400">{u.options.length} package(s)</div>
                            </div>
                            {u.options.length > 0 && (
                                <div className="mt-2 text-xs text-zinc-400">
                                    {u.options.map((o,idx)=>(
                                        <div key={idx}>#{idx+1}: {weaponName(o.weapon1Id)}{o.weapon2Id ? ` + ${weaponName(o.weapon2Id)}` : ''} | {o.costCaps} caps{typeof o.rating==='number' ? ` | Rating ${o.rating}` : ''}</div>
                                    ))}
                                </div>
                            )}
                        </button>
                        {(u as unknown as { isLeader?: boolean }).isLeader ? (
                            <div className="mt-2 text-[11px] text-sky-200">
                                <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 font-semibold">LEADER</span>
                            </div>
                        ) : null}
                     </div>
                 ))}
            </div>
        </div>
    );
}

