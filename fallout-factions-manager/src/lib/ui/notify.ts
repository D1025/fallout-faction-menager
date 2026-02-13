import { Modal, message, notification } from 'antd';

export function getErrorMessage(error: unknown, fallback = 'Wystąpił nieoczekiwany błąd.'): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message || fallback;
    return fallback;
}

export function notifyError(content: string) {
    message.error(content);
}

export function notifySuccess(content: string) {
    message.success(content);
}

export function notifyWarning(content: string) {
    message.warning(content);
}

export function notifyApiError(error: unknown, fallback = 'Nie udało się wykonać operacji.') {
    notification.error({
        message: 'Błąd API',
        description: getErrorMessage(error, fallback),
    });
}

export async function responseError(res: Response, fallback: string): Promise<Error> {
    const text = await res.text().catch(() => '');
    return new Error(text || fallback);
}

export function confirmAction(options: {
    title: string;
    content?: string;
    okText?: string;
    cancelText?: string;
    danger?: boolean;
    onOk: () => Promise<void>;
}) {
    Modal.confirm({
        title: options.title,
        content: options.content,
        okText: options.okText ?? 'Potwierdź',
        cancelText: options.cancelText ?? 'Anuluj',
        okButtonProps: { danger: options.danger },
        cancelButtonProps: {},
        onOk: async () => {
            await options.onOk();
        },
    });
}
