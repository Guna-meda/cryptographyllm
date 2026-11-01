import crypto from "crypto";
import type { CryptoResult } from "./types";

export function hash(algo: "sha1" | "sha256" | "sha512" | "md5", text: string): CryptoResult {
  const names = { sha1: "SHA-1", sha256: "SHA-256", sha512: "SHA-512", md5: "MD5" };
  const sizes = { sha1: 160, sha256: 256, sha512: 512, md5: 128 };
  const result = crypto.createHash(algo).update(text, "utf8").digest("hex");
  return {
    result,
    steps: [
      `Take the input as UTF-8 bytes (${Buffer.byteLength(text)} bytes): "${text}".`,
      `Feed the bytes through ${names[algo]}, which pads the message and processes it in blocks through many rounds of bitwise operations.`,
      `The final ${sizes[algo]}-bit digest is written as ${sizes[algo] / 4} hex characters: ${result}`,
      "Hashes are one-way: the original text cannot be computed back from the digest (only guessed and compared).",
    ],
  };
}

const ITER = 100_000;

export function aesEncrypt(text: string, password: string): CryptoResult {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, ITER, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const result = Buffer.concat([salt, iv, tag, enc]).toString("base64");
  return {
    result,
    steps: [
      `Generate a random 16-byte salt (${salt.toString("hex")}) and a random 12-byte IV (${iv.toString("hex")}).`,
      `Derive a 256-bit key from the password with PBKDF2-HMAC-SHA256 (${ITER.toLocaleString("en-US")} iterations, using the salt).`,
      "Encrypt the UTF-8 text with AES-256-GCM using that key and IV; GCM also produces a 16-byte authentication tag.",
      `Pack salt (16) + IV (12) + tag (16) + ciphertext (${enc.length}) into one buffer.`,
      `Base64-encode the buffer: ${result}`,
      "Because salt and IV are random, encrypting the same text again gives a different output. Decryption needs the same password.",
    ],
  };
}

export function aesDecrypt(b64: string, password: string): CryptoResult {
  const buf = Buffer.from(b64.trim().replace(/\s+/g, ""), "base64");
  if (buf.length < 44) throw new Error("Ciphertext is too short to be valid AES output from this app.");
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const enc = buf.subarray(44);
  const key = crypto.pbkdf2Sync(password, salt, ITER, 32, "sha256");
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  let result: string;
  try {
    result = Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    throw new Error("Decryption failed: wrong password or corrupted ciphertext.");
  }
  return {
    result,
    steps: [
      "Base64-decode the input into bytes.",
      `Split: salt = ${salt.toString("hex")}, IV = ${iv.toString("hex")}, tag = ${tag.toString("hex")}, ciphertext = ${enc.length} bytes.`,
      `Re-derive the key with PBKDF2-HMAC-SHA256 (${ITER.toLocaleString("en-US")} iterations) from the password and salt.`,
      "Decrypt with AES-256-GCM, verifying the authentication tag (this fails if the password is wrong).",
      `Decode the plaintext bytes as UTF-8: ${result}`,
    ],
  };
}
