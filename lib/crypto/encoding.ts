import type { CryptoResult, Step } from "./types";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const bin8 = (b: number) => b.toString(2).padStart(8, "0");

export function base64Encode(text: string): CryptoResult {
  const bytes = Buffer.from(text, "utf8");
  const result = bytes.toString("base64");
  const rows: string[][] = [["Input bytes (8-bit)", "6-bit groups → index → char"]];
  for (let i = 0; i < bytes.length && i < 30; i += 3) {
    const chunk = bytes.subarray(i, i + 3);
    const bits = [...chunk].map(bin8).join("");
    const groups = (bits.match(/.{1,6}/g) ?? []).map((g) => g.padEnd(6, "0"));
    rows.push([[...chunk].map(bin8).join(" "), groups.map((g) => `${g}=${parseInt(g, 2)}→${B64[parseInt(g, 2)]}`).join("  ")]);
  }
  const steps: Step[] = [
    `Convert the text to UTF-8 bytes: ${[...bytes].join(" ")}`,
    "Split the bits into groups of 6 and map each group to the Base64 alphabet (A–Z, a–z, 0–9, +, /).",
    { text: `Per 3-byte block${bytes.length > 30 ? " (first 30 bytes)" : ""}:`, table: rows },
    "If the last block has fewer than 3 bytes, '=' padding is added.",
    `Result: ${result}`,
  ];
  return { result, steps };
}

export function base64Decode(text: string): CryptoResult {
  const clean = text.trim().replace(/\s+/g, "");
  const bytes = Buffer.from(clean.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const result = bytes.toString("utf8");
  const rows: string[][] = [["Char", "Index", "6 bits"]];
  for (const ch of clean.replace(/=+$/, "").slice(0, 24)) {
    const idx = B64.indexOf(ch);
    rows.push([ch, String(idx), idx >= 0 ? idx.toString(2).padStart(6, "0") : "?"]);
  }
  return {
    result,
    steps: [
      `Remove whitespace and padding: ${clean.replace(/=+$/, "")}`,
      { text: "Look up each character's 6-bit value" + (clean.length > 24 ? " (first 24)" : "") + ":", table: rows },
      "Concatenate all bits and regroup them into 8-bit bytes (dropping leftover bits).",
      `Bytes: ${[...bytes].join(" ")}`,
      `Decode as UTF-8: ${result}`,
    ],
  };
}

export function hexEncode(text: string): CryptoResult {
  const bytes = Buffer.from(text, "utf8");
  const rows = [["Char", "Byte (dec)", "Hex"], ...[...text].slice(0, 40).map((c) => [c, String(Buffer.from(c)[0]), Buffer.from(c).toString("hex")])];
  const result = bytes.toString("hex");
  return { result, steps: ["Convert each character to its UTF-8 byte and write the byte as two hex digits.", { text: "Mapping:", table: rows }, `Result: ${result}`] };
}

export function hexDecode(text: string): CryptoResult {
  const clean = text.replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  const even = clean.length % 2 ? clean.slice(0, -1) : clean;
  const bytes = Buffer.from(even, "hex");
  const pairs = even.match(/.{2}/g) ?? [];
  const rows = [["Hex", "Decimal", "Char"], ...pairs.slice(0, 40).map((p) => [p, String(parseInt(p, 16)), String.fromCharCode(parseInt(p, 16))])];
  const result = bytes.toString("utf8");
  return { result, steps: ["Strip separators and any 0x prefixes, then group the hex digits in pairs (one byte each).", { text: "Mapping:", table: rows }, `Decode bytes as UTF-8: ${result}`] };
}

export function binaryEncode(text: string): CryptoResult {
  const bytes = Buffer.from(text, "utf8");
  const rows = [["Byte (dec)", "Binary"], ...[...bytes].slice(0, 40).map((b) => [String(b), bin8(b)])];
  const result = [...bytes].map(bin8).join(" ");
  return { result, steps: ["Convert the text to UTF-8 bytes, then write each as 8 bits.", { text: "Mapping:", table: rows }, `Result: ${result}`] };
}

export function binaryDecode(text: string): CryptoResult {
  const bits = text.replace(/[^01]/g, "");
  const groups = bits.match(/.{1,8}/g) ?? [];
  const bytes = Buffer.from(groups.map((g) => parseInt(g.padEnd(8, "0"), 2)));
  const rows = [["Binary", "Decimal"], ...groups.slice(0, 40).map((g) => [g, String(parseInt(g, 2))])];
  const result = bytes.toString("utf8");
  return { result, steps: ["Remove spaces and split the bits into groups of 8.", { text: "Mapping:", table: rows }, `Decode bytes as UTF-8: ${result}`] };
}

export function urlEncode(text: string): CryptoResult {
  const result = encodeURIComponent(text);
  return { result, steps: ["Every character that is not unreserved (A–Z a–z 0–9 - _ . ! ~ * ' ( )) is replaced by % followed by the hex of its UTF-8 bytes.", `Result: ${result}`] };
}

export function urlDecode(text: string): CryptoResult {
  let result: string;
  try {
    result = decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    result = unescape(text);
  }
  return { result, steps: ["Replace each %XX with the byte it represents ('+' becomes a space).", "Decode the bytes as UTF-8.", `Result: ${result}`] };
}

const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--",
  N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...",
  ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-", '"': ".-..-.", "@": ".--.-.",
};
const REV: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export function morseEncode(text: string): CryptoResult {
  const rows: string[][] = [["Char", "Morse"]];
  const words = text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      [...w]
        .map((c) => {
          const m = MORSE[c];
          if (m) rows.push([c, m]);
          return m ?? "";
        })
        .filter(Boolean)
        .join(" ")
    );
  const result = words.join(" / ");
  return { result, steps: ["Look up each character in the Morse table. Letters are separated by spaces, words by ' / '.", { text: "Mapping:", table: rows }, `Result: ${result}`] };
}

export function morseDecode(text: string): CryptoResult {
  const rows: string[][] = [["Morse", "Char"]];
  const result = text
    .trim()
    .split(/\s*(?:\/|\s{3,}|\|)\s*/)
    .map((w) =>
      w
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => {
          const c = REV[code.replace(/[·•]/g, ".").replace(/[–—_]/g, "-")] ?? "?";
          rows.push([code, c]);
          return c;
        })
        .join("")
    )
    .join(" ");
  return { result, steps: ["Split into words on '/' and into letters on spaces.", { text: "Mapping:", table: rows }, `Result: ${result}`] };
}
