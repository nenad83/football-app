/**
 * Returns the maximum number of substitutes allowed on the bench for a given match.
 * Defaults to 7, except for England where it is 5 before the 2008/09 season (year 2008).
 * Starting from the 2022/23 season (year 2022), all squad players go to the match bench (returns 99).
 * 
 * @param {string} cupId - The active league or cup identifier
 * @param {string} season - The current season string (e.g. "1995" or "2022")
 * @param {string} country - The country of the active league (e.g. "england")
 * @returns {number} The maximum number of substitutes allowed on the bench
 */
export const getSubstituteLimit = (cupId, season, country) => {
  const year = parseInt(season, 10);
  if (!isNaN(year) && year >= 2022) {
    return 99; // Unlimited / All non-starting squad players
  }
  if (country && country.toLowerCase() === 'england') {
    if (!isNaN(year) && year < 2008) {
      return 5;
    }
  }
  return 7;
};

/**
 * Returns the maximum number of substitutions allowed per team in a match.
 * Defaults to 3, but increases to 5 starting from the 2022/23 season (year 2022).
 * 
 * @param {string} cupId - The active league or cup identifier
 * @param {string} season - The current season string (e.g. "1995" or "2022")
 * @returns {number} The maximum number of substitutions allowed
 */
export const getSubstitutionLimit = (cupId, season) => {
  const year = parseInt(season, 10);
  if (!isNaN(year) && year >= 2022) {
    return 5;
  }
  return 3;
};

/**
 * Returns the maximum number of stoppage windows allowed for substitutions during active play.
 * Defaults to 99 (no stoppage window limit), but limited to 3 starting from 2022/23.
 * 
 * @param {string} cupId - The active league or cup identifier
 * @param {string} season - The current season string (e.g. "1995" or "2022")
 * @returns {number} The maximum number of stoppage windows allowed
 */
export const getStoppageLimit = (cupId, season) => {
  const year = parseInt(season, 10);
  if (!isNaN(year) && year >= 2022) {
    return 3;
  }
  return 99;
};
