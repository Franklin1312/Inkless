"use client";

import { useState } from "react";
import { useBlockchain, EvaluationData } from "../../hooks/useBlockchain";
import { BLOCK_EXPLORER, CONTRACT_ADDRESS } from "../../lib/contract";

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    idle:    { cls: "bg-ink-100 text-ink-600",           label: "Ready"      },
    pending: { cls: "bg-amber-100 text-amber-700",        label: "Signing…"   },
    mining:  { cls: "bg-blue-100 text-blue-700",          label: "Mining…"    },
    success: { cls: "bg-green-100 text-green-700",        label: "On-chain ✓" },
    error:   { cls: "bg-red-100 text-red-700",            label: "Failed ✗"   },
  };
  const s = map[status] || map.idle;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold font-body ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── Wallet Connect Button ────────────────────────────────────────────────────

function WalletButton({
  wallet, connect, switchToSepolia,
}: {
  wallet: { isConnected: boolean; isCorrectNetwork: boolean; address: string | null };
  connect: () => Promise<any>;
  switchToSepolia: () => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      if (!wallet.isConnected) await connect();
      else if (!wallet.isCorrectNetwork) await switchToSepolia();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (wallet.isConnected && wallet.isCorrectNetwork) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-mono text-green-800">
          {wallet.address?.slice(0, 6)}…{wallet.address?.slice(-4)}
        </span>
        <span className="text-xs text-green-600">Sepolia</span>
      </div>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="flex items-center gap-2 bg-navy-700 hover:bg-navy-800 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
    >
      {loading && (
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {!wallet.isConnected ? "Connect MetaMask" : "Switch to Sepolia"}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  evaluationData: EvaluationData | null;
  onSuccess?: (txHash: string, evaluationId: string | null) => void;
}

export default function BlockchainSubmit({ evaluationData, onSuccess }: Props) {
  const { wallet, connect, switchToSepolia, submitEvaluation, txState, resetTxState, getTxUrl } = useBlockchain();
  const [showDetails, setShowDetails] = useState(false);

  const canSubmit =
    wallet.isConnected &&
    wallet.isCorrectNetwork &&
    txState.status === "idle" &&
    (evaluationData?.questions?.length ?? 0) > 0;

  const handleSubmit = async () => {
    if (!evaluationData) return;
    try {
      const { txHash, evaluationId } = await submitEvaluation(evaluationData);
      onSuccess?.(txHash, evaluationId);
    } catch (_) {}
  };

  if (!CONTRACT_ADDRESS) {
    return (
      <div className="card p-4 text-sm text-amber-800 bg-amber-50 border border-amber-200">
        <strong className="font-display">Contract not deployed yet.</strong>{" "}
        Run <code className="bg-amber-100 px-1 rounded font-mono text-xs">npx hardhat run scripts/deploy.js --network sepolia</code>{" "}
        and set <code className="bg-amber-100 px-1 rounded font-mono text-xs">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in{" "}
        <code className="font-mono text-xs">frontend/.env.local</code>.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-navy-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          <h2 className="font-display text-lg font-semibold text-navy-900">Commit to Blockchain</h2>
          <StatusBadge status={txState.status} />
        </div>
        <WalletButton wallet={wallet} connect={connect} switchToSepolia={switchToSepolia} />
      </div>

      <div className="p-6 space-y-4">
        {/* Evaluation summary */}
        {evaluationData && (
          <div className="bg-ink-50 rounded-xl p-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <span className="text-ink-500 font-body">Student Roll</span>
              <span className="font-medium text-ink-800">{evaluationData.studentRollNumber || "—"}</span>
              <span className="text-ink-500 font-body">Subject</span>
              <span className="font-medium text-ink-800">{evaluationData.subject || "—"}</span>
              <span className="text-ink-500 font-body">Exam Year</span>
              <span className="font-medium text-ink-800">{evaluationData.examYear || "—"}</span>
              <span className="text-ink-500 font-body">Score</span>
              <span className="font-display font-bold text-navy-800">
                {evaluationData.totalMarksAwarded} / {evaluationData.totalMaxMarks}
              </span>
            </div>

            <button
              onClick={() => setShowDetails(v => !v)}
              className="mt-3 text-xs text-ink-400 hover:text-ink-700 flex items-center gap-1 transition-colors"
            >
              {showDetails ? "▲ Hide" : "▼ Show"} {evaluationData.questions?.length} question marks
            </button>

            {showDetails && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-ink-100">
                <table className="w-full text-xs">
                  <thead className="bg-ink-100 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-ink-500 font-body">Q Code</th>
                      <th className="text-center px-3 py-2 text-ink-500 font-body">Marks</th>
                      <th className="text-center px-3 py-2 text-ink-500 font-body">Max</th>
                      <th className="text-center px-3 py-2 text-ink-500 font-body">Box</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluationData.questions?.map((q, i) => (
                      <tr key={i} className="border-t border-ink-50 hover:bg-ink-50">
                        <td className="px-3 py-1.5 font-mono text-ink-700">{q.code}</td>
                        <td className="px-3 py-1.5 text-center font-bold text-navy-800">{q.marksAwarded}</td>
                        <td className="px-3 py-1.5 text-center text-ink-400">{q.maxMarks}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-block w-3 h-3 rounded-full ${
                            q.boxColor === "green"  ? "bg-green-500"  :
                            q.boxColor === "red"    ? "bg-red-500"    :
                            q.boxColor === "blue"   ? "bg-blue-500"   :
                            q.boxColor === "violet" ? "bg-violet-500" : "bg-gray-300"
                          }`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* What gets stored tags */}
        <div className="flex flex-wrap gap-2">
          {["Evaluation hash", "Per-question marks", "Evaluator ID", "Final score", "Timestamp"].map(item => (
            <span key={item} className="text-xs bg-navy-50 text-navy-700 border border-navy-100 rounded-full px-2.5 py-0.5 font-body">
              {item}
            </span>
          ))}
        </div>

        {/* Mining progress */}
        {(txState.status === "pending" || txState.status === "mining") && (
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <svg className="animate-spin w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {txState.status === "pending" ? "Waiting for MetaMask signature…" : "Mining on Sepolia…"}
            {txState.txHash && (
              <a href={getTxUrl(txState.txHash)} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline font-mono ml-1">
                {txState.txHash.slice(0, 16)}… ↗
              </a>
            )}
          </div>
        )}

        {/* Submit button */}
        {txState.status !== "success" && (
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all font-body ${
              canSubmit
                ? "bg-navy-700 hover:bg-navy-800 text-white shadow-sm"
                : "bg-ink-100 text-ink-400 cursor-not-allowed"
            }`}
          >
            {!wallet.isConnected ? "Connect wallet to submit"
              : !wallet.isCorrectNetwork ? "Switch to Sepolia first"
              : txState.status === "pending" || txState.status === "mining" ? "Submitting…"
              : "Submit Evaluation On-Chain"}
          </button>
        )}

        {/* Success result */}
        {txState.status === "success" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
              </svg>
              <span className="font-display font-semibold text-green-800">Evaluation committed to Sepolia</span>
            </div>
            <div className="space-y-1.5 text-xs font-body">
              <div className="flex gap-2">
                <span className="text-green-600 w-24 shrink-0">Tx Hash</span>
                <a href={getTxUrl(txState.txHash!)} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-blue-600 hover:underline truncate">
                  {txState.txHash?.slice(0, 24)}…
                </a>
              </div>
              {txState.evaluationId && (
                <div className="flex gap-2">
                  <span className="text-green-600 w-24 shrink-0">Eval ID</span>
                  <span className="font-mono text-ink-700 break-all">{txState.evaluationId}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <a href={getTxUrl(txState.txHash!)} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-green-600 text-white rounded px-3 py-1.5 hover:bg-green-700 transition-colors">
                View on Etherscan ↗
              </a>
              <button onClick={resetTxState}
                className="text-xs border border-ink-200 rounded px-3 py-1.5 hover:bg-ink-50 transition-colors text-ink-600">
                Submit Another
              </button>
            </div>
          </div>
        )}

        {/* Error result */}
        {txState.status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-800 mb-1">Transaction Failed</p>
            <p className="text-xs text-red-700 font-body">{txState.error}</p>
            <button onClick={resetTxState}
              className="mt-3 text-xs border border-red-200 text-red-700 rounded px-3 py-1.5 hover:bg-red-50 transition-colors">
              Try Again
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-ink-400 text-center font-body">
          Sepolia Testnet ·{" "}
          <a href={`${BLOCK_EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer"
            className="hover:text-navy-600 hover:underline">
            InklessAudit contract ↗
          </a>
        </p>
      </div>
    </div>
  );
}
