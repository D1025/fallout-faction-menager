'use client';

import { Avatar, Button, Card, Flex, List, Space, Tag, Typography } from 'antd';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';

export function RosterClient(props: {
    armyId: string;
    armyName: string;
    units: { id: string; name: string; wounds: number; present: boolean; weaponsCount: number; upgradesCount: number; photoPath: string | null }[];
}) {
    return (
        <MobilePageShell
            title={`Roster: ${props.armyName}`}
            backHref={`/army/${props.armyId}`}
            stickyActions={
                <Button type="primary" href={`/army/${props.armyId}/roster/add`} block style={{ minHeight: 44 }}>
                    Dodaj jednostkę
                </Button>
            }
        >
                <Card size="small">
                    <List
                        dataSource={props.units}
                        renderItem={(u) => (
                            <List.Item style={{ paddingBlock: 0 }}>
                                <a href={`/army/${props.armyId}/unit/${u.id}`} style={{ width: '100%', minHeight: 44, display: 'flex', paddingBlock: 12 }}>
                                    <Flex align="center" gap={12} style={{ width: '100%' }}>
                                        <Avatar shape="square" size={48}>
                                            {u.photoPath ? '🖼️' : u.name.slice(0, 2)}
                                        </Avatar>
                                        <Space direction="vertical" size={0} style={{ flex: 1 }}>
                                            <Flex justify="space-between" align="center">
                                                <Typography.Text strong>{u.name}</Typography.Text>
                                                <Tag color={u.present ? 'green' : 'default'}>{u.present ? 'obecny' : 'rezerwa'}</Tag>
                                            </Flex>
                                            <Typography.Text type="secondary">
                                                Rany: {u.wounds}/4 • Broń: {u.weaponsCount} • Ulepszenia: {u.upgradesCount}
                                            </Typography.Text>
                                        </Space>
                                    </Flex>
                                </a>
                            </List.Item>
                        )}
                    />
                </Card>
        </MobilePageShell>
    );
}
