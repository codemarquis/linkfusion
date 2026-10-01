/** Password hashing with scrypt (no native dependencies). Format: scrypt$N$r$p$salt$hash */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15;
const r = 8;
const p = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * N * r * 2;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r, p, maxmem: MAX_MEM });
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Spend the same time as a real check so response time doesn't reveal whether an account exists.
    await derive(password, randomBytes(16), { N, r, p, maxmem: MAX_MEM });
    return false;
  }
  const [scheme, n, rr, pp, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
    maxmem: 128 * Number(n) * Number(rr) * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
