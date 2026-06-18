// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title InklessAudit
 * @notice On-chain audit trail for CBSE OSM (On-Screen Marking) evaluations
 * @dev Stores evaluation hash, per-question marks, evaluator ID, and final score
 *      Deployed on Sepolia Testnet for Inkless project
 * @author Franklin (GitHub: Franklin1312)
 */
contract InklessAudit {

    // ─── Structs ───────────────────────────────────────────────────────────────

    struct QuestionMark {
        string  questionCode;   // e.g. "30a_iORS1"
        uint8   marksAwarded;
        uint8   maxMarks;
        string  boxColor;       // "green" | "red" | "blue" | "purple"
    }

    struct EvaluationRecord {
        bytes32   evaluationHash;      // keccak256 of (studentId + evaluatorId + marks)
        string    studentRollNumber;
        string    evaluatorId;
        string    subject;             // e.g. "Mathematics", "Science"
        string    examYear;            // "2025"
        uint16    totalMarksAwarded;
        uint16    totalMaxMarks;
        uint256   timestamp;
        bool      exists;
        bool      verified;            // set by admin after second review
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    address public owner;

    // evaluationId => EvaluationRecord
    mapping(bytes32 => EvaluationRecord) public evaluations;

    // evaluationId => array of QuestionMark
    mapping(bytes32 => QuestionMark[]) public questionMarks;

    // evaluatorId => list of evaluationIds submitted by them
    mapping(string => bytes32[]) public evaluatorHistory;

    // studentRollNumber => list of evaluationIds for that student
    mapping(string => bytes32[]) public studentHistory;

    // total evaluations submitted
    uint256 public totalEvaluations;

    // ─── Events ────────────────────────────────────────────────────────────────

    event EvaluationSubmitted(
        bytes32 indexed evaluationId,
        string  indexed studentRollNumber,
        string          evaluatorId,
        uint16          totalMarksAwarded,
        uint16          totalMaxMarks,
        uint256         timestamp
    );

    event EvaluationVerified(
        bytes32 indexed evaluationId,
        address verifiedBy,
        uint256 timestamp
    );

    event MarksDisputed(
        bytes32 indexed evaluationId,
        string  reason,
        address disputedBy,
        uint256 timestamp
    );

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "InklessAudit: caller is not the owner");
        _;
    }

    modifier evaluationExists(bytes32 evaluationId) {
        require(evaluations[evaluationId].exists, "InklessAudit: evaluation not found");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Submit a completed evaluation to the blockchain
     * @param studentRollNumber CBSE roll number of the student
     * @param evaluatorId       Unique ID of the evaluator
     * @param subject           Subject name
     * @param examYear          Year of exam (e.g. "2025")
     * @param questionCodes     Array of question codes (e.g. ["1a", "1b", "2"])
     * @param marksAwarded      Array of marks given per question
     * @param maxMarks          Array of max marks per question
     * @param boxColors         Array of annotation colors per question
     * @param totalMarksAwarded Final total marks
     * @param totalMaxMarks     Total maximum marks
     * @return evaluationId     Unique ID for this evaluation record
     */
    function submitEvaluation(
        string    memory studentRollNumber,
        string    memory evaluatorId,
        string    memory subject,
        string    memory examYear,
        string[]  memory questionCodes,
        uint8[]   memory marksAwarded,
        uint8[]   memory maxMarks,
        string[]  memory boxColors,
        uint16           totalMarksAwarded,
        uint16           totalMaxMarks
    ) external returns (bytes32 evaluationId) {

        // Input validation
        require(bytes(studentRollNumber).length > 0, "InklessAudit: empty roll number");
        require(bytes(evaluatorId).length > 0,       "InklessAudit: empty evaluator ID");
        require(questionCodes.length == marksAwarded.length, "InklessAudit: array length mismatch");
        require(questionCodes.length == maxMarks.length,     "InklessAudit: array length mismatch");
        require(questionCodes.length == boxColors.length,    "InklessAudit: array length mismatch");
        require(totalMarksAwarded <= totalMaxMarks,          "InklessAudit: marks exceed maximum");

        // Generate deterministic evaluation ID
        evaluationId = keccak256(
            abi.encodePacked(
                studentRollNumber,
                evaluatorId,
                subject,
                examYear,
                block.timestamp,
                totalMarksAwarded
            )
        );

        // Compute audit hash (tamper-proof fingerprint)
        bytes32 evaluationHash = keccak256(
            abi.encodePacked(
                evaluationId,
                studentRollNumber,
                evaluatorId,
                totalMarksAwarded,
                totalMaxMarks
            )
        );

        // Store main record
        evaluations[evaluationId] = EvaluationRecord({
            evaluationHash:     evaluationHash,
            studentRollNumber:  studentRollNumber,
            evaluatorId:        evaluatorId,
            subject:            subject,
            examYear:           examYear,
            totalMarksAwarded:  totalMarksAwarded,
            totalMaxMarks:      totalMaxMarks,
            timestamp:          block.timestamp,
            exists:             true,
            verified:           false
        });

        // Store per-question marks
        for (uint256 i = 0; i < questionCodes.length; i++) {
            questionMarks[evaluationId].push(QuestionMark({
                questionCode:  questionCodes[i],
                marksAwarded:  marksAwarded[i],
                maxMarks:      maxMarks[i],
                boxColor:      boxColors[i]
            }));
        }

        // Update lookup indices
        evaluatorHistory[evaluatorId].push(evaluationId);
        studentHistory[studentRollNumber].push(evaluationId);
        totalEvaluations++;

        emit EvaluationSubmitted(
            evaluationId,
            studentRollNumber,
            evaluatorId,
            totalMarksAwarded,
            totalMaxMarks,
            block.timestamp
        );

        return evaluationId;
    }

    /**
     * @notice Admin verifies an evaluation after second review
     */
    function verifyEvaluation(bytes32 evaluationId)
        external
        onlyOwner
        evaluationExists(evaluationId)
    {
        require(!evaluations[evaluationId].verified, "InklessAudit: already verified");
        evaluations[evaluationId].verified = true;
        emit EvaluationVerified(evaluationId, msg.sender, block.timestamp);
    }

    /**
     * @notice Log a dispute against an evaluation (anyone can raise)
     */
    function raiseDispute(bytes32 evaluationId, string calldata reason)
        external
        evaluationExists(evaluationId)
    {
        require(bytes(reason).length > 0, "InklessAudit: reason required");
        emit MarksDisputed(evaluationId, reason, msg.sender, block.timestamp);
    }

    // ─── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Get full evaluation record
     */
    function getEvaluation(bytes32 evaluationId)
        external
        view
        evaluationExists(evaluationId)
        returns (EvaluationRecord memory)
    {
        return evaluations[evaluationId];
    }

    /**
     * @notice Get all per-question marks for an evaluation
     */
    function getQuestionMarks(bytes32 evaluationId)
        external
        view
        evaluationExists(evaluationId)
        returns (QuestionMark[] memory)
    {
        return questionMarks[evaluationId];
    }

    /**
     * @notice Get count of questions in an evaluation
     */
    function getQuestionCount(bytes32 evaluationId)
        external
        view
        returns (uint256)
    {
        return questionMarks[evaluationId].length;
    }

    /**
     * @notice Verify the audit hash matches stored record (tamper detection)
     */
    function verifyHash(bytes32 evaluationId)
        external
        view
        evaluationExists(evaluationId)
        returns (bool isValid, bytes32 storedHash, bytes32 computedHash)
    {
        EvaluationRecord memory rec = evaluations[evaluationId];
        computedHash = keccak256(
            abi.encodePacked(
                evaluationId,
                rec.studentRollNumber,
                rec.evaluatorId,
                rec.totalMarksAwarded,
                rec.totalMaxMarks
            )
        );
        storedHash = rec.evaluationHash;
        isValid = (storedHash == computedHash);
    }

    /**
     * @notice Get all evaluation IDs by a specific evaluator
     */
    function getEvaluatorHistory(string calldata evaluatorId)
        external
        view
        returns (bytes32[] memory)
    {
        return evaluatorHistory[evaluatorId];
    }

    /**
     * @notice Get all evaluation IDs for a student
     */
    function getStudentHistory(string calldata studentRollNumber)
        external
        view
        returns (bytes32[] memory)
    {
        return studentHistory[studentRollNumber];
    }

    /**
     * @notice Transfer contract ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "InklessAudit: zero address");
        owner = newOwner;
    }
}
