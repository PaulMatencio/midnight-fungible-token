/**
 * Standard Token Balance & Number Formatting Utilities
 *
 * Formats token balances with both thousand separators (e.g. 1,000) and
 * decimal separators (e.g. .0000) consistently across Dashboard, Circuits & Actions,
 * Ledger & Shares, and Header.
 */

/**
 * Formats a token balance with both thousand separators and decimal separators.
 *
 * @param amount - The raw bigint atomic balance, or number/string.
 * @param decimals - Token decimal scale (defaults to 6).
 * @param displayDecimals - Number of fractional digits to display (defaults to 4).
 * @returns Fully formatted balance string (e.g. "33,000.0000").
 */
export function formatBalance(
  amount: bigint | number | string | null | undefined,
  decimals: number | bigint = 6,
  displayDecimals: number = 4
): string {
  const dispDec = Math.max(0, Number(displayDecimals));
  if (amount === null || amount === undefined) {
    return dispDec > 0 ? `0.${'0'.repeat(dispDec)}` : '0';
  }

  let bigAmount: bigint;
  try {
    if (typeof amount === 'bigint') {
      bigAmount = amount;
    } else if (typeof amount === 'number') {
      bigAmount = BigInt(Math.floor(amount));
    } else {
      bigAmount = BigInt(amount || '0');
    }
  } catch {
    return dispDec > 0 ? `0.${'0'.repeat(dispDec)}` : '0';
  }

  const dec = Math.max(0, Number(decimals));

  if (dec === 0) {
    const wholeStr = bigAmount.toLocaleString();
    return dispDec > 0 ? `${wholeStr}.${'0'.repeat(dispDec)}` : wholeStr;
  }

  const divisor = 10n ** BigInt(dec);
  const whole = bigAmount / divisor;
  const fraction = bigAmount % divisor;
  const wholeStr = whole.toLocaleString();

  const fracFull = (fraction < 0n ? -fraction : fraction).toString().padStart(dec, '0');
  const fracStr = fracFull.slice(0, dispDec).padEnd(dispDec, '0');

  return dispDec > 0 ? `${wholeStr}.${fracStr}` : wholeStr;
}
