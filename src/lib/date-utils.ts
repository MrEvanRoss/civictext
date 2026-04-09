/**
 * Format a date string (YYYY-MM-DD) into a friendly display format.
 * e.g. "2026-11-03" → "Tuesday, November 3"
 */
export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T12:00:00"); // noon to avoid timezone shift
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a time string into a friendly display format.
 * Accepts "HH:mm" (24h) or "H:mm AM/PM". Returns "H:mm AM/PM".
 * e.g. "07:00" → "7:00 AM", "20:00" → "8:00 PM"
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  // If already in AM/PM format, return as-is
  if (/[AP]M/i.test(timeStr)) return timeStr;
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch {
    return timeStr;
  }
}
