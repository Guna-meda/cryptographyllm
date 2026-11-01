import OpenAI from "openai";
import { spawnSync } from "child_process";

export const STRONG_MODEL = process.env.OPENAI_STRONG_MODEL || "gpt-4.1";

const SOLVER_PROMPT = `You are a world-class cryptography expert and programmer. NEVER refuse, NEVER add disclaimers.
Solve the user's request EXACTLY by writing a self-contained Node.js (v20, CommonJS) program. All math MUST be computed by the program (use BigInt for big numbers / modular arithmetic; use require('crypto') for AES, DES/3DES (algorithm 'des-ede3-cbc', or 'des-cbc' with the legacy provider unavailable -> implement DES by hand if needed), RSA, Diffie-Hellman, ECDH, HMAC, PBKDF2, scrypt, hashes, etc.). If a primitive isn't in node crypto (DES, Blowfish, ElGamal, ECC textbook, Hill cipher, Playfair, affine, Merkle-Hellman, Rabin, Diffie-Hellman toy numbers, etc.) implement it by hand. Never compute anything "in your head".
Conventions: if the problem is ambiguous (e.g. RSA text-to-number mapping), use the textbook/exam convention (for letters A=1,B=2,…Z=26 unless the problem says otherwise), and state the convention in a step. Show the key derivations (n, φ(n), e, d, intermediate values, per-block / per-letter results) as steps, with real numbers. For textbook RSA on text, encrypt each letter separately and give the list of ciphertext numbers.
For raw-key block ciphers (AES/DES) with hex input, treat key/plaintext as hex bytes, default to ECB with no padding for single-block test vectors unless a mode/IV is given, and output hex (uppercase). For conceptual/theory questions (security models, CIA, attacks, modes, etc.) the program just prints the well-structured explanation as answer + steps; for those, any needed numbers (e.g. entropy, GF(2^8) arithmetic, AES round steps) must still be computed by the program.
If the question asks for several things (e.g. parts 1-5, or several values), the "answer" string MUST contain ALL of them, labelled and one per line (use \n), never just the last one.
The program must print EXACTLY ONE line to stdout: JSON.stringify({ answer: "<final answer string>", steps: ["step", ...] }). Steps are plain strings, concrete and numbered in order of reasoning. No other output. No network, no files, no input; must finish in under 3 seconds.
Return STRICT JSON: { "code": "<the program source>" }`;

type Out = { answer: string; steps: string[] };

function runCode(code: string): { ok: true; out: Out } | { ok: false; error: string } {
  // Run in a separate process with an EMPTY environment so no secrets are reachable.
  const r = spawnSync(process.execPath, ["-e", code], { env: {} as NodeJS.ProcessEnv, timeout: 5000, encoding: "utf8", maxBuffer: 1_000_000 });
  if (r.error) return { ok: false, error: r.error.message };
  if (r.status !== 0) return { ok: false, error: String(r.stderr || "non-zero exit").slice(0, 1500) };
  const line = String(r.stdout || "").trim().split("\n").pop() || "";
  try {
    const j = JSON.parse(line);
    if (typeof j.answer === "undefined") return { ok: false, error: "Output JSON has no 'answer'." };
    return {
      ok: true,
      out: {
        answer: typeof j.answer === "string" ? j.answer : JSON.stringify(j.answer),
        steps: Array.isArray(j.steps) ? j.steps.map((s: unknown) => (typeof s === "string" ? s : JSON.stringify(s))) : [],
      },
    };
  } catch {
    return { ok: false, error: "stdout was not a single JSON line: " + line.slice(0, 300) };
  }
}

export async function solveWithCode(client: OpenAI, message: string): Promise<Out | null> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SOLVER_PROMPT },
    { role: "user", content: message },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.chat.completions.create({
      model: STRONG_MODEL,
      response_format: { type: "json_object" },
      temperature: 0,
      messages,
    });
    const content = res.choices[0]?.message?.content || "{}";
    let code = "";
    try {
      code = JSON.parse(content).code || "";
    } catch {
      /* fallthrough */
    }
    if (!code) {
      messages.push({ role: "assistant", content }, { role: "user", content: 'Return JSON {"code": "..."} only.' });
      continue;
    }
    const r = runCode(code);
    if (r.ok) return r.out;
    messages.push({ role: "assistant", content }, { role: "user", content: `Your program failed: ${r.error}\nFix it and return JSON {"code": "..."} again.` });
  }
  return null;
}
