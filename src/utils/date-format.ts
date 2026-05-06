/**
 * Convert minutes to hours
 * @param minutes
 * @param precision Number of decimal places, default is 2
 */
export const minToHour = (minutes: number, precision = 2): number => {
  if (!minutes) return 0;
  return Number((minutes / 60).toFixed(precision));
};
