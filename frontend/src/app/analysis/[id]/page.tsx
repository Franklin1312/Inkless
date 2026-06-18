"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getPaper } from "@/lib/api";
import TrustScoreGauge from "@/components/dashboard/TrustScoreGauge";
import ProcessingTimeline from "@/components/dashboard/ProcessingTimeline";
import IssuesPanel from "@/components/dashboard/IssuesPanel";
import AIAdvisor from "@/components/dashboard/AIAdvisor";
import AuditTrail from "@/components/dashboard/AuditTrail";
import BlockchainSubmit from "@/components/dashboard/BlockchainSubmit";
import dynamic from "next/dynamic";
const AnswerSheetViewer = dynamic(
  () => import("@/components/viewer/AnswerSheetViewer"),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96 text-ink-400">Loading viewer...</div> }
);
import { Shield, Loader2, AlertTriangle } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  uploaded:               "File received",
  extracting_pages:       "Extracting pages...",
  detecting_blur:         "Checking scan quality...",
  detecting_annotations:  "Reading evaluator marks...",
  detecting_content:      "Detecting student content...",
  cross_referencing:      "Cross-referencing marks...",
  calculating_score:      "Calculating trust score...",
  generating_advice:      "Generating AI recommendation...",
  complete:               "Analysis complete",
  error:                  "Analysis failed",
};

export default function AnalysisPage() {
  const params = useParams();
  const paperId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "viewer" | "audit">(
    "dashboard"
  );

  const fetchData = useCallback(async () => {
    try {
      const result = await getPaper(paperId);
      setData(result);
      return result.paper.status;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    fetchData();

    // Poll every 2 seconds until complete or error
    const interval = setInterval(async () => {
      const status = await fetchData();
      if (status === "complete" || status === "error") {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const isProcessing =
    data?.paper?.status &&
    !["complete", "error"].includes(data.paper.status);

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="px-8 py-5 border-b border-ink-200 bg-white sticky top-0 z-40 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 cursor-pointer">
          <div className="w-7 h-7 bg-navy-700 rounded-lg flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display text-lg font-semibold text-navy-900">
            Inkless
          </span>
        </a>

        {data?.paper && (
          <div className="text-right">
            <p className="text-sm font-bold text-ink-800 font-body">
              {data.paper.studentName || "Unknown Student"}
            </p>
            <p className="text-xs text-ink-500">
              Roll: {data.paper.rollNumber || "—"} ·{" "}
              {data.paper.subject || "Unknown Subject"}
            </p>
          </div>
        )}
      </nav>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-96 gap-4">
          <Loader2 className="w-8 h-8 text-navy-600 animate-spin" />
          <p className="font-body text-ink-500">Loading analysis...</p>
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center min-h-96 gap-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="font-body text-red-600">Paper not found.</p>
        </div>
      ) : (
        <>
          {/* Processing banner */}
          {isProcessing && (
            <div className="bg-navy-700 text-white px-8 py-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span className="font-body text-sm">
                {STATUS_LABELS[data.paper.status] || data.paper.status}
              </span>
            </div>
          )}

          {/* Error banner */}
          {data.paper.status === "error" && (
            <div className="bg-red-50 border-b border-red-200 px-8 py-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700 font-body">
                {data.paper.errorMessage || "Analysis failed. Please try again."}
              </span>
            </div>
          )}

          {/* Main content */}
          <div className="max-w-6xl mx-auto px-8 py-8">

            {/* Top — Trust score + Timeline side by side */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="md:col-span-1">
                <TrustScoreGauge
                  score={data.paper.trustScore}
                  breakdown={data.paper.trustBreakdown}
                  isProcessing={isProcessing}
                />
              </div>
              <div className="md:col-span-2">
                <ProcessingTimeline
                  events={data.events}
                  currentStatus={data.paper.status}
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-ink-100 p-1 rounded-xl mb-6 w-fit">
              {[
                { key: "dashboard", label: "Issues & Advice" },
                { key: "viewer",    label: "Answer Sheet Viewer" },
                { key: "audit",     label: "Audit Trail" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold font-body transition-all duration-150 cursor-pointer
                    ${activeTab === tab.key
                      ? "bg-white text-navy-800 shadow-sm"
                      : "text-ink-500 hover:text-ink-700"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                  <IssuesPanel issues={data.issues} />
                </div>
                <div className="lg:col-span-2">
                  <AIAdvisor
                    advice={data.paper.aiAdvice}
                    isProcessing={isProcessing}
                    issueCount={data.issues?.length || 0}
                    trustScore={data.paper.trustScore}
                  />
                </div>
              </div>
            )}

            {activeTab === "viewer" && (
              <AnswerSheetViewer
                paperId={paperId}
                issues={data.issues || []}
                totalPages={data.paper.totalPages}
              />
            )}

            {activeTab === "audit" && (
              <div className="space-y-6">
                <BlockchainSubmit
                  evaluationData={data.paper.status === "complete" ? {
                    studentRollNumber: data.paper.rollNumber || "Unknown",
                    evaluatorId: `CBSE-${data.paper.rollNumber || "SYS"}`,
                    subject: data.paper.subject || "Unknown",
                    examYear: String(new Date().getFullYear()),
                    totalMarksAwarded: Math.round(data.paper.trustScore || 0),
                    totalMaxMarks: 100,
                    questions: (data.issues || []).map((issue: any, i: number) => ({
                      code: `Q${i + 1}`,
                      marksAwarded: issue.detectedMark ?? 0,
                      maxMarks: issue.expectedMark ?? 10,
                      boxColor: issue.type === "arithmetic_error" ? "red"
                        : issue.type === "unevaluated_page" ? "violet"
                        : issue.type === "blur_penalized" ? "red"
                        : "green",
                    })),
                  } : null}
                />
                <AuditTrail paperId={paperId} events={data.events || []} />
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
