# Plum Medical Report Simplifier (AuraDoc)

A production-ready medical report simplification engine that uses OCR and AI to deliver patient-friendly, clinically accurate report summaries.

---

## 📽️ Project Resources & Video Demos
Stay updated with our project walkthroughs and tutorials:
- **Video 1:** [AI-Powered Medical Report Simplifier API Application](https://youtu.be/GROvdMVBBqE) — Overview and Live Demo.
- **Video 2:** [AI-Powered Medical Report Simplifier API Architecture](https://youtu.be/6IKSPyUs2eg) — Deep dive into the technical design.
- **Video 3:** [How to Obtain a Groq API Key for LLM Integration](https://youtu.be/wmGNLv-Ft3M) — Step-by-step setup guide.
- **Full Playlist:** [Assignment Walkthrough & Tutorials](https://www.youtube.com/playlist?list=PLmDBUKUITOzHMxqHysbSipKe1JJ7tOy6H)

---


## 🚀 Features
- **Dual Input Modes:** Supports high-fidelity OCR (Images/PDFs) and direct Text Input.
- **Modular Architecture:** Clean separation between **Common Engines** (AI, Units) and **API Specialists** (Normalizer, Parser).
- **Two-Stage AI Pipeline:** Multi-call LLM chaining for explanation generation and zero-temperature clinical verification.
- **Master Toggle System:** Centralized `constants.js` to enable/disable AI, Verification, and Output Formatting globally.
- **Resilience:** Automatic fallback to "Safe Templates" if the AI engine is disabled or verification fails.

---

## 📂 Project Structure
```text
Plum_Assignment/
├── src/                # All application logic
│   ├── services/       # Core engines logic
│   │   ├── common/     # Reusable engines (Units, AI)
│   │   └── report_api/ # API Specific logic (Normalizer, Parser)
│   ├── config/         # Master constants, toggles and prompts
│   └── index.js        # Express entry point
├── data/               # Knowledge bases (medical_ranges.json)
├── uploads/            # Temporary storage for OCR processing
├── Dockerfile          # Container instructions
├── docker-compose.yml  # Deployment orchestration
├── package.json        # Dependencies
└── .gitignore          # Repository hygiene
```

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js
- **OCR:** Tesseract.js
- **AI Engine:** Llama-3.3 (via Groq/OpenAI-compatible API)
- **Fuzzy Matching:** Fuse.js
- **Containerization:** Docker & Docker Compose

---

## 🚦 Getting Started

### 1. Environment Setup
Clone the repository and create a `.env` file in the root directory:
```bash
AI_API_KEY=your_key_here # Get your key at https://console.groq.com/
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
PORT=3000
```

> [!TIP]
> **How to get a Groq API Key:**
> 1. Visit the [Groq Cloud Console](https://console.groq.com/).
> 2. Log in with your account (Google/GitHub/Email).
> 3. Click on **"API Keys"** in the sidebar.
> 4. Click **"Create API Key"**, give it a name, and copy the value.
> 5. For a visual guide, watch our [Groq Key Setup Tutorial](https://youtu.be/wmGNLv-Ft3M).


### 2. Execution Options

#### Option A: Run with Docker (Recommended)
Use Docker Compose to spin up the entire environment instantly:
```bash
docker-compose up --build
```
The server will be available at `http://localhost:3000`.

#### Option B: Run Locally (Manual)
If you don't have Docker installed, you can run the service directly using Node.js.

**Prerequisites:**
- Node.js (v18.x or higher)
- npm (v9.x or higher)

**Steps:**
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Start the Server:**
   - For Production: `npm start`
   - For Development (with Hot-Reload): `npm run dev`

The server will be available at `http://localhost:3000`.

#### Option C: Deploy to Vercel (Cloud)
The project is pre-configured for Vercel deployment. Note that OCR processing in a serverless environment may be limited by memory/timeout.
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Remember to add your `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` to the Vercel Project Settings (Environment Variables).

---


---

## 🧪 Testing the API

### Mode A: Image Upload (OCR)
To test with a physical lab report image (PNG/JPEG/PDF):
```bash
curl -X POST -F "report=@testcase/test_2sets.png" http://localhost:3000/process-report
```

### Mode B: Direct Text Input
To test with raw text extracted from a report:
```bash
curl -X POST http://localhost:3000/process-report \
  -H "Content-Type: application/json" \
  -d '{
    "text": "CBC: Hemglobin 10.2 g/dL (Low)\nWBC 11200 /uL (Hgh)\nPlatelets: 250k /uL"
  }'
```

### Mode C: Postman Configuration
1. **Method:** `POST`
2. **URL:** `http://localhost:3000/process-report`
3. **Body (Multipart/form-data):**
   - Key: `report`, Type: `File`, Value: `[Select Image/PDF]`
4. **Body (JSON):**
   - Content-Type: `application/json`
   - Body: `{"text": "Your report text here"}`

---

## 📄 Assignment Specification
This project was developed for the **SDE Intern Assignment - IIT [Summer Internship]**. It implements a robust, industry-grade medical parsing engine that prioritizes clinical accuracy and safety.

**Key Requirements Met:**
- **3-Layer Reconciliation:** Cross-references Document Ranges, Knowledge Base Ranges, and AI Verification.
- **Zero-Hallucination Policy:** Two-stage AI pipeline (Explainer + Judge) to prevent clinical inaccuracies.
- **High Resilience:** Seamless fallback to safe templates if AI services are unreachable.
- **Audit Logging:** All mismatches are logged to `data/review_queue.json` for human oversight.


## 📂 Detailed Service Breakdown

### 🛠️ Common Engines (`src/services/common/`)
*   **`ai.js`**: The high-level LLM orchestrator. It handles the two-stage chaining (Explainer & Judge) and manages communication with the AI provider.
*   **`units.js`**: A clinical math utility that normalizes medical units (e.g., converting everything to a standard baseline for comparison).

### 🏥 Medical Report API (`src/services/report_api/`)
*   **`normalizer.js`**: The core medical engine. It uses fuzzy matching to identify tests from OCR text and reconciles report ranges with the system's authoritative knowledge base.
*   **`responseParser.js`**: The final formatting layer. It calculates the **Normalization Confidence** score and builds the final patient-friendly JSON structure.

---

## 🔍 Audit & Review System
The system uses a tagged **Reconciliation** system to ensure clinical transparency. Any test requiring human oversight is automatically moved to the `temp_ranges` bucket.

| Tag | Meaning | Action |
| --- | --- | --- |
| `[KB]` | Used authoritative Knowledge Base range. | Verified. |
| `[Doc]` | Used range provided in the lab report. | Verified. |
| `[Mismatch]` | Lab range differs from Knowledge Base. | **Review Required.** |
| `[Missing]` | Test not in KB or no range available. | **Review Required.** |

---

## 🛡️ Safety & Guardrails
The system implements a **Zero-Hallucination Policy**:
1. **The Explainer (Call 1):** Generates patient-friendly descriptions.
2. **The Judge (Call 2):** A strict verification pass that blocks any response containing made-up tests or definitive diagnoses.
3. **Internal Normalization:** All status flags (Low/High) are reconciled against a local knowledge base, ensuring the AI never "invents" a clinical status.