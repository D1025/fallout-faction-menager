export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AdminPerksClient } from '@/components/AdminPerksClient';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';

export default function PerksAdminPage() {
    return (
        <MobilePageShell title="Perks (admin)" backHref="/admin">
            <AdminPerksClient />
        </MobilePageShell>
    );
}
