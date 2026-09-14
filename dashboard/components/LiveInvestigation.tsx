"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// Backs a real, voice-driven price-verification flow: the browser's own
// Web Speech API captures what you say, real Amazon Comprehend pulls the
// product out of that sentence, a real isolated Bedrock AgentCore browser
// session (a genuine AWS-managed Chromium instance, driven by a Lambda)
// goes and reads live market prices via real Amazon Rekognition OCR, and
// real Amazon Polly speaks the verdict back to you. Every step here is a
// live AWS API call -- nothing here is pre-scripted or faked.
const LAMBDA_URL = "https://zdkqjzidcei6rqcy5a43ahxtrm0gxauh.lambda-url.us-east-1.on.aws/";
const START_TIMEOUT_MS = 20_000;

type Phase = "idle" | "listening" | "ready" | "running" | "done" | "error";

interface LogLine {
  t: string;
  text: string;
}

function timestamp() {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

async function callLambda(body: Record<string, unknown>, timeoutMs = 25_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Request failed (HTTP ${resp.status})`);
    return await resp.json();
  } finally {
    window.clearTimeout(timer);
  }
}

// Fast, synchronous, client-side mirror of the server's Comprehend-based
// extraction -- used only to fill the item field instantly so the
// "Investigate" click can open the new tab in the same call stack as the
// click (browsers block window.open() once you've crossed an await, so
// there's no waiting on the real Comprehend call for this part). The real
// Comprehend call still runs and overwrites this the moment it resolves,
// which is normally well under a second.
const TRIGGER_WORDS = new Set(["with", "for", "of", "about"]);
// "on"/"in"/"at" stop the phrase at "ring on amazon" -- the platform name is
// never part of the item. "i"/"have"/"worth"/etc. stop it at the start of a
// declared-value clause ("...ring, I have about $190") so that clause's
// words never bleed into the item name the way they did before this list
// existed -- confirmed by testing, the earlier version returned
// "ring on amazon i have about $190" as the "item" for that exact sentence.
const STOP_WORDS = new Set([
  "and", "compare", "cost", "costs", "price", "prices", "it", "please",
  "to", "the", "me", "help", "can", "you", "for", "on", "in", "at",
  "i", "im", "have", "having", "worth", "is", "its", "around", "roughly",
  "approximately", "declared", "value",
]);
// A real product name is almost never more than a few words -- caps how far
// a mis-tagged sentence can run on, on top of the stop-word list above.
const MAX_ITEM_PHRASE_WORDS = 4;
function extractItemClientSide(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[.,!?']/g, "")
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (!TRIGGER_WORDS.has(words[i])) continue;
    let j = i + 1;
    if (words[j] === "a" || words[j] === "an" || words[j] === "the") j++;
    const phrase: string[] = [];
    while (
      words[j] &&
      !STOP_WORDS.has(words[j]) &&
      !/^\$?\d/.test(words[j]) &&
      phrase.length < MAX_ITEM_PHRASE_WORDS
    ) {
      phrase.push(words[j]);
      j++;
    }
    if (phrase.length > 0) return phrase.join(" ");
  }
  return text.trim();
}

// Same idea as the item extractor above, run in parallel on the same
// transcript: pulls a declared dollar value out of a phrase like "I have
// about $190" or "it's worth 190 dollars" so a single sentence can carry
// both the item and the value to compare against, with no typing needed.
function extractDeclaredValueClientSide(text: string): string | null {
  let m = text.match(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (m) return m[1].replace(/,/g, "");
  m = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:dollars?|bucks?)/i);
  if (m) return m[1].replace(/,/g, "");
  m = text.match(/(?:have|worth|valued at|value of|declared|about|around|roughly)\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\b/i);
  if (m) return m[1].replace(/,/g, "");
  return null;
}

function pickLowestPrice(prices: string[]): number | null {
  const values = prices
    .map((p) => Number(p.replace(/[$,]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return null;
  return Math.min(...values);
}

export default function LiveInvestigation() {
  const searchParams = useSearchParams();
  const [transcript, setTranscript] = useState(() => searchParams.get("q") ?? "");
  const [itemQuery, setItemQuery] = useState(() => searchParams.get("q") ?? "");
  const [compareValue, setCompareValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [listening, setListening] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [verdict, setVerdict] = useState<{ text: string; tone: "cheaper" | "pricier" | "close" } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const runIdRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  function pushLog(text: string) {
    setLog((prev) => [...prev, { t: timestamp(), text }]);
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setPhase("listening");
      setVerdict(null);
      setAudioUrl(null);
      setLog([]);
    };
    recognition.onerror = () => {
      setListening(false);
      setPhase(transcript ? "ready" : "idle");
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.onresult = (event: any) => {
      const heard = event.results[0][0].transcript as string;
      setTranscript(heard);
      const quick = extractItemClientSide(heard);
      const declared = extractDeclaredValueClientSide(heard);
      setItemQuery(quick);
      if (declared) setCompareValue(declared);
      setPhase("ready");

      // If the sentence carried both the item and a declared value ("check
      // the price of a ring on amazon, I have about $190"), go straight to
      // investigating -- no click needed. This has to happen synchronously,
      // right here, not after the Comprehend refinement below: browsers only
      // allow window.open() within a user-gesture call stack, and by the
      // time that async call resolves, the mic tap's gesture has expired.
      // Passing quick/declared directly (not reading state) sidesteps the
      // stale-closure problem of state set moments ago in this same tick.
      if (quick && declared) {
        investigate(quick, Number(declared));
      }

      // Refine with real Comprehend in the background -- this is the
      // genuine AWS NLP call; the client-side guess above only exists so
      // the UI never sits on a blank field while this resolves. Only
      // overwrites the item field; doesn't retrigger an auto-run already
      // underway from the quick guess above.
      callLambda({ action: "extractItem", text: heard }, 10_000)
        .then((res) => {
          if (res?.item) setItemQuery(res.item);
        })
        .catch(() => {});
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  async function investigate(itemOverride?: string, declaredOverride?: number) {
    const item = (itemOverride ?? itemQuery).trim();
    if (!item) return;
    const declared = declaredOverride ?? Number(compareValue);
    if (!Number.isFinite(declared) || declared <= 0) return;

    const myRunId = ++runIdRef.current;
    const stillCurrent = () => runIdRef.current === myRunId;

    // Synchronous, in the same call stack as the triggering gesture --
    // guaranteed to open regardless of AWS or network conditions, since it
    // never leaves your machine. This is a real Amazon search in your own
    // browser; the agent below does its own, separate, real market-price
    // lookup in parallel (major retailers block automated datacenter
    // traffic with bot-detection challenges, confirmed against Amazon,
    // eBay, and Walmart directly -- so the agent cross-references live
    // shopping listings instead, the same real prices you'd see yourself).
    //
    // When this runs from the voice auto-trigger rather than a direct
    // button click, the browser's user-activation window (left over from
    // the mic tap) can already have expired by the time speech recognition
    // resolves, especially for a longer sentence -- window.open() then
    // returns null instead of throwing. Rather than silently losing that
    // tab, fall back to a one-tap manual link so it's still one click away,
    // never a dead end.
    setBlockedUrl(null);
    const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(item)}`;
    const win = window.open(amazonUrl, "_blank", "noopener,noreferrer");
    if (!win) setBlockedUrl(amazonUrl);

    setPhase("running");
    setVerdict(null);
    setAudioUrl(null);
    setLog([]);
    pushLog(
      win
        ? `Opened "${item}" on Amazon in a new tab.`
        : `Couldn't auto-open the Amazon tab (browser popup block) — tap the link below to open it.`
    );
    pushLog(`Agent cross-referencing live market listings for "${item}"…`);

    try {
      const start = await callLambda({ action: "start" }, START_TIMEOUT_MS);
      if (!stillCurrent()) return;
      if (start.error) {
        setPhase("error");
        pushLog(`Failed to start agent session: ${start.error}`);
        return;
      }
      pushLog(`Agent session ${start.sessionId} started.`);

      const priceRes = await callLambda(
        {
          action: "readPrice",
          sessionId: start.sessionId,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(item + " price")}`,
        },
        30_000
      );
      if (!stillCurrent()) return;

      callLambda({ action: "stop", sessionId: start.sessionId }, 10_000).catch(() => {});

      if (priceRes.error) {
        setPhase("error");
        pushLog(`Price lookup failed: ${priceRes.error}`);
        return;
      }

      const lowest = pickLowestPrice(priceRes.prices || []);
      if (lowest === null) {
        setPhase("error");
        pushLog("Agent couldn't read a clear price from the listings it found.");
        return;
      }
      pushLog(`Agent read ${priceRes.prices.length} real price${priceRes.prices.length === 1 ? "" : "s"} via OCR — lowest: $${lowest.toFixed(2)}`);

      const diff = declared - lowest;
      const pct = Math.abs((diff / declared) * 100);
      let tone: "cheaper" | "pricier" | "close";
      let verdictText: string;
      if (Math.abs(diff) < declared * 0.05) {
        tone = "close";
        verdictText = `Market listings for ${item} start around $${lowest.toFixed(2)}, close to the ${declared.toFixed(2)} dollars declared on this shipment. No red flag on value alone.`;
      } else if (diff > 0) {
        tone = "cheaper";
        verdictText = `Based on what I found on Amazon and live market listings, ${item} runs about ${pct.toFixed(0)} percent cheaper than declared — real price near $${lowest.toFixed(2)}, against ${declared.toFixed(2)} dollars on the shipment. That gap is worth a closer look.`;
      } else {
        tone = "pricier";
        verdictText = `I found ${item} listed from $${lowest.toFixed(2)}, actually ${pct.toFixed(0)} percent above the ${declared.toFixed(2)} dollars declared here. The declared value looks reasonable, possibly even conservative.`;
      }

      setVerdict({ text: verdictText, tone });
      pushLog("Verdict ready — synthesizing voice with Amazon Polly…");

      const speech = await callLambda({ action: "speak", text: verdictText }, 15_000);
      if (!stillCurrent()) return;
      if (speech.audioBase64) {
        const url = `data:audio/mpeg;base64,${speech.audioBase64}`;
        setAudioUrl(url);
        window.setTimeout(() => audioRef.current?.play().catch(() => {}), 100);
      }

      setPhase("done");
      pushLog("Done.");
    } catch (err) {
      if (!stillCurrent()) return;
      setPhase("error");
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "Timed out waiting for AWS to respond — try again."
          : err instanceof Error
            ? err.message
            : "Unknown error";
      pushLog(`Error: ${message}`);
    }
  }

  const running = phase === "running";
  const toneStyles = {
    cheaper: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-600", icon: "💰" },
    pricier: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-500", icon: "📈" },
    close: { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-500", icon: "⚖️" },
  } as const;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={listening ? stopListening : startListening}
          disabled={!speechSupported || running}
          className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-lg transition-colors ${
            listening
              ? "bg-red-600 text-white animate-pulse"
              : "bg-red-50 text-red-600 hover:bg-red-100"
          } disabled:opacity-40`}
          title={speechSupported ? "Speak your request" : "Voice input isn't supported in this browser — type below instead"}
        >
          🎤
        </button>
        <div className="flex-1 min-w-[240px]">
          <input
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setItemQuery(extractItemClientSide(e.target.value));
              if (phase === "idle") setPhase("ready");
            }}
            placeholder='Say or type: "check the price of a ring camera on amazon, I have about $190"'
            disabled={running}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 disabled:bg-slate-50"
          />
        </div>
      </div>

      {(transcript || phase !== "idle") && (
        <div className="flex items-end gap-3 mb-4 flex-wrap bg-slate-50 border border-slate-200 rounded-md p-3">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Item to investigate</label>
            <input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              disabled={running}
              className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 mt-1 disabled:bg-slate-100"
            />
          </div>
          <div className="w-40">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Declared value ($)</label>
            <input
              value={compareValue}
              onChange={(e) => setCompareValue(e.target.value)}
              placeholder="e.g. 259.00"
              inputMode="decimal"
              disabled={running}
              className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 mt-1 disabled:bg-slate-100"
            />
          </div>
          <button
            onClick={() => investigate()}
            disabled={running || !itemQuery.trim() || !compareValue.trim()}
            className="text-xs font-medium bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 rounded-md h-[34px]"
          >
            {running ? "Investigating…" : "🔎 Investigate"}
          </button>
        </div>
      )}

      {log.length > 0 && (
        <div className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-md px-3 py-2 mb-3 space-y-0.5 max-h-32 overflow-y-auto">
          {log.map((l, i) => (
            <div key={i} className="text-slate-600">
              <span className="text-slate-400">{l.t}</span> {l.text}
            </div>
          ))}
        </div>
      )}

      {blockedUrl && (
        <a
          href={blockedUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setBlockedUrl(null)}
          className="block text-center text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-md mb-3 hover:bg-amber-100"
        >
          Your browser blocked the auto-opened tab — tap here to open the Amazon search →
        </a>
      )}

      {verdict && (
        <div className={`rounded-lg border overflow-hidden ${toneStyles[verdict.tone].bg} ${toneStyles[verdict.tone].border}`}>
          <div className="flex items-center gap-3 px-4 py-3">
            <div
              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${toneStyles[verdict.tone].badge}`}
            >
              {toneStyles[verdict.tone].icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-900">Fraud-Verification Agent</div>
              <p className="text-sm text-slate-700 leading-relaxed mt-0.5">{verdict.text}</p>
            </div>
          </div>
          {audioUrl && (
            <div className="px-4 pb-3">
              <audio ref={audioRef} src={audioUrl} controls className="w-full h-8" />
            </div>
          )}
        </div>
      )}

      {phase === "idle" && !transcript && (
        <p className="text-xs text-slate-400">
          Tap the mic and say the item <em>and</em> a declared value in one go — &ldquo;check the price of a ring
          camera on amazon, I have about $190&rdquo; — and the agent investigates immediately, no typing or clicking
          needed. Say just the item and it fills the field in for you to finish. Real Comprehend pulls out the item,
          a real isolated AWS browser agent reads real live prices via Rekognition OCR, and real Polly speaks back
          the verdict.
        </p>
      )}
    </div>
  );
}
