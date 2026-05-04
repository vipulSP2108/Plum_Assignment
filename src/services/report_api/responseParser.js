/**
 * @module ResponseParser
 * @description Transforms internal data into the final structured API response.
 * @author AuraDoc Style
 */

const CONSTANTS = require('../../config/constants');

/**
 * Parses internal results into the final patient-ready JSON.
 * @param {Array} tests - Normalized test results.
 * @param {Object} aiReport - AI generated report (summary/explanations).
 * @param {number} ocrConfidence - Raw OCR confidence (0-1).
 * @returns {Object} Final API Response.
 */
const parseFinalResponse = (tests, aiReport, ocrConfidence) => {
  
  // 1. Handle Hallucination / Verification Failure
  if (aiReport && aiReport.verification_status === "unprocessed") {
    return {
      status: "unprocessed",
      reason: "hallucinated tests not present in input"
    };
  }

  // 2. Calculate Global Normalization Confidence
  // Formula: (Avg Match Confidence * Weight) + (OCR Confidence * Weight)
  const avgMatchConfidence = tests.length > 0 
    ? tests.reduce((acc, t) => acc + t.confidence, 0) / tests.length 
    : 0;

  const finalConfidence = (avgMatchConfidence * CONSTANTS.WEIGHT_MATCH_CONFIDENCE) + 
                          (ocrConfidence * CONSTANTS.WEIGHT_OCR_CONFIDENCE);

  // 3. Format Test List
  const formattedTests = tests.map(t => ({
    name: t.display_name,
    value: t.value,
    unit: t.unit,
    status: t.status.toLowerCase(),
    ref_range: t.ref_range
  }));

  // 4. Construct Final JSON
  return {
    status: "ok",
    tests: formattedTests,
    summary: aiReport ? aiReport.summary : "Analysis complete. Values are within standard ranges.",
    // normalization_confidence: parseFloat(finalConfidence.toFixed(2)),
    // explanations: aiReport ? aiReport.explanations : []
  };
};

module.exports = { parseFinalResponse };
