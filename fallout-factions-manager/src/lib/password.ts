import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

const PASSWORD_HASH_ALGO = 'scrypt';
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEM = 32 * 1024 * 1024;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, keyLength, options, (err, derivedKey) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(derivedKey as Buffer);
        });
    });
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function getPasswordValidationError(password: string): string | null {
    if (password.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
        return `Password can be at most ${PASSWORD_MAX_LENGTH} characters.`;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return 'Password must contain at least one letter and one digit.';
    }
    return null;
}

export async function hashPassword(password: string): Promise<string> {
    const validationError = getPasswordValidationError(password);
    if (validationError) {
        throw new Error(validationError);
    }

    const salt = randomBytes(SALT_LENGTH);
    const derived = await scryptAsync(password, salt, KEY_LENGTH, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEM,
    });

    return [
        PASSWORD_HASH_ALGO,
        String(SCRYPT_N),
        String(SCRYPT_R),
        String(SCRYPT_P),
        salt.toString('base64'),
        derived.toString('base64'),
    ].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split('$');
    if (parts.length !== 6) return false;

    const [algo, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
    if (algo !== PASSWORD_HASH_ALGO) return false;

    const n = Number.parseInt(nRaw, 10);
    const r = Number.parseInt(rRaw, 10);
    const p = Number.parseInt(pRaw, 10);
    if (![n, r, p].every((v) => Number.isFinite(v) && v > 0)) return false;

    let salt: Buffer;
    let expectedHash: Buffer;
    try {
        salt = Buffer.from(saltB64, 'base64');
        expectedHash = Buffer.from(hashB64, 'base64');
    } catch {
        return false;
    }

    if (!salt.length || !expectedHash.length) return false;

    const actualHash = await scryptAsync(password, salt, expectedHash.length, {
        N: n,
        r,
        p,
        maxmem: SCRYPT_MAX_MEM,
    });

    if (actualHash.length !== expectedHash.length) return false;
    return timingSafeEqual(actualHash, expectedHash);
}
