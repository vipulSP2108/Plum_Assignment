/**
 * @module MainAPI
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
const { normalizeTest } = require('./services/normalizer');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware Configuration ---

const upload = multer({ 
  dest: 'uploads/',
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
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;

  try {
    // Step 1: OCR Extraction
    const result = await Tesseract.recognize(filePath, 'eng');
    const rawText = result.data.text;
    const ocrConfidence = result.data.confidence / 100;
    const rawLines = rawText.split('\n').filter(line => line.trim().length > 0);

    // Step 2: Normalization
    const normalizedTests = rawLines.map(line => normalizeTest(line));
    const recognizedTests = normalizedTests.filter(t => t.status !== "unrecognized");

    // Cleanup
    fs.unlinkSync(filePath);

    res.json({
      status: "ok",
      tests_raw: rawLines,
      tests_normalized: recognizedTests,
      metadata: {
        ocr_confidence: ocrConfidence,
        tests_count: recognizedTests.length
      }
    });

  } catch (error) {
    console.error("Critical Processing Error:", error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: "Internal server error during processing" });
  }
});

app.listen(port, () => {
  console.log(`[AuraDoc] Plum Service listening on port ${port}`);
});
