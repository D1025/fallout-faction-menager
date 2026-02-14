import { message, notification, type ModalFuncProps } from 'antd';

export const UI_FEEDBACK_STANDARD = {
  toast: 'Uzywaj krotkich toastow (message.*) dla powodzen i lekkich walidacji formularza.',
  blockingModal: 'Uzywaj modala blokujacego wylacznie przy akcjach nieodwracalnych (usuniecie, reset).',
  errors: 'Komunikat bledu: co sie nie udalo + wskazowka naprawcza (np. odswiez, sprawdz polaczenie).',
} as const;

export function getErrorMessage(error: unknown, fallback = 'Wystapil nieoczekiwany blad.'): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function withHint(content: string, hint = 'Sprobuj ponownie za chwile.') {
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

export function notifyApiError(error: unknown, fallback = 'Nie udalo sie wykonac operacji.') {
  notification.error({
    message: 'Blad API',
    description: withHint(getErrorMessage(error, fallback), 'Sprawdz dane i polaczenie, a potem sprobuj ponownie.'),
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
      okText: options.okText ?? 'Potwierdz',
      cancelText: options.cancelText ?? 'Anuluj',
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
