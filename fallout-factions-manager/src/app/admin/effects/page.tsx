export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AdminEffectsClient } from "@/components/AdminEffectsClient";
import { AppHeader } from '@/components/nav/AppHeader';

export default function EffectsAdminPage() {
    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <AppHeader title="Efekty (admin)" backHref="/admin" />
            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <AdminEffectsClient />
            </main>
        </div>
    );
}
