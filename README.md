# Crypto Chat

A chatbot-style web app for cryptography. Type or paste anything ("encrypt HELLO with caesar shift 3", "sha256 hello", a raw encoded string…) and get a highlighted final answer plus a numbered step-by-step breakdown.

OpenAI figures out *what* you want; the maths is done by deterministic TypeScript in `lib/crypto/` (Caesar, ROT13, Atbash, Vigenère, Base64, Hex, Binary, URL, Morse, SHA/MD5, AES-256-GCM, Rail fence, XOR). Anything else is solved by OpenAI directly.

## Run locally

```bash
npm i
cp .env.example .env.local   # then put your key in OPENAI_API_KEY
npm run dev
```

Open http://localhost:3000. Run tests with `npm test`.

## Deploy to Vercel

1. Import this repo in Vercel.
2. Add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) under Environment Variables.
3. Deploy.
