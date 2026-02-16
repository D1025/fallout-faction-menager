'use client';

import { useEffect, useState } from 'react';
import { CopyOutlined, LinkOutlined, QrcodeOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { notifyApiError, notifySuccess, notifyWarning } from '@/lib/ui/notify';

type PublicSharePayload = {
    enabled: boolean;
    token: string | null;
    path: string | null;
};

function normalizeSharePayload(raw: unknown): PublicSharePayload {
    if (!raw || typeof raw !== 'object') return { enabled: false, token: null, path: null };
    const data = raw as Record<string, unknown>;
    return {
        enabled: Boolean(data.enabled),
        token: typeof data.token === 'string' ? data.token : null,
        path: typeof data.path === 'string' ? data.path : null,
    };
}

export function ArmyShareClient({
    armyId,
    armyName,
}: {
    armyId: string;
    armyName: string;
}) {
    const [origin, setOrigin] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [share, setShare] = useState<PublicSharePayload>({ enabled: false, token: null, path: null });

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setErrorText(null);
            try {
                const res = await fetch(`/api/armies/${armyId}/public-share`, { cache: 'no-store' });
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(text || 'Failed to load share settings.');
                }
                setShare(normalizeSharePayload(await res.json().catch(() => null)));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load share settings.';
                setErrorText(message);
            } finally {
                setLoading(false);
            }
        };
        void run();
    }, [armyId]);

    async function enableOrRegenerate(action: 'ENABLE' | 'REGENERATE') {
        setBusy(true);
        setErrorText(null);
        try {
            const res = await fetch(`/api/armies/${armyId}/public-share`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || 'Failed to update share settings.');
            }
            setShare(normalizeSharePayload(await res.json().catch(() => null)));
            notifySuccess(action === 'ENABLE' ? 'Public link enabled.' : 'Public link regenerated.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update share settings.';
            setErrorText(message);
            notifyApiError(message, 'Failed to update share settings.');
        } finally {
            setBusy(false);
        }
    }

    async function disableSharing() {
        setBusy(true);
        setErrorText(null);
        try {
            const res = await fetch(`/api/armies/${armyId}/public-share`, { method: 'DELETE' });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || 'Failed to disable share link.');
            }
            setShare(normalizeSharePayload(await res.json().catch(() => null)));
            notifySuccess('Public link disabled.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to disable share link.';
            setErrorText(message);
            notifyApiError(message, 'Failed to disable share link.');
        } finally {
            setBusy(false);
        }
    }

    const shareUrl = share.enabled && share.path && origin ? `${origin}${share.path}` : '';
    const qrUrl = shareUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(shareUrl)}`
        : '';

    async function copyLink() {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            notifySuccess('Link copied.');
        } catch {
            notifyWarning('Could not copy automatically. Copy the link manually.');
        }
    }

    return (
        <div className="pt-3">
            <section className="vault-panel p-3">
                <div className="text-sm font-semibold text-zinc-100">{armyName}</div>
                <div className="mt-1 text-xs text-zinc-400">Public read-only sharing settings</div>
            </section>

            <section className="mt-3 vault-panel p-3">
                {loading ? (
                    <div className="text-sm text-zinc-400">Loading share settings...</div>
                ) : (
                    <div className="space-y-3">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-300">
                            Anyone with this link can view the army in read-only mode without logging in.
                        </div>

                        {errorText ? (
                            <div className="rounded-xl border border-red-900/80 bg-red-950/30 p-2 text-xs text-red-200">
                                {errorText}
                            </div>
                        ) : null}

                        {!share.enabled ? (
                            <button
                                type="button"
                                onClick={() => void enableOrRegenerate('ENABLE')}
                                disabled={busy}
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-500/70 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                            >
                                <LinkOutlined /> Enable public link
                            </button>
                        ) : (
                            <>
                                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                                    <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                                        Share Link
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            readOnly
                                            value={shareUrl || share.path || ''}
                                            className="vault-input h-10 flex-1 px-3 text-xs"
                                            aria-label="Share link"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void copyLink()}
                                            disabled={busy || !shareUrl}
                                            className="inline-flex h-10 items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 disabled:opacity-50"
                                        >
                                            <CopyOutlined /> Copy
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                                    <div className="mb-2 inline-flex items-center gap-2 text-xs text-zinc-300">
                                        <QrcodeOutlined className="text-zinc-200" />
                                        QR Code
                                    </div>
                                    {qrUrl ? (
                                        <div className="flex justify-center rounded-xl border border-zinc-800 bg-white p-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={qrUrl} alt="QR code for shared army link" className="h-64 w-64" />
                                        </div>
                                    ) : (
                                        <div className="text-xs text-zinc-500">Preparing QR code...</div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => void enableOrRegenerate('REGENERATE')}
                                        disabled={busy}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 disabled:opacity-50"
                                    >
                                        <ReloadOutlined /> Regenerate link
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void disableSharing()}
                                        disabled={busy}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-700/70 bg-red-950/30 px-3 text-xs text-red-200 disabled:opacity-50"
                                    >
                                        <StopOutlined /> Disable sharing
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}

