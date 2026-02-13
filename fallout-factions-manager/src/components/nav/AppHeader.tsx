'use client';

import type React from 'react';
import { Flex, Layout, Typography } from 'antd';
import { BackButton } from '@/components/nav/BackButton';

export function AppHeader({
    title,
    backHref,
    right,
    maxWidth = 560,
}: {
    title: string;
    backHref?: string;
    right?: React.ReactNode;
    maxWidth?: number;
}) {
    return (
        <Layout.Header style={{ position: 'sticky', top: 0, zIndex: 10, height: 56, lineHeight: '56px', paddingInline: 12 }}>
            <Flex align="center" justify="space-between" style={{ maxWidth, margin: '0 auto', width: '100%' }}>
                <div style={{ minWidth: 64 }}>{backHref ? <BackButton fallbackHref={backHref} /> : null}</div>
                <Typography.Text strong style={{ flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {title}
                </Typography.Text>
                <div style={{ minWidth: 64, textAlign: 'right' }}>{right}</div>
            </Flex>
        </Layout.Header>
    );
}
