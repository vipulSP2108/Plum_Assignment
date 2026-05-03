/**
 * @module MainAPI
 * [Hot-Reload Active]
 * @project Plum Medical Report Simplifier
 * @description Express entry point for OCR and Normalization services.
 * @author AuraDoc Style
 */

const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Service Imports
const { normalizeTest } = require('./services/report_api/normalizer');
const CONSTANTS = require('./config/constants');

const app = express();
const port = process.env.PORT || 3000;

console.log(`[AuraDoc] AI System Status: ${CONSTANTS.ENABLE_AI_EXPLANATIONS ? 'ACTIVE' : 'DISABLED'}`);

// --- Middleware Configuration ---

const upload = multer({ 
  dest: CONSTANTS.UPLOAD_DIR,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Error: File upload only supports images and PDFs"));
  }
});

app.use(express.json());

// --- Routes ---

/**
 * Health Check Endpoint
 */
app.get('/', (req, res) => {
  res.json({ 
    project: "Plum Medical Report Simplifier",
    engine: "Node.js/Express",
    status: "Healthy"
  });
});

/**
 * Primary Processing Endpoint
 * @route POST /process-report
 * @consumes multipart/form-data
 */
app.post('/process-report', upload.single('report'), async (req, res) => {
  let rawText = '';
  let ocrConfidence = 1.0;
  let filePath = null;

  try {
    if (req.file) {
      filePath = req.file.path;
      // Step 1: OCR Extraction
      const result = await Tesseract.recognize(filePath, 'eng');
      rawText = result.data.text;
      ocrConfidence = result.data.confidence / 100;
    } else if (req.body && req.body.text) {
      rawText = req.body.text;
    } else {
      return res.status(400).json({ error: "No file or text provided" });
    }

    const rawLines = rawText.split('\n').filter(line => line.trim().length > 0);

    // Step 2: Normalization
    const allProcessed = rawLines.map(line => normalizeTest(line));
    
    // Valid tests found in KB
    const recognizedTests = allProcessed.filter(t => t.test_id !== "unknown" && t.status !== "unrecognized");
    
    // Tests that require human audit (Mismatches, Unknowns, or Missing Ranges)
    const tempRanges = allProcessed.filter(t => t.needs_review && t.status !== "unrecognized");

    // Step 3: AI Explanations & Guardrails
    let aiInsights = null;
    
    if (CONSTANTS.ENABLE_AI_EXPLANATIONS && recognizedTests.length > 0) {
      aiInsights = await require('./services/common/ai').generateExplanations(recognizedTests);
    }

    // Step 4: Final Output Determination
    let finalOutput = {
      status: "ok",
      tests_raw: rawLines,
      tests_normalized: recognizedTests,
      temp_ranges: tempRanges, // New section for user review
      ai_report: aiInsights,
      metadata: { ocrConfidence, tests_count: recognizedTests.length, review_required: tempRanges.length > 0 }
    };

    if (CONSTANTS.ENABLE_RESPONSE_PARSER) {
      const { parseFinalResponse } = require('./services/report_api/responseParser');
      finalOutput = parseFinalResponse(recognizedTests, aiInsights, ocrConfidence);
    }

    // Cleanup
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json(finalOutput);

  } catch (error) {
    console.error("Critical Processing Error:", error);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: "Internal server error during processing" });
  }
});

if (process.env.NODE_ENV !== 'production' && !CONSTANTS.IS_VERCEL) {
  app.listen(port, () => {
    console.log(`[AuraDoc] Plum Service listening on port ${port}`);
  });
}

module.exports = app;
