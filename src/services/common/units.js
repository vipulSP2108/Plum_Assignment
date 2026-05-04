/**
 * @module UnitEngine
 * @project Plum Medical Report Simplifier
 * @description Centralized conversion logic for laboratory units.
 * @author AuraDoc Style
 */

const CONVERSIONS = {
  // --- Weight/Mass Scale ---
  'mg_to_g': 0.001,
  'g_to_mg': 1000,
  'mcg_to_mg': 0.001,
  'ug_to_mg': 0.001,

  // --- Volume Scale ---
  'dl_to_l': 10,
  'l_to_dl': 0.1,
  'ml_to_l': 0.001,

  // --- Compound Concentrations ---
  'g/dl_to_g/l': 10,
  'g/l_to_g/dl': 0.1,
  'mg/dl_to_mg/l': 10,
  'mg/l_to_mg/dl': 0.1,
  'g/dl_to_mg/dl': 1000,
  'mg/dl_to_g/dl': 0.001,

  // --- Lab Counts ---
  '10^3/ul_to_/ul': 1000,
  '/ul_to_10^3/ul': 0.001,
  '10^6/ul_to_million/ul': 1,
  'k/ul_to_/ul': 1000,
  'lakh_to_/ul': 100000,
  '/ul_to_lakh': 0.00001,

  // --- Discrepancy Fallbacks
  'g/dl_to_/ul': 1000
};

/**
 * Standardizes a numeric value between units.
 * @param {number} value - Input value.
 * @param {string} fromUnit - Original unit.
 * @param {string} toUnit - Target unit.
 * @returns {number} Converted value.
 */
const convertValue = (value, fromUnit, toUnit) => {
  if (!fromUnit || !toUnit) return value;

  const from = fromUnit.toLowerCase().replace(/\s/g, '');
  const to = toUnit.toLowerCase().replace(/\s/g, '');

  if (from === to) return value;

  const key = `${from}_to_${to}`;

  if (CONVERSIONS[key]) {
    return value * CONVERSIONS[key];
  }

  return value;
};

module.exports = { convertValue };
