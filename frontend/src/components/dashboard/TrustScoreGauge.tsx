"use client";

interface Props {
  score: number | null;
  breakdown: {
    scanQuality: number;
    pageIntegrity: number;
    evaluationCompleteness: number;
    markAccuracy: number;
  } | null;
  isProcessing: boolean;
}

const CATEGORIES = [
  { key: "scanQuality",            label: "Scan Quality",       weight: "20%" },
  { key: "pageIntegrity",          label: "Page Integrity",     weight: "25%" },
  { key: "evaluationCompleteness", label: "Eval Completeness",  weight: "35%" },
  { key: "markAccuracy",           label: "Mark Accuracy",      weight: "20%" },
];

function getScoreColor(score: number | null) {
  if (score === null) return { stroke: "#CBD5E1", text: "text-ink-400" };
  if (score >= 80)    return { stroke: "#16A34A", text: "text-green-700" };
  if (score >= 55)    return { stroke: "#D97706", text: "text-amber-700" };
  return               { stroke: "#DC2626", text: "text-red-700" };
}

function getScoreLabel(score: number | null) {
  if (score === null) return "Calculating...";
  if (score >= 80)    return "Low Risk";
  if (score >= 55)    return "Review Recommended";
  return               "Re-evaluation Recommended";
}

export default function TrustScoreGauge({ score, breakdown, isProcessing }: Props) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const displayScore = score ?? 0;
  const offset = circumference - (displayScore / 100) * circumference;
  const colors = getScoreColor(score);

  return (
    <div className="card p-6 flex flex-col items-center">
      <h2 className="font-display text-lg font-semibold text-navy-900 mb-4 self-start">
        Trust Score
      </h2>

      {/* SVG Gauge */}
      <div className="relative flex items-center justify-center mb-4">
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Background track */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none" stroke="#E2E8F0" strokeWidth="12"
          />
          {/* Score arc */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isProcessing ? circumference : offset}
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dashoffset 1.5s ease-out, stroke 0.5s ease" }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute text-center">
          {isProcessing ? (
            <div className="w-6 h-6 border-2 border-navy-300 border-t-navy-700 rounded-full animate-spin mx-auto" />
          ) : (
            <>
              <div className={`font-display text-4xl font-bold ${colors.text}`}>
                {score !== null ? score : "—"}
              </div>
              <div className="text-xs text-ink-500 font-body">/100</div>
            </>
          )}
        </div>
      </div>

      {/* Label */}
      <div className={`text-sm font-bold font-body mb-5 ${colors.text}`}>
        {isProcessing ? "Processing..." : getScoreLabel(score)}
      </div>

      {/* Breakdown bars */}
      {breakdown && (
        <div className="w-full space-y-3">
          {CATEGORIES.map(({ key, label, weight }) => {
            const val = (breakdown as any)[key] ?? 100;
            const barColor = val >= 80 ? "bg-green-500" : val >= 50 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-ink-600 font-body">{label}</span>
                  <span className="text-xs font-bold text-ink-700">{val}</span>
                </div>
                <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
