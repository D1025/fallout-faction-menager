'use client';

import { PlusOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { confirmAction, notifyApiError, notifyWarning } from '@/lib/ui/notify';
import type { SubfactionDTO, UnitTemplateDTO } from '@/app/admin/subfactions/page';

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
        // Show global templates and templates assigned to this faction.
        return unitTemplates.filter((u) => u.isGlobal || u.factionIds.includes(selectedFactionId));
    }, [unitTemplates, selectedFactionId]);

    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);

    async function create() {
        if (!selectedFactionId) return;
        const name = newName.trim();
        if (name.length < 2) {
            notifyWarning('Subfaction name must be at least 2 characters');
            return;
        }
        setBusy(true);
        try {
            const created = await postSubfaction({ factionId: selectedFactionId, name });
            setSubfactions((prev) => [created, ...prev]);
            setNewName('');
            setEditorId(created.id);
        } catch (e) {
            notifyApiError(errMsg(e), 'Subfaction operation failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="app-shell pt-2">
            <div className="vault-panel p-3">
                <p className="ff-panel-headline">Admin / Subfactions</p>
                <p className="vault-muted text-sm">Configure faction variants and control allowed or blocked unit lists.</p>
            </div>

            <div className="vault-panel p-3">
                <div className="text-sm font-semibold">Select faction</div>
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
                        placeholder="New subfaction"
                        className="flex-1 vault-input px-3 py-2 text-sm"
                    />
                    <button
                        disabled={busy || !selectedFactionId}
                        onClick={() => void create()}
                        className="ff-btn ff-btn-icon-mobile ff-btn-primary disabled:opacity-50"
                        aria-label="Add subfaction"
                        title="Add subfaction"
                    >
                        <PlusOutlined className="ff-btn-icon" />
                        <span className="ff-btn-label">Add</span>
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
                                <div className="mt-1 text-xs text-zinc-400">Allow: {s.unitAllowIds.length} | Deny: {s.unitDenyIds.length}</div>
                            </div>
                            <span className="text-xs text-zinc-400">Edit</span>
                        </div>
                    </button>
                ))}
                {listForFaction.length === 0 && <div className="text-sm text-zinc-500">No subfactions for this faction.</div>}
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
        setAllowIds((prev) => toggle(prev, id));
        // If allow is selected, remove from deny.
        setDenyIds((prev) => prev.filter((x) => x !== id));
    }

    function toggleDeny(id: string) {
        setDenyIds((prev) => toggle(prev, id));
        // If deny is selected, remove from allow.
        setAllowIds((prev) => prev.filter((x) => x !== id));
    }

    async function saveName() {
        const n = name.trim();
        if (n.length < 2) {
            notifyWarning('Name must be at least 2 characters');
            return;
        }
        setSaving(true);
        try {
            await patchSubfaction(sub.id, { name: n });
            onSaveLocal({ ...sub, name: n, unitAllowIds: allowIds, unitDenyIds: denyIds });
        } catch (e) {
            notifyApiError(errMsg(e), 'Subfaction operation failed');
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
            notifyApiError(errMsg(e), 'Subfaction operation failed');
        } finally {
            setSaving(false);
        }
    }

    async function del() {
        confirmAction({
            title: `Delete subfaction "${sub.name}"?`,
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onOk: async () => {
                setSaving(true);
                try {
                    await deleteSubfaction(sub.id);
                    onDeleteLocal(sub.id);
                } catch (e) {
                    notifyApiError(errMsg(e), 'Subfaction operation failed');
                    throw e;
                } finally {
                    setSaving(false);
                }
            },
        });
    }

    return (
        <div className="fixed inset-0 z-20">
            <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[90dvh] w-full max-w-screen-sm flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />

                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-xs text-zinc-400">Faction: {factionName}</div>
                        <div className="text-base font-semibold">Subfaction</div>
                    </div>
                    <button onClick={onClose} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                        Close
                    </button>
                </div>

                <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs text-zinc-400">Name</div>
                    <div className="mt-2 flex gap-2">
                        <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
                        <button
                            disabled={saving}
                            onClick={() => void saveName()}
                            className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                        >
                            Save
                        </button>
                    </div>
                </div>

                <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-sm font-semibold">Units (allow/deny)</div>
                    <div className="mt-1 text-[11px] text-zinc-400">Allow adds a unit to this subfaction. Deny blocks a unit and takes precedence.</div>

                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search units..."
                        className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    />

                    <div className="vault-scrollbar mt-3 flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-2">
                            {filteredUnits.map((u) => {
                                const isAllow = allowIds.includes(u.id);
                                const isDeny = denyIds.includes(u.id);
                                return (
                                    <div key={u.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium">{u.name}</div>
                                                <div className="text-[11px] text-zinc-500">
                                                    {u.isGlobal ? 'GLOBAL' : `Assigned to ${u.factionIds.length} faction(s)`}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 gap-2">
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
                            {filteredUnits.length === 0 && <div className="text-sm text-zinc-500">No results.</div>}
                        </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                        <button
                            disabled={saving}
                            onClick={() => void saveUnits()}
                            className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                        >
                            Save rules
                        </button>
                        <button
                            disabled={saving}
                            onClick={() => void del()}
                            className="h-11 rounded-2xl border border-red-700 bg-red-900/30 px-4 text-sm text-red-200 disabled:opacity-50"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
