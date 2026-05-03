/**
 * @module NormalizationEngine
 * @description Logic for fuzzy matching test names and reconciling ranges.
 */

const Fuse = require('fuse.js');
const CONSTANTS = require('../../config/constants');
const { convertValue } = require('../common/units');

const medicalRanges = require('../../../' + CONSTANTS.KNOWLEDGE_BASE_PATH);

// --- Pre-computation ---
const testPool = Object.keys(medicalRanges)
  .filter(key => !key.startsWith('_'))
  .map(key => ({ id: key, ...medicalRanges[key] }));

const fuse = new Fuse(testPool, {
  keys: [
    { name: 'id', weight: 2 },
    { name: 'display_name', weight: 1 }
  ],
  threshold: 0.4,
  includeScore: true
});

const HEADER_BLACKLIST = ['CBC', 'REPORT', 'SAMPLE', 'PATIENT', 'DOCTOR', 'TEST', 'PANEL', 'REFERENCE', 'UNITS', 'RESULT'];

/**
 * Transforms messy OCR strings into structured medical data.
 */
const normalizeTest = (line) => {
  // 1. Extraction (Value, Unit, Multiplier)
  const valueMatch = line.match(/(\d+(\.\d+)?)/);
  let rawValue = valueMatch ? parseFloat(valueMatch[0]) : null;

  if (rawValue !== null && line.toLowerCase().includes('lakh')) {
    rawValue = rawValue * 100000;
  }

  if (line.match(/\d+k/i)) {
    const kMatch = line.match(/(\d+)k/i);
    if (kMatch) rawValue = parseInt(kMatch[1]) * 1000;
  }

  const rangeMatch = line.match(/(\d+(\.\d+)?)\s*[-]\s*(\d+(\.\d+)?)/);
  let docRange = null;
  if (rangeMatch) {
    docRange = { low: parseFloat(rangeMatch[1]), high: parseFloat(rangeMatch[3]) };
  }

  const unitMatch = line.match(/[a-z0-9^/]{1,}\/[a-z]{1,}|%|mEq\/L|mmol\/L|mg/i);
  const detectedUnit = unitMatch ? unitMatch[0] : null;

  const statusKeyword = line.match(/\(L\)|\(H\)|\(Low\)|\(High\)|\(Hgh\)|Low|High|Hgh|Normal/i);

  // 2. Early Exit for Non-Data Lines
  if (rawValue === null && !detectedUnit && !statusKeyword) {
    return { raw_line: line, status: "unrecognized", confidence: 0 };
  }

  // 3. Fuzzy Match Test Name
  const cleanedName = line
    .replace(/^[A-Z]{2,}:/i, '') 
    .replace(/[0-9.]+|g\/dL|\/uL|mg\/dL|mIU\/L|mEq\/L|mmol\/L|mg|lakh|%|k\b/gi, '') 
    .replace(/\(L\)|\(H\)|\(Low\)|\(High\)|\(Hgh\)|\(|\)|Low|High|Hgh|Normal/gi, '') 
    .replace(/[-,:]/g, ' ') 
    .trim();
  
  if (cleanedName.length < 2 || HEADER_BLACKLIST.includes(cleanedName.toUpperCase())) {
    return { raw_line: line, status: "unrecognized", confidence: 0 };
  }

  const searchResults = fuse.search(cleanedName);
  const match = (searchResults.length > 0 && searchResults[0].score < 0.45) ? searchResults[0] : null;

  // 4. Handle "Known" vs "Unknown" Tests
  const testInfo = match ? match.item : null;
  let confidence = match ? (1 - match.score) : 0.5;

  // 5. Unit Conversion
  let normalizedValue = rawValue;
  if (testInfo) {
    normalizedValue = convertValue(rawValue, detectedUnit, testInfo.unit);
  }

  // 6. Range Reconciliation & Tagging
  let finalRange = docRange || (testInfo ? testInfo.range : null);
  let reconciliationNote = "";
  let needsReview = false;

  if (!testInfo) {
    reconciliationNote = "[Missing] Test not found in Knowledge Base";
    needsReview = true;
  } else if (docRange && testInfo.range && (docRange.low !== testInfo.range.low || docRange.high !== testInfo.range.high)) {
    reconciliationNote = "[Mismatch] Document range differs from Knowledge Base";
    needsReview = true;
  } else if (docRange) {
    reconciliationNote = "[Doc] Used Document Range";
  } else if (testInfo.range) {
    reconciliationNote = "[KB] Used Knowledge Base Range";
  } else {
    reconciliationNote = "[Missing] No Reference Range Available";
    needsReview = true;
  }

  // 7. Status Logic
  let status = "Unknown";
  if (normalizedValue !== null && finalRange) {
    status = getStatus(normalizedValue, finalRange);
  } else if (statusKeyword) {
    const kw = statusKeyword[0].toLowerCase();
    if (kw.includes('low') || kw.includes('(l)')) status = "Low";
    else if (kw.includes('high') || kw.includes('hgh') || kw.includes('(h)')) status = "High";
    else status = "Normal";
  }

  return {
    test_id: testInfo ? testInfo.id : "unknown",
    display_name: testInfo ? testInfo.display_name : cleanedName,
    category: testInfo ? testInfo.category : "Uncategorized",
    value: rawValue,
    unit: detectedUnit || (testInfo ? testInfo.unit : "unknown"),
    normalized_value: normalizedValue,
    ref_range: finalRange,
    kb_range: testInfo ? testInfo.range : null,
    status: status,
    confidence: parseFloat(confidence.toFixed(2)),
    reconciliation: reconciliationNote,
    needs_review: needsReview,
    raw_line: line
  };
};

const getStatus = (val, range) => {
  if (!range) return "Unknown";
  const low = Math.min(range.low, range.high);
  const high = Math.max(range.low, range.high);
  if (val < low) return "Low";
  if (val > high) return "High";
  return "Normal";
};

module.exports = { normalizeTest };
