import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The encrypt-then-MAC envelope intake link tokens are carried in. (Ported from DentalOS.)
 *
 *   base64( json({ iv, value, mac, tag }) )
 *
 * `iv` and `value` are base64; the cipher is AES-256-CBC with PKCS#7 padding;
 * `tag` is empty, because AES-CBC is not an AEAD mode; and
 *
 *   mac = HMAC-SHA256( iv_base64 ‖ value_base64, key )
 *
 * The key is `APP_KEY` from .env.
 *
 * ## The two properties that are load-bearing
 *
 *  1. **The MAC is verified before decrypting.** It is what stops a forged or
 *     tampered token from ever reaching the cipher, and a padding oracle with it.
 *  2. **The comparison is constant time.** A byte-by-byte comparison leaks how
 *     much of a guess was right, which turns forgery from infeasible into a few
 *     thousand requests.
 */

/** `base64:…` as it appears in APP_KEY, or a bare base64 key. */
export function decodeAppKey(appKey: string): Buffer {
  const raw = appKey.startsWith("base64:") ? appKey.slice(7) : appKey;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`APP_KEY must decode to 32 bytes for AES-256-CBC; got ${key.length}.`);
  }
  return key;
}

export function encryptString(plaintext: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const value = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64");
  const ivB64 = iv.toString("base64");

  const payload = {
    iv: ivB64,
    value,
    mac: hmac(ivB64, value, key),
    tag: "",
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

class InvalidPayload extends Error {}

export function decryptString(token: string, key: Buffer): string {
  let payload: { iv?: unknown; value?: unknown; mac?: unknown };
  try {
    payload = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
  } catch {
    throw new InvalidPayload("The payload is invalid.");
  }

  const { iv, value, mac } = payload;
  if (typeof iv !== "string" || typeof value !== "string" || typeof mac !== "string") {
    throw new InvalidPayload("The payload is invalid.");
  }

  if (!validMac(iv, value, mac, key)) throw new InvalidPayload("The MAC is invalid.");

  const ivBuffer = Buffer.from(iv, "base64");
  if (ivBuffer.length !== 16) throw new InvalidPayload("The payload is invalid.");

  try {
    const decipher = createDecipheriv("aes-256-cbc", key, ivBuffer);
    return Buffer.concat([decipher.update(Buffer.from(value, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new InvalidPayload("Could not decrypt the data.");
  }
}

function hmac(iv: string, value: string, key: Buffer): string {
  return createHmac("sha256", key).update(iv + value).digest("hex");
}

function validMac(iv: string, value: string, mac: string, key: Buffer): boolean {
  const expected = Buffer.from(hmac(iv, value, key), "utf8");
  const actual = Buffer.from(mac, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
