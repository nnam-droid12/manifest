"use client";

import { useState } from "react";
import { GUARDRAIL_SCENARIOS } from "@/lib/guardrail-results";
import { Badge } from "@/components/ui";

export default function GuardrailToggle() {
  const [guardrailsOn, setGuardrailsOn] = useState(true);
  const [scenarioId, setScenarioId] = useState(GUARDRAIL_SCENARIOS[0].id);
  const [sent, setSent] = useState<{ guardrailsOn: boolean; scenarioId: string } | null>(null);

  const scenario = GUARDRAIL_SCENARIOS.find((s) => s.id === scenarioId)!;
  const result = sent
    ? GUARDRAIL_SCENARIOS.find((s) => s.id === sent.scenarioId)!
    : null;
  const wasBlocked = result ? sent!.guardrailsOn && result.blocked : false;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Carrier Outreach Guardrail</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real results from a live Bedrock ApplyGuardrail call against the deployed guardrail
            (manifest-carrier-outreach-guardrail), captured directly against the AWS API.
          </p>
        </div>
        <button
          onClick={() => setGuardrailsOn((v) => !v)}
          className={`relative inline-flex items-center h-7 w-14 rounded-full transition-colors shrink-0 ${
            guardrailsOn ? "bg-ink" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
              guardrailsOn ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-slate-500">Guardrails are</span>
        <Badge tone={guardrailsOn ? "success" : "danger"}>{guardrailsOn ? "ON" : "OFF"}</Badge>
      </div>

      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
        Pick a message the Carrier Outreach Agent might draft
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        {GUARDRAIL_SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => setScenarioId(s.id)}
            className={`text-left text-xs px-3 py-2 rounded-md border ${
              scenarioId === s.id
                ? "border-ink bg-ink/5 text-slate-900"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <div className="font-medium">{s.label}</div>
            <div className="text-slate-500 mt-0.5">&ldquo;{s.text}&rdquo;</div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setSent({ guardrailsOn, scenarioId })}
        className="text-xs font-medium bg-ink text-white px-4 py-2 rounded-md hover:bg-ink/90"
      >
        ▶ Send this message
      </button>

      {result && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          {sent!.guardrailsOn ? (
            wasBlocked ? (
              <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl bg-red-600 text-white">
                    🛑
                  </div>
                  <div>
                    <div className="text-sm font-bold text-red-800">BLOCKED — message never reaches the carrier</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      ApplyGuardrail → GUARDRAIL_INTERVENED
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  {result.ceilingContext && <p className="text-sm text-slate-700">{result.ceilingContext}.</p>}
                  {result.dollarsAtRisk && (
                    <div className="mt-2 inline-flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-md">
                      💰 ${result.dollarsAtRisk.toLocaleString()} overpayment risk avoided
                    </div>
                  )}
                  {result.note && <p className="text-xs text-slate-500 mt-3 leading-relaxed">{result.note}</p>}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl bg-emerald-600 text-white">
                    ✅
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-800">PASSED — proceeds to the carrier</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">ApplyGuardrail → NONE</div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl bg-amber-500 text-white">
                  ⚠️
                </div>
                <div>
                  <div className="text-sm font-bold text-amber-800">UNCHECKED — guardrail skipped</div>
                  <div className="text-xs text-slate-500 mt-0.5">toggle is off — this goes straight through</div>
                </div>
              </div>
              {result.blocked && (
                <div className="px-4 pb-4">
                  {result.dollarsAtRisk ? (
                    <div className="inline-flex items-center gap-2 bg-amber-500 text-white text-sm font-bold px-3 py-1.5 rounded-md">
                      ⚠️ With guardrails on, this would have been blocked — ${result.dollarsAtRisk.toLocaleString()}{" "}
                      stayed at risk
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-amber-700">
                      With guardrails on, this exact message would have been blocked instead.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
