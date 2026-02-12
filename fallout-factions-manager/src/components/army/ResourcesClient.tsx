'use client';

import { Button, Card, Drawer, Flex, List, Space, Typography } from 'antd';
import { useState } from 'react';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';

type Kind = 'caps' | 'parts' | 'reach';

const resourceKinds: Kind[] = ['caps', 'parts', 'reach'];

export function ResourcesClient(props: {
    armyId: string;
    armyName: string;
    totals: Record<Kind, number>;
    history: { id: string; kind: Kind; delta: number; at: string; note: string }[];
}) {
    const [totals, setTotals] = useState(props.totals);
    const [historyOpen, setHistoryOpen] = useState(false);

    async function change(kind: Kind, delta: number, note?: string) {
        setTotals((t) => ({ ...t, [kind]: (t[kind] ?? 0) + delta }));
        await fetch(`/api/resources/${props.armyId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, delta, note }),
        });
    }

    return (
        <MobilePageShell
            title={`Zasoby: ${props.armyName}`}
            backHref={`/army/${props.armyId}`}
            headerRight={
                <Button type="text" onClick={() => setHistoryOpen(true)} style={{ minHeight: 44, minWidth: 44 }}>
                    Historia
                </Button>
            }
        >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Card size="small" title="Status zasobów">
                    <Flex gap={8} wrap>
                        {resourceKinds.map((k) => (
                            <Card key={k} size="small" style={{ flex: 1, minWidth: 120 }}>
                                <Typography.Text type="secondary">{k.toUpperCase()}</Typography.Text>
                                <Typography.Title level={4} style={{ marginTop: 4 }}>
                                    {totals[k] ?? 0}
                                </Typography.Title>
                                <Flex gap={6} wrap>
                                    {[1, 5, 10].map((n) => (
                                        <Button key={n} onClick={() => change(k, n)} style={{ minHeight: 44 }}>
                                            +{n}
                                        </Button>
                                    ))}
                                </Flex>
                                <Flex gap={6} wrap style={{ marginTop: 6 }}>
                                    {[-1, -5, -10].map((n) => (
                                        <Button key={n} onClick={() => change(k, n)} style={{ minHeight: 44 }}>
                                            {n}
                                        </Button>
                                    ))}
                                </Flex>
                            </Card>
                        ))}
                    </Flex>
                </Card>
            </Space>

            <Drawer
                title="Historia zmian"
                placement="bottom"
                height="70vh"
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
            >
                <List
                    dataSource={props.history}
                    renderItem={(h) => (
                        <List.Item style={{ minHeight: 44 }}>
                            <Flex justify="space-between" style={{ width: '100%' }} gap={8}>
                                <Typography.Text>
                                    {h.kind.toUpperCase()} {h.delta > 0 ? `+${h.delta}` : h.delta}
                                </Typography.Text>
                                <Typography.Text type="secondary">{new Date(h.at).toLocaleString()}</Typography.Text>
                            </Flex>
                        </List.Item>
                    )}
                />
            </Drawer>
        </MobilePageShell>
    );
}
