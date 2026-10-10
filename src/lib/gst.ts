/**
 * GST on GST-inclusive prices. Mirrors public.gst_split() in the database,
 * which is the authority when an order is stored; this copy only drives what
 * the cart shows before the order exists.
 *
 * Tax is extracted from the amount, never added on top, and the parts always
 * add back up to the amount exactly:
 *   intra-state: CGST = SGST = round(tax / 2), taxable = amount - CGST - SGST
 *   inter-state: IGST = round(tax),            taxable = amount - IGST
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type GstSplit = { taxable: number; cgst: number; sgst: number; igst: number };

export function gstSplit(amount: number, ratePercent: number, intraState: boolean): GstSplit {
  const tax = amount - amount / (1 + ratePercent / 100);
  if (intraState) {
    const half = round2(tax / 2);
    return { taxable: round2(amount - 2 * half), cgst: half, sgst: half, igst: 0 };
  }
  const igst = round2(tax);
  return { taxable: round2(amount - igst), cgst: 0, sgst: 0, igst };
}

export const isIntraState = (customerState: string, sellerState: string) =>
  customerState.trim().toLowerCase() === sellerState.trim().toLowerCase();

export type TaxableAmount = { amount: number; rate: number };

export type Invoice = GstSplit & {
  intraState: boolean;
  /** Distinct rates in the order, for labels such as "CGST @ 2.5%". Empty when rates are mixed. */
  rate: number | null;
  total: number;
};

/** Adds up the split of every line (and shipping) the same way the database does. */
export function buildInvoice(amounts: TaxableAmount[], customerState: string, sellerState: string): Invoice {
  const intraState = isIntraState(customerState, sellerState);
  const sum: GstSplit = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  for (const { amount, rate } of amounts) {
    if (amount <= 0) continue;
    const part = gstSplit(amount, rate, intraState);
    sum.taxable += part.taxable;
    sum.cgst += part.cgst;
    sum.sgst += part.sgst;
    sum.igst += part.igst;
  }
  const rates = [...new Set(amounts.filter((a) => a.amount > 0).map((a) => a.rate))];
  return {
    taxable: round2(sum.taxable),
    cgst: round2(sum.cgst),
    sgst: round2(sum.sgst),
    igst: round2(sum.igst),
    intraState,
    rate: rates.length === 1 ? rates[0] : null,
    total: round2(amounts.reduce((n, a) => n + Math.max(0, a.amount), 0)),
  };
}

/** "2.5" not "2.50"; "5" not "5.0". */
export const formatRate = (rate: number) => String(Number(rate.toFixed(2)));

/** 15-character GSTIN: 2-digit state code, 10-character PAN, entity code, "Z", check character. */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function isValidGstin(input: string): boolean {
  const value = input.trim().toUpperCase();
  if (!GSTIN.test(value)) return false;
  const stateCode = Number(value.slice(0, 2));
  if (stateCode < 1 || stateCode > 38) return false;
  // The last character is a base-36 checksum of the first 14.
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(value[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === value[14];
}
