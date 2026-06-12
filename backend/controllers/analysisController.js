const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const Paper = require("../models/Paper");
const Issue = require("../models/Issue");
const { createEvent } = require("../utils/hashChain");
const { generateAIAdvice, analyzePageVision } = require("./aiController");
const { calculateTrustScore } = require("./trustController");

const PYTHON_DIR = path.join(__dirname, "../../python");

// Run a Python detector script and return parsed JSON output
function runPythonScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PYTHON_DIR, scriptName);
    const process = spawn("python", [scriptPath, ...args]);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => (stdout += data.toString()));
    process.stderr.on("data", (data) => (stderr += data.toString()));

    process.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python script ${scriptName} stderr:`, stderr);
        reject(new Error(`Script failed: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON parse error: ${stdout}`));
      }
    });
  });
}

async function updateStatus(paperId, status) {
  await Paper.findByIdAndUpdate(paperId, { status });
}

async function runAnalysisPipeline(paperId) {
  const paper = await Paper.findById(paperId);
  if (!paper) throw new Error("Paper not found");

  const processedDir = path.join("./processed", paperId.toString());
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  try {
    // ── PHASE 1: Extract pages ──────────────────────────────────────────────
    await updateStatus(paperId, "extracting_pages");
    const pageData = await runPythonScript("extract_pages.py", [
      paper.answerSheetPath,
      processedDir,
    ]);

    await Paper.findByIdAndUpdate(paperId, { totalPages: pageData.total_pages });
    await createEvent(paperId, "pages_extracted", {
      totalPages: pageData.total_pages,
      pageFiles: pageData.page_files,
    });

    // ── PHASE 2: Blur detection ─────────────────────────────────────────────
    await updateStatus(paperId, "detecting_blur");
    const blurData = await runPythonScript("detect_blur.py", [processedDir]);

    // Save blur issues
    for (const page of blurData.pages) {
      if (page.is_blurred) {
        await Issue.create({
          paperId,
          type: "blur_penalized",
          severity: page.blur_score < 50 ? "critical" : "high",
          pageNumber: page.page_number,
          blurScore: page.blur_score,
          contentDensity: page.content_density,
          details: `Page ${page.page_number} has blur score ${page.blur_score.toFixed(2)} (threshold: 100). Evaluator may not have been able to read this answer clearly.`,
        });
      }
    }

    await createEvent(paperId, "blur_check_complete", {
      blurredPages: blurData.pages.filter((p) => p.is_blurred).length,
      totalPages: blurData.pages.length,
    });

    // ── PHASE 3: Annotation detection ──────────────────────────────────────
    await updateStatus(paperId, "detecting_annotations");
    const annotationData = await runPythonScript("detect_annotations.py", [
      processedDir,
    ]);

    await createEvent(paperId, "annotations_detected", {
      totalAnnotations: annotationData.total_annotations,
      questionCodes: annotationData.all_question_codes,
    });

    // ── PHASE 4: Content detection ──────────────────────────────────────────
    await updateStatus(paperId, "detecting_content");
    const contentData = await runPythonScript("detect_content.py", [
      processedDir,
    ]);

    await createEvent(paperId, "content_detected", {
      pagesWithContent: contentData.pages.filter((p) => p.has_content).length,
    });

    // ── PHASE 4.5: Vision AI — run on content pages only ────────────────────
    // Uses the Nano Omni vision model to extract question-level annotation data.
    // We skip blank pages to conserve free-tier API rate limits.
    // A 2-second delay between calls avoids hitting the rate limiter.
    await updateStatus(paperId, "vision_analysis");
    const contentPages = contentData.pages.filter((p) => p.has_content);
    const visionPages = [];

    console.log(`[Vision] Running vision analysis on ${contentPages.length} content page(s)...`);
    for (const cp of contentPages) {
      const imagePath = path.join(processedDir, `page_${String(cp.page_number).padStart(3, "0")}.png`);
      if (!fs.existsSync(imagePath)) continue;

      const questions = await analyzePageVision(imagePath);
      visionPages.push({ pageNumber: cp.page_number, questions });
      console.log(`[Vision] Page ${cp.page_number}: found ${questions.length} question(s)`);

      // Rate-limit pause between pages (free tier ~10 req/min)
      if (contentPages.indexOf(cp) < contentPages.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    await createEvent(paperId, "vision_analysis_complete", {
      pagesAnalyzed: visionPages.length,
      totalQuestionsFound: visionPages.reduce((sum, vp) => sum + vp.questions.length, 0),
      unevaluatedQuestions: visionPages.reduce(
        (sum, vp) => sum + vp.questions.filter((q) => q.box_color === "none").length, 0
      ),
    });

    // ── PHASE 5: Cross-reference ────────────────────────────────────────────
    await updateStatus(paperId, "cross_referencing");

    const blurMap = {};
    for (const p of blurData.pages) blurMap[p.page_number] = p;

    const annotMap = {};
    for (const p of annotationData.pages) annotMap[p.page_number] = p;

    for (const contentPage of contentData.pages) {
      const pageNum = contentPage.page_number;
      const annotPage = annotMap[pageNum];
      const blurPage = blurMap[pageNum];

      // Type A: Content but NO annotation at all → completely skipped
      if (
        contentPage.has_content &&
        (!annotPage || annotPage.annotations.length === 0)
      ) {
        await Issue.create({
          paperId,
          type: "unevaluated_page",
          severity: "critical",
          pageNumber: pageNum,
          contentDensity: contentPage.content_density,
          details: `Page ${pageNum} contains student writing (content density: ${(contentPage.content_density * 100).toFixed(1)}%) but has no evaluator annotation. This page was never evaluated.`,
        });
      }

      // Type B: Content + blurred + all zeros → blur-induced penalization
      if (
        contentPage.has_content &&
        blurPage?.is_blurred &&
        annotPage?.all_zeros
      ) {
        await Issue.create({
          paperId,
          type: "blur_penalized",
          severity: "critical",
          pageNumber: pageNum,
          blurScore: blurPage.blur_score,
          contentDensity: contentPage.content_density,
          details: `Page ${pageNum} received zero marks but had a blur score of ${blurPage.blur_score.toFixed(2)}. The evaluator likely could not read the answer due to poor scan quality.`,
        });
      }

      // REPEAT stamp detected
      if (annotPage?.has_repeat_stamp) {
        await Issue.create({
          paperId,
          type: "repeat_stamp",
          severity: "high",
          pageNumber: pageNum,
          details: `Page ${pageNum} has a REPEAT ANS+ stamp. Answer was flagged as a repeat and may have been disqualified.`,
        });
      }

      // Supplement missing (PTO/Contd found but page count seems low)
      if (
        contentPage.has_pto_marker &&
        pageData.total_pages < contentPage.expected_min_pages
      ) {
        await Issue.create({
          paperId,
          type: "supplement_missing",
          severity: "critical",
          pageNumber: pageNum,
          details: `Page ${pageNum} contains a "P.T.O." or "Contd." marker but no supplement pages were found. Answer may be incomplete in the evaluated copy.`,
        });
      }
    }

    // Arithmetic errors — check blue box totals
    for (const annotPage of annotationData.pages) {
      for (const arith of annotPage.arithmetic_errors || []) {
        await Issue.create({
          paperId,
          type: "arithmetic_error",
          severity: "high",
          pageNumber: annotPage.page_number,
          questionCode: arith.question_code,
          detectedMark: arith.computed_total,
          expectedMark: arith.recorded_total,
          details: `Question ${arith.question_code}: individual marks sum to ${arith.computed_total} but the total box shows ${arith.recorded_total}.`,
        });
      }
    }

    // Missing pages — check page number sequence
    const pageNumbers = contentData.pages
      .map((p) => p.printed_page_number)
      .filter((n) => n !== null)
      .sort((a, b) => a - b);

    for (let i = 1; i < pageNumbers.length; i++) {
      if (pageNumbers[i] - pageNumbers[i - 1] > 1) {
        for (
          let missing = pageNumbers[i - 1] + 1;
          missing < pageNumbers[i];
          missing++
        ) {
          await Issue.create({
            paperId,
            type: "missing_page",
            severity: "critical",
            pageNumber: missing,
            details: `Page ${missing} is missing from the scanned PDF. The evaluator never saw this page.`,
          });
        }
      }
    }

    await createEvent(paperId, "cross_reference_complete", {
      issuesFound: await Issue.countDocuments({ paperId }),
    });

    // ── PHASE 6: Trust score ────────────────────────────────────────────────
    await updateStatus(paperId, "calculating_score");
    const { trustScore, breakdown } = await calculateTrustScore(paperId);
    await Paper.findByIdAndUpdate(paperId, {
      trustScore,
      trustBreakdown: breakdown,
    });
    await createEvent(paperId, "trust_score_calculated", { trustScore, breakdown });

    // ── PHASE 7: AI advice (Reasoning model + Vision JSON) ─────────────────
    await updateStatus(paperId, "generating_advice");
    const advice = await generateAIAdvice(paperId, visionPages);
    await Paper.findByIdAndUpdate(paperId, { aiAdvice: advice });
    await createEvent(paperId, "ai_advice_generated", {
      adviceLength: advice.length,
    });

    // ── COMPLETE ────────────────────────────────────────────────────────────
    await updateStatus(paperId, "complete");
    await createEvent(paperId, "analysis_complete", { trustScore });
  } catch (err) {
    console.error("Pipeline error for paper", paperId, err);
    await Paper.findByIdAndUpdate(paperId, {
      status: "error",
      errorMessage: err.message,
    });
  }
}

module.exports = { runAnalysisPipeline };
