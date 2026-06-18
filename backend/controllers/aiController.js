const https = require("https");
const fs = require("fs");
const Issue = require("../models/Issue");
const Paper = require("../models/Paper");

// ─── Core HTTP helper for Google Gemini ─────────────────────────────────────
// Free tier: 10 RPM, 1500 requests/day, 250K TPM — no credit card needed
// Get your free API key at: https://aistudio.google.com/apikey
function geminiRequest(model, parts, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const bodyObj = { contents: [{ parts }] };
    const body = JSON.stringify(bodyObj);
    const apiKey = process.env.GEMINI_API_KEY;

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          // Handle API errors
          if (parsed.error) {
            console.error("Gemini API error:", JSON.stringify(parsed.error));
            return reject(new Error(`Gemini: ${parsed.error.message || JSON.stringify(parsed.error)}`));
          }

          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return reject(new Error("Empty response from Gemini"));
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Failed to parse Gemini response: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Gemini request timed out"));
    });
    req.setTimeout(timeoutMs);
    req.write(body);
    req.end();
  });
}

// ─── STEP 1: Vision Extraction ───────────────────────────────────────────────
// Sends a page image to Gemini Flash (free, vision-capable) and extracts
// structured JSON: which question numbers exist and what color their box is.
async function analyzePageVision(imagePath) {
  try {
    // Read and encode image as base64
    let imageBuffer;
    try {
      const sharp = require("sharp");
      imageBuffer = await sharp(imagePath)
        .resize({ width: 1024, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (_sharpErr) {
      // sharp not installed — fall back to reading raw file
      imageBuffer = fs.readFileSync(imagePath);
    }

    const base64Image = imageBuffer.toString("base64");

    const visionPrompt = `This is a page from a CBSE Class 12 answer sheet evaluated using the OSM (Online Subjective Marks) system.

The evaluator leaves colored rectangular annotation boxes on the page:
- GREEN box with a checkmark (✓) and a number = marks awarded. The student answered correctly. This is NORMAL and fine.
- RED box with 0 = zero marks given. The student answered INCORRECTLY. The evaluator DID evaluate this question. This is NORMAL and fine — it means the answer was wrong, NOT that it was skipped.
- BLUE box with a sub-total = partial marks tally. NORMAL.
- "REPEAT ANS+" stamp = answer flagged as a repeated/duplicate and disqualified. This IS an issue.
- Student handwriting with NO colored box at all nearby = the answer was NEVER evaluated by the examiner. This IS an issue.

IMPORTANT: A RED box (zero marks) is NOT a problem. The evaluator checked and gave 0 because the answer was wrong. Only flag answers where there is NO box at all.

Your task: Identify the evaluation status of each visible answer on this page.

Output ONLY a valid JSON array, no other text. Each element must have:
- "question_number": the question code (e.g. "14S1", "7S1", "Q3")
- "box_color": "green" (correct answer), "red" (wrong answer, zero marks — EVALUATED), "blue" (subtotal), "repeat" (REPEAT stamp — issue), or "none" (NO box found — UNEVALUATED, this is the only real issue)
- "marks": the number shown in the box as a string, or null if no box

Example: [{"question_number":"14S1","box_color":"green","marks":"1"},{"question_number":"7S1","box_color":"red","marks":"0"},{"question_number":"11","box_color":"none","marks":null}]

Also add one final summary object at the END of the array:
{"summary": true, "blank_page": true/false, "has_repeat_stamp": true/false, "unevaluated_count": <number of answers with NO box — do NOT count red boxes as unevaluated>}

If the page appears blank (no student writing at all), output: [{"summary":true,"blank_page":true,"has_repeat_stamp":false,"unevaluated_count":0}]`;

    // gemini-2.5-flash supports vision and is free tier eligible
    const visionResult = await geminiRequest(
      "gemini-2.5-flash",
      [
        {
          inline_data: {
            mime_type: "image/jpeg",
            data: base64Image,
          },
        },
        { text: visionPrompt },
      ],
      45000
    );

    // Extract JSON array from the response (model may wrap it in markdown)
    const jsonMatch = visionResult.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn(`Vision analysis failed for ${imagePath}: ${err.message}`);
    return []; // Graceful fallback — don't fail the whole pipeline
  }
}

// ─── STEP 3: Reasoning & Advice ─────────────────────────────────────────────
// Passes the aggregated vision JSON + existing CV issues to Gemini Flash
// for a professional audit recommendation with teacher tips.
async function generateAIAdvice(paperId, visionPages = []) {
  const paper = await Paper.findById(paperId);
  const issues = await Issue.find({ paperId }).sort({ severity: 1 });

  // Build vision summary string from the enriched vision JSON
  let visionSummary = "";
  if (visionPages.length > 0) {
    const pageLines = [];
    let totalUnevaluated = 0;
    let totalRepeat = 0;
    let totalBlank = 0;

    for (const vp of visionPages) {
      const summaryObj = vp.questions.find((q) => q.summary === true);
      const questions = vp.questions.filter((q) => !q.summary);

      if (summaryObj?.blank_page) {
        totalBlank++;
        continue;
      }
      if (summaryObj?.has_repeat_stamp) totalRepeat++;
      if (summaryObj?.unevaluated_count) totalUnevaluated += summaryObj.unevaluated_count;

      if (questions.length > 0) {
        const qList = questions.map((q) => {
          const mark = q.marks !== null && q.marks !== undefined ? `(${q.marks}pts)` : "";
          const status = q.box_color === "none" ? "⚠️UNEVALUATED" : q.box_color.toUpperCase();
          return `Q${q.question_number}:${status}${mark}`;
        }).join(", ");
        const repeatFlag = summaryObj?.has_repeat_stamp ? " [REPEAT STAMP]" : "";
        pageLines.push(`  Page ${vp.pageNumber}${repeatFlag}: ${qList}`);
      }
    }

    const unevaluatedQs = visionPages.flatMap((vp) =>
      vp.questions
        .filter((q) => !q.summary && q.box_color === "none")
        .map((q) => `Page ${vp.pageNumber} Q${q.question_number}`)
    );

    visionSummary = `
Vision AI Scan Results (CBSE OSM box-level analysis):
${pageLines.length > 0 ? pageLines.join("\n") : "  No annotation boxes detected."}

Summary:
- Blank pages (no student writing): ${totalBlank}
- Pages with REPEAT ANS+ stamp: ${totalRepeat}
- Total unevaluated answers (no box): ${totalUnevaluated}
- Specific unevaluated questions: ${unevaluatedQs.length > 0 ? unevaluatedQs.join(", ") : "None"}`;
  }

  // No issues at all and no vision anomalies
  if (issues.length === 0 && visionSummary === "") {
    return "No significant issues were detected in this answer sheet. The evaluation appears to have been conducted properly. Re-evaluation is not recommended at this time.";
  }

  const issuesSummary = issues.length > 0
    ? issues
        .map((i) => `- [${i.severity.toUpperCase()}] Page ${i.pageNumber}: ${i.type.replace(/_/g, " ")} — ${i.details}`)
        .join("\n")
    : "No structural issues detected by CV pipeline.";

  const prompt = `You are an expert educational auditor reviewing a CBSE Class 12 answer sheet evaluation audit.

Student: ${paper.studentName || "Unknown"}
Subject: ${paper.subject || "Unknown"}
Trust Score: ${paper.trustScore}/100
Total CV Issues Found: ${issues.length}
${visionSummary}

CV Pipeline Issues:
${issuesSummary}

CRITICAL RULES FOR YOUR RESPONSE:
- A RED box (0 marks) in OSM means the evaluator DID check the answer and gave zero because it was WRONG. This is completely normal and should NOT be flagged as an issue.
- Only recommend re-evaluation if there is evidence of: (a) a page with student writing but NO evaluator box at all, (b) a blurred page that may not have been readable, (c) an arithmetic error in the totals, (d) a REPEAT ANS+ stamp that may have been wrongly applied, (e) a "content_marked_blank" issue where the CV detected content but the page was skipped, or (f) a "blur_marks_awarded" issue where marks were given despite poor scan quality.
- If the trust score is high (≥80) and no CV issues were found and no unevaluated pages exist, state clearly that the evaluation appears correct and re-evaluation is NOT recommended.
- Do NOT suggest re-evaluation simply because some answers received zero marks — zero marks for wrong answers is correct grading.
- For "content_marked_blank" issues: flag that an answer page may have been skipped entirely.
- For "blur_marks_awarded" issues: flag that the blurred page quality may have affected scoring fairness — the evaluator may not have been able to read the answer clearly before awarding marks.

Your task: Write a professional 3-4 sentence audit verdict. Name the specific pages and issue types found. State clearly whether re-evaluation is recommended and the exact reason(s). If the paper appears correctly evaluated, say so explicitly. Use precise, factual language — this may be submitted to CBSE as evidence. Write in plain paragraphs only. Do not use bullet points, markdown, or tips.`;

  try {
    return await geminiRequest(
      "gemini-2.5-flash",
      [{ text: prompt }],
      30000
    );
  } catch (err) {
    console.error("Gemini reasoning API error:", err.message);
    // Fallback: build a specific summary from actual issue data instead of a generic message
    const critIssues = issues.filter((i) => i.severity === "critical");
    const highIssues = issues.filter((i) => i.severity === "high");

    if (issues.length === 0) {
      return "No issues were detected in this answer sheet during automated analysis. All pages appear to have been evaluated and the evaluation appears correct. Re-evaluation is not recommended at this time.";
    }

    const issueLines = issues
      .slice(0, 6) // cap at 6 to keep message concise
      .map((i) => `Page ${i.pageNumber}: ${i.type.replace(/_/g, " ")} — ${i.details}`)
      .join(" ");

    const verdict = critIssues.length > 0
      ? "Re-evaluation is strongly recommended."
      : highIssues.length > 0
      ? "A review of this answer sheet is recommended."
      : "Minor issues were found; a spot-check is advised.";

    return `${verdict} The automated audit detected ${issues.length} issue(s) (${critIssues.length} critical, ${highIssues.length} high): ${issueLines}`;
  }
}

module.exports = { generateAIAdvice, analyzePageVision };