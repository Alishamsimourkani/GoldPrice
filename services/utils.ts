/**
 * Helper to clean and parse numeric strings from varying API responses
 */
export const parseNumericValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '');
    return parseFloat(cleaned);
  }
  return 0;
};
