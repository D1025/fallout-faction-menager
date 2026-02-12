export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AdminPerksClient } from "@/components/AdminPerksClient";
import { AppHeader } from '@/components/nav/AppHeader';

export default function PerksAdminPage() {
    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <AppHeader title="Perki (admin)" backHref="/admin" />
            <main className="mx-auto max-w-screen-sm px-3 pb-24">
                <AdminPerksClient />
            </main>
        </div>
    );
}
