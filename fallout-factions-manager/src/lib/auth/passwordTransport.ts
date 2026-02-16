export const PASSWORD_TRANSPORT_HEX_LENGTH = 64;
const PASSWORD_TRANSPORT_HEX_RE = /^[a-f0-9]{64}$/;

export function normalizePasswordTransportHash(input: string): string | null {
    const value = input.trim().toLowerCase();
    if (!PASSWORD_TRANSPORT_HEX_RE.test(value)) return null;
    return value;
}

export function isPasswordTransportHash(input: string): boolean {
    return normalizePasswordTransportHash(input) !== null;
}
