/**
 * Count SMS segments for a message.
 * Safe to import from client components.
 */
export function countSegments(message: string): number {
  const hasUnicode = /[^\x00-\x7F]/.test(message);
  const len = message.length;

  if (hasUnicode) {
    return len <= 70 ? 1 : Math.ceil(len / 67);
  }
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

/**
 * Detect if a message contains Unicode (non-GSM-7) characters.
 */
export function hasUnicodeChars(message: string): boolean {
  return /[^\x00-\x7F]/.test(message);
}

/**
 * Get the max characters for the current segment.
 */
export function getSegmentLimit(message: string): number {
  const unicode = hasUnicodeChars(message);
  const len = message.length;
  if (unicode) return len <= 70 ? 70 : 67;
  return len <= 160 ? 160 : 153;
}

/**
 * Get remaining characters in the current segment.
 */
export function getRemainingChars(message: string): number {
  if (message.length === 0) return 160;
  const limit = getSegmentLimit(message);
  const segments = countSegments(message);
  return (segments * limit) - message.length;
}
