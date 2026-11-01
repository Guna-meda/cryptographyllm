import type { CryptoResult, Step } from "./types";

const A = "A".charCodeAt(0);
const a = "a".charCodeAt(0);

function shiftChar(ch: string, k: number): string | null {
  const c = ch.charCodeAt(0);
  if (c >= A && c < A + 26) return String.fromCharCode(((((c - A + k) % 26) + 26) % 26) + A);
  if (c >= a && c < a + 26) return String.fromCharCode(((((c - a + k) % 26) + 26) % 26) + a);
  return null;
}

export function caesar(text: string, shift: number, decrypt = false): CryptoResult {
  const k = decrypt ? -shift : shift;
  const rows: string[][] = [["Char", "Position", `Position ${k >= 0 ? "+" : "-"} ${Math.abs(k)} (mod 26)`, "Result"]];
  let out = "";
  for (const ch of text) {
    const r = shiftChar(ch, k);
    if (r === null) {
      out += ch;
    } else {
      const base = ch === ch.toUpperCase() ? A : a;
      const pos = ch.charCodeAt(0) - base;
      rows.push([ch, String(pos), String((((pos + k) % 26) + 26) % 26), r]);
      out += r;
    }
  }
  const steps: Step[] = [
    `Mode: ${decrypt ? "decrypt" : "encrypt"} with shift ${shift}. Each letter moves ${Math.abs(k)} place(s) ${k >= 0 ? "forward" : "backward"} in the alphabet (A=0 … Z=25), wrapping around.`,
    "Case is preserved; spaces, digits and punctuation are left unchanged.",
    { text: "Letter-by-letter mapping:", table: rows },
    `Joined result: ${out}`,
  ];
  return { result: out, steps };
}

export function caesarCrack(text: string): CryptoResult {
  const rows: string[][] = [["Shift", "Decrypted text"]];
  for (let s = 1; s <= 25; s++) rows.push([String(s), caesar(text, s, true).result]);
  return {
    result: rows.slice(1).map((r) => `${r[0]}: ${r[1]}`).join("\n"),
    steps: [
      "Caesar has only 25 useful shifts, so we simply try every one (brute force).",
      { text: "All candidates:", table: rows },
      "Read down the list and pick the shift that gives readable text.",
    ],
  };
}

export function rot13(text: string): CryptoResult {
  const r = caesar(text, 13);
  return {
    result: r.result,
    steps: ["ROT13 is a Caesar cipher with shift 13. Applying it twice returns the original, so encrypt = decrypt.", ...r.steps.slice(1)],
  };
}

export function atbash(text: string): CryptoResult {
  const rows: string[][] = [["Char", "Mirror"]];
  let out = "";
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    let r = ch;
    if (c >= A && c < A + 26) r = String.fromCharCode(A + 25 - (c - A));
    else if (c >= a && c < a + 26) r = String.fromCharCode(a + 25 - (c - a));
    if (/[a-z]/i.test(ch)) rows.push([ch, r]);
    out += r;
  }
  return {
    result: out,
    steps: [
      "Atbash mirrors the alphabet: A↔Z, B↔Y, C↔X … It is its own inverse, so encrypt = decrypt.",
      { text: "Mapping:", table: rows },
      `Joined result: ${out}`,
    ],
  };
}

export function vigenere(text: string, key: string, decrypt = false): CryptoResult {
  const k = key.replace(/[^a-z]/gi, "").toUpperCase() || "A";
  const rows: string[][] = [["Char", "Key letter", "Shift", "Result"]];
  let out = "";
  let i = 0;
  for (const ch of text) {
    if (/[a-z]/i.test(ch)) {
      const kl = k[i % k.length];
      const s = (kl.charCodeAt(0) - A) * (decrypt ? -1 : 1);
      const r = shiftChar(ch, s)!;
      rows.push([ch, kl, String(s), r]);
      out += r;
      i++;
    } else out += ch;
  }
  return {
    result: out,
    steps: [
      `Key (letters only, uppercased): ${k}. Each key letter gives a shift (A=0 … Z=25).`,
      `The key repeats over the letters of the text only (non-letters are skipped and don't consume key letters). Mode: ${decrypt ? "decrypt (subtract shift)" : "encrypt (add shift)"}.`,
      { text: "Letter-by-letter mapping:", table: rows },
      `Joined result: ${out}`,
    ],
  };
}

export function railFence(text: string, rails: number, decrypt = false): CryptoResult {
  const n = Math.max(2, Math.min(Math.floor(rails) || 3, Math.max(2, text.length)));
  const chars = [...text];
  const len = chars.length;
  const pattern: number[] = [];
  let r = 0;
  let dir = 1;
  for (let i = 0; i < len; i++) {
    pattern.push(r);
    if (r === 0) dir = 1;
    else if (r === n - 1) dir = -1;
    r += dir;
  }
  const steps: Step[] = [`Using ${n} rails. Characters zig-zag down and up across the rails.`];
  let out: string;
  if (!decrypt) {
    const lines: string[][] = Array.from({ length: n }, () => []);
    chars.forEach((c, i) => lines[pattern[i]].push(c));
    out = lines.map((l) => l.join("")).join("");
    steps.push({ text: "Characters on each rail:", table: [["Rail", "Characters"], ...lines.map((l, i) => [String(i + 1), l.join("")])] });
    steps.push(`Read rails top to bottom: ${out}`);
  } else {
    const counts: number[] = Array(n).fill(0);
    pattern.forEach((p) => counts[p]++);
    const rails2: string[][] = [];
    let idx = 0;
    for (let i = 0; i < n; i++) {
      rails2.push(chars.slice(idx, idx + counts[i]));
      idx += counts[i];
    }
    steps.push({ text: "Split ciphertext into rails by length:", table: [["Rail", "Characters"], ...rails2.map((l, i) => [String(i + 1), l.join("")])] });
    const ptr: number[] = Array(n).fill(0);
    out = pattern.map((p) => rails2[p][ptr[p]++]).join("");
    steps.push(`Read the zig-zag path to rebuild the text: ${out}`);
  }
  return { result: out, steps };
}

export function xorCipher(text: string, key: string, decrypt = false): CryptoResult {
  const k = key || "key";
  const kb = Buffer.from(k, "utf8");
  const steps: Step[] = [`XOR each byte of the data with the repeating key "${k}".`];
  let inputBytes: Buffer;
  if (decrypt) {
    const clean = text.replace(/\s+/g, "");
    inputBytes = /^[0-9a-f]+$/i.test(clean) && clean.length % 2 === 0 ? Buffer.from(clean, "hex") : Buffer.from(clean, "base64");
    steps.push("Input interpreted as hex (or base64) ciphertext bytes.");
  } else inputBytes = Buffer.from(text, "utf8");
  const out = Buffer.alloc(inputBytes.length);
  const rows: string[][] = [["Byte", "Key byte", "XOR"]];
  for (let i = 0; i < inputBytes.length; i++) {
    out[i] = inputBytes[i] ^ kb[i % kb.length];
    if (i < 32) rows.push([inputBytes[i].toString(2).padStart(8, "0"), kb[i % kb.length].toString(2).padStart(8, "0"), out[i].toString(2).padStart(8, "0")]);
  }
  steps.push({ text: `Byte-by-byte XOR${inputBytes.length > 32 ? " (first 32 bytes)" : ""}:`, table: rows });
  const result = decrypt ? out.toString("utf8") : out.toString("hex");
  steps.push(decrypt ? `Bytes decoded as UTF-8: ${result}` : `Result bytes shown as hex: ${result}`);
  return { result, steps };
}
