'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useRouter } from 'next/navigation';

export function BackButton({
    fallbackHref,
    label = 'Wróć',
    className,
}: {
    fallbackHref: string;
    label?: string;
    className?: string;
}) {
    const router = useRouter();

    function goBack() {
        if (typeof document !== 'undefined' && document.referrer) {
            router.back();
        } else {
            router.push(fallbackHref);
        }
    }

    return (
        <Button type="default" size="small" onClick={goBack} className={className} aria-label={label} title={label}>
            <ArrowLeftOutlined /> {label}
        </Button>
    );
}
