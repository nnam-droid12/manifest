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
              <div className="border border-red-200 bg-red-50/60 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="danger">BLOCKED</Badge>
                  <span className="text-xs text-slate-500 font-mono">ApplyGuardrail → GUARDRAIL_INTERVENED</span>
                </div>
                <p className="text-sm text-slate-700">
                  This message never reaches the carrier. {result.ceilingContext && <>{result.ceilingContext}.</>}
                </p>
                {result.dollarsAtRisk && (
                  <p className="text-sm font-semibold text-red-700 mt-2">
                    ${result.dollarsAtRisk.toLocaleString()} overpayment risk avoided on this load.
                  </p>
                )}
                {result.note && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{result.note}</p>}
              </div>
            ) : (
              <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="success">PASSED</Badge>
                  <span className="text-xs text-slate-500 font-mono">ApplyGuardrail → NONE</span>
                </div>
                <p className="text-sm text-slate-700">
                  No violation detected — this message proceeds to the carrier normally.
                </p>
              </div>
            )
          ) : (
            <div className="border border-amber-200 bg-amber-50/60 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge tone="warning">UNCHECKED</Badge>
                <span className="text-xs text-slate-500">guardrail skipped — toggle is off</span>
              </div>
              <p className="text-sm text-slate-700">
                This message goes straight to the carrier, no matter what it says.
              </p>
              {result.blocked && result.dollarsAtRisk && (
                <p className="text-sm font-semibold text-amber-700 mt-2">
                  With guardrails on, this exact message would have been blocked — ${result.dollarsAtRisk.toLocaleString()}{" "}
                  stayed at risk this time.
                </p>
              )}
              {result.blocked && !result.dollarsAtRisk && (
                <p className="text-sm font-semibold text-amber-700 mt-2">
                  With guardrails on, this exact message would have been blocked instead.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
