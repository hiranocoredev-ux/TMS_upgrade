/**
 * A transaction's `transactionUrl` must be a full http(s) link (same rule as the
 * server), so it is always safe to open.
 */
export const MAX_TRANSACTION_URL_LENGTH = 2000;

export const TRANSACTION_URL_MESSAGE =
  'Transaction URL must be a full link starting with https:// or http://';

/** True for a full http(s) link of reasonable length. */
export const isTransactionUrl = (value) => {
  const text = String(value ?? '').trim();
  if (!text || text.length > MAX_TRANSACTION_URL_LENGTH) return false;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/** The URL to open for a transaction, or '' when it has no valid link yet (older transactions). */
export const transactionLink = (transaction) =>
  isTransactionUrl(transaction?.transactionUrl) ? String(transaction.transactionUrl).trim() : '';

export const MAX_DESCRIPTION_LENGTH = 2000;
