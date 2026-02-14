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
        <Layout.Header className="ff-app-header">
            <Flex className="ff-app-header__inner" align="center" justify="space-between" style={{ maxWidth }}>
                <div style={{ flex: '0 0 auto' }}>{backHref ? <BackButton fallbackHref={backHref} /> : null}</div>

                <Typography.Text
                    strong
                    className="ff-app-header__title"
                    ellipsis
                    title={title}
                >
                    {title}
                </Typography.Text>

                <div className="ff-app-header__right">
                    {right}
                </div>
            </Flex>
        </Layout.Header>
    );
}
