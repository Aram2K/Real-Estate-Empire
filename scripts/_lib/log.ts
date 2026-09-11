/* Minimal timestamped logger for ingestion scripts. */

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

export const log = {
  info: (msg: string) => console.log(`[${ts()}] ${msg}`),
  step: (msg: string) => console.log(`[${ts()}] → ${msg}`),
  ok: (msg: string) => console.log(`[${ts()}] ✓ ${msg}`),
  warn: (msg: string) => console.warn(`[${ts()}] ! ${msg}`),
  error: (msg: string) => console.error(`[${ts()}] ✗ ${msg}`),
};
