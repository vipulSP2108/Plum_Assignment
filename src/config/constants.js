/**
 * @module Constants
 * @description Global Application Master Switches and Configuration.
 */

const APP_CONFIG = {
  // --- Feature Flags ---
  ENABLE_AI_EXPLANATIONS: true, // Main AI Switch
  ENABLE_AI_VERIFICATION: true, // The "Judge" Switch
  ENABLE_RESPONSE_PARSER: false, // Output Formatting Switch

  // --- API Settings ---
  OCR_CONFIDENCE_THRESHOLD: 0.6,
  WEIGHT_MATCH_CONFIDENCE: 0.7,
  WEIGHT_OCR_CONFIDENCE: 0.3,

  // --- Paths ---
  UPLOAD_DIR: 'uploads/',
  KNOWLEDGE_BASE_PATH: './data/medical_ranges.json'
};

module.exports = APP_CONFIG;
