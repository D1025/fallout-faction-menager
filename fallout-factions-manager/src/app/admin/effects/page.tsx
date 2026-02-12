export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AdminEffectsClient } from "@/components/AdminEffectsClient";
import { AppHeader } from '@/components/nav/AppHeader';

export default function EffectsAdminPage() {
    return (
        <div className="min-h-dvh">
            <AppHeader title="Efekty (admin)" backHref="/admin" />
            <main className="app-shell">
                <AdminEffectsClient />
            </main>
        </div>
    );
}
