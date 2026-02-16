import type { ReactNode } from 'react';
import { Alert, Button, Result, Skeleton, Space, Typography } from 'antd';

export function LoadingState({
  title = 'Loading data',
  description = 'Please wait, preparing the view.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="vault-panel rounded-xl p-4">
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="secondary">{description}</Typography.Text>
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      </Space>
    </div>
  );
}

export function EmptyState({
  title = 'No data',
  description = 'No items found for current filters.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Result
      status="info"
      title={title}
      subTitle={description}
      extra={action}
      style={{ border: '1px solid rgba(101,118,104,0.5)', borderRadius: 16, padding: 20 }}
    />
  );
}

export function ErrorState({
  title = 'Failed to load data',
  description = 'Check your connection and try again. If the problem persists, refresh the page.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert
      type="error"
      showIcon
      message={title}
      description={
        <Space direction="vertical" size={8}>
          <Typography.Text>{description}</Typography.Text>
          {onRetry ? (
            <Button size="small" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </Space>
      }
      style={{ borderRadius: 12 }}
    />
  );
}
