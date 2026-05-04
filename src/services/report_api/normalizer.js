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
  const cleanLine = line.replace(/(\d),(\d)/g, '$1$2'); // Remove commas in numbers
  const valueMatch = cleanLine.match(/(\d+(\.\d+)?)/);
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

  const unitRegex = /(?:\s|^)(mg\/dL|g\/dL|mg\/L|g\/L|mEq\/L|mmol\/L|%|million\/uL|10\^3\/uL|\/uL|u\/L|k\/uL|mg|g|lakh|mcg|ug|mIU\/L)(?=\s|$|[().,])/i;
  const unitMatch = line.match(unitRegex);
  const detectedUnit = unitMatch ? unitMatch[1] : null;

  const statusKeyword = line.match(/\(L\)|\(H\)|\(Low\)|\(High\)|\(Hgh\)|Low|High|Hgh|Normal/i);

  // 2. Early Exit for Non-Data Lines
  if (rawValue === null && !detectedUnit && !statusKeyword) {
    return { raw_line: line, status: "unrecognized", confidence: 0 };
  }

  // 3. Fuzzy Match Test Name
  // Robust cleaning: remove everything that isn't the test name
  let cleanedName = line
    .replace(/^[A-Z]{2,}:/i, '') // Remove category prefixes like "CBC:"
    .replace(/(\d+(\.\d+)?)\s*[-]\s*(\d+(\.\d+)?)/g, '') // Remove ranges like "8.5-10.2"
    .replace(new RegExp(detectedUnit || '', 'gi'), '') // Remove the unit we found
    .replace(/[0-9.]+/g, '') // Remove remaining numbers
    .replace(/\(L\)|\(H\)|\(Low\)|\(High\)|\(Hgh\)|\(|\)|Low|High|Hgh|Normal/gi, '') // Remove status/brackets
    .replace(/[-,:]/g, ' ') // Remove separators
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
  
  if (cleanedName.length < 2 || HEADER_BLACKLIST.includes(cleanedName.toUpperCase())) {
    return { raw_line: line, status: "unrecognized", confidence: 0 };
  }

  const searchResults = fuse.search(cleanedName);
  const match = (searchResults.length > 0 && searchResults[0].score < 0.5) ? searchResults[0] : null;

  // 4. Handle "Known" vs "Unknown" Tests
  const testInfo = match ? match.item : null;
  let confidence = match ? (1 - match.score) : 0.5;

  // 5. Unit Conversion
  let normalizedValue = rawValue;
  if (testInfo) {
    normalizedValue = convertValue(rawValue, detectedUnit, testInfo.unit);
  }

  // 6. Range Reconciliation & Tagging
  let normalizedDocRange = null;
  if (docRange && testInfo) {
    normalizedDocRange = {
      low: convertValue(docRange.low, detectedUnit, testInfo.unit),
      high: convertValue(docRange.high, detectedUnit, testInfo.unit)
    };
  }

  let finalRange = normalizedDocRange || (testInfo ? testInfo.range : null);
  let reconciliationNote = "";
  let needsReview = false;

  if (!testInfo) {
    reconciliationNote = "[Missing] Test not found in Knowledge Base";
    needsReview = true;
  } else if (normalizedDocRange && testInfo.range && (
    Math.abs(normalizedDocRange.low - testInfo.range.low) > 0.01 || 
    Math.abs(normalizedDocRange.high - testInfo.range.high) > 0.01
  )) {
    reconciliationNote = "[Mismatch] Document range differs from Knowledge Base";
    needsReview = true;
  } else if (normalizedDocRange) {
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
