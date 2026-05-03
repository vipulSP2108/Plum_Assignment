/**
 * @module Prompts
 * @description Centralized AI prompt templates.
 */

module.exports = {
  EXPLAINER_TEMPLATE: `
    You are a medical assistant generating simple, patient-friendly summaries of lab test results.

    Input Data:
    {{CONTEXT}}

    Instructions:
    1. Determine if each value is low, normal, or high based on the range.
    2. Write a short summary stating the level in plain English.
    3. Write a brief explanation (1–2 sentences) describing what the test relates to and possible general reasons if abnormal.
    4. Keep language simple and non-technical.
    5. Do not give diagnosis or medical advice.

    Output format (STRICT JSON ARRAY OF OBJECTS):
    [
      {
        "name": "<Test name>",
        "status": "low | normal | high",
        "summary": "<Simple statement>",
        "explanation": "<1-2 sentence patient-friendly explanation>"
      }
    ]
  `,

  JUDGE_TEMPLATE: `
    Source Data (Clinical Facts):
    {{SOURCE_DATA}}

    AI Generated Report:
    {{AI_OUTPUT}}

    CRITICAL VERIFICATION TASK:
    Check if the AI Generated Report contains any CLINICAL HALLUCINATIONS.
    - Respond "FALSE" if the AI mentions a test that is NOT in the Source Data.
    - Respond "FALSE" if the AI assigns an incorrect status based on the Source Data.
    - Respond "FALSE" if the AI gives a definitive medical diagnosis.
    - Respond "TRUE" if the explanations are grounded in the Source Data.
    
    NOTE: Source data ranges might be inverted or messy due to OCR artifacts (e.g. 6.0-1.8). Focus on whether the Test Name and Value exist in the Source.

    RESPONSE (TRUE/FALSE ONLY):
  `
};
