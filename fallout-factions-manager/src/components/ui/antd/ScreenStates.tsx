import type { ReactNode } from 'react';
import { Alert, Button, Result, Skeleton, Space, Typography } from 'antd';

export function LoadingState({
  title = 'Ładowanie danych',
  description = 'Poczekaj chwilę, przygotowujemy widok.',
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
  title = 'Brak danych',
  description = 'Nie znaleziono żadnych elementów dla bieżących filtrów.',
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
  title = 'Nie udało się pobrać danych',
  description = 'Sprawdź połączenie i spróbuj ponownie. Jeśli błąd się powtarza, odśwież stronę.',
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
              Spróbuj ponownie
            </Button>
          ) : null}
        </Space>
      }
      style={{ borderRadius: 12 }}
    />
  );
}
