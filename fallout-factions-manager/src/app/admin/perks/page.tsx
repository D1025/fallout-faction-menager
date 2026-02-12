export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AdminPerksClient } from "@/components/AdminPerksClient";
import { AppHeader } from '@/components/nav/AppHeader';

export default function PerksAdminPage() {
    return (
        <div className="min-h-dvh">
            <AppHeader title="Perki (admin)" backHref="/admin" />
            <main className="app-shell">
                <AdminPerksClient />
            </main>
        </div>
    );
}
