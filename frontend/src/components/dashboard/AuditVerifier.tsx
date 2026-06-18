"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { useBlockchain } from "../../hooks/useBlockchain";
import { BLOCK_EXPLORER } from "../../lib/contract";

/**
 * AuditVerifier — lookup and tamper-check any evaluation by its on-chain ID.
 * Place in the dashboard alongside the AuditTrail or as a standalone tab.
 */
export default function AuditVerifier() {
  const { getEvaluation, verifyHash } = useBlockchain();

  const [evaluationId, setEvaluationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!evaluationId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const [evalData, hashData] = await Promise.all([
        getEvaluation(evaluationId.trim()),
        verifyHash(evaluationId.trim()),
      ]);
      setResult({ ...evalData, ...hashData });
    } catch (e: any) {
      setError(e?.reason || e?.message || "Evaluation not found on-chain.");
    } finally {
      setLoading(false);
    }
  };

  const fmtTs = (ts: any) =>
    ts ? new Date(Number(ts) * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-ink-100 flex items-center gap-2">
        <Shield className="w-5 h-5 text-navy-600" />
        <h2 className="font-display text-lg font-semibold text-navy-900">On-Chain Audit Verifier</h2>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-xs text-ink-500 font-body">
          Paste an Evaluation ID to verify it on Sepolia and check tamper status.
        </p>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={evaluationId}
            onChange={e => setEvaluationId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLookup()}
            placeholder="Evaluation ID (0x…)"
            className="flex-1 border border-ink-200 rounded-lg px-3 py-2 text-sm font-mono bg-ink-50 focus:outline-none focus:ring-2 focus:ring-navy-300 text-ink-700"
          />
          <button
            onClick={handleLookup}
            disabled={loading || !evaluationId.trim()}
            className="bg-navy-700 hover:bg-navy-800 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 font-body"
          >
            {loading ? "…" : "Verify"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 font-body">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {/* Hash integrity */}
            <div className={`rounded-xl p-4 flex items-start gap-3 ${
              result.isValid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            }`}>
              <svg className={`w-6 h-6 shrink-0 mt-0.5 ${result.isValid ? "text-green-600" : "text-red-600"}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {result.isValid
                  ? <><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></>
                  : <><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></>
                }
              </svg>
              <div>
                <p className={`font-display font-semibold ${result.isValid ? "text-green-800" : "text-red-800"}`}>
                  {result.isValid ? "Hash Verified — Record Intact" : "⚠ Hash Mismatch — Possible Tampering"}
                </p>
                <p className={`text-xs font-body mt-0.5 ${result.isValid ? "text-green-600" : "text-red-600"}`}>
                  {result.isValid
                    ? "On-chain hash matches computed hash. No tampering detected."
                    : "Stored hash does not match computed hash. Escalate immediately."}
                </p>
              </div>
            </div>

            {/* Record details */}
            <div className="bg-ink-50 rounded-xl p-4 text-sm">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-3 font-body">
                Evaluation Record
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  ["Student Roll", result.record?.studentRollNumber],
                  ["Evaluator ID", result.record?.evaluatorId],
                  ["Subject",      result.record?.subject],
                  ["Exam Year",    result.record?.examYear],
                  ["Score",        `${result.record?.totalMarksAwarded} / ${result.record?.totalMaxMarks}`],
                  ["Timestamp",    fmtTs(result.record?.timestamp)],
                  ["Admin Verified", result.record?.verified ? "✓ Yes" : "Pending"],
                ].map(([label, value]) => (
                  <div key={label} className="contents">
                    <span className="text-ink-500 font-body">{label}</span>
                    <span className={`font-medium ${label === "Admin Verified" && result.record?.verified ? "text-green-700" : "text-ink-800"}`}>
                      {value || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-question marks */}
            {result.questions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2 font-body">
                  Question Marks ({result.questions.length})
                </p>
                <div className="border border-ink-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-ink-50 border-b border-ink-100">
                      <tr>
                        <th className="text-left px-3 py-2 text-ink-500 font-body">Q Code</th>
                        <th className="text-center px-3 py-2 text-ink-500 font-body">Marks</th>
                        <th className="text-center px-3 py-2 text-ink-500 font-body">Max</th>
                        <th className="text-center px-3 py-2 text-ink-500 font-body">Box</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.questions.map((q: any, i: number) => (
                        <tr key={i} className="border-t border-ink-50 hover:bg-ink-50">
                          <td className="px-3 py-2 font-mono text-ink-700">{q.questionCode}</td>
                          <td className="px-3 py-2 text-center font-bold text-navy-800">{q.marksAwarded?.toString()}</td>
                          <td className="px-3 py-2 text-center text-ink-400">{q.maxMarks?.toString()}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-body ${
                              q.boxColor === "green"  ? "bg-green-100 text-green-700"   :
                              q.boxColor === "red"    ? "bg-red-100 text-red-700"       :
                              q.boxColor === "blue"   ? "bg-blue-100 text-blue-700"     :
                              q.boxColor === "violet" ? "bg-violet-100 text-violet-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                q.boxColor === "green"  ? "bg-green-500"  :
                                q.boxColor === "red"    ? "bg-red-500"    :
                                q.boxColor === "blue"   ? "bg-blue-500"   :
                                q.boxColor === "violet" ? "bg-violet-500" : "bg-gray-400"
                              }`} />
                              {q.boxColor || "none"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <a href={`${BLOCK_EXPLORER}/address/${evaluationId}`} target="_blank" rel="noopener noreferrer"
              className="block text-center text-xs text-ink-400 hover:text-navy-600 hover:underline font-body">
              View on Etherscan ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
