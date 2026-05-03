/**
 * @module Constants
 * @description Global Application Master Switches and Configuration.
 */

const IS_VERCEL = false; // <-- SET THIS TO TRUE BEFORE DEPLOYING TO VERCEL

const APP_CONFIG = {
  // --- Environment Settings ---
  IS_VERCEL: IS_VERCEL,
  IS_LOCAL: !IS_VERCEL,
  BASE_URL: IS_VERCEL ? 'https://plum-assignment.vercel.app' : 'http://localhost:3000',

  // --- Feature Flags ---
  ENABLE_AI_EXPLANATIONS: true, // Main AI Switch
  ENABLE_AI_VERIFICATION: true, // The "Judge" Switch
  ENABLE_RESPONSE_PARSER: false, // Output Formatting Switch

  // --- API Settings ---
  OCR_CONFIDENCE_THRESHOLD: 0.6,
  WEIGHT_MATCH_CONFIDENCE: 0.7,
  WEIGHT_OCR_CONFIDENCE: 0.3,

  // --- Paths ---
  UPLOAD_DIR: IS_VERCEL ? '/tmp' : 'uploads/',
  KNOWLEDGE_BASE_PATH: './data/medical_ranges.json'
};

module.exports = APP_CONFIG;
