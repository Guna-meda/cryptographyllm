"use client";

import { useEffect, useRef, useState } from "react";

type Step = string | { text: string; table?: string[][] };
type Bot = { answer: string; steps: Step[]; explanation: string; algorithm: string };
type Msg = { role: "user"; text: string } | { role: "bot"; data: Bot } | { role: "error"; text: string };

const EXAMPLES = [
  "encrypt HELLO WORLD with caesar shift 3",
  "KHOOR ZRUOG decode caesar",
  "vigenere LEMON attack at dawn",
  "base64 of hello",
  "sha256 hello",
  "AES encrypt secret with password abc123",
];

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="shrink-0 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-400/20"
    >
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}

function BotCard({ d }: { d: Bot }) {
  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-emerald-300">Final answer</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">{d.algorithm}</span>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-sm text-emerald-100">{d.answer}</pre>
        <CopyButton text={d.answer} />
      </div>

      {d.steps.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Steps</div>
          <ol className="space-y-3">
            {d.steps.map((s, i) => {
              const text = typeof s === "string" ? s : s.text;
              const table = typeof s === "string" ? undefined : s.table;
              return (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] text-zinc-300">{i + 1}</span>
                  <div className="min-w-0 flex-1 text-sm text-zinc-300">
                    <p className="whitespace-pre-wrap break-words">{text}</p>
                    {table && table.length > 1 && (
                      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-white/10">
                        <table className="w-full text-left font-mono text-xs">
                          <thead className="sticky top-0 bg-zinc-900 text-zinc-400">
                            <tr>
                              {table[0].map((h, j) => (
                                <th key={j} className="px-2 py-1.5 font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.slice(1).map((row, r) => (
                              <tr key={r} className="border-t border-white/5">
                                {row.map((c, j) => (
                                  <td key={j} className="whitespace-pre-wrap break-all px-2 py-1">{c}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {d.explanation && (
        <div className="mt-5 rounded-xl bg-white/[0.04] p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">Explanation</div>
          <p className="text-sm text-zinc-300">{d.explanation}</p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || "Request failed.");
      setMsgs((m) => [...m, { role: "bot", data }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "error", text: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header className="py-5 text-center">
        <h1 className="text-lg font-semibold tracking-tight">🔐 Crypto Chat</h1>
      </header>

      <main className="flex-1 space-y-4 pb-6">
        {msgs.length === 0 && (
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">Ask anything cryptography</h2>
            <p className="mt-2 text-sm text-zinc-400">Encrypt, decrypt, encode, hash or crack — with a clear step-by-step breakdown.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-300 hover:border-emerald-400/40 hover:bg-emerald-400/10"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-emerald-500/20 px-4 py-2 text-sm text-emerald-50">{m.text}</div>
            </div>
          ) : m.role === "bot" ? (
            <BotCard key={i} d={m.data} />
          ) : (
            <div key={i} className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">⚠️ {m.text}</div>
          )
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Working on it…
          </div>
        )}
        <div ref={endRef} />
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12] to-transparent pb-5 pt-3"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-zinc-900 p-2 focus-within:border-emerald-400/50">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="e.g. encrypt HELLO WORLD with caesar shift 3"
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
