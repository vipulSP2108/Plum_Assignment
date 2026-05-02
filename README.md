# Plum_Assignment

## Problem

### Instructions:
Read the submission guidelines and evaluation criteria carefully for the chosen problem statement as mentioned below.
- Submission Timeline: You have a total of 4 days to complete the assignment. The solution needs to be submitted by the 5th day from receiving the problem statement.

### For Problem Statements 5-8 (Backend): AI-Powered Medical Report Simplifier

#### Overview
Build a backend service that processes medical reports (typed or scanned) and converts them into structured data along with clear, patient-friendly explanations. The system must handle OCR errors, normalize medical test data, and strictly avoid hallucinating any information not present in the input.

---

#### Tech Stack
- **Backend:** Node.js with Express.js
- **OCR Engine:** Tesseract.js for robust image-to-text extraction
- **AI Engine:** OpenAI/LLM for simplified patient explanations
- **Fuzzy Matching:** Fuse.js for correcting medical jargon and OCR typos
- **Containerization:** Docker for consistent deployment
- **Validation:** Zod for strict JSON schema adherence

#### Key Engineering Features
1. **3-Layer Range Reconciliation:** A multi-tier logic system (Document -> Knowledge Base -> LLM Fallback) to ensure highly accurate medical reference ranges.

#### Project Structure
The codebase follows a modular architecture designed for scalability and clean separation of concerns:

```text
Plum_Assignment/
├── src/                # All application logic
│   ├── services/       # Core engines (Normalizer, Units)
│   ├── config/         # App configuration
│   └── index.js        # Entry point
├── data/               # Knowledge bases and static JSONs
├── uploads/            # Temporary storage for OCR processing
├── Dockerfile          # Container instructions
├── docker-compose.yml  # Deployment orchestration
└── package.json        # Dependencies
```

- **`src/index.js`**: Main API entry point and orchestration.
- **`src/services/`**: Core logic including the Normalizer and Unit Conversion engines.
- **`data/`**: Knowledge base containing standardized medical reference ranges.
- **`uploads/`**: Ephemeral storage for processing uploaded reports.
- **`AuraDoc`**: Standardized documentation and commenting style for high code readability.

---

---

## 🚀 Quick Start (Docker)

The easiest way to run the service is using Docker Compose.

### 1. Build and Run
```bash
docker-compose up --build
```
The server will be available at `http://localhost:3000`.

### 2. Test the Endpoint
You can test the OCR and Normalization logic by uploading the provided `test_image.png`:
```bash
curl -X POST -F "report=@test_image.png" http://localhost:3000/process-report
```

---

#### Pipeline Architecture

The solution should follow a 4-step pipeline:

---

### Step 1: OCR / Text Extraction

**Objective:**  
Extract relevant medical test details from raw text or OCR output.

**Responsibilities:**
- Identify test names, values, units, and status (e.g., Low/High)
- Handle and correct minor OCR errors (e.g., "Hemglobin" → "Hemoglobin", "Hgh" → "High")
- Preserve original extracted lines for traceability

**Input Example:**
CBC: Hemglobin 10.2 g/dL (Low)
WBC 11200 /uL (Hgh)

**Output (JSON):**
```json
{
  "tests_raw": [
    "Hemoglobin 10.2 g/dL (Low)",
    "WBC 11200 /uL (High)"
  ],
  "confidence": 0.80
}
```




#### Submission Instructions:
- Submit a working backend demo (local with ngrok or simple cloud instance).
- Provide a GitHub repository containing your code.
- Include a README.md with setup instructions, architecture, and API usage examples.
- Provide sample curl/Postman requests to test your endpoints.
- Submit a short screen recording showing your endpoints working with sample inputs.

#### Evaluation Criteria:
- Correctness of API responses and adherence to JSON schemas.
- Handling of both text and image inputs with OCR.
- Implementation of guardrails and error handling.
- Code organization, clarity, and reusability.
- Effective use of Al for chaining and validation.