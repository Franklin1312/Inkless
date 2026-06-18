const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function uploadPaper(
  file: File,
  metadata: { studentName: string; rollNumber: string; subject: string }
) {
  const formData = new FormData();
  formData.append("answerSheet", file);
  formData.append("studentName", metadata.studentName);
  formData.append("rollNumber", metadata.rollNumber);
  formData.append("subject", metadata.subject);

  const res = await fetch(`${API_BASE}/papers/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function getPaper(paperId: string) {
  const res = await fetch(`${API_BASE}/papers/${paperId}`);
  if (!res.ok) throw new Error("Failed to fetch paper");
  return res.json();
}

export async function getPaperStatus(paperId: string) {
  const res = await fetch(`${API_BASE}/papers/${paperId}/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function getAuditTrail(paperId: string) {
  const res = await fetch(`${API_BASE}/audit/${paperId}`);
  if (!res.ok) throw new Error("Failed to fetch audit trail");
  return res.json();
}

export const PROCESSED_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
  "http://localhost:5000";
