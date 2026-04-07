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
