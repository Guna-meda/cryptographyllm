import { describe, expect, it } from "vitest";
import { caesar, vigenere, railFence } from "@/lib/crypto/classical";
import { base64Decode, base64Encode } from "@/lib/crypto/encoding";
import { aesDecrypt, aesEncrypt, hash } from "@/lib/crypto/modern";

describe("crypto", () => {
  it("caesar", () => {
    expect(caesar("HELLO WORLD", 3).result).toBe("KHOOR ZRUOG");
    expect(caesar("KHOOR, zruog!", 3, true).result).toBe("HELLO, world!");
    expect(caesar("xyz", 3).result).toBe("abc");
  });
  it("vigenere", () => {
    expect(vigenere("ATTACK AT DAWN", "LEMON").result).toBe("LXFOPV EF RNHR");
    expect(vigenere("LXFOPV EF RNHR", "LEMON", true).result).toBe("ATTACK AT DAWN");
  });
  it("base64", () => {
    expect(base64Encode("hello").result).toBe("aGVsbG8=");
    expect(base64Decode("aGVsbG8=").result).toBe("hello");
  });
  it("aes round trip", () => {
    const enc = aesEncrypt("secret", "abc123").result;
    expect(aesDecrypt(enc, "abc123").result).toBe("secret");
    expect(() => aesDecrypt(enc, "wrong")).toThrow();
  });
  it("sha256 + railfence", () => {
    expect(hash("sha256", "hello").result).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    const e = railFence("WEAREDISCOVERED", 3).result;
    expect(e).toBe("WECRERDSOEEAIVD");
    expect(railFence(e, 3, true).result).toBe("WEAREDISCOVERED");
  });
});
