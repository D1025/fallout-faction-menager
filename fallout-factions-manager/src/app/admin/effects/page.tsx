export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { AdminEffectsClient } from '@/components/AdminEffectsClient';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';

export default function EffectsAdminPage() {
    return (
        <MobilePageShell title="Efekty (admin)" backHref="/admin">
            <AdminEffectsClient />
        </MobilePageShell>
    );
}
