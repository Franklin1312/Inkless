"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, FileX, Eye, Calculator, Stamp, BookOpen } from "lucide-react";

const ISSUE_META: Record<string, { label: string; icon: any; color: string }> = {
  unevaluated_page:     { label: "Unevaluated Page",         icon: FileX,        color: "red" },
  blur_penalized:       { label: "Blur-Penalized Answer",    icon: Eye,          color: "red" },
  blur_marks_awarded:   { label: "Blur: Marks Awarded",      icon: Eye,          color: "violet" },
  missing_page:         { label: "Missing Page",             icon: BookOpen,     color: "red" },
  anomalous_zero:       { label: "Anomalous Zero",           icon: AlertTriangle, color: "orange" },
  arithmetic_error:     { label: "Arithmetic Error",         icon: Calculator,   color: "orange" },
  repeat_stamp:         { label: "REPEAT Stamp",             icon: Stamp,        color: "violet" },
  content_marked_blank: { label: "Content Marked as Blank",  icon: FileX,        color: "gray" },
  supplement_missing:   { label: "Supplement Missing",       icon: FileX,        color: "red" },
  wrong_sheet:          { label: "Wrong Answer Sheet",       icon: AlertTriangle, color: "red" },
  mark_mismatch:        { label: "Mark Mismatch",            icon: Calculator,   color: "orange" },
};

interface Issue {
  _id: string;
  type: string;
  severity: string;
  pageNumber: number;
  questionCode?: string;
  details: string;
  blurScore?: number;
  contentDensity?: number;
  detectedMark?: number;
  expectedMark?: number;
}

interface Props {
  issues: Issue[];
}

export default function IssuesPanel({ issues }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!issues || issues.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-green-600" />
        </div>
        <p className="font-display text-lg font-semibold text-green-700 mb-1">
          No issues detected
        </p>
        <p className="text-sm text-ink-500 font-body">
          The evaluation appears to have been conducted correctly.
        </p>
      </div>
    );
  }

  const critical = issues.filter((i) => i.severity === "critical");
  const high     = issues.filter((i) => i.severity === "high");
  const other    = issues.filter((i) => !["critical","high"].includes(i.severity));
  const sorted   = [...critical, ...high, ...other];

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-navy-900">
          Issues Detected
        </h2>
        <div className="flex gap-2">
          {critical.length > 0 && (
            <span className="badge-critical">{critical.length} critical</span>
          )}
          {high.length > 0 && (
            <span className="badge-high">{high.length} high</span>
          )}
        </div>
      </div>

      <div className="divide-y divide-ink-100">
        {sorted.map((issue) => {
          const meta  = ISSUE_META[issue.type] || { label: issue.type, icon: AlertTriangle, color: "gray" };
          const Icon  = meta.icon;
          const isOpen = expanded === issue._id;
          const badgeClass = issue.severity === "critical" ? "badge-critical" :
                             issue.severity === "high"     ? "badge-high"     :
                             issue.severity === "medium"   ? "badge-medium"   : "badge-low";

          return (
            <div key={issue._id} className="hover:bg-ink-50 transition-colors duration-150">
              <button
                onClick={() => setExpanded(isOpen ? null : issue._id)}
                className="w-full px-6 py-4 flex items-start gap-4 text-left cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                  ${meta.color === "red"    ? "bg-red-50"    :
                    meta.color === "orange" ? "bg-orange-50" :
                    meta.color === "violet" ? "bg-violet-50" :
                    meta.color === "gray"   ? "bg-gray-100"  : "bg-ink-100"}`}
                >
                  <Icon className={`w-4 h-4
                    ${meta.color === "red"    ? "text-red-600"    :
                      meta.color === "orange" ? "text-orange-600" :
                      meta.color === "violet" ? "text-violet-600" :
                      meta.color === "gray"   ? "text-gray-500"   : "text-ink-500"}`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-body font-bold text-sm text-ink-800">
                      {meta.label}
                    </span>
                    <span className={badgeClass}>{issue.severity}</span>
                    {issue.questionCode && (
                      <span className="text-xs font-mono bg-ink-100 text-ink-600 px-2 py-0.5 rounded">
                        {issue.questionCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-500 font-body">
                    Page {issue.pageNumber}
                    {issue.blurScore != null && ` · Blur score: ${Number(issue.blurScore).toFixed(1)}`}
                    {issue.detectedMark != null && ` · Detected: ${issue.detectedMark}`}
                    {issue.expectedMark != null && ` · Expected: ${issue.expectedMark}`}
                  </p>
                </div>

                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-ink-400 flex-shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-ink-400 flex-shrink-0 mt-1" />
                )}
              </button>

              {isOpen && (
                <div className="px-6 pb-4 ml-13">
                  <div className="bg-ink-50 rounded-lg px-4 py-3 ml-13 ml-[52px]">
                    <p className="text-sm text-ink-700 font-body leading-relaxed">
                      {issue.details}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
