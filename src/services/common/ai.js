/**
 * @module AIService
 * @description Pure AI service for communicating with LLM providers.
 */

const { OpenAI } = require('openai');
const CONSTANTS = require('../../config/constants');
const PROMPTS = require('../../config/prompts');

const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
});

/**
 * Orchestrates the explanation and verification process.
 */
const generateExplanations = async (tests) => {
  if (!tests || tests.length === 0) return null;

  const context = tests.map(t => (
    `Test: ${t.display_name}, Value: ${t.value !== null ? t.value : '[MISSING]'} ${t.unit}${t.value === null ? ' (Status: ' + t.status + ')' : ''}, Range: ${t.ref_range ? (t.ref_range.low + '-' + t.ref_range.high) : 'N/A'}, Description: ${t.description || 'General health marker'}`
  )).join('\n---\n');

  const explanationPrompt = PROMPTS.EXPLAINER_TEMPLATE.replace('{{CONTEXT}}', context);

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: explanationPrompt }],
      response_format: { type: "json_object" }
    });

    const rawResult = JSON.parse(response.choices[0].message.content);
    const testsArray = Array.isArray(rawResult) ? rawResult : (rawResult.results || rawResult.tests || Object.values(rawResult)[0]);

    if (!Array.isArray(testsArray)) throw new Error("Invalid AI Response Format");

    const finalResult = {
      summary: testsArray.map(t => t.summary.trim().replace(/\.+$/, '')).join('. ') + '.',
      explanations: testsArray.map(t => t.explanation),
      verification_status: "verified_safe"
    };

    if (CONSTANTS.ENABLE_AI_VERIFICATION) {
      const isVerified = await verifyExplanations(context, finalResult);
      if (!isVerified) {
        console.warn("[AI Guardrail] Verification failed.");
        return { verification_status: "unprocessed" };
      }
    }

    return finalResult;

  } catch (error) {
    console.error("[AI Service Error]:", error);
    return generateSafeFallback(tests);
  }
};

const generateSafeFallback = (tests) => {
  const summaries = tests.map(t => `${t.display_name} is ${t.status.toLowerCase()}`);
  return {
    summary: summaries.join('. ') + '.',
    explanations: tests.map(t => `${t.description || 'This marker monitors general health.'}`),
    verification_status: "template_fallback_active"
  };
};

const verifyExplanations = async (sourceData, aiOutput) => {
  const verifyPrompt = PROMPTS.JUDGE_TEMPLATE
    .replace('{{SOURCE_DATA}}', sourceData)
    .replace('{{AI_OUTPUT}}', JSON.stringify(aiOutput));

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: verifyPrompt }],
      temperature: 0
    });
    const decision = response.choices[0].message.content.trim().toUpperCase();
    console.log("[AI Judge Decision]:", decision);
    return decision.includes('TRUE');
  } catch (err) {
    return false;
  }
};

module.exports = { generateExplanations };
