'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Layout, List, Space, Typography } from 'antd';
import { useState } from 'react';

type Kind = 'caps' | 'parts' | 'reach';

const resourceKinds: Kind[] = ['caps', 'parts', 'reach'];

export function ResourcesClient(props: {
    armyId: string;
    armyName: string;
    totals: Record<Kind, number>;
    history: { id: string; kind: Kind; delta: number; at: string; note: string }[];
}) {
    const [totals, setTotals] = useState(props.totals);

    async function change(kind: Kind, delta: number, note?: string) {
        setTotals((t) => ({ ...t, [kind]: (t[kind] ?? 0) + delta }));
        await fetch(`/api/resources/${props.armyId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, delta, note }),
        });
    }

    return (
        <Layout style={{ minHeight: '100dvh' }}>
            <Layout.Header style={{ position: 'sticky', top: 0, zIndex: 10, height: 56, lineHeight: '56px', paddingInline: 12 }}>
                <Flex align="center" justify="space-between" style={{ maxWidth: 560, margin: '0 auto' }}>
                    <Button type="link" href={`/army/${props.armyId}`}>
                        <ArrowLeftOutlined />
                    </Button>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                        Zasoby: {props.armyName}
                    </Typography.Title>
                    <span style={{ width: 24 }} />
                </Flex>
            </Layout.Header>

            <Layout.Content style={{ maxWidth: 560, width: '100%', margin: '12px auto', paddingInline: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Flex gap={8} wrap>
                        {resourceKinds.map((k) => (
                            <Card key={k} size="small" style={{ flex: 1, minWidth: 150 }}>
                                <Typography.Text type="secondary">{k.toUpperCase()}</Typography.Text>
                                <Typography.Title level={4} style={{ marginTop: 4 }}>
                                    {totals[k] ?? 0}
                                </Typography.Title>
                                <Flex gap={4}>
                                    {[1, 5, 10].map((n) => (
                                        <Button key={n} size="small" onClick={() => change(k, n)}>
                                            +{n}
                                        </Button>
                                    ))}
                                </Flex>
                                <Flex gap={4} style={{ marginTop: 4 }}>
                                    {[-1, -5, -10].map((n) => (
                                        <Button key={n} size="small" onClick={() => change(k, n)}>
                                            {n}
                                        </Button>
                                    ))}
                                </Flex>
                            </Card>
                        ))}
                    </Flex>

                    <Card title="Historia" size="small">
                        <List
                            dataSource={props.history}
                            renderItem={(h) => (
                                <List.Item>
                                    <Flex justify="space-between" style={{ width: '100%' }}>
                                        <Typography.Text>
                                            {h.kind.toUpperCase()} {h.delta > 0 ? `+${h.delta}` : h.delta}
                                        </Typography.Text>
                                        <Typography.Text type="secondary">{new Date(h.at).toLocaleString()}</Typography.Text>
                                    </Flex>
                                </List.Item>
                            )}
                        />
                    </Card>
                </Space>
            </Layout.Content>
        </Layout>
    );
}
