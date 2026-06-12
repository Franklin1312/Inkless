"use client";

import { CheckCircle, Circle, Loader2 } from "lucide-react";

const PIPELINE_STEPS = [
  { event: "uploaded",                  label: "File uploaded",              desc: "PDF received and stored" },
  { event: "pages_extracted",           label: "Pages extracted",            desc: "PDF rendered to images" },
  { event: "blur_check_complete",       label: "Scan quality checked",       desc: "Blur detection per page" },
  { event: "annotations_detected",      label: "Evaluator marks read",       desc: "Green/red/blue boxes detected" },
  { event: "content_detected",          label: "Student content detected",   desc: "Ink density + OCR analysis" },
  { event: "vision_analysis_complete",  label: "Vision AI analysis",         desc: "Question-level mark extraction (Nano Omni)" },
  { event: "cross_reference_complete",  label: "Cross-reference complete",   desc: "Marks vs content compared" },
  { event: "trust_score_calculated",    label: "Trust score calculated",     desc: "Weighted scoring applied" },
  { event: "ai_advice_generated",       label: "AI recommendation ready",    desc: "Reasoning model analysed findings (Ultra)" },
  { event: "analysis_complete",         label: "Analysis complete",          desc: "Full audit report ready" },
];

interface Props {
  events: Array<{ eventType: string; createdAt: string; hash: string }>;
  currentStatus: string;
}

export default function ProcessingTimeline({ events, currentStatus }: Props) {
  const completedEvents = new Set(events?.map((e) => e.eventType) || []);
  const isError = currentStatus === "error";

  return (
    <div className="card p-6 h-full">
      <h2 className="font-display text-lg font-semibold text-navy-900 mb-5">
        Processing Timeline
      </h2>

      <div className="space-y-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const isDone    = completedEvents.has(step.event);
          const isActive  = !isDone && PIPELINE_STEPS[idx - 1] && completedEvents.has(PIPELINE_STEPS[idx - 1].event);
          const isPending = !isDone && !isActive;

          return (
            <div key={step.event} className="flex gap-3 items-start">
              {/* Connector line + icon */}
              <div className="flex flex-col items-center flex-shrink-0 w-6">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                  ${isDone    ? "bg-green-100" : 
                    isActive  ? "bg-navy-100" : 
                    "bg-ink-100"}`}
                >
                  {isDone ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  ) : isActive ? (
                    <Loader2 className="w-3 h-3 text-navy-600 animate-spin" />
                  ) : (
                    <Circle className="w-3 h-3 text-ink-300" />
                  )}
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className={`w-px flex-1 mt-1 mb-0 min-h-3 ${isDone ? "bg-green-200" : "bg-ink-100"}`} />
                )}
              </div>

              {/* Step info */}
              <div className="pb-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold font-body
                    ${isDone   ? "text-ink-800" :
                      isActive ? "text-navy-700" :
                      "text-ink-400"}`}
                  >
                    {step.label}
                  </span>
                  {isDone && events.find((e) => e.eventType === step.event) && (
                    <span className="text-xs text-ink-400 font-body">
                      {new Date(events.find((e) => e.eventType === step.event)!.createdAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {(isDone || isActive) && (
                  <p className="text-xs text-ink-500 font-body mt-0.5">
                    {step.desc}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
