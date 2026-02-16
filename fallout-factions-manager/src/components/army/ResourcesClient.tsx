'use client';

import { Button, Card, Col, Flex, Grid, Row, Space, Typography } from 'antd';
import { useState } from 'react';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { EmptyState } from '@/components/ui/antd/ScreenStates';

type Kind = 'caps' | 'parts' | 'reach';

const resourceKinds: Kind[] = ['caps', 'parts', 'reach'];

export function ResourcesClient(props: {
  armyId: string;
  armyName: string;
  totals: Record<Kind, number>;
  history: { id: string; kind: Kind; delta: number; at: string; note: string }[];
}) {
  const [totals, setTotals] = useState(props.totals);
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);

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
      title={`Resources: ${props.armyName}`}
      backHref={`/army/${props.armyId}`}
      desktopSidebar={
        <Card size="small" title="History filters">
          <Typography.Text type="secondary">Desktop version uses a fixed panel for filters and shortcuts.</Typography.Text>
        </Card>
      }
      stickyActions={
        <Flex gap={8} justify="end" wrap>
          <Button type={isDesktop ? 'default' : 'primary'} size="large" style={{ minHeight: 44 }} href={`/army/${props.armyId}`}>
            Back
          </Button>
          <Button type={isDesktop ? 'primary' : 'default'} size="large" style={{ minHeight: 44 }}>
            Export history
          </Button>
        </Flex>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Row gutter={[12, 12]}>
          {resourceKinds.map((k) => (
            <Col key={k} xs={24} md={12} xl={8}>
              <Card size="small">
                <Typography.Text type="secondary">{k.toUpperCase()}</Typography.Text>
                <Typography.Title level={4} style={{ marginTop: 4 }}>
                  {totals[k] ?? 0}
                </Typography.Title>
                <Flex gap={4} wrap>
                  {[1, 5, 10].map((n) => (
                    <Button key={n} size="small" style={{ minHeight: 44 }} onClick={() => change(k, n)}>
                      +{n}
                    </Button>
                  ))}
                  {[-1, -5, -10].map((n) => (
                    <Button key={n} size="small" style={{ minHeight: 44 }} onClick={() => change(k, n)}>
                      {n}
                    </Button>
                  ))}
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>

        <Card title="History" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            {props.history.length === 0 ? <EmptyState title="No history" description="Make your first resource change to see entries." /> : null}
            {props.history.map((h) => (
              <Flex key={h.id} justify="space-between" gap={8}>
                <Typography.Text>
                  {h.kind.toUpperCase()} {h.delta > 0 ? `+${h.delta}` : h.delta}
                </Typography.Text>
                <Typography.Text type="secondary">{new Date(h.at).toLocaleString()}</Typography.Text>
              </Flex>
            ))}
          </Space>
        </Card>
      </Space>
    </MobilePageShell>
  );
}
