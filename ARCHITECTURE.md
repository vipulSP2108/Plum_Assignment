# Plum Medical Report Simplifier — System Architecture

> **Author:** Vipul &nbsp;|&nbsp; **Internship Assignment** &nbsp;|&nbsp; AI-Powered Medical Report Processing Backend

![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js)
![AI](https://img.shields.io/badge/LLM-Groq%20%7C%20llama--3.3--70b-blue?logo=openai)
![OCR](https://img.shields.io/badge/OCR-Tesseract.js-orange)
![Docker](https://img.shields.io/badge/Dev-Docker%20Compose-blue?logo=docker)

This document describes the full technical architecture of the Plum Medical Report Simplifier — a backend service that accepts typed or scanned medical reports, extracts and normalises all lab test values, flags range mismatches for human review, and produces patient-friendly AI explanations with a built-in hallucination guard.

> [!NOTE]
> All diagrams below are provided in both **PNG** (for quick preview) and **SVG** (vector-based, high-quality) formats. SVG versions are linked below each diagram for detailed viewing.

---

## Table of Contents

1. [Diagram 1 — Master End-to-End Flow](#diagram-1--master-end-to-end-flow)
2. [Diagram 2 — Sequence of Interactions and Feedback Loop](#diagram-2--sequence-of-interactions-and-feedback-loop)
3. [Diagram 3 — Normalization Deep Dive](#diagram-3--normalization-deep-dive)
4. [Diagram 4 — AI Pipeline and Zero-Hallucination Balance](#diagram-4--ai-pipeline-and-zero-hallucination-balance)
5. [Diagram 5 — Audit Store and Confidence Score](#diagram-5--audit-store-and-confidence-score)
6. [File Map](#file-map)

---

## Diagram 1 — Master End-to-End Flow

![Diagram 1 — Master End-to-End Flow](docs/diagrams/diagram1_master_flow.png)
> SVG version (vector, zoomable): [diagram1_master_flow.svg](docs/diagrams/diagram1_master_flow.svg)

> Mermaid Source: [Diagram 1 — Master End-to-End Flow.mmd](scratch/Diagram%201%20%E2%80%94%20Master%20End-to-End%20Flow.mmd)

### Step-by-Step Notes

| Step | What Happens |
|---|---|
| **Input** | User POSTs to `/process-report` with an image file or plain text |
| **OCR** | Tesseract reads the image using `data/eng.traineddata`, returns raw text + confidence 0–1 |
| **Text path** | Body text used directly, confidence = 1.0 (no OCR uncertainty) |
| **Line Splitter** | Splits on newline, then on comma/semicolon *only before a letter* so `11,200` stays intact |
| **A: Number** | Reads the numeric value — handles `11,200 → 11200`, `250k → 250000`, `5 lakh → 500000` |
| **B: Unit** | Word-boundary regex matches `mg/dL`, `g/dL`, `/uL`, `mmol/L`, `%`, `lakh`, `mIU/L` and more |
| **C: Report Range** | Finds two numbers separated by a dash e.g. `8.5-10.2`, stored as `{low, high}` |
| **D: Clean Name** | Strips numbers, units, ranges, status words, brackets — leaves only the test name |
| **E: Fuzzy Match** | Searches `medical_ranges.json` using fuse.js. `id` weight 2, `display_name` weight 1. Score 0=perfect, score ≥0.5=no match |
| **F: Convert** | `units.js convertValue(value, detectedUnit, KB_unit)` using CONVERSIONS lookup table |
| **Report Range** | Same conversion applied to doc range so both sides are on the same scale before comparison |
| **Mismatch → Audit** | If report range differs from KB range by more than 0.01, written immediately to `review_queue.json` |
| **G: Status** | `Math.min/max` handles inverted ranges. Value vs finalRange gives Low / Normal / High |
| **LLM Call 1** | `EXPLAINER_TEMPLATE` from `prompts.js` filled with test context, sent to Groq API |
| **LLM Call 2** | `JUDGE_TEMPLATE` checks if Call 1 invented anything — returns TRUE or FALSE |
| **Confidence** | `avg fuzzy score × 0.7 + ocrConfidence × 0.3` in `responseParser.js` |

---

## Diagram 2 — Sequence of Interactions and Feedback Loop

![Diagram 2 — Sequence of Interactions and Feedback Loop](docs/diagrams/diagram2_sequence.png)
> SVG version (vector, zoomable): [diagram2_sequence.svg](docs/diagrams/diagram2_sequence.svg)

> Mermaid Source: [Diagram 2 — Sequence of Interactions and Feedback Loop.mmd](scratch/Diagram%202%20%E2%80%94%20Sequence%20of%20Interactions%20and%20Feedback%20Loop.mmd)

### Actor Roles

| Actor | File | Role |
|---|---|---|
| `index.js` | `src/index.js` | Orchestrator — receives input, calls every step, returns result |
| `Tesseract.js` | library | OCR engine — image to raw text |
| `normalizer.js` | `src/services/report_api/normalizer.js` | Core engine — extracts, cleans, matches, converts, reconciles |
| `medical_ranges.json` | `data/medical_ranges.json` | Knowledge Base — source of truth for test ranges and canonical units |
| `audit.js` | `src/services/common/audit.js` | Permanent mismatch logger — writes to `review_queue.json` |
| `LLM Explainer` | Groq API + `EXPLAINER_TEMPLATE` | Generates patient-friendly summary |
| `LLM Judge` | Groq API + `JUDGE_TEMPLATE` | Verifies Call 1 — prevents hallucinations |
| `responseParser.js` | `src/services/report_api/responseParser.js` | Calculates confidence, formats final JSON |

---

## Diagram 3 — Normalization Deep Dive

![Diagram 3 — Normalization Deep Dive](docs/diagrams/diagram3_normalization.png)
> SVG version (vector, zoomable): [diagram3_normalization.svg](docs/diagrams/diagram3_normalization.svg)

> Mermaid Source: [Diagram 3 — Normalization Deep Dive.mmd](scratch/Diagram%203%20%E2%80%94%20Normalization%20Deep%20Dive.mmd)

### What Each Step Does

| Step | File | Logic |
|---|---|---|
| A — Read Value | `normalizer.js` | Regex, strips commas, `k` × 1000, `lakh` × 100000 |
| B — Read Unit | `normalizer.js` | Word-boundary regex, 17+ unit types |
| C — Report Range | `normalizer.js` | Pattern finds two numbers with dash, stored as `{low, high}` |
| D — Clean Name | `normalizer.js` | Strips unit, numbers, ranges, status keywords |
| E — Fuzzy Match | `fuse.js` → `medical_ranges.json` | `id` weight 2, `display_name` weight 1, score < 0.5 = match |
| F — Unit Convert | `units.js` | `convertValue(value, from, to)` lookup key like `mg/l_to_mg/dl` |
| G — Reconcile | `normalizer.js` | Compare converted ranges within tolerance 0.01, assign tag |
| Audit | `audit.js` | Triggered only on Mismatch tag — deduplicates then appends to `review_queue.json` |
| H — Status | `normalizer.js getStatus()` | `Math.min/max` normalizes inverted ranges, Low/Normal/High verdict |

---

## Diagram 4 — AI Pipeline and Zero-Hallucination Balance

![Diagram 4 — AI Pipeline and Zero-Hallucination Balance](docs/diagrams/diagram4_ai_pipeline.png)
> SVG version (vector, zoomable): [diagram4_ai_pipeline.svg](docs/diagrams/diagram4_ai_pipeline.svg)

> Mermaid Source: [Diagram 4 — AI Pipeline and Zero-Hallucination Balance.mmd](scratch/Diagram%204%20%E2%80%94%20AI%20Pipeline%20and%20Zero-Hallucination%20Balance.mmd)

### Why Two Calls?

| Call | Template | Purpose | Temperature |
|---|---|---|---|
| Call 1 — Explainer | `EXPLAINER_TEMPLATE` | Generate patient-friendly summaries | Default |
| Call 2 — Judge | `JUDGE_TEMPLATE` | Verify Call 1 invented nothing new | 0 (deterministic) |

**Zero-Hallucination guarantee:** Context sent to LLM Call 1 is tightly scoped to only what `normalizer.js` found. The Judge cross-checks every test name and status against the original context. If anything was invented, it returns FALSE and the pipeline returns `status: unprocessed`.

---

## Diagram 5 — Audit Store and Confidence Score

![Diagram 5 — Audit Store and Confidence Score](docs/diagrams/diagram5_audit_confidence.png)
> SVG version (vector, zoomable): [diagram5_audit_confidence.svg](docs/diagrams/diagram5_audit_confidence.svg)

> Mermaid Source: [Diagram 5 — Audit Store and Confidence Score.mmd](scratch/Diagram%205%20%E2%80%94%20Audit%20Store%20and%20Confidence%20Score.mmd)

### Audit Entry Fields

| Field | Value |
|---|---|
| `timestamp` | When the mismatch was detected |
| `test_id` | Matched KB key e.g. `wbc` |
| `display_name` | Full name e.g. `White Blood Cell Count` |
| `raw_line` | Original text from the report |
| `value` | Extracted numeric value |
| `unit` | Unit detected from the line |
| `doc_range` | Report range converted to KB unit |
| `kb_range` | Range from `medical_ranges.json` |
| `reconciliation` | Tag e.g. `[Mismatch] Document range differs from Knowledge Base` |
| `status` | Always `pending_review` until human resolves |

### Confidence Score Examples

| Scenario | fuzzy score | ocrConfidence | Final |
|---|---|---|---|
| Text input, perfect match | 1.0 | 1.0 | 1.00 |
| Image input, good match | 0.9 | 0.85 | 0.885 |
| Text input, no KB match | 0.5 | 1.0 | 0.65 |

---

## File Map

| File | Role |
|---|---|
| `src/index.js` | Entry point — routing, input detection, line splitting, orchestrates all steps |
| `src/config/constants.js` | Feature flags: AI on/off, verification on/off, parser on/off, confidence weights |
| `src/config/prompts.js` | `EXPLAINER_TEMPLATE` and `JUDGE_TEMPLATE` — all LLM prompt text lives here |
| `src/services/report_api/normalizer.js` | Core engine — steps A through H: extract, clean, match, convert, reconcile, status |
| `src/services/report_api/responseParser.js` | Formats final JSON, calculates confidence score, handles hallucination gate |
| `src/services/common/ai.js` | LLM Call 1 (Explainer), LLM Call 2 (Judge), safe fallback builder |
| `src/services/common/units.js` | `CONVERSIONS` table, `convertValue(value, from, to)` function |
| `src/services/common/audit.js` | Filters Mismatch, deduplicates, appends to `review_queue.json` |
| `data/medical_ranges.json` | Knowledge Base — 15+ tests with reference range, canonical unit, description |
| `data/review_queue.json` | Permanent mismatch log — append-only, only a human can delete entries |
| `data/eng.traineddata` | Tesseract language model for English OCR recognition |
