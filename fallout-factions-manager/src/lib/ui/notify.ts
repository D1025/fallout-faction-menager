import { message, notification, type ModalFuncProps } from 'antd';

export const UI_FEEDBACK_STANDARD = {
  toast: 'Use short toasts (message.*) for successes and lightweight form validation.',
  blockingModal: 'Use blocking modals only for irreversible actions (delete, reset).',
  errors: 'Error message: what failed + corrective hint (e.g. refresh, check connection).',
} as const;

export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function withHint(content: string, hint = 'Try again in a moment.') {
  return `${content} ${hint}`.trim();
}

export function notifyError(content: string) {
  message.error(withHint(content));
}

export function notifySuccess(content: string) {
  message.success(content);
}

export function notifyWarning(content: string) {
  message.warning(content);
}

export function notifyApiError(error: unknown, fallback = 'Operation failed.') {
  notification.error({
    message: 'API error',
    description: withHint(getErrorMessage(error, fallback), 'Check your data and connection, then try again.'),
  });
}

export async function responseError(res: Response, fallback: string): Promise<Error> {
  const text = await res.text().catch(() => '');
  return new Error(text || fallback);
}

let modalConfirmHandler: ((config: ModalFuncProps) => void) | null = null;

export function bindConfirmActionModal(handler: ((config: ModalFuncProps) => void) | null) {
  modalConfirmHandler = handler;
}

export function confirmAction(options: {
  title: string;
  content?: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  onOk: () => Promise<void>;
}) {
  if (modalConfirmHandler) {
    modalConfirmHandler({
      title: options.title,
      content: options.content,
      okText: options.okText ?? 'Confirm',
      cancelText: options.cancelText ?? 'Cancel',
      okButtonProps: { danger: options.danger },
      onOk: async () => {
        await options.onOk();
      },
    });
    return;
  }

  if (typeof window !== 'undefined') {
    const prompt = [options.title, options.content].filter(Boolean).join('\n\n');
    const accepted = window.confirm(prompt);
    if (!accepted) return;
    void options.onOk();
  }
}
