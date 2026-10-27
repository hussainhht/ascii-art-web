const prefix = 'ascii-art-web.demo.';
const memory = new Map();

export function readStored(key, fallback, kind = 'localStorage') {
  try { return JSON.parse(globalThis[kind].getItem(prefix + key)) ?? memory.get(key) ?? fallback; }
  catch { return memory.get(key) ?? fallback; }
}

export function writeStored(key, value, kind = 'localStorage') {
  memory.set(key, value);
  try { globalThis[kind].setItem(prefix + key, JSON.stringify(value)); } catch { /* In-memory fallback. */ }
}

export function readCount() {
  const value = readStored('count', 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
