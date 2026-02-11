'use client';

import { useState } from 'react';
import type { FactionDTO, PerkDTO, WeaponDTO, UnitTemplateDTO } from '@/app/admin/templates/page';

/** Opcja: 1–2 bronie + koszt + (opcjonalny) rating */
type FormOption = { weapon1Id: string; weapon2Id: string | null; costCaps: number; rating: number | null };
type FormStartPerk = { perkId: string; valueInt: number | null };

type FormState = {
    id?: string;
    name: string;
    isGlobal: boolean;
    factionIds: string[];
    roleTag: string | null;

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

    function blankForm(): FormState {
        return {
            name: '',
            isGlobal: false,
            factionIds: [],
            roleTag: null,
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
        if (!res.ok) { alert('Nie udało się pobrać jednostek'); return; }
        const data: UnitTemplateDTO[] = await res.json();
        setList(data);
    }

    function validateOptions(): string | null {
        if (form.options.length === 0) return 'Dodaj przynajmniej jeden pakiet uzbrojenia.';
        for (const [idx, o] of form.options.entries()) {
            if (!o.weapon1Id) return `Pakiet #${idx+1}: wybierz przynajmniej jedną broń.`;
            if (o.weapon2Id && o.weapon2Id === o.weapon1Id) return `Pakiet #${idx+1}: druga broń nie może być tą samą.`;
            if (!Number.isFinite(o.costCaps) || o.costCaps < 0) return `Pakiet #${idx+1}: koszt musi być nieujemny.`;
        }
        return null;
    }

    async function save(): Promise<void> {
        if (!form.name.trim()) { alert('Podaj nazwę jednostki'); return; }
        const optErr = validateOptions();
        if (optErr) { alert(optErr); return; }
        if (!form.isGlobal && form.factionIds.length === 0) {
            alert('Wybierz przynajmniej jedną frakcję albo ustaw GLOBAL.');
            return;
        }

        setSaving(true);
        try {
            const url = form.id ? `/api/admin/unit-templates/${form.id}` : `/api/admin/unit-templates`;
            const method: 'POST' | 'PATCH' = form.id ? 'PATCH' : 'POST';
            const payload = {
                ...form,
                // upewniamy się, że null trafia jako null (a nie pusty string)
                options: form.options.map(o => ({
                    weapon1Id: o.weapon1Id,
                    weapon2Id: o.weapon2Id || null,
                    costCaps: o.costCaps,
                    rating: o.rating ?? null,
                })),
            };
            const res = await fetch(url, {
                method,
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const pld = await res.json().catch(async()=>({status:res.status, text:await res.text()}));
                alert('Błąd zapisu: ' + JSON.stringify(pld));
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
                    // jeśli druga broń równa nowej pierwszej – wyczyść drugą
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

    const weaponName = (id?: string | null) => weapons.find(w=>w.id===id)?.name ?? '—';

    function toggleFaction(id: string) {
        setForm((f) => {
            const has = f.factionIds.includes(id);
            return { ...f, factionIds: has ? f.factionIds.filter((x) => x !== id) : [...f.factionIds, id] };
        });
    }

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100 p-3 max-w-screen-sm mx-auto">
            <h1 className="text-lg font-semibold">Jednostki</h1>

            {/* LISTA */}
            <div className="mt-3 grid gap-2">
                {list.map(u=>(
                    <div key={u.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                        <button
                            className="w-full text-left"
                            onClick={()=> setForm({
                                id: u.id,
                                name: u.name,
                                isGlobal: u.isGlobal,
                                factionIds: u.factionIds,
                                roleTag: u.roleTag,
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
                                        {u.isGlobal ? 'GLOBAL' : (u.factionIds.length ? `Frakcje: ${u.factionIds.length}` : 'Brak frakcji')} • HP {u.hp} • S{u.s} P{u.p} E{u.e} C{u.c} I{u.i} A{u.a} L{u.l}
                                    </div>
                                </div>
                                <div className="text-xs text-zinc-400">{u.options.length} pakiet(y)</div>
                            </div>
                            {u.options.length > 0 && (
                                <div className="mt-2 text-xs text-zinc-400">
                                    {u.options.map((o,idx)=>(
                                        <div key={idx}>#{idx+1}: {weaponName(o.weapon1Id)}{o.weapon2Id ? ` + ${weaponName(o.weapon2Id)}` : ''} • {o.costCaps} caps{typeof o.rating==='number' ? ` • rating ${o.rating}` : ''}</div>
                                    ))}
                                </div>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {/* FORMULARZ */}
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{form.id ? 'Edytuj jednostkę' : 'Nowa jednostka'}</div>
                    {form.id && <button onClick={()=>setForm(blankForm())} className="text-xs text-zinc-300">Nowa</button>}
                </div>

                <label className="block mt-2 text-xs text-zinc-400">Nazwa</label>
                <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}
                       className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"/>

                <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.isGlobal}
                            onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })}
                        />
                        <span className="font-medium">GLOBAL (dostępna dla wszystkich frakcji)</span>
                    </label>

                    {!form.isGlobal && (
                        <div className="mt-2">
                            <div className="text-xs text-zinc-400">Przypisz do frakcji (wiele)</div>
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

                <label className="block mt-2 text-xs text-zinc-400">Tag roli (opcjonalnie)</label>
                <input value={form.roleTag ?? ''} onChange={e=>setForm({...form, roleTag: e.target.value || null})}
                       placeholder="np. CHAMPION / LEADER / GRUNT"
                       className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"/>

                {/* SPECIAL + HP */}
                <div className="mt-3 grid grid-cols-4 gap-2">
                    <div>
                        <label className="block text-[10px] text-zinc-400">HP</label>
                        <input inputMode="numeric" value={form.hp} onChange={e=>setForm({...form, hp:n(e.target.value,3)})}
                               className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"/>
                    </div>
                    {primaryKeys.map(k=>(
                        <div key={k}>
                            <label className="block text-[10px] text-zinc-400">{k.toUpperCase()}</label>
                            <input inputMode="numeric" value={form[k]} onChange={e=>updateStat(k, n(e.target.value,5))}
                                   className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"/>
                        </div>
                    ))}
                    {secondaryKeys.map(k=>(
                        <div key={k}>
                            <label className="block text-[10px] text-zinc-400">{k.toUpperCase()}</label>
                            <input inputMode="numeric" value={form[k]} onChange={e=>updateStat(k, n(e.target.value,5))}
                                   className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"/>
                        </div>
                    ))}
                </div>

                <label className="block mt-3 text-xs text-zinc-400">Bazowy rating (opcjonalnie)</label>
                <input inputMode="numeric" value={form.baseRating ?? ''} onChange={e=>setForm({...form, baseRating:nOrNull(e.target.value)})}
                       placeholder="np. 6" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"/>

                {/* OPCJE UZBROJENIA */}
                <div className="mt-4">
                    <div className="text-xs text-zinc-400 mb-1">Pakiety uzbrojenia (max 2 bronie)</div>

                    {form.options.map((o, i)=>(
                        <div key={i} className="mb-3 rounded-xl border border-zinc-800 p-2">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-400">Pakiet #{i+1}</div>
                                <button onClick={()=>removeOption(i)} className="text-xs text-red-300">Usuń</button>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <select
                                    value={o.weapon1Id}
                                    onChange={e=>setOptionWeapon(i, 1, e.target.value)}
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                >
                                    <option value="">— wybierz broń #1 —</option>
                                    {weapons.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>

                                <select
                                    value={o.weapon2Id ?? ''}
                                    onChange={e=>setOptionWeapon(i, 2, e.target.value)}
                                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                                >
                                    <option value="">(opcjonalnie) broń #2</option>
                                    {weapons
                                        .filter(w => w.id !== o.weapon1Id) // nie pozwól wybrać tej samej
                                        .map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <input inputMode="numeric" placeholder="Koszt (caps)" value={o.costCaps}
                                       onChange={e=>setOptionCost(i, n(e.target.value, 0))}
                                       className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"/>
                                <input inputMode="numeric" placeholder="Rating (opc.)" value={o.rating ?? ''}
                                       onChange={e=>setOptionRating(i, nOrNull(e.target.value))}
                                       className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"/>
                            </div>
                        </div>
                    ))}

                    <div className="flex gap-2">
                        <button onClick={addOption}
                                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
                            Dodaj pakiet
                        </button>
                    </div>
                </div>

                {/* Startowe perki (opcjonalnie) */}
                <div className="mt-4">
                    <div className="text-xs text-zinc-400 mb-1">Startowe perki (opcjonalnie)</div>
                    {form.startPerks.map((sp,i)=>{
                        const perk = perks.find(p=>p.id===sp.perkId);
                        return (
                            <div key={i} className="mb-2 grid grid-cols-5 gap-2 items-center">
                                <select value={sp.perkId} onChange={e=>setForm(f=>({...f, startPerks: f.startPerks.map((x,idx)=> idx===i ? {...x, perkId:e.target.value} : x)}))}
                                        className="col-span-3 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm">
                                    <option value="">— wybierz —</option>
                                    {perks.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                {perk?.requiresValue ? (
                                    <input inputMode="numeric" placeholder="X" value={sp.valueInt ?? ''} onChange={e=>setForm(f=>({...f, startPerks: f.startPerks.map((x,idx)=> idx===i ? {...x, valueInt:nOrNull(e.target.value)} : x)}))}
                                           className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"/>
                                ) : <div className="text-xs text-zinc-500">—</div>}
                                <button className="text-xs text-red-300"
                                        onClick={()=> setForm(f=>({...f, startPerks: f.startPerks.filter((_,idx)=> idx!==i)}))}>
                                    Usuń
                                </button>
                            </div>
                        );
                    })}
                    <button onClick={()=> setForm(f=>({...f, startPerks: [...f.startPerks, { perkId:'', valueInt:null }] }))}
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
                        Dodaj startowy perk
                    </button>
                </div>

                <div className="mt-4 flex gap-2">
                    <button onClick={()=>setForm(blankForm())}
                            className="flex-1 h-10 rounded-xl border border-zinc-700">
                        Wyczyść
                    </button>
                    <button
                        disabled={saving}
                        onClick={() => void save()}
                        className="flex-1 h-10 rounded-xl bg-emerald-500 text-emerald-950 font-semibold disabled:opacity-50"
                    >
                        {saving ? 'Zapisywanie…' : 'Zapisz'}
                    </button>
                </div>
            </div>
        </div>
    );
}
