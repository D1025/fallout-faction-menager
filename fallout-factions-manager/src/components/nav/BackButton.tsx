'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useRouter } from 'next/navigation';

export function BackButton({
    fallbackHref,
    label = 'Back',
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
        <Button
            type="default"
            onClick={goBack}
            icon={<ArrowLeftOutlined />}
            className={`ff-ant-btn-icon-mobile ff-header-action-btn ff-back-btn ${className ?? ''}`.trim()}
            aria-label={label}
            title={label}
        >
            {label}
        </Button>
    );
}
