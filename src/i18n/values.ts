import { tk } from '.';

/**
 * Values stored in English in the data (so they stay the same whichever language saved them)
 * and translated only when shown with `t(value)`. Listed here so every locale file includes them.
 */
export const STORED_VALUES = [
  // Material types
  tk('Recycled'), tk('Reused'), tk('Virgin'),
  // Transport
  tk('Sea'), tk('Rail'), tk('Road'), tk('Air'),
  // Funding
  tk('Loan'), tk('Grant'), tk('Equity'), tk('Reward'),
  tk('Pending'), tk('Approved'), tk('Funded'), tk('Declined'),
  // Customer segments
  tk('New'), tk('Repeat'), tk('At-risk'),
  // Insight confidence and supplier risk
  tk('High'), tk('Medium'), tk('Low'), tk('Moderate'), tk('Needs data'),
  // Categories added automatically
  tk('Uncategorized'), tk('Refund'),
];
