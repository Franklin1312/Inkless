# Inkless — CBSE OSM Audit Platform

> **ExamChain** — Independent verification and audit layer for CBSE's OSM digital evaluation system, powered by a dual-AI vision pipeline.

[![GitHub](https://img.shields.io/badge/GitHub-ExamChain-blue?logo=github)](https://github.com/Franklin1312/Examchain)

---

## What is Inkless?

Inkless is an open-source audit tool that lets students and parents independently verify whether their CBSE evaluated answer sheet was properly graded by the examiner. It analyses the OSM (Online Subjective Marks) annotated PDF using computer vision and AI to detect unevaluated pages, blurred scans, arithmetic errors, and missing supplements — then generates a professional re-evaluation recommendation.

---

## Project Structure

```
inkless/
├── frontend/     Next.js 14 + React 18 + TypeScript + TailwindCSS
├── backend/      Node.js + Express + MongoDB + Mongoose
└── python/       OpenCV + PyMuPDF + Tesseract detection scripts
```

---

## AI Pipeline (2-Model Architecture)

Inkless uses a state-of-the-art dual-model pipeline via [OpenRouter](https://openrouter.ai):

```
Page Images
    │
    ▼
┌───────────────────────────────────────────────────────┐
│  Step 1 — VISION (nvidia/nemotron-3-nano-omni-30b)   │
│  "Eyes" — Reads each page, extracts question numbers  │
│  and evaluator box colors into structured JSON         │
└───────────────────────────────────────────────────────┘
    │  JSON: [{"question_number":"1","box_color":"green"}, ...]
    ▼
┌───────────────────────────────────────────────────────┐
│  Step 2 — JSON HANDOFF (The Bridge)                   │
│  Vision JSON + CV pipeline issues merged together      │
└───────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────┐
│  Step 3 — REASONING (nvidia/nemotron-3-ultra-550b)    │
│  "Brain" — Identifies missing evaluations, sequences  │
│  gaps, and generates 3 teacher improvement tips        │
└───────────────────────────────────────────────────────┘
```

Both models are used via their **free tier** on OpenRouter — no paid API key needed.

---

## Prerequisites

- Node.js 18+
- Python 3.9+
- MongoDB (running locally on port 27017)
- An [OpenRouter](https://openrouter.ai) API key (free account)
- Tesseract OCR (optional — used as OCR fallback)

### Install Tesseract (optional)

**Ubuntu/Debian:**
```bash
sudo apt install tesseract-ocr
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
Download installer from: https://github.com/UB-Mannheim/tesseract/wiki

---

## Setup

### 1. Python environment

```bash
cd python
pip install -r requirements.txt
```

Test it works:
```bash
python detect_blur.py
# Should print: {"error": "Usage: detect_blur.py <processed_dir>"}
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — add your OPENROUTER_API_KEY
npm run dev
```

Backend runs on: http://localhost:5000

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: http://localhost:3000

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

Get a **free** Gemini API key (no credit card) at: https://aistudio.google.com/apikey

Free tier limits: **1,500 requests/day**, 10 RPM — more than enough for auditing answer sheets.

---

## How It Works

1. Student uploads their CBSE OSM-evaluated answer sheet PDF
2. Backend saves file, creates paper record in MongoDB, starts pipeline
3. Python scripts run in sequence:
   - `extract_pages.py` — renders each PDF page as a PNG image
   - `detect_blur.py` — Laplacian variance blur score per page
   - `detect_annotations.py` — detects green/red/blue OSM annotation boxes
   - `detect_content.py` — detects student ink + OCR per page
4. **Vision AI** (Nano Omni) analyses each content page, extracts question-level annotation JSON
5. Node cross-references all signals, writes issues to MongoDB
6. Trust score calculated from weighted issue deductions
7. **Reasoning AI** (Ultra) receives the JSON + issues, generates audit recommendation + 3 teacher tips
8. SHA-256 hash chain records every event as a tamper-evident audit trail
9. Frontend polls for status, renders dashboard with viewer + audit trail

---

## Full Processing Pipeline

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | `extracting_pages` | PDF → PNG images via PyMuPDF |
| 2 | `detecting_blur` | Blur score per page via OpenCV Laplacian |
| 3 | `detecting_annotations` | OSM box detection via OpenCV HSV + Tesseract |
| 4 | `detecting_content` | Student ink presence via pixel density + OCR |
| 4.5 | `vision_analysis` | **AI Vision** — question-level JSON extraction (Nano Omni) |
| 5 | `cross_referencing` | Content vs marks mismatch detection |
| 6 | `calculating_score` | Weighted trust score computation |
| 7 | `generating_advice` | **AI Reasoning** — audit recommendation + tips (Ultra) |
| — | `complete` | Dashboard ready |

---

## OSM Annotation Format (CBSE 2026)

| Box Color | Meaning | Example |
|-----------|---------|---------|
| Green | Marks awarded | `1 30a_iORS1` |
| Red | Zero marks | `0 34_ivaORS1` |
| Blue | Sub-total | `30a_i : 0.5 + 0 = 0.5` |
| Purple | REPEAT ANS+ stamp | disqualified answer |
| Red ⊗ | Wrong answer cross | wrong mark |

Question code format: `30a_iORS1`
- `30` = Question number
- `a` = Part
- `_i` = Sub-part
- `ORS` = Optional/alternate (if applicable)
- `S1` = Set number

---

## Detection Modules

| Module | What It Detects | Tech |
|--------|----------------|------|
| Blur detector | Pages too blurry for fair evaluation | OpenCV Laplacian |
| Annotation detector | All evaluator marks + question codes | OpenCV HSV + Tesseract |
| Content detector | Student writing presence | Pixel density + OCR |
| Vision AI | Question numbers + box colors per page | Nano Omni (vision LLM) |
| Cross-reference engine | Content vs marks mismatch | Pure Python logic |
| Trust score | Weighted issue scoring | Pure math |
| AI advisor | Audit recommendation + teacher tips | Ultra (reasoning LLM) |
| Audit trail | Tamper-evident event log | SHA-256 chain |

---

## Issue Types

| Type | Severity | Description |
|------|----------|-------------|
| `unevaluated_page` | Critical | Page has student content, zero evaluator annotations |
| `blur_penalized` | Critical | Blurred page received zero marks |
| `missing_page` | Critical | Gap in page number sequence |
| `supplement_missing` | Critical | PTO marker found, supplement not attached |
| `arithmetic_error` | High | Blue box total ≠ sum of sub-marks |
| `repeat_stamp` | High | REPEAT ANS+ stamp detected |

---

## Audit Trail (Hash Chain)

Every event in the pipeline is recorded with:
- **SHA-256 hash** of its own data
- **Previous event's hash** as the chain link

This means if anyone modifies a MongoDB record after the fact, the hash chain will break — making tampering detectable. The system does **not** use a public blockchain, but the chain structure is conceptually identical to Ethereum's block chaining.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB |
| CV | OpenCV, PyMuPDF |
| OCR | Tesseract (optional) |
| Vision AI | Google Gemini 2.5 Flash (free, 1500 req/day) |
| Reasoning AI | Google Gemini 2.5 Flash (same model, text-only) |
| Audit | SHA-256 hash chaining |
| Viewer | React-Konva canvas |

---

## Demo

To prepare a reliable demo PDF:

1. Take any CBSE OSM answer sheet PDF (look for the coloured annotation boxes)
2. Ensure at least one page has visible student content but no green/red annotation box
3. Ensure at least one page is noticeably blurred with a red zero box
4. Upload through the Inkless dashboard
5. Output should show Trust Score < 70 with critical issues

An example test file `inkless-osm-marked.pdf` is included at the project root (not committed to git).

---

## License

MIT — feel free to fork and adapt for any state board or examination system.
