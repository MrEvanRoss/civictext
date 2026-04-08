/**
 * BullMQ Worker Entry Point
 * Starts all background workers for CivicText.
 */

console.info("CivicText workers starting...");

// Import workers (they self-register on import)
import("./message-worker")
  .then(() => console.info("Message + campaign workers loaded"))
  .catch((err) => console.error("Failed to load message workers:", err));

console.info("CivicText workers ready. Waiting for jobs...");

// Keep the process alive
setInterval(() => {}, 1 << 30);
