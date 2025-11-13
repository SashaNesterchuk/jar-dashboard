const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD_HASH_HEX =
  "67948109603cfd0dfd716a6bbedf866028710dc613914e378b40f7ba62aa60ba";

export const SESSION_COOKIE_NAME = "mindjar_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const ADMIN_USERNAME_BYTES = TEXT_ENCODER.encode(ADMIN_USERNAME);
const ADMIN_PASSWORD_HASH_BYTES = hexToBytes(ADMIN_PASSWORD_HASH_HEX);

let cachedSecret: Uint8Array | null = null;
let cachedHmacKey: CryptoKey | null = null;

export interface SessionPayload {
  username: string;
  issuedAt: number;
  expiresAt: number;
}

function getSubtleCrypto(): SubtleCrypto {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }

  throw new Error("Web Crypto API is not available in this environment.");
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.toLowerCase();
  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

function getAuthSecret(): Uint8Array {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Please provide a strong secret in the environment."
    );
  }

  cachedSecret = TEXT_ENCODER.encode(secret);
  return cachedSecret;
}

async function getHmacKey(): Promise<CryptoKey> {
  if (cachedHmacKey) {
    return cachedHmacKey;
  }

  const subtle = getSubtleCrypto();
  const secretBytes = new Uint8Array(getAuthSecret());

  cachedHmacKey = await subtle.importKey(
    "raw",
    secretBytes,
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );

  return cachedHmacKey;
}

async function digestSha256(input: string): Promise<Uint8Array> {
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest("SHA-256", TEXT_ENCODER.encode(input));
  return new Uint8Array(digest);
}

async function signHmacBase64Url(message: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const key = await getHmacKey();
  const signature = await subtle.sign(
    "HMAC",
    key,
    TEXT_ENCODER.encode(message)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const usernameBytes = TEXT_ENCODER.encode(username);

  if (!timingSafeEqualBytes(usernameBytes, ADMIN_USERNAME_BYTES)) {
    return false;
  }

  const submittedHash = await digestSha256(password);

  return timingSafeEqualBytes(submittedHash, ADMIN_PASSWORD_HASH_BYTES);
}

export async function createSessionToken(
  username: string,
  ttlSeconds = SESSION_TTL_SECONDS
): Promise<string> {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlSeconds * 1000;

  const payload: SessionPayload = {
    username,
    issuedAt,
    expiresAt,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = base64UrlEncode(TEXT_ENCODER.encode(payloadJson));

  const signature = await signHmacBase64Url(payloadBase64);

  return `${payloadBase64}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadBase64, signature] = parts;
  const expectedSignature = await signHmacBase64Url(payloadBase64);

  const signatureBytes = TEXT_ENCODER.encode(signature);
  const expectedSignatureBytes = TEXT_ENCODER.encode(expectedSignature);

  if (!timingSafeEqualBytes(signatureBytes, expectedSignatureBytes)) {
    return null;
  }

  try {
    const payloadBytes = base64UrlDecodeToBytes(payloadBase64);
    const payloadJson = TEXT_DECODER.decode(payloadBytes);
    const payload = JSON.parse(payloadJson) as SessionPayload;

    if (typeof payload?.expiresAt !== "number") {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
