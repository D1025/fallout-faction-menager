'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Crop = { x: number; y: number; size: number };

type Props = {
    file: File;
    onCancel: () => void;
    onConfirm: (blob: Blob) => void;
    targetSize?: number; // px
    maxBytes?: number; // walidacja po downscale
    disableCompression?: boolean;
};

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

export function PhotoCropperModal({ file, onCancel, onConfirm, targetSize = 400, maxBytes = 3 * 1024 * 1024, disableCompression = false }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState(1);
    const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, size: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

    const mime = useMemo(() => {
        if (file.type === 'image/png') return 'image/png';
        if (file.type === 'image/webp') return 'image/webp';
        return 'image/jpeg'; // default
    }, [file.type]);

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;

        (async () => {
            objectUrl = URL.createObjectURL(file);
            const image = new Image();
            image.decoding = 'async';
            image.src = objectUrl;
            await image.decode();
            if (cancelled) return;
            setImg(image);

            const minSide = Math.min(image.naturalWidth, image.naturalHeight);
            setCrop({ x: (image.naturalWidth - minSide) / 2, y: (image.naturalHeight - minSide) / 2, size: minSide });
            setZoom(1);
        })().catch(() => {
            // noop
        });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [file]);

    // render preview w canvas
    useEffect(() => {
        const c = canvasRef.current;
        if (!c || !img) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;

        const outSize = 260; // preview
        c.width = outSize;
        c.height = outSize;
        ctx.clearRect(0, 0, outSize, outSize);

        const scaledSize = crop.size / zoom;
        const sx = clamp(crop.x + (crop.size - scaledSize) / 2, 0, img.naturalWidth - scaledSize);
        const sy = clamp(crop.y + (crop.size - scaledSize) / 2, 0, img.naturalHeight - scaledSize);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, scaledSize, scaledSize, 0, 0, outSize, outSize);
    }, [img, crop, zoom]);

    function onPointerDown(e: React.PointerEvent) {
        if (!img) return;
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragStart.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y };
    }

    function onPointerMove(e: React.PointerEvent) {
        if (!img || !dragging || !dragStart.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;

        // preview canvas 260px -> przelicz na przestrzeń obrazu
        const preview = 260;
        const scaledSize = crop.size / zoom;
        const pxToImg = scaledSize / preview;

        const nx = clamp(dragStart.current.cx - dx * pxToImg, 0, img.naturalWidth - crop.size);
        const ny = clamp(dragStart.current.cy - dy * pxToImg, 0, img.naturalHeight - crop.size);
        setCrop((c) => ({ ...c, x: nx, y: ny }));
    }

    function onPointerUp(e: React.PointerEvent) {
        setDragging(false);
        dragStart.current = null;
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // noop
        }
    }

    async function confirm() {
        if (!img) return;

        const out = document.createElement('canvas');
        out.width = targetSize;
        out.height = targetSize;
        const ctx = out.getContext('2d');
        if (!ctx) return;

        const scaledSize = crop.size / zoom;
        const sx = clamp(crop.x + (crop.size - scaledSize) / 2, 0, img.naturalWidth - scaledSize);
        const sy = clamp(crop.y + (crop.size - scaledSize) / 2, 0, img.naturalHeight - scaledSize);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, scaledSize, scaledSize, 0, 0, targetSize, targetSize);

        const quality = mime === 'image/jpeg' ? (disableCompression ? 1.0 : 0.85) : undefined;

        const blob: Blob | null = await new Promise((resolve) => out.toBlob(resolve, mime, quality));
        if (!blob) return;
        if (blob.size > maxBytes) {
            alert(`Zdjęcie po przeskalowaniu jest za duże (${Math.round(blob.size / 1024)}KB). Spróbuj większego przybliżenia lub innego zdjęcia.`);
            return;
        }
        onConfirm(blob);
    }

    return (
        <div className="fixed inset-0 z-30">
            <button aria-label="Zamknij" onClick={onCancel} className="absolute inset-0 bg-black/70" />

            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-sm rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
                <div className="p-4">
                    <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
                    <div className="flex items-center justify-between gap-3">
                        <button onClick={onCancel} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
                            ← Wróć
                        </button>
                        <div className="min-w-0 flex-1 text-center">
                            <div className="truncate text-sm font-semibold">Przytnij zdjęcie</div>
                            <div className="text-[11px] text-zinc-400">Wyjście: {targetSize}×{targetSize}</div>
                        </div>
                        <div className="w-[72px]" />
                    </div>

                    <div className="mt-4 grid place-items-center">
                        <div
                            className="relative h-[260px] w-[260px] touch-none overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                        >
                            <canvas ref={canvasRef} className="h-full w-full" />
                            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block text-xs text-zinc-400">Przybliżenie</label>
                        <input
                            type="range"
                            min={1}
                            max={4}
                            step={0.01}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    <div className="mt-4 flex gap-2">
                        <button onClick={onCancel} className="h-11 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300">
                            Anuluj
                        </button>
                        <button onClick={() => void confirm()} className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-emerald-950">
                            Zapisz zdjęcie
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
