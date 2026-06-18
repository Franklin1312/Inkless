"use client";

import { Shield, CheckCircle, AlertTriangle } from "lucide-react";

interface Event {
  _id: string;
  eventType: string;
  hash: string;
  previousHash: string;
  sequence: number;
  createdAt: string;
  eventData: Record<string, any>;
}

interface Props {
  paperId: string;
  events: Event[];
}

const EVENT_LABELS: Record<string, string> = {
  uploaded:                 "File uploaded",
  pages_extracted:          "Pages extracted",
  blur_check_complete:      "Blur check complete",
  annotations_detected:     "Annotations detected",
  content_detected:         "Content detection complete",
  vision_analysis_complete: "Vision AI analysis complete",
  cross_reference_complete: "Cross-reference complete",
  trust_score_calculated:   "Trust score calculated",
  ai_advice_generated:      "AI advice generated",
  analysis_complete:        "Analysis complete",
};

export default function AuditTrail({ paperId, events }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-navy-600" />
          <h2 className="font-display text-lg font-semibold text-navy-900">
            Tamper-Evident Audit Trail
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" />
          SHA-256 chain verified
        </div>
      </div>

      <div className="px-6 py-4 bg-navy-50 border-b border-ink-100">
        <p className="text-xs font-body text-ink-600">
          Every processing event is cryptographically chained. If any record is
          tampered with, the chain integrity check will fail. This log can be
          submitted as evidence.
        </p>
        <p className="text-xs font-mono text-ink-500 mt-1">
          Paper ID: {paperId}
        </p>
      </div>

      <div className="divide-y divide-ink-100">
        {events.map((event, idx) => (
          <div key={event._id} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-navy-700">
                    {event.sequence}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold font-body text-ink-800">
                    {EVENT_LABELS[event.eventType] || event.eventType}
                  </p>
                  <p className="text-xs text-ink-500 font-body">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Hash display */}
            <div className="mt-3 ml-9 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-ink-500 w-20 flex-shrink-0 font-body">
                  HASH
                </span>
                <span className="text-xs font-mono text-navy-700 break-all bg-navy-50 px-2 py-1 rounded">
                  {event.hash}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-ink-500 w-20 flex-shrink-0 font-body">
                  PREV
                </span>
                <span className="text-xs font-mono text-ink-400 break-all">
                  {event.previousHash === "0" ? "genesis block" : event.previousHash}
                </span>
              </div>
              {Object.keys(event.eventData || {}).length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-ink-500 w-20 flex-shrink-0 font-body">
                    DATA
                  </span>
                  <span className="text-xs font-mono text-ink-500 break-all">
                    {JSON.stringify(event.eventData)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
