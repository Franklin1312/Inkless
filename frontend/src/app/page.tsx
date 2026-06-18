"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadPaper } from "@/lib/api";
import {
  Upload,
  FileText,
  Shield,
  Search,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import AuditVerifier from "@/components/dashboard/AuditVerifier";

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState({
    studentName: "",
    rollNumber: "",
    subject: "",
  });
  const [error, setError] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setError("");
    } else {
      setError("Please upload a PDF file.");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected?.type === "application/pdf") {
      setFile(selected);
      setError("");
    }
  };

  const handleSubmit = async () => {
    if (!file) return setError("Please upload your evaluated answer sheet PDF.");
    if (!meta.rollNumber.trim()) return setError("Roll number is required.");

    setUploading(true);
    setError("");

    try {
      const result = await uploadPaper(file, meta);
      router.push(`/analysis/${result.paperId}`);
    } catch (err) {
      setError("Upload failed. Please check your connection and try again.");
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen">
      {/* Hero Nav */}
      <nav className="px-8 py-6 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-navy-700 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-xl font-semibold text-navy-900">
            Inkless
          </span>
        </div>
        <span className="text-xs font-body text-ink-500 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
          CBSE OSM Audit Platform
        </span>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-2 rounded-full mb-8 animate-fade-in">
          <AlertTriangle className="w-3 h-3" />
          17 lakh students affected by CBSE OSM 2026 failures
        </div>

        <h1 className="font-display text-5xl md:text-6xl font-bold text-navy-900 leading-tight mb-6 animate-fade-up">
          Your answer sheet.
          <br />
          <span className="text-amber-600">Verified.</span>
        </h1>

        <p className="font-body text-lg text-ink-600 max-w-2xl mx-auto mb-4 animate-fade-up animate-delay-100">
          Inkless audits your CBSE evaluated answer sheet and detects pages
          marked blank when they weren't, answers that received zero due to
          blurred scans, and questions the evaluator never marked.
        </p>

        <p className="font-body text-sm text-ink-500 mb-12 animate-fade-up animate-delay-200">
          Upload your evaluated PDF. Get evidence — not just a complaint.
        </p>

        {/* Feature chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-16 animate-fade-up animate-delay-300">
          {[
            { icon: Search, label: "Unevaluated pages" },
            { icon: AlertTriangle, label: "Blur-penalized answers" },
            { icon: FileText, label: "Missing pages" },
            { icon: CheckCircle, label: "Arithmetic errors" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-white border border-ink-200 text-ink-700 text-sm px-4 py-2 rounded-full shadow-sm"
            >
              <Icon className="w-3.5 h-3.5 text-navy-600" />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Dual card section */}
      <section className="max-w-5xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-up animate-delay-400">

          {/* Student: Upload & Audit */}
          <div className="card p-8 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Search className="w-4 h-4 text-amber-700" />
              </div>
              <span className="text-xs font-bold font-body text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">For Verification</span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-navy-900 mb-2">
              Audit Answer Sheet
            </h2>
            <p className="text-sm text-ink-500 font-body mb-8 flex-1">
              Upload the evaluated PDF the one with
              evaluator marks overlaid.
            </p>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-ink-600 uppercase tracking-wide mb-1.5">
                Student Name
              </label>
              <input
                type="text"
                placeholder="Enter name"
                value={meta.studentName}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, studentName: e.target.value }))
                }
                className="w-full border border-ink-200 rounded-lg px-4 py-2.5 text-sm font-body text-ink-900 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-600 uppercase tracking-wide mb-1.5">
                Roll Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1234567"
                value={meta.rollNumber}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, rollNumber: e.target.value }))
                }
                className="w-full border border-ink-200 rounded-lg px-4 py-2.5 text-sm font-body text-ink-900 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 transition-colors"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-ink-600 uppercase tracking-wide mb-1.5">
                Subject
              </label>
              <select
                value={meta.subject}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, subject: e.target.value }))
                }
                className="w-full border border-ink-200 rounded-lg px-4 py-2.5 text-sm font-body text-ink-900 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 transition-colors bg-white cursor-pointer"
              >
                <option value="">Select subject</option>
                <option>Computer Science</option>
                <option>Mathematics</option>
                <option>Physics</option>
                <option>Chemistry</option>
                <option>Biology</option>
                <option>English</option>
                <option>Economics</option>
                <option>Accountancy</option>
                <option>Business Studies</option>
                <option>History</option>
                <option>Political Science</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
              ${dragging ? "border-navy-400 bg-navy-50" : "border-ink-300 hover:border-navy-300 hover:bg-ink-50"}
              ${file ? "bg-green-50 border-green-300" : ""}
            `}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div className="text-left">
                  <p className="font-body font-bold text-green-700 text-sm">
                    {file.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB — Ready to audit
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-ink-400 mx-auto mb-3" />
                <p className="font-body font-bold text-ink-700 mb-1">
                  Drop your evaluated answer sheet here
                </p>
                <p className="text-xs text-ink-500">
                  PDF only · Max 50MB · The evaluated copy with OSM marks
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={uploading || !file}
            className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading and starting analysis...
              </>
            ) : (
              <>
                Start Audit
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-ink-400 mt-4 font-body">
            Your file is processed locally. No data is shared with CBSE or third parties.
          </p>
          </div>{/* end student card */}

          {/* Evaluator: OSM Marking Tool */}
          <div className="flex flex-col rounded-2xl overflow-hidden border border-ink-200 bg-[#0d1117]">
            <div className="p-8 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-900/60 rounded-lg flex items-center justify-center border border-blue-700">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs font-bold font-body text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-full">For Evaluation</span>
              </div>
              <h2 className="font-display text-2xl font-semibold text-white mb-2">
                OSM Marking Tool
              </h2>
              <p className="text-sm text-slate-400 font-body mb-6 flex-1">
                Place green award marks, red zeros, subtotals, REPEAT ANS+ stamps,
                and blank-page markers directly onto any CBSE answer sheet PDF.
                Export a fully annotated marked PDF or JSON audit report.
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { color: "bg-green-500", label: "✓ Award marks" },
                  { color: "bg-red-500",   label: "0 Zero" },
                  { color: "bg-blue-500",  label: "Σ Subtotal" },
                  { color: "bg-purple-500",label: "REPEAT ANS+" },
                  { color: "bg-gray-500",  label: "☐ Blank page" },
                ].map(({ color, label }) => (
                  <span key={label} className={`flex items-center gap-1.5 text-xs font-bold font-body text-white px-2.5 py-1 rounded-full bg-white/10`}>
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    {label}
                  </span>
                ))}
              </div>

              <a
                href="/osm-evaluator.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold font-body text-sm transition-colors"
              >
                Open OSM Evaluator
                <ChevronRight className="w-4 h-4" />
              </a>

              <p className="text-center text-xs text-slate-600 mt-4 font-body">
                All marks are computed locally — no data is uploaded.
              </p>
            </div>
          </div>{/* end evaluator card */}

        </div>{/* end grid */}
      </section>

      {/* Audit Verifier Tool */}
      <section className="max-w-4xl mx-auto px-8 pb-24">
        <div className="flex items-center gap-3 mb-6 justify-center text-center">
          <Shield className="w-5 h-5 text-navy-600" />
          <h2 className="font-display text-2xl font-semibold text-navy-900">
            Verify an On-Chain Audit
          </h2>
        </div>
        <AuditVerifier />
      </section>
    </main>
  );
}
