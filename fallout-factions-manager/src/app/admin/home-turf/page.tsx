export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AdminHomeTurfClient } from '@/components/AdminHomeTurfClient';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';

export default function HomeTurfAdminPage() {
    return (
        <MobilePageShell title="Home Turf (admin)" backHref="/admin">
            <AdminHomeTurfClient />
        </MobilePageShell>
    );
}

