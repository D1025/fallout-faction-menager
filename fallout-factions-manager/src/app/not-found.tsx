import Link from 'next/link';
import { Button } from 'antd';
import { HomeOutlined, WarningOutlined } from '@ant-design/icons';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { SectionCard } from '@/components/ui/antd/SectionCard';

export default function NotFoundPage() {
    return (
        <MobilePageShell title="Page not found">
            <SectionCard>
                <div className="text-center">
                    <div className="text-3xl text-amber-300">
                        <WarningOutlined />
                    </div>
                    <div className="mt-2 text-lg font-semibold">This page does not exist</div>
                    <p className="mt-2 text-sm vault-muted">
                        Check the URL or return to the app home page.
                    </p>
                    <Link href="/">
                        <Button type="primary" className="mt-4" icon={<HomeOutlined />}>
                            Go to home page
                        </Button>
                    </Link>
                </div>
            </SectionCard>
        </MobilePageShell>
    );
}
