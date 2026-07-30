import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// N=16384 (2^14), r=8, p=1: parâmetros interativos padrão do scrypt (custo
// de CPU/memória equilibrado para login, sem depender do default implícito
// do Node caso ele mude entre versões).
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derivedKey = await scryptAsync(password, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected);
}
