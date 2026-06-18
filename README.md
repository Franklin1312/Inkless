# Inkless — CBSE OSM Audit Platform

> **ExamChain** — Independent, blockchain-anchored verification and audit layer for CBSE's OSM digital evaluation system, powered by a dual-AI vision pipeline and an on-chain tamper-proof record.

[![GitHub](https://img.shields.io/badge/GitHub-Franklin1312%2FInkless-blue?logo=github)](https://github.com/Franklin1312/Inkless)
[![Sepolia](https://img.shields.io/badge/Contract-Sepolia%20Testnet-8A2BE2?logo=ethereum)](https://sepolia.etherscan.io/address/0xdE25F355f0628ab06A0839FD563FD6Fed298e2c0#code)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What is Inkless?

Inkless is an open-source, end-to-end CBSE answer sheet audit platform with two complementary tools:

| Tool | Who is it for? | What it does |
|------|----------------|--------------|
| **Audit Tool** | Students / Parents | Uploads an OSM-evaluated PDF and uses AI + computer vision to detect unevaluated pages, blurred scans, arithmetic errors, and missing supplements. Commits the audit record immutably to the Ethereum Sepolia blockchain. |
| **OSM Evaluator** | Evaluators / Schools | A full-featured in-browser marking tool. Open any CBSE answer sheet PDF, place green award marks, red zeros, blue subtotals, REPEAT ANS+ stamps, and blank-page markers. Export a professionally annotated marked PDF or JSON audit report — all locally, with no upload. |

---

## Project Structure

```
inkless/
├── frontend/           Next.js 14 + React 18 + TypeScript
│   ├── public/
│   │   └── osm-evaluator.html   ← Standalone OSM Marking Tool
│   └── src/
│       ├── app/                 ← Pages (landing, analysis/[id])
│       ├── components/          ← Dashboard, Viewer, Blockchain UI
│       ├── hooks/               ← useBlockchain (ethers v6 + MetaMask)
│       └── lib/                 ← API client, contract config + ABI
├── backend/            Node.js + Express + MongoDB
│   ├── controllers/             ← Analysis, AI, Trust score
│   ├── models/                  ← Paper, Issue, Event (Mongoose)
│   ├── routes/                  ← /papers, /audit, /analysis
│   └── utils/                   ← SHA-256 hash chain
├── python/             Computer Vision pipeline
│   ├── extract_pages.py         ← PDF → PNG (PyMuPDF)
│   ├── detect_blur.py           ← Laplacian variance blur score
│   ├── detect_annotations.py   ← OSM box detection (OpenCV HSV)
│   └── detect_content.py       ← Student ink presence
└── hardhat/            Ethereum Smart Contract
    ├── contracts/
    │   └── InklessAudit.sol     ← On-chain audit trail contract
    ├── scripts/
    │   └── deploy.js            ← Sepolia deployment script
    └── deployments/
        └── sepolia.json         ← Deployed contract address + ABI
```

---

## Blockchain — InklessAudit Smart Contract

The `InklessAudit.sol` contract is **live and verified** on the Ethereum Sepolia testnet:

| Field | Value |
|-------|-------|
| **Contract** | [`0xdE25F355f0628ab06A0839FD563FD6Fed298e2c0`](https://sepolia.etherscan.io/address/0xdE25F355f0628ab06A0839FD563FD6Fed298e2c0#code) |
| **Network** | Sepolia Testnet (Chain ID: 11155111) |
| **Language** | Solidity ^0.8.24 |

### What gets stored on-chain

```solidity
struct EvaluationRecord {
    bytes32   evaluationHash;      // keccak256 tamper fingerprint
    string    studentRollNumber;
    string    evaluatorId;
    string    subject;
    string    examYear;
    uint16    totalMarksAwarded;
    uint16    totalMaxMarks;
    uint256   timestamp;
    bool      exists;
    bool      verified;
}
```

Per-question marks (`QuestionMark[]`), evaluator history, student history, and dispute logs are also stored immutably.

### Flow

1. Analysis completes → **Submit Evaluation On-Chain** button appears in the Audit Trail tab
2. User connects MetaMask (Sepolia network)
3. Contract call is signed via wallet — no private key ever touches the frontend
4. Transaction is mined on Sepolia, `EvaluationSubmitted` event emitted
5. Evaluation ID (a `bytes32` hash) is displayed with a link to Etherscan
6. Anyone can paste the Evaluation ID into the **On-Chain Audit Verifier** on the homepage to verify tamper status

---

## AI Pipeline (2-Model Architecture)

```
PDF Answer Sheet
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 1 — Computer Vision (Python / OpenCV / PyMuPDF) │
│  Extract pages • Detect blur • Find OSM annotation boxes│
│  Detect student ink content • OCR page numbers          │
└─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 2 — VISION AI (Google Gemini 2.5 Flash)         │
│  Reads each content page image                          │
│  Outputs structured JSON: question codes + box colors   │
│  Detects blank pages and REPEAT ANS+ stamps             │
└─────────────────────────────────────────────────────────┘
     │  JSON: [{question_number, box_color, marks}, ...]
     ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 3 — Cross-Reference Engine (Node.js)            │
│  Merges CV signals + Vision AI output                   │
│  Creates Issue records: unevaluated, blur, arithmetic   │
│  Computes weighted Trust Score (0–100)                  │
└─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 4 — REASONING AI (Google Gemini 2.5 Flash)      │
│  Receives issue list + vision JSON                      │
│  Generates professional 3-4 sentence audit paragraph    │
│  Verdict: Re-evaluation recommended / Not required      │
└─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 5 — Blockchain Commit (optional, user-triggered) │
│  MetaMask signs transaction → InklessAudit.sol          │
│  Record permanently anchored on Ethereum Sepolia        │
└─────────────────────────────────────────────────────────┘
```

---

## OSM Evaluator Tool

A fully self-contained, browser-based OSM marking tool available at `/osm-evaluator.html` (no installation needed — served as a static file).

**Features:**
- 📂 Upload any CBSE answer sheet PDF or image
- 🖱 Click to place OSM annotation marks directly on the page:
  - ✅ **Green box** — Marks awarded
  - ❌ **Red box** — Zero marks
  - **Σ Blue box** — Subtotal
  - **REPEAT ANS+** — Repeat answer stamp
  - **⊗ Cross** — Wrong mark
  - **☐ Blank Page** — Mark as blank
- 📋 Questions panel with CBSE SQP 2025-26 Mathematics question list pre-loaded
- 📊 Live score tracking with trust score
- ⬇ Export a fully annotated marked PDF (with page footer and summary page)
- ⬇ Export full JSON audit report with hash chain
- 🔑 Keyboard shortcuts: `1`–`6` to switch annotation tools

---

## Full Processing Pipeline

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | `extracting_pages` | PDF → PNG images via PyMuPDF at 2× scale |
| 2 | `detecting_blur` | Blur score per page via OpenCV Laplacian variance |
| 3 | `detecting_annotations` | OSM box detection via OpenCV HSV colour masking + Tesseract |
| 4 | `detecting_content` | Student ink presence via pixel density + OCR |
| 4.5 | `vision_analysis` | **Gemini Vision** — question-level JSON extraction |
| 5 | `cross_referencing` | Content vs marks mismatch, arithmetic error detection |
| 6 | `calculating_score` | Weighted trust score computation |
| 7 | `generating_advice` | **Gemini Reasoning** — professional audit paragraph |
| — | `complete` | Full dashboard with Issues, Viewer, Audit Trail + Blockchain tab |

---

## Issue Types Detected

| Type | Severity | Description |
|------|----------|-------------|
| `unevaluated_page` | 🔴 Critical | Page has student content but zero evaluator annotations |
| `blur_penalized` | 🔴 Critical | Blurred page received zero marks |
| `missing_page` | 🔴 Critical | Gap in page number sequence |
| `supplement_missing` | 🔴 Critical | PTO marker found, supplement not attached |
| `content_marked_blank` | 🟠 High | Vision AI found content but page flagged as blank |
| `arithmetic_error` | 🟠 High | Blue box total ≠ sum of sub-marks |
| `repeat_stamp` | 🟠 High | REPEAT ANS+ stamp detected — answer may be disqualified |
| `blur_marks_awarded` | 🟠 High | Marks given on a blurry page — legibility questionable |

---

## OSM Annotation Format (CBSE 2026)

| Box Color | Meaning | Example Code |
|-----------|---------|--------------|
| Green | Marks awarded | `1 30a_iORS1` |
| Red | Zero marks | `0 34_ivaORS1` |
| Blue | Sub-total | `30a_i: 0.5+0=0.5` |
| Purple | REPEAT ANS+ stamp | Disqualified answer |

**Question code format:** `30a_iORS1`
- `30` = Question number
- `a` = Part
- `_i` = Sub-part
- `ORS` = Optional/alternate
- `S1` = Set number

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- MongoDB (running locally on port 27017)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (free, no credit card)
- MetaMask browser extension (for blockchain features)
- Tesseract OCR (optional — fallback)

---

### 1. Clone

```bash
git clone https://github.com/Franklin1312/Inkless.git
cd Inkless
```

### 2. Python Environment

```bash
cd python
pip install -r requirements.txt
```

Test:
```bash
python detect_blur.py
# → {"error": "Usage: detect_blur.py <processed_dir>"}
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — fill in GEMINI_API_KEY
npm run dev
# Runs on http://localhost:5000
```

### 4. Frontend

```bash
cd frontend
npm install
# Create .env.local:
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=0xdE25F355f0628ab06A0839FD563FD6Fed298e2c0" >> .env.local
echo "NEXT_PUBLIC_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com" >> .env.local
npm run dev
# Runs on http://localhost:3000
```

### 5. (Optional) Blockchain — Redeploy Contract

Only needed if you want to deploy your own contract instance:

```bash
cd hardhat
npm install
cp .env.example .env
# Fill in PRIVATE_KEY and ETHERSCAN_API_KEY in hardhat/.env
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat verify --network sepolia <deployed_address>
```

---

## Environment Variables

### `backend/.env`

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/inkless
GEMINI_API_KEY=your_gemini_api_key_here
UPLOADS_DIR=./uploads
PROCESSED_DIR=./processed
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_CONTRACT_ADDRESS=0xdE25F355f0628ab06A0839FD563FD6Fed298e2c0
NEXT_PUBLIC_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
```

### `hardhat/.env` ⚠️ Never commit this file

```env
PRIVATE_KEY=your_deployer_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Vanilla CSS |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB |
| Computer Vision | OpenCV, PyMuPDF |
| OCR | Tesseract (optional) |
| AI — Vision | Google Gemini 2.5 Flash |
| AI — Reasoning | Google Gemini 2.5 Flash |
| Blockchain | Solidity 0.8.24, Hardhat 2, ethers v6 |
| Network | Ethereum Sepolia Testnet |
| Wallet | MetaMask (browser extension) |
| Audit Chain | SHA-256 hash chaining (MongoDB) |
| PDF Export | jsPDF + Canvas API (OSM Evaluator) |

---

## Blockchain Trust Model

| Layer | Tamper Protection |
|-------|------------------|
| **MongoDB event chain** | SHA-256 linked hash chain — any modification breaks integrity |
| **Ethereum Sepolia** | Immutable on-chain record — no one, including the deployer, can alter it |
| **Etherscan verification** | Source code verified — anyone can read and audit the contract logic |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

MIT — free to fork and adapt for any state board or examination system.

---

*Built to protect 17 lakh students affected by CBSE OSM 2026 evaluation failures.*
