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
            <Flex align="center" justify="space-between" style={{ maxWidth, margin: '0 auto', width: '100%', gap: 8 }}>
                <div style={{ flex: '0 0 auto' }}>{backHref ? <BackButton fallbackHref={backHref} /> : null}</div>

                <Typography.Text
                    strong
                    style={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                    }}
                    ellipsis
                    title={title}
                >
                    {title}
                </Typography.Text>

                <div style={{ flex: '0 0 auto', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
                    {right}
                </div>
            </Flex>
        </Layout.Header>
    );
}
