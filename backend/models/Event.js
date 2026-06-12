const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paper",
      required: true,
    },
    eventType: {
      type: String,
      enum: [
        "uploaded",
        "pages_extracted",
        "blur_check_complete",
        "annotations_detected",
        "content_detected",
        "vision_analysis_complete",
        "cross_reference_complete",
        "trust_score_calculated",
        "ai_advice_generated",
        "analysis_complete",
      ],
      required: true,
    },
    eventData: { type: mongoose.Schema.Types.Mixed, default: {} },
    hash: { type: String, required: true },
    previousHash: { type: String, default: "0" },
    sequence: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
