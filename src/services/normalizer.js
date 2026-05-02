/**
 * @module NormalizationEngine
 * @project Plum Medical Report Simplifier
 * @description Logic for fuzzy matching test names and reconciling ranges.
 * @author AuraDoc Style
 */

const Fuse = require('fuse.js');
const medicalRanges = require('../../data/medical_ranges.json');
const { convertValue } = require('./units');

// --- Pre-computation ---

const testPool = Object.keys(medicalRanges)
  .filter(key => !key.startsWith('_'))
  .map(key => ({ id: key, ...medicalRanges[key] }));

const fuse = new Fuse(testPool, {
  keys: ['id', 'display_name'],
  threshold: 0.4,
  includeScore: true
});

/**
 * Transforms messy OCR strings into structured medical data.
 * @param {string} line - Raw text line from OCR.
 * @returns {Object} Structured test result.
 */
const normalizeTest = (line) => {
  const valueMatch = line.match(/(\d+(\.\d+)?)/);
  const rawValue = valueMatch ? parseFloat(valueMatch[0]) : null;

  const rangeMatch = line.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
  let docRange = null;
  if (rangeMatch) {
    docRange = { low: parseFloat(rangeMatch[1]), high: parseFloat(rangeMatch[3]) };
  }

  const unitMatch = line.match(/[a-z0-9^/]{1,}\/[a-z]{1,}/i);
  const detectedUnit = unitMatch ? unitMatch[0] : null;

  const cleanedName = line
    .replace(/^[A-Z]{2,}:/i, '') 
    .replace(/[0-9.]+|g\/dL|\/uL|mg\/dL|mIU\/L|\(|\)|Low|High|Hgh|Normal/gi, '')
    .trim();
  
  const searchResults = fuse.search(cleanedName);
  const match = searchResults.length > 0 ? searchResults[0] : null;

  if (!match || rawValue === null) {
    return { raw_line: line, status: "unrecognized", confidence: 0 };
  }

  const testInfo = match.item;
  let confidence = 1 - match.score;

  const targetUnit = testInfo.unit;
  const normalizedValue = convertValue(rawValue, detectedUnit, targetUnit);

  let finalRange = docRange || (testInfo ? testInfo.range : null);
  let reconciliationNote = docRange ? "Used Document Range" : (testInfo ? "Used Knowledge Base Range" : "No Range Available");

  // 6. Final Status Calculation (with Safety Catch)
  let status = "Unknown";
  if (finalRange && normalizedValue !== null) {
    status = getStatus(normalizedValue, finalRange);
    
    // Conflict detection only if both ranges exist
    if (docRange && testInfo && (docRange.low !== testInfo.range.low || docRange.high !== testInfo.range.high)) {
      const docStatus = getStatus(rawValue, docRange);
      const baseStatus = getStatus(normalizedValue, testInfo.range);
      if (docStatus !== baseStatus) {
        confidence *= 0.8; 
        reconciliationNote = "Conflict: Document prioritized";
      }
    }
  }

  return {
    test_id: testInfo ? testInfo.id : "unknown",
    display_name: testInfo ? testInfo.display_name : cleanedName,
    category: testInfo ? testInfo.category : "Uncategorized",
    value: rawValue,
    unit: detectedUnit || (testInfo ? testInfo.unit : "unknown"),
    normalized_value: normalizedValue,
    ref_range: finalRange,
    status: status,
    confidence: parseFloat(confidence.toFixed(2)),
    reconciliation: reconciliationNote,
    raw_line: line
  };
};

/**
 * Compares a value against a numeric range.
 * @param {number} val - Input value.
 * @param {Object} range - {low, high} range object.
 * @returns {string} Low | High | Normal.
 */
const getStatus = (val, range) => {
  if (val < range.low) return "Low";
  if (val > range.high) return "High";
  return "Normal";
};

module.exports = { normalizeTest };
