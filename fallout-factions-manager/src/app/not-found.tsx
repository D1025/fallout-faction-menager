import Link from 'next/link';
import { Button } from 'antd';
import { HomeOutlined, WarningOutlined } from '@ant-design/icons';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { SectionCard } from '@/components/ui/antd/SectionCard';

export default function NotFoundPage() {
    return (
        <MobilePageShell title="Nie znaleziono strony">
            <SectionCard>
                <div className="text-center">
                    <div className="text-3xl text-amber-300">
                        <WarningOutlined />
                    </div>
                    <div className="mt-2 text-lg font-semibold">Ta strona nie istnieje</div>
                    <p className="mt-2 text-sm vault-muted">
                        Sprawdz adres URL albo wroc do strony glownej aplikacji.
                    </p>
                    <Link href="/">
                        <Button type="primary" className="mt-4" icon={<HomeOutlined />}>
                            Przejdz do strony glownej
                        </Button>
                    </Link>
                </div>
            </SectionCard>
        </MobilePageShell>
    );
}

