export const MAX_INPUT_LENGTH = 1000;

export function normalizeInput(input) {
  if (typeof input !== 'string') throw new Error('Enter text to generate ASCII art.');
  // Go removes every CR, including lone CR characters, before splitting on LF.
  const text = input.replace(/\r/g, '');
  if (text.length > MAX_INPUT_LENGTH) throw new Error(`Please use at most ${MAX_INPUT_LENGTH} characters.`);
  for (const character of text) {
    const code = character.codePointAt(0);
    if (character !== '\n' && (code < 32 || code > 126)) {
      throw new Error('Use printable ASCII characters (space through ~) and line breaks. Accents, emoji, and tabs are not supported.');
    }
  }
  return text;
}

// Port of backend.ASCIIArt, PrintLine, and PrintLineforbigmoney. No trimming.
export function generateASCII(input, font) {
  const lines = normalizeInput(input).split('\n');
  let first = true;
  const output = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line !== '') {
      if (first && index !== 0) output.push('\n');
      const characters = Array.from(line, character => font.glyphs.get(character));
      for (let row = 0; row < font.height; row++) {
        output.push(characters.map(glyph => glyph[row]).join(''), '\n');
      }
      // The Go Bigmoney branch continues before first=false. Preserve its extra
      // newline before later nonempty lines for byte-for-byte compatibility.
      if (font.banner !== 'bigmoney') first = false;
    } else if (index !== 0) {
      output.push('\n');
    }
  }
  return output.join('');
}
