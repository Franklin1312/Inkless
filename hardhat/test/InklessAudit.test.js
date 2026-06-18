const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InklessAudit", function () {
  let contract;
  let owner, evaluator, admin;

  // Sample 2025 paper evaluation data
  const STUDENT_ROLL = "1234567";
  const EVALUATOR_ID = "EVL-CBSE-2025-001";
  const SUBJECT = "Mathematics";
  const EXAM_YEAR = "2025";

  const QUESTION_CODES  = ["1a", "1b", "2", "3a", "3b", "4", "5"];
  const MARKS_AWARDED   = [4, 3, 5, 2, 3, 6, 4];
  const MAX_MARKS       = [4, 4, 5, 3, 3, 6, 5];
  const BOX_COLORS      = ["green", "green", "green", "red", "green", "blue", "green"];
  const TOTAL_AWARDED   = 27;
  const TOTAL_MAX       = 30;

  beforeEach(async function () {
    [owner, evaluator, admin] = await ethers.getSigners();
    const InklessAudit = await ethers.getContractFactory("InklessAudit");
    contract = await InklessAudit.deploy();
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set deployer as owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Should start with zero evaluations", async function () {
      expect(await contract.totalEvaluations()).to.equal(0);
    });
  });

  describe("submitEvaluation()", function () {
    it("Should submit an evaluation and emit event", async function () {
      const tx = await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      expect(await contract.totalEvaluations()).to.equal(1);
    });

    it("Should emit EvaluationSubmitted with correct data", async function () {
      await expect(
        contract.submitEvaluation(
          STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
          QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
          TOTAL_AWARDED, TOTAL_MAX
        )
      ).to.emit(contract, "EvaluationSubmitted")
        .withArgs(
          // evaluationId is dynamic, skip check
          ethers.isHexString,  // evaluationId (bytes32)
          STUDENT_ROLL,
          EVALUATOR_ID,
          TOTAL_AWARDED,
          TOTAL_MAX,
          // timestamp is dynamic
          ethers.isHexString
        );
    });

    it("Should store correct total marks", async function () {
      const tx = await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const receipt = await tx.wait();
      // Extract evaluationId from event
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "EvaluationSubmitted"
      );
      const evaluationId = event.args[0];

      const record = await contract.getEvaluation(evaluationId);
      expect(record.totalMarksAwarded).to.equal(TOTAL_AWARDED);
      expect(record.totalMaxMarks).to.equal(TOTAL_MAX);
      expect(record.studentRollNumber).to.equal(STUDENT_ROLL);
      expect(record.evaluatorId).to.equal(EVALUATOR_ID);
      expect(record.subject).to.equal(SUBJECT);
      expect(record.verified).to.equal(false);
    });

    it("Should store per-question marks correctly", async function () {
      const tx = await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "EvaluationSubmitted"
      );
      const evaluationId = event.args[0];

      const qMarks = await contract.getQuestionMarks(evaluationId);
      expect(qMarks.length).to.equal(QUESTION_CODES.length);
      expect(qMarks[0].questionCode).to.equal("1a");
      expect(qMarks[0].marksAwarded).to.equal(4);
      expect(qMarks[0].boxColor).to.equal("green");
      expect(qMarks[2].questionCode).to.equal("2");
      expect(qMarks[3].marksAwarded).to.equal(2); // red (0 or low)
      expect(qMarks[3].boxColor).to.equal("red");
    });

    it("Should revert if marks exceed max", async function () {
      await expect(
        contract.submitEvaluation(
          STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
          QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
          999, TOTAL_MAX  // awarded > max
        )
      ).to.be.revertedWith("InklessAudit: marks exceed maximum");
    });

    it("Should revert on empty roll number", async function () {
      await expect(
        contract.submitEvaluation(
          "", EVALUATOR_ID, SUBJECT, EXAM_YEAR,
          QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
          TOTAL_AWARDED, TOTAL_MAX
        )
      ).to.be.revertedWith("InklessAudit: empty roll number");
    });

    it("Should revert on array length mismatch", async function () {
      await expect(
        contract.submitEvaluation(
          STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
          QUESTION_CODES, [1, 2], MAX_MARKS, BOX_COLORS, // wrong length
          TOTAL_AWARDED, TOTAL_MAX
        )
      ).to.be.revertedWith("InklessAudit: array length mismatch");
    });
  });

  describe("verifyHash()", function () {
    it("Should return valid hash for untampered record", async function () {
      const tx = await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "EvaluationSubmitted"
      );
      const evaluationId = event.args[0];

      const [isValid] = await contract.verifyHash(evaluationId);
      expect(isValid).to.equal(true);
    });
  });

  describe("verifyEvaluation()", function () {
    it("Should allow owner to verify evaluation", async function () {
      const tx = await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "EvaluationSubmitted"
      );
      const evaluationId = event.args[0];

      await contract.verifyEvaluation(evaluationId);
      const record = await contract.getEvaluation(evaluationId);
      expect(record.verified).to.equal(true);
    });

    it("Should revert if non-owner tries to verify", async function () {
      const tx = await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "EvaluationSubmitted"
      );
      const evaluationId = event.args[0];

      await expect(
        contract.connect(evaluator).verifyEvaluation(evaluationId)
      ).to.be.revertedWith("InklessAudit: caller is not the owner");
    });
  });

  describe("raiseDispute()", function () {
    it("Should emit MarksDisputed event", async function () {
      const tx = await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "EvaluationSubmitted"
      );
      const evaluationId = event.args[0];

      await expect(
        contract.connect(evaluator).raiseDispute(evaluationId, "Q3b marks missing")
      ).to.emit(contract, "MarksDisputed")
        .withArgs(evaluationId, "Q3b marks missing", evaluator.address, ethers.isHexString);
    });
  });

  describe("History lookups", function () {
    it("Should return evaluator history", async function () {
      await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const history = await contract.getEvaluatorHistory(EVALUATOR_ID);
      expect(history.length).to.equal(1);
    });

    it("Should return student history", async function () {
      await contract.submitEvaluation(
        STUDENT_ROLL, EVALUATOR_ID, SUBJECT, EXAM_YEAR,
        QUESTION_CODES, MARKS_AWARDED, MAX_MARKS, BOX_COLORS,
        TOTAL_AWARDED, TOTAL_MAX
      );
      const history = await contract.getStudentHistory(STUDENT_ROLL);
      expect(history.length).to.equal(1);
    });
  });
});
