import { NextResponse } from "next/server";
import OpenAI from "openai";
import { runCrypto } from "@/lib/crypto";
import type { Step } from "@/lib/crypto";
import { solveWithCode, STRONG_MODEL } from "@/lib/solve";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const CLASSIFY_PROMPT = `You are the request parser for a cryptography assistant. You NEVER refuse and NEVER say "unknown" or "not crypto".
Given the user's message, return STRICT JSON:
{ "algorithm": "caesar|rot13|atbash|vigenere|base64|hex|binary|url|morse|sha1|sha256|sha512|md5|aes|railfence|xor|other",
  "operation": "encrypt|decrypt|encode|decode|hash|crack|other",
  "text": "the exact payload text to process (without the instruction words)",
  "key": "key/password/keyword if any, else empty string",
  "shift": number (caesar shift, or number of rails for railfence; omit if not given) }
Rules: always pick the closest match; use "other" only if nothing fits. If the user pastes a raw encoded string with no instruction, guess the encoding and use operation "decode". If they say "crack"/"brute force" for caesar use operation "crack". For "caesar decode" with no shift given, use operation "crack". Hashing => operation "hash". Use "aes" ONLY for simple "encrypt/decrypt <text> with password <pw>" requests (or a base64 ciphertext produced by this app). If the user gives an explicit hex/raw key, IV, a mode (ECB/CBC/CTR/GCM), key size, rounds, test vectors, or asks about AES/DES internals, use "other". Anything about DES, 3DES, Hill, Playfair, affine, monoalphabetic, columnar, RSA, Diffie-Hellman, ECC, hashes' internals, math (gcd, totient, CRT, modular inverse...) or theory questions => "other". Keep "text" exactly as the user gave it (preserve case and punctuation).`;

const OTHER_PROMPT = `You are a cryptography expert and puzzle solver. You NEVER refuse, add disclaimers, or say you can't. Solve the user's request as best you can.
Return STRICT JSON: { "answer": "final answer as a string", "steps": ["step 1", "step 2", ...] } with clear, numbered-style steps (no numbering prefix needed).`;

const EXPLAIN_PROMPT = `In exactly 2 short, friendly lines, explain the cryptographic concept used (algorithm and what it does). Return STRICT JSON: { "explanation": "..." }`;

async function jsonCall(client: OpenAI, system: string, user: string, model: string = MODEL) {
  const res = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return JSON.parse(res.choices[0]?.message?.content || "{}");
}

export async function POST(req: Request) {
  let message = "";
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Please type something first." }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Message is too long (max 2000 characters)." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing. Add it to .env.local (or Vercel Environment Variables) and restart the server." },
      { status: 500 }
    );
  }
  const client = new OpenAI({ apiKey });

  try {
    const parsed = await jsonCall(client, CLASSIFY_PROMPT, message);
    const algorithm = String(parsed.algorithm || "other").toLowerCase();
    const operation = String(parsed.operation || "other").toLowerCase();
    const text = typeof parsed.text === "string" && parsed.text.length ? parsed.text : message;
    const key = parsed.key === undefined || parsed.key === null ? "" : String(parsed.key);
    const shift = parsed.shift === undefined || parsed.shift === null || parsed.shift === "" ? undefined : Number(parsed.shift);

    let answer = "";
    let steps: Step[] = [];
    let handled = false;

    // Built-in AES is password-based only; explicit keys/modes go to the code solver.
    const builtinOk = algorithm !== "aes" || /pass(word|phrase)?|pwd/i.test(message);
    try {
      const r = !builtinOk ? null : runCrypto(algorithm, { text, key, shift: Number.isFinite(shift) ? shift : undefined, operation });
      if (r) {
        answer = r.result;
        steps = r.steps;
        handled = true;
      }
    } catch (e) {
      // Deterministic engine failed on this input (e.g. wrong AES password): report clearly.
      const msg = e instanceof Error ? e.message : "Processing failed.";
      return NextResponse.json({ answer: msg, steps: [msg], explanation: "", algorithm });
    }

    if (!handled) {
      const solved = await solveWithCode(client, message);
      if (solved) {
        answer = solved.answer;
        steps = solved.steps;
      } else {
        const o = await jsonCall(client, OTHER_PROMPT, message, STRONG_MODEL);
        answer = typeof o.answer === "string" ? o.answer : JSON.stringify(o.answer ?? "");
        steps = Array.isArray(o.steps) ? o.steps.map((s: unknown) => (typeof s === "string" ? s : JSON.stringify(s))) : [];
      }
    }

    let explanation = "";
    try {
      const ex = await jsonCall(client, EXPLAIN_PROMPT, `Algorithm: ${algorithm}. Operation: ${operation}. User request: ${message}`);
      explanation = typeof ex.explanation === "string" ? ex.explanation : "";
    } catch {
      explanation = "";
    }

    return NextResponse.json({ answer, steps, explanation, algorithm: handled ? algorithm : "other" });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    let error = "Something went wrong talking to OpenAI. Please try again.";
    if (status === 401) error = "OpenAI rejected the API key (401). Check OPENAI_API_KEY.";
    else if (status === 429) error = "OpenAI rate limit or quota reached (429). Try again shortly or check your billing.";
    return NextResponse.json({ error }, { status: 500 });
  }
}
