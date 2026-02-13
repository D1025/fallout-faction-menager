import { Modal, message, notification } from 'antd';

export const UI_FEEDBACK_STANDARD = {
  toast: 'Używaj krótkich toastów (message.*) dla powodzeń i lekkich walidacji formularza.',
  blockingModal: 'Używaj modala blokującego wyłącznie przy akcjach nieodwracalnych (usuniecie, reset).',
  errors: 'Komunikat błędu: co się nie udało + wskazówka naprawcza (np. odśwież, sprawdź połączenie).',
} as const;

export function getErrorMessage(error: unknown, fallback = 'Wystąpił nieoczekiwany błąd.'): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function withHint(content: string, hint = 'Spróbuj ponownie za chwilę.') {
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

export function notifyApiError(error: unknown, fallback = 'Nie udało się wykonać operacji.') {
  notification.error({
    message: 'Błąd API',
    description: withHint(getErrorMessage(error, fallback), 'Sprawdź dane i połączenie, a potem spróbuj ponownie.'),
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
    onOk: async () => {
      await options.onOk();
    },
  });
}
