'use client';

import { Avatar, Button, Card, Flex, Layout, List, Space, Tag, Typography } from 'antd';

export function RosterClient(props: {
    armyId: string;
    armyName: string;
    units: { id: string; name: string; wounds: number; present: boolean; weaponsCount: number; upgradesCount: number; photoPath: string | null }[];
}) {
    return (
        <Layout style={{ minHeight: '100dvh' }}>
            <Layout.Header style={{ position: 'sticky', top: 0, zIndex: 10, height: 56, lineHeight: '56px', paddingInline: 12 }}>
                <Flex align="center" justify="space-between" style={{ maxWidth: 560, margin: '0 auto' }}>
                    <Button type="link" href={`/army/${props.armyId}`}>
                        ←
                    </Button>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                        Roster: {props.armyName}
                    </Typography.Title>
                    <span style={{ width: 24 }} />
                </Flex>
            </Layout.Header>

            <Layout.Content style={{ maxWidth: 560, width: '100%', margin: '12px auto', paddingInline: 12 }}>
                <Card size="small">
                    <List
                        dataSource={props.units}
                        renderItem={(u) => (
                            <List.Item>
                                <a href={`/army/${props.armyId}/unit/${u.id}`} style={{ width: '100%' }}>
                                    <Flex align="center" gap={12}>
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

                <Button type="primary" shape="circle" size="large" href={`/army/${props.armyId}/roster/add`} style={{ position: 'fixed', right: 20, bottom: 20 }}>
                    ＋
                </Button>
            </Layout.Content>
        </Layout>
    );
}
