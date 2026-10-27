export const BANNERS = Object.freeze(['standard', 'shadow', 'thinkertoy', 'bigmoney']);

export function validateBanner(banner) {
  if (!BANNERS.includes(banner)) throw new Error('Choose Standard, Shadow, Thinkertoy, or Bigmoney.');
}

// These offsets are the exact FileLine formulas in the two Go PrintLine functions.
export function parseFont(source, banner) {
  validateBanner(banner);
  const lines = source.replace(/\r/g, '').split('\n');
  const height = banner === 'bigmoney' ? 11 : 8;
  const stride = banner === 'bigmoney' ? 11 : 9;
  const offset = banner === 'bigmoney' ? 0 : 1;
  if (lines.length < offset + 95 * stride || (offset && lines[0] !== '')) {
    throw new Error(`The ${banner} font is incomplete or corrupted. Please reload and try again.`);
  }
  const glyphs = new Map();
  for (let code = 32; code <= 126; code++) {
    const start = (code - 32) * stride + offset;
    const rows = lines.slice(start, start + height);
    if (rows.length !== height || rows.some(row => /[^\x20-\x7e]/.test(row))) {
      throw new Error(`The ${banner} font contains invalid character data.`);
    }
    glyphs.set(String.fromCharCode(code), Object.freeze(rows));
  }
  if (![...glyphs.values()].some(rows => rows.some(row => row.trim()))) {
    throw new Error(`The ${banner} font has no character data.`);
  }
  return Object.freeze({ banner, height, glyphs });
}

export function createFontLoader(fetcher = (...args) => fetch(...args)) {
  const cache = new Map();
  return async function loadFont(banner) {
    validateBanner(banner);
    if (!cache.has(banner)) {
      const request = (async () => {
        const url = new URL(`../fonts/${banner}.txt`, import.meta.url);
        const response = await fetcher(url);
        if (!response.ok) throw new Error(`Could not load the ${banner} font. Please reload and try again.`);
        return parseFont(await response.text(), banner);
      })();
      cache.set(banner, request);
      request.catch(() => cache.delete(banner)); // Failed requests can be retried.
    }
    return cache.get(banner);
  };
}

export const loadFont = createFontLoader();
