"use client";

import { useRef, useState } from "react";

const LAMBDA_URL = "https://adfmj6eajqwdwcheh4pite5oiy0lpjja.lambda-url.us-east-1.on.aws/";

interface Instance {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  confidence?: number;
}

interface Label {
  name?: string;
  confidence?: number;
  instances: Instance[];
}

interface SlotState {
  previewUrl: string | null;
  base64: string | null;
  labels: Label[] | null;
}

const EMPTY_SLOT: SlotState = { previewUrl: null, base64: null, labels: null };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function urlToBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function analyze(base64: string): Promise<Label[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const resp = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
      signal: controller.signal,
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data.labels || [];
  } finally {
    window.clearTimeout(timer);
  }
}

type Diff = "new" | "missing" | "shared";

function PhotoSlot({
  title,
  slot,
  onFile,
  onUseDemo,
  diffFor,
}: {
  title: string;
  slot: SlotState;
  onFile: (file: File) => void;
  onUseDemo: () => void;
  diffFor: (name: string | undefined) => Diff;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const chipStyle: Record<Diff, string> = {
    new: "bg-red-100 text-red-700 border-red-300 font-semibold",
    missing: "bg-amber-100 text-amber-700 border-amber-300 font-semibold",
    shared: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const boxStyle: Record<Diff, string> = {
    new: "border-red-500",
    missing: "border-amber-500",
    shared: "border-slate-400",
  };

  return (
    <div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{title}</div>
      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3] flex items-center justify-center">
        {slot.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.previewUrl} alt={`${title} photo`} className="w-full h-full object-contain" />
        ) : (
          <div className="text-center px-4">
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90"
            >
              Upload a photo
            </button>
            <div className="text-xs text-slate-400 mt-2">
              or{" "}
              <button onClick={onUseDemo} className="underline hover:text-slate-600">
                use the example photo
              </button>
            </div>
          </div>
        )}
        {slot.previewUrl && (
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute top-2 right-2 text-[11px] font-semibold bg-white/95 text-ink border border-slate-300 px-2.5 py-1.5 rounded-md shadow-sm hover:bg-white flex items-center gap-1"
          >
            🔄 Upload a different photo
          </button>
        )}
        {slot.labels &&
          slot.labels.flatMap((label, li) =>
            label.instances.map((inst, ii) => {
              const d = diffFor(label.name);
              return inst.left != null ? (
                <div
                  key={`${li}-${ii}`}
                  className={`absolute border-[3px] rounded-sm pointer-events-none ${boxStyle[d]}`}
                  style={{
                    left: `${inst.left * 100}%`,
                    top: `${inst.top! * 100}%`,
                    width: `${inst.width! * 100}%`,
                    height: `${inst.height! * 100}%`,
                  }}
                >
                  <span
                    className={`absolute -top-6 left-0 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${
                      d === "new" ? "bg-red-600" : d === "missing" ? "bg-amber-600" : "bg-slate-600"
                    }`}
                  >
                    {label.name}
                  </span>
                </div>
              ) : null;
            })
          )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {slot.labels && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {slot.labels.slice(0, 10).map((l) => {
            const d = diffFor(l.name);
            return (
              <span
                key={l.name}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${chipStyle[d]}`}
              >
                {d === "new" ? "🆕 " : d === "missing" ? "❌ " : ""}
                {l.name} {l.confidence ? Math.round(l.confidence) : ""}%
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Status = "idle" | "analyzing" | "done" | "error";

export default function CargoInspector() {
  const [pickup, setPickup] = useState<SlotState>(EMPTY_SLOT);
  const [delivery, setDelivery] = useState<SlotState>(EMPTY_SLOT);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadFile(file: File, setSlot: (s: SlotState) => void) {
    const base64 = await fileToBase64(file);
    setSlot({ previewUrl: URL.createObjectURL(file), base64, labels: null });
    setStatus("idle");
  }

  async function loadDemo(src: string, setSlot: (s: SlotState) => void) {
    const base64 = await urlToBase64(src);
    setSlot({ previewUrl: src, base64, labels: null });
    setStatus("idle");
  }

  async function runAnalysis() {
    if (!pickup.base64 || !delivery.base64) return;
    setStatus("analyzing");
    setErrorMsg(null);
    try {
      const [pickupLabels, deliveryLabels] = await Promise.all([analyze(pickup.base64), analyze(delivery.base64)]);
      setPickup((p) => ({ ...p, labels: pickupLabels }));
      setDelivery((d) => ({ ...d, labels: deliveryLabels }));
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof DOMException && err.name === "AbortError"
          ? "Timed out waiting for Amazon Rekognition. Try again."
          : err instanceof Error
            ? err.message
            : "Unknown error"
      );
    }
  }

  const pickupNames = new Set((pickup.labels || []).map((l) => l.name));
  const deliveryNames = new Set((delivery.labels || []).map((l) => l.name));
  const onlyInDelivery = [...deliveryNames].filter((n) => !pickupNames.has(n));
  const onlyInPickup = [...pickupNames].filter((n) => !deliveryNames.has(n));
  const totalDiffs = onlyInDelivery.length + onlyInPickup.length;

  function pickupDiff(name: string | undefined): Diff {
    if (!name) return "shared";
    return onlyInPickup.includes(name) ? "missing" : "shared";
  }
  function deliveryDiff(name: string | undefined): Diff {
    if (!name) return "shared";
    return onlyInDelivery.includes(name) ? "new" : "shared";
  }

  const ready = !!(pickup.base64 && delivery.base64);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Cargo Condition Agent — pickup vs. delivery</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload your own two photos, or use the examples — a real Amazon Rekognition call analyzes each one
            independently, live.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={!ready || status === "analyzing"}
          className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 disabled:opacity-40 shrink-0"
        >
          {status === "analyzing" ? "Analyzing…" : "▶ Analyze with Rekognition"}
        </button>
      </div>

      {status === "error" && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <PhotoSlot
          title="Pickup"
          slot={pickup}
          onFile={(f) => loadFile(f, setPickup)}
          onUseDemo={() => loadDemo("/cargo/pickup.png", setPickup)}
          diffFor={pickupDiff}
        />
        <PhotoSlot
          title="Delivery"
          slot={delivery}
          onFile={(f) => loadFile(f, setDelivery)}
          onUseDemo={() => loadDemo("/cargo/delivery.png", setDelivery)}
          diffFor={deliveryDiff}
        />
      </div>

      {status === "analyzing" && (
        <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
          Calling Amazon Rekognition on both photos…
        </div>
      )}

      {status === "done" && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div
            className={`rounded-lg px-4 py-3 flex items-center gap-3 ${
              totalDiffs > 0 ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"
            }`}
          >
            <div
              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white ${
                totalDiffs > 0 ? "bg-red-600" : "bg-emerald-600"
              }`}
            >
              {totalDiffs}
            </div>
            <div>
              <div className={`text-sm font-semibold ${totalDiffs > 0 ? "text-red-800" : "text-emerald-800"}`}>
                {totalDiffs > 0
                  ? `${totalDiffs} difference${totalDiffs === 1 ? "" : "s"} found between pickup and delivery`
                  : "No differences found — condition match"}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                rekognition:DetectLabels() — real, live results, highlighted on the photos above
              </div>
            </div>
          </div>

          {onlyInDelivery.length > 0 && (
            <p className="text-sm text-slate-700 mt-3">
              <span className="font-semibold text-red-700">🆕 New at delivery, not seen at pickup:</span>{" "}
              {onlyInDelivery.join(", ")}
            </p>
          )}
          {onlyInPickup.length > 0 && (
            <p className="text-sm text-slate-700 mt-1.5">
              <span className="font-semibold text-amber-700">❌ Seen at pickup, missing at delivery:</span>{" "}
              {onlyInPickup.join(", ")}
            </p>
          )}

          <p className="text-xs text-slate-400 leading-relaxed pt-3">
            This is Amazon Rekognition&apos;s real, general-purpose label detection run independently on each photo
            you provided — not a purpose-built damage detector, and not scripted for these two images specifically.
            Boxes only appear on the photo when Rekognition is confident enough to localize an object; real
            photographs typically produce more of them than the flat synthetic examples.
          </p>
        </div>
      )}
    </div>
  );
}
