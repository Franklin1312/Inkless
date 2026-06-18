"use client";

import { Loader2, Bot, AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  advice: string;
  isProcessing: boolean;
  issueCount: number;
  trustScore: number | null;
}

export default function AIAdvisor({ advice, isProcessing, issueCount, trustScore }: Props) {
  // Derive verdict from the AI's actual text first (most accurate)
  // Then fall back to issue count and trust score
  const adviceLower = (advice || "").toLowerCase();
  const aiSaysReeval =
    adviceLower.includes("re-evaluation is recommended") ||
    adviceLower.includes("re-evaluation is strongly recommended") ||
    adviceLower.includes("strongly recommended") ||
    adviceLower.includes("recommend re-evaluation") ||
    adviceLower.includes("revaluation is recommended");
  const aiSaysOk =
    adviceLower.includes("re-evaluation is not recommended") ||
    adviceLower.includes("evaluation appears correct") ||
    adviceLower.includes("no re-evaluation") ||
    adviceLower.includes("correctly evaluated");

  const shouldReeval =
    aiSaysReeval ||
    (!aiSaysOk && issueCount > 0) ||
    (!aiSaysOk && trustScore !== null && trustScore < 70);

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
          <Bot className="w-4 h-4 text-amber-700" />
        </div>
        <h2 className="font-display text-lg font-semibold text-navy-900">
          AI Recommendation
        </h2>
      </div>

      {isProcessing || !advice ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
          <Loader2 className="w-6 h-6 text-navy-400 animate-spin" />
          <p className="text-sm text-ink-500 font-body text-center">
            Analysing detected issues and generating recommendation...
          </p>
        </div>
      ) : (
        <>
          {/* Verdict badge */}
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-4
            ${shouldReeval
              ? "bg-red-50 border border-red-200"
              : "bg-green-50 border border-green-200"}`}
          >
            {shouldReeval ? (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            )}
            <span className={`text-sm font-bold font-body
              ${shouldReeval ? "text-red-700" : "text-green-700"}`}
            >
              {shouldReeval
                ? "Re-evaluation recommended"
                : "Re-evaluation not required"}
            </span>
          </div>

          {/* AI text */}
          <div className="flex-1 bg-ink-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-ink-700 font-body leading-relaxed">
              {advice}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-navy-50 rounded-lg p-3 text-center">
              <div className="font-display text-2xl font-bold text-navy-800">
                {issueCount}
              </div>
              <div className="text-xs text-navy-600 font-body">Issues found</div>
            </div>
            <div className={`rounded-lg p-3 text-center
              ${shouldReeval ? "bg-red-50" : "bg-green-50"}`}
            >
              <div className={`font-display text-2xl font-bold
                ${shouldReeval ? "text-red-700" : "text-green-700"}`}
              >
                {trustScore ?? "—"}
              </div>
              <div className={`text-xs font-body
                ${shouldReeval ? "text-red-600" : "text-green-600"}`}
              >
                Trust score
              </div>
            </div>
          </div>

          {/* Export hint */}
          <p className="text-xs text-ink-400 font-body text-center">
            Use the Answer Sheet Viewer to annotate and export a PDF report
          </p>
        </>
      )}
    </div>
  );
}
