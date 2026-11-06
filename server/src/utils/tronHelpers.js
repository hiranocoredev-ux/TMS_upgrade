/**
 * Tron Flag Helpers
 *
 * A transaction's recorded amount is derived from the price the user entered
 * and whether the money moved over Tron:
 *   Tron      -> amount = inputPrice
 *   non-Tron  -> amount = inputPrice * 0.98  (2% transfer fee)
 *
 * Mirrors `resolveIsTron` / `deriveAmount` in server/src/routes/finance.routes.js.
 */

// Non-Tron transfers lose a 2% fee, so only 98% of the entered price lands.
export const NON_TRON_RATE = 0.98;

/**
 * Effective Tron state of a transaction.
 * The Tron fee only ever applies to income: outcomes are always recorded at the
 * full price. For income, a transaction that did NOT go through the team wallet
 * is always Tron; otherwise the explicit flag decides, and a missing flag
 * (legacy rows created before this feature) means not Tron.
 * @param {'income'|'outcome'} type
 * @param {boolean|undefined} throughTeamWallet
 * @param {boolean|undefined} isTron
 * @returns {boolean}
 */
export const resolveIsTron = (type, throughTeamWallet, isTron) => {
  if (type !== 'income') return true;
  return throughTeamWallet === false ? true : isTron === true;
};

/**
 * Effective Tron state of a stored transaction document.
 * @param {{ type?: string, throughTeamWallet?: boolean, isTron?: boolean }} transaction
 * @returns {boolean}
 */
export const transactionIsTron = (transaction) =>
  resolveIsTron(
    transaction?.type,
    transaction?.throughTeamWallet,
    transaction?.isTron
  );

/**
 * Final recorded amount for a given entered price and Tron state.
 * @param {number} inputPrice
 * @param {boolean} isTron
 * @returns {number} - rounded to 2 decimals
 */
export const deriveAmount = (inputPrice, isTron) => {
  const price = Number(inputPrice) || 0;
  return Math.round((isTron ? price : price * NON_TRON_RATE) * 100) / 100;
};
