const mongoose = require("mongoose");

const paperSchema = new mongoose.Schema(
  {
    studentName: { type: String, default: "Unknown" },
    rollNumber: { type: String, default: "" },
    subject: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "uploaded",
        "extracting_pages",
        "detecting_blur",
        "detecting_annotations",
        "detecting_content",
        "vision_analysis",
        "cross_referencing",
        "calculating_score",
        "generating_advice",
        "complete",
        "error",
      ],
      default: "uploaded",
    },
    answerSheetPath: { type: String, required: true },
    totalPages: { type: Number, default: 0 },
    trustScore: { type: Number, default: null },
    trustBreakdown: {
      scanQuality: { type: Number, default: 100 },
      pageIntegrity: { type: Number, default: 100 },
      evaluationCompleteness: { type: Number, default: 100 },
      markAccuracy: { type: Number, default: 100 },
    },
    aiAdvice: { type: String, default: "" },
    errorMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Paper", paperSchema);
