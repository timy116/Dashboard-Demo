/**
 * Format a number with thousand separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with thousand separators (e.g., 1000 -> "1,000")
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Format an integer with thousand separators (no decimals)
 * @param value - The number to format
 * @returns Formatted string with thousand separators (e.g., 1000 -> "1,000")
 */
export function formatInteger(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}
