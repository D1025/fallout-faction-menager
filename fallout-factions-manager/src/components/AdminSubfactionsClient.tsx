'use client';

import { useMemo, useState } from 'react';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';
import type { SubfactionDTO, UnitTemplateDTO } from '@/app/admin/subfactions/page';
import { PlusOutlined } from '@ant-design/icons';

type FactionDTO = { id: string; name: string };

function errMsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

async function postSubfaction(payload: { factionId: string; name: string }): Promise<SubfactionDTO> {
    const res = await fetch('/api/admin/subfactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as SubfactionDTO;
}

async function patchSubfaction(id: string, payload: { name: string }): Promise<void> {
    const res = await fetch(`/api/admin/subfactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
}

async function deleteSubfaction(id: string): Promise<void> {
    const res = await fetch(`/api/admin/subfactions/${id}`, { method: 'DELETE' });
    if (res.status === 204) return;
    if (!res.ok) throw new Error(await res.text());
}

async function putSubfactionUnits(id: string, payload: { allowIds: string[]; denyIds: string[] }): Promise<void> {
    const res = await fetch(`/api/admin/subfactions/${id}/units`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
}

export function AdminSubfactionsClient({
    factions,
    initialSubfactions,
    unitTemplates,
}: {
    factions: FactionDTO[];
    initialSubfactions: SubfactionDTO[];
    unitTemplates: UnitTemplateDTO[];
}) {
    const [selectedFactionId, setSelectedFactionId] = useState<string>(factions[0]?.id ?? '');
    const [subfactions, setSubfactions] = useState<SubfactionDTO[]>(initialSubfactions);
    const [editorId, setEditorId] = useState<string | null>(null);

    const selectedFaction = useMemo(
        () => factions.find((f) => f.id === selectedFactionId) ?? null,
        [factions, selectedFactionId],
    );

    const listForFaction = useMemo(
        () => subfactions.filter((s) => s.factionId === selectedFactionId),
        [subfactions, selectedFactionId],
    );

    const editor = useMemo(
        () => (editorId ? subfactions.find((s) => s.id === editorId) ?? null : null),
        [subfactions, editorId],
    );

    const unitList = useMemo(() => {
        if (!selectedFactionId) return [];
        // Pokazujemy: globalne + przypisane do frakcji
        return unitTemplates.filter((u) => u.isGlobal || u.factionIds.includes(selectedFactionId));
    }, [unitTemplates, selectedFactionId]);

    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);

    async function create() {
        if (!selectedFactionId) return;
        const name = newName.trim();
        if (name.length < 2) {
            notifyWarning('Nazwa subfrakcji min. 2 znaki');
            return;
        }
        setBusy(true);
        try {
            const created = await postSubfaction({ factionId: selectedFactionId, name });
            setSubfactions((prev) => [created, ...prev]);
            setNewName('');
            setEditorId(created.id);
        } catch (e) {
            notifyApiError(errMsg(e), 'Błąd operacji na subfrakcji');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="app-shell pt-2">
            <div className="vault-panel p-3">
                <p className="ff-panel-headline">Admin / Subfrakcje</p>
                <p className="text-sm vault-muted">
                    Konfiguruj warianty frakcji i kontroluj liste dozwolonych lub blokowanych jednostek.
                </p>
            </div>

            <div className="vault-panel p-3">
                <div className="text-sm font-semibold">Wybierz frakcję</div>
                <select
                    value={selectedFactionId}
                    onChange={(e) => {
                        setSelectedFactionId(e.target.value);
                        setEditorId(null);
                    }}
                    className="mt-2 w-full vault-input px-3 py-2 text-sm"
                >
                    {factions.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.name}
                        </option>
                    ))}
                </select>

                <div className="mt-3 flex gap-2">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nowa subfrakcja"
                        className="flex-1 vault-input px-3 py-2 text-sm"
                    />
                    <button
                        disabled={busy || !selectedFactionId}
                        onClick={() => void create()}
                        className="ff-btn ff-btn-primary ff-btn-icon-mobile disabled:opacity-50"
                        aria-label="Dodaj subfrakcje"
                        title="Dodaj subfrakcje"
                    >
                        <PlusOutlined className="ff-btn-icon" />
                        <span className="ff-btn-label">Dodaj</span>
                    </button>
                </div>
            </div>

            <div className="mt-4 grid gap-3">
                {listForFaction.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setEditorId(s.id)}
                        className={
                            'rounded-2xl border p-3 text-left active:scale-[0.99] ' +
                            (editorId === s.id ? 'border-emerald-400 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900')
                        }
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium">{s.name}</div>
                                <div className="mt-1 text-xs text-zinc-400">
                                    Allow: {s.unitAllowIds.length} • Deny: {s.unitDenyIds.length}
                                </div>
                            </div>
                            <span className="text-xs text-zinc-400">edytuj</span>
                        </div>
                    </button>
                ))}
                {listForFaction.length === 0 && (
                    <div className="text-sm text-zinc-500">Brak subfrakcji dla tej frakcji.</div>
                )}
            </div>

            {selectedFaction && editor && (
                <Editor
                    key={editor.id}
                    factionName={selectedFaction.name}
                    sub={editor}
                    units={unitList}
                    onClose={() => setEditorId(null)}
                    onSaveLocal={(next) =>
                        setSubfactions((prev) => prev.map((x) => (x.id === next.id ? next : x)))
                    }
                    onDeleteLocal={(id) => {
                        setSubfactions((prev) => prev.filter((x) => x.id !== id));
                        setEditorId(null);
                    }}
                />
            )}
        </div>
    );
}

function Editor({
    factionName,
    sub,
    units,
    onClose,
    onSaveLocal,
    onDeleteLocal,
}: {
    factionName: string;
    sub: SubfactionDTO;
    units: UnitTemplateDTO[];
    onClose: () => void;
    onSaveLocal: (next: SubfactionDTO) => void;
    onDeleteLocal: (id: string) => void;
}) {
    const [name, setName] = useState(sub.name);
    const [q, setQ] = useState('');

    const [allowIds, setAllowIds] = useState<string[]>(sub.unitAllowIds);
    const [denyIds, setDenyIds] = useState<string[]>(sub.unitDenyIds);

    const [saving, setSaving] = useState(false);

    const filteredUnits = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return units;
        return units.filter((u) => u.name.toLowerCase().includes(s));
    }, [q, units]);

    function toggle(list: string[], id: string): string[] {
        return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    }

    function toggleAllow(id: string) {
        setAllowIds((prev) => {
            const next = toggle(prev, id);
            return next;
        });
        // jeśli dodajemy allow, usuń z deny
        setDenyIds((prev) => prev.filter((x) => x !== id));
    }

    function toggleDeny(id: string) {
        setDenyIds((prev) => {
            const next = toggle(prev, id);
            return next;
        });
        // jeśli dodajemy deny, usuń z allow
        setAllowIds((prev) => prev.filter((x) => x !== id));
    }

    async function saveName() {
        const n = name.trim();
        if (n.length < 2) {
            notifyWarning('Nazwa min. 2 znaki');
            return;
        }
        setSaving(true);
        try {
            await patchSubfaction(sub.id, { name: n });
            onSaveLocal({ ...sub, name: n, unitAllowIds: allowIds, unitDenyIds: denyIds });
        } catch (e) {
            notifyApiError(errMsg(e), 'Błąd operacji na subfrakcji');
        } finally {
            setSaving(false);
        }
    }

    async function saveUnits() {
        setSaving(true);
        try {
            await putSubfactionUnits(sub.id, { allowIds, denyIds });
            onSaveLocal({ ...sub, name: name.trim(), unitAllowIds: allowIds, unitDenyIds: denyIds });
        } catch (e) {
            notifyApiError(errMsg(e), 'Błąd operacji na subfrakcji');
        } finally {
            setSaving(false);
        }
    }

    async function del() {
        confirmAction({
            title: `Usunąć subfrakcję „${sub.name}”?`,
            okText: 'Usuń',
            cancelText: 'Anuluj',
            danger: true,
            onOk: async () => {
                setSaving(true);
                try {
                    await deleteSubfaction(sub.id);
                    onDeleteLocal(sub.id);
                } catch (e) {
                    notifyApiError(errMsg(e), 'Błąd operacji na subfrakcji');
                    throw e;
                } finally {
                    setSaving(false);
                }
            },
        });
    }

    return (
        <div className="fixed inset-0 z-20">
            <button aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl h-[90dvh] flex flex-col">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />

                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-xs text-zinc-400">Frakcja: {factionName}</div>
                        <div className="text-base font-semibold">Subfrakcja</div>
                    </div>
                    <button onClick={onClose} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                        Zamknij
                    </button>
                </div>

                <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs text-zinc-400">Nazwa</div>
                    <div className="mt-2 flex gap-2">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                        />
                        <button
                            disabled={saving}
                            onClick={() => void saveName()}
                            className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                        >
                            Zapisz
                        </button>
                    </div>
                </div>

                <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 flex-1 flex flex-col min-h-0">
                    <div className="text-sm font-semibold">Jednostki (allow/deny)</div>
                    <div className="mt-1 text-[11px] text-zinc-400">
                        Allow dodaje jednostkę do subfrakcji. Deny blokuje jednostkę (wygrywa).
                    </div>

                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Szukaj jednostki…"
                        className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    />

                    <div className="mt-3 flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-2">
                            {filteredUnits.map((u) => {
                                const isAllow = allowIds.includes(u.id);
                                const isDeny = denyIds.includes(u.id);
                                return (
                                    <div key={u.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium truncate">{u.name}</div>
                                                <div className="text-[11px] text-zinc-500">
                                                    {u.isGlobal ? 'GLOBAL' : `Przypisana do ${u.factionIds.length} frakcji`}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAllow(u.id)}
                                                    className={
                                                        'h-9 rounded-xl border px-3 text-xs font-medium ' +
                                                        (isAllow
                                                            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                                                            : 'border-zinc-700 bg-zinc-950 text-zinc-300')
                                                    }
                                                >
                                                    Allow
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleDeny(u.id)}
                                                    className={
                                                        'h-9 rounded-xl border px-3 text-xs font-medium ' +
                                                        (isDeny
                                                            ? 'border-red-400 bg-red-500/10 text-red-300'
                                                            : 'border-zinc-700 bg-zinc-950 text-zinc-300')
                                                    }
                                                >
                                                    Deny
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredUnits.length === 0 && (
                                <div className="text-sm text-zinc-500">Brak wyników.</div>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                        <button
                            disabled={saving}
                            onClick={() => void saveUnits()}
                            className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                        >
                            Zapisz reguły
                        </button>
                        <button
                            disabled={saving}
                            onClick={() => void del()}
                            className="h-11 rounded-2xl border border-red-700 bg-red-900/30 px-4 text-sm text-red-200 disabled:opacity-50"
                        >
                            Usuń
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
