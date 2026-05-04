const fs = require('fs');
const path = require('path');
const CONSTANTS = require('../../config/constants');

const REVIEW_FILE_PATH = path.join(__dirname, '../../../data/review_queue.json');

/**
 * Logs a test that needs human review (mismatch or unknown).
 * @param {Object} test - The processed test object.
 */
const logForReview = (test) => {
  if (!test.needs_review || !test.reconciliation.includes('[Mismatch]')) return;

  let queue = [];
  try {
    if (fs.existsSync(REVIEW_FILE_PATH)) {
      const content = fs.readFileSync(REVIEW_FILE_PATH, 'utf8');
      queue = JSON.parse(content);
    }
  } catch (error) {
    console.error("[Audit] Error reading review queue:", error);
  }

  // Avoid duplicates in the queue (by raw_line or test_id + value)
  const isDuplicate = queue.some(item => 
    item.raw_line === test.raw_line || 
    (item.test_id === test.test_id && item.value === test.value && item.test_id !== "unknown")
  );

  if (!isDuplicate) {
    const entry = {
      timestamp: new Date().toISOString(),
      test_id: test.test_id,
      display_name: test.display_name,
      raw_line: test.raw_line,
      value: test.value,
      unit: test.unit,
      doc_range: test.ref_range,
      kb_range: test.kb_range,
      reconciliation: test.reconciliation,
      status: "pending_review"
    };
    
    queue.push(entry);

    try {
      fs.writeFileSync(REVIEW_FILE_PATH, JSON.stringify(queue, null, 2));
    } catch (error) {
      console.error("[Audit] Error writing to review queue:", error);
    }
  }
};

module.exports = { logForReview };
