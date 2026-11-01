import type { CryptoResult, Params } from "./types";
import { atbash, caesar, caesarCrack, railFence, rot13, vigenere, xorCipher } from "./classical";
import { base64Decode, base64Encode, binaryDecode, binaryEncode, hexDecode, hexEncode, morseDecode, morseEncode, urlDecode, urlEncode } from "./encoding";
import { aesDecrypt, aesEncrypt, hash } from "./modern";

const isDecode = (op: string) => ["decrypt", "decode", "crack"].includes(op);

/** Returns null if the algorithm isn't handled deterministically. May throw on bad input. */
export function runCrypto(algorithm: string, p: Params): CryptoResult | null {
  const dec = isDecode(p.operation);
  switch (algorithm) {
    case "caesar":
      if (p.operation === "crack" || (dec && !Number.isFinite(p.shift))) return caesarCrack(p.text);
      return caesar(p.text, Number.isFinite(p.shift) ? (p.shift as number) : 3, dec);
    case "rot13":
      return rot13(p.text);
    case "atbash":
      return atbash(p.text);
    case "vigenere":
      return vigenere(p.text, p.key || "KEY", dec);
    case "base64":
      return dec ? base64Decode(p.text) : base64Encode(p.text);
    case "hex":
      return dec ? hexDecode(p.text) : hexEncode(p.text);
    case "binary":
      return dec ? binaryDecode(p.text) : binaryEncode(p.text);
    case "url":
      return dec ? urlDecode(p.text) : urlEncode(p.text);
    case "morse":
      return dec ? morseDecode(p.text) : morseEncode(p.text);
    case "sha1":
    case "sha256":
    case "sha512":
    case "md5":
      return hash(algorithm, p.text);
    case "aes":
      return dec ? aesDecrypt(p.text, p.key || "password") : aesEncrypt(p.text, p.key || "password");
    case "railfence": {
      const rails = Number.isFinite(p.shift) && p.shift ? (p.shift as number) : p.key ? parseInt(p.key, 10) || 3 : 3;
      return railFence(p.text, rails, dec);
    }
    case "xor":
      return xorCipher(p.text, p.key || "key", dec);
    default:
      return null;
  }
}

export type { CryptoResult, Step, Params } from "./types";
