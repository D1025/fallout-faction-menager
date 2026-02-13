'use client';

import { FileImageOutlined, PlusOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Col, Flex, Grid, Row, Space, Tag, Typography } from 'antd';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';
import { EmptyState } from '@/components/ui/antd/ScreenStates';

export function RosterClient(props: {
  armyId: string;
  armyName: string;
  units: { id: string; name: string; wounds: number; present: boolean; weaponsCount: number; upgradesCount: number; photoPath: string | null }[];
}) {
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);

  return (
    <MobilePageShell
      title={`Roster: ${props.armyName}`}
      backHref={`/army/${props.armyId}`}
      stickyActions={
        <Flex gap={8} justify="end">
          {isDesktop ? (
            <Button href={`/army/${props.armyId}`} size="large" style={{ minHeight: 44 }}>
              Powrót do armii
            </Button>
          ) : null}
          <Button type="primary" icon={<PlusOutlined />} href={`/army/${props.armyId}/roster/add`} size="large" style={{ minHeight: 44 }}>
            Dodaj jednostkę
          </Button>
        </Flex>
      }
    >
      <Row gutter={[12, 12]}>
        {props.units.length === 0 ? (
          <Col span={24}><EmptyState title="Brak jednostek" description="Dodaj pierwszą jednostkę do rosteru." /></Col>
        ) : null}
        {props.units.map((u) => (
          <Col key={u.id} xs={24} md={12}>
            <a href={`/army/${props.armyId}/unit/${u.id}`} style={{ width: '100%', display: 'block' }}>
              <Card size="small" styles={{ body: { padding: 12 } }}>
                <Flex align="center" gap={12}>
                  <Avatar shape="square" size={48}>
                    {u.photoPath ? <FileImageOutlined /> : u.name.slice(0, 2)}
                  </Avatar>
                  <Space direction="vertical" size={2} style={{ flex: 1 }}>
                    <Flex justify="space-between" align="center" gap={8}>
                      <Typography.Text strong>{u.name}</Typography.Text>
                      <Tag color={u.present ? 'green' : 'default'}>{u.present ? 'obecny' : 'rezerwa'}</Tag>
                    </Flex>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Rany: {u.wounds}/4 • Broń: {u.weaponsCount} • Ulepszenia: {u.upgradesCount}
                    </Typography.Text>
                  </Space>
                </Flex>
              </Card>
            </a>
          </Col>
        ))}
      </Row>
    </MobilePageShell>
  );
}
