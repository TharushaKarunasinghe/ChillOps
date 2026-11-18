export const PASSWORD_ITERATIONS = 100_000;
export const PASSWORD_SALT_BYTES = 16;
export const PASSWORD_HASH_BYTES = 32;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
  needsRehash(stored: string): boolean;
}

export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error('Invalid password encoding.');
  const bytes = Uint8Array.from(
    atob(value.replaceAll('-', '+').replaceAll('_', '/')),
    (char) => char.charCodeAt(0),
  );
  if (base64url(bytes) !== value) throw new Error('Invalid password encoding.');
  return bytes;
}

function parse(stored: string) {
  const [algorithm, count, salt, hash, extra] = stored.split('$');
  if (
    algorithm !== 'pbkdf2-sha256' ||
    !count ||
    !/^[1-9]\d*$/.test(count) ||
    !salt ||
    !hash ||
    extra !== undefined
  )
    throw new Error('Invalid password format.');
  const iterations = Number(count);
  // Read the stored cost, not the current write policy, to permit upgrades.
  if (!Number.isSafeInteger(iterations) || iterations > 0xffffffff)
    throw new Error('Invalid password cost.');
  const saltBytes = decode(salt),
    hashBytes = decode(hash);
  if (
    saltBytes.length !== PASSWORD_SALT_BYTES ||
    hashBytes.length !== PASSWORD_HASH_BYTES
  )
    throw new Error('Invalid password length.');
  return { iterations, salt: saltBytes, hash: hashBytes };
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      key,
      PASSWORD_HASH_BYTES * 8,
    ),
  );
}

type ConstantTimeEqual = (
  a: Uint8Array<ArrayBuffer>,
  b: Uint8Array<ArrayBuffer>,
) => boolean;
const workerEqual: ConstantTimeEqual = (a, b) =>
  (
    crypto.subtle as SubtleCrypto & { timingSafeEqual: ConstantTimeEqual }
  ).timingSafeEqual(a, b);

export function createPasswordHasher(
  equal: ConstantTimeEqual = workerEqual,
): PasswordHasher {
  return {
    async hash(password) {
      const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
      const hash = await derive(password, salt, PASSWORD_ITERATIONS);
      return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${base64url(salt)}$${base64url(hash)}`;
    },
    async verify(password, stored) {
      let parsed;
      try {
        parsed = parse(stored);
      } catch {
        return false;
      }
      const actual = await derive(password, parsed.salt, parsed.iterations);
      return equal(actual, parsed.hash);
    },
    needsRehash(stored) {
      return parse(stored).iterations !== PASSWORD_ITERATIONS;
    },
  };
}

// Valid, fixed-cost dummy record. It is not an account and can never authenticate.
export const DUMMY_PASSWORD_HASH = `pbkdf2-sha256$${PASSWORD_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
