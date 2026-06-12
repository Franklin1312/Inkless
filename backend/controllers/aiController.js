const https = require("https");
const fs = require("fs");
const path = require("path");
const Issue = require("../models/Issue");
const Paper = require("../models/Paper");

// ─── Core HTTP helper for OpenRouter ────────────────────────────────────────
function openRouterRequest(bodyObj, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const options = {
      hostname: "openrouter.ai",
      path: "/api/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Inkless Audit System",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.error("OpenRouter error response:", JSON.stringify(parsed.error));
            return reject(new Error(`OpenRouter: ${parsed.error.message || JSON.stringify(parsed.error)}`));
          }
          const text = parsed.choices?.[0]?.message?.content;
          if (!text) return reject(new Error("Empty response from OpenRouter"));
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Failed to parse OpenRouter response: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("OpenRouter request timed out"));
    });
    req.setTimeout(timeoutMs);
    req.write(body);
    req.end();
  });
}

// ─── STEP 1: Vision Extraction ───────────────────────────────────────────────
// Sends a page image to the Nano Omni vision model and extracts
// structured JSON: which question numbers exist and what color their box is.
// Images are resized to ≤1024px wide before sending to keep payload manageable.
async function analyzePageVision(imagePath) {
  const VISION_MODELS = [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nex-agi/nex-n2-pro:free",
  ];

  try {
    // Resize image to max 1024px wide to reduce base64 payload size
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
    const mimeType = "image/jpeg";

    const visionPrompt = `This is a page from a CBSE Class 12 answer sheet evaluated using the OSM (Online Subjective Marks) system.

The evaluator leaves colored rectangular annotation boxes on the page:
- GREEN box with a checkmark (✓) and a number = marks awarded for that question (e.g. "✓ 1 14S1" means 1 mark for question 14)
- RED box with 0 = zero marks given (e.g. "0 7S1" means 0 marks for question 7)  
- BLUE box with a sub-total = partial marks tally
- "REPEAT ANS+" stamp = answer was flagged as a repeated/duplicate and disqualified
- Student handwriting with NO colored box nearby = the answer was NEVER evaluated by the examiner

Your task: Look at this page and identify the evaluation status of each visible answer section.

Output ONLY a valid JSON array, no other text. Each element must have:
- "question_number": the question code visible (e.g. "14S1", "7S1", "Q3", or a number you can read)
- "box_color": "green" (marks given), "red" (zero marks), "blue" (subtotal), "repeat" (REPEAT stamp), or "none" (NO box found — UNEVALUATED)
- "marks": the number shown in the box as a string, or null if no box

Example: [{"question_number":"14S1","box_color":"green","marks":"1"},{"question_number":"7S1","box_color":"red","marks":"0"},{"question_number":"11","box_color":"none","marks":null}]

Also add one final summary object at the END of the array:
{"summary": true, "blank_page": true/false, "has_repeat_stamp": true/false, "unevaluated_count": <number of answers with no box>}

If the page appears blank (no student writing at all), output: [{"summary":true,"blank_page":true,"has_repeat_stamp":false,"unevaluated_count":0}]`;

    let visionResult = null;
    for (const model of VISION_MODELS) {
      try {
        visionResult = await openRouterRequest({
          model,
          max_tokens: 800,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64Image}` },
                },
                { type: "text", text: visionPrompt },
              ],
            },
          ],
        }, 45000);
        break; // success — stop trying fallback models
      } catch (modelErr) {
        console.warn(`[Vision] Model ${model} failed: ${modelErr.message} — trying next...`);
      }
    }

    if (!visionResult) return [];

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
// Passes the aggregated vision JSON + existing CV issues to the Ultra model
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
      const questions  = vp.questions.filter((q) => !q.summary);

      if (summaryObj?.blank_page) {
        totalBlank++;
        continue; // skip blank pages
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

Your task has two parts:
1. Write a professional 2-3 sentence audit recommendation for the student. State clearly whether re-evaluation is recommended and why. Use precise, factual language — this may be submitted to CBSE as evidence.
2. Then write exactly 3 practical tips for the evaluator to improve their grading process for future papers. Label them "Tip 1:", "Tip 2:", "Tip 3:".

Write in plain paragraphs only. Do not use bullet points or markdown.`;

  try {
    return await openRouterRequest({
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }, 20000);
  } catch (err) {
    console.error("OpenRouter reasoning API error:", err.message);
    // Fallback summary if Ultra model fails
    const critCount = issues.filter((i) => i.severity === "critical").length;
    return `${issues.length} issue(s) were detected during automated analysis, including ${critCount} critical issue(s). Manual review and re-evaluation is recommended. Tip 1: Ensure all pages are evaluated before submission. Tip 2: Use clearly legible marks to avoid misinterpretation. Tip 3: Double-check arithmetic totals on the front cover.`;
  }
}

module.exports = { generateAIAdvice, analyzePageVision };
