const Issue = require("../models/Issue");

// Deductions for scan quality and page integrity only
// (eval coverage and mark accuracy are now computed from ratios, not deductions)
const SCAN_DEDUCTIONS = {
  blur_penalized:       { critical: 25, high: 18, medium: 10, low: 5 },
  blur_marks_awarded:   { critical: 20, high: 15, medium: 8,  low: 3 },
};

const INTEGRITY_DEDUCTIONS = {
  missing_page:         { critical: 20, high: 15, medium: 10, low: 5 },
  supplement_missing:   { critical: 18, high: 12, medium: 8,  low: 3 },
  wrong_sheet:          { critical: 30, high: 20, medium: 10, low: 5 },
  content_marked_blank: { critical: 30, high: 20, medium: 10, low: 5 },
};

const ACCURACY_DEDUCTIONS = {
  arithmetic_error:     { critical: 10, high: 7,  medium: 4,  low: 2 },
  mark_mismatch:        { critical: 15, high: 10, medium: 6,  low: 3 },
  anomalous_zero:       { critical: 12, high: 8,  medium: 5,  low: 2 },
  repeat_stamp:         { critical: 15, high: 10, medium: 5,  low: 2 },
};

/**
 * @param {string} paperId
 * @param {object} pageStats  { totalContentPages, unevaluatedPages, totalAnnotatedPages }
 */
async function calculateTrustScore(paperId, pageStats = {}) {
  const issues = await Issue.find({ paperId });

  const {
    totalContentPages = 0,
    unevaluatedPages = 0,
    totalAnnotatedPages = 0,
  } = pageStats;

  // ── Scan Quality (0–100): deduction-based ────────────────────────────────
  let scanQuality = 100;
  for (const issue of issues) {
    const tbl = SCAN_DEDUCTIONS[issue.type];
    if (tbl) scanQuality = Math.max(0, scanQuality - (tbl[issue.severity] || 0));
  }

  // ── Page Integrity (0–100): deduction-based ───────────────────────────────
  let pageIntegrity = 100;
  for (const issue of issues) {
    const tbl = INTEGRITY_DEDUCTIONS[issue.type];
    if (tbl) pageIntegrity = Math.max(0, pageIntegrity - (tbl[issue.severity] || 0));
  }

  // ── Eval Coverage (0–100): RATIO — evaluated pages / content pages ────────
  // If no content pages found, default to 100 (nothing to evaluate)
  let evaluationCompleteness;
  if (totalContentPages === 0) {
    evaluationCompleteness = 100;
  } else {
    const evaluatedPages = totalContentPages - unevaluatedPages;
    evaluationCompleteness = Math.round((evaluatedPages / totalContentPages) * 100);
  }

  // ── Mark Accuracy (0–100): RATIO-aware ───────────────────────────────────
  // If NO pages were annotated at all → 0 (nothing was marked, can't be "accurate")
  // If some pages were annotated → start at 100 and deduct for errors
  let markAccuracy;
  if (totalAnnotatedPages === 0 && totalContentPages > 0) {
    markAccuracy = 0;
  } else {
    markAccuracy = 100;
    for (const issue of issues) {
      const tbl = ACCURACY_DEDUCTIONS[issue.type];
      if (tbl) markAccuracy = Math.max(0, markAccuracy - (tbl[issue.severity] || 0));
    }
    // Also penalise proportionally for unevaluated pages
    if (totalContentPages > 0 && unevaluatedPages > 0) {
      const evalRatio = (totalContentPages - unevaluatedPages) / totalContentPages;
      markAccuracy = Math.round(markAccuracy * evalRatio);
    }
  }

  // ── Weighted average ──────────────────────────────────────────────────────
  // scanQuality 20%, pageIntegrity 25%, evalCompleteness 35%, markAccuracy 20%
  const trustScore = Math.round(
    scanQuality            * 0.20 +
    pageIntegrity          * 0.25 +
    evaluationCompleteness * 0.35 +
    markAccuracy           * 0.20
  );

  const breakdown = { scanQuality, pageIntegrity, evaluationCompleteness, markAccuracy };

  return { trustScore: Math.max(0, Math.min(100, trustScore)), breakdown };
}

module.exports = { calculateTrustScore };
