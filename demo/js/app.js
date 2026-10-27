import { generateASCII, normalizeInput, MAX_INPUT_LENGTH } from './ascii-generator.js';
import { BANNERS, loadFont } from './font-loader.js';
import { downloadASCII } from './download.js';
import { readStored, writeStored, readCount } from './storage.js';

const themes = ['mario', 'terminal', 'normal', 'dark'];
const theme = document.body.dataset.theme;
let count = readCount();
function updateCount() {
  document.querySelectorAll('[data-count]').forEach(node => {
    node.textContent = node.dataset.count === 'coin' ? String(count).padStart(2, '0') : String(count);
  });
}
updateCount();

if (theme === 'home') {
  const form = document.querySelector('.button-group');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const selected = event.submitter?.value;
    if (themes.includes(selected)) {
      writeStored('theme', selected);
      location.href = `${selected}.html`;
    }
  });
  const previous = readStored('theme', '');
  if (themes.includes(previous)) {
    const resume = document.querySelector('[data-resume]');
    resume.hidden = false;
    resume.href = `${previous}.html`;
    resume.textContent = `Continue with ${previous.charAt(0).toUpperCase() + previous.slice(1)}`;
  }
} else if (themes.includes(theme)) {
  writeStored('theme', theme);
  const form = document.querySelector('[data-generator]');
  const input = form.elements.inputText;
  const output = document.querySelector('[data-output]');
  const section = document.querySelector('[data-result]');
  const error = document.querySelector('[data-error]');
  const status = document.querySelector('[data-status]');
  const buttons = [...form.querySelectorAll('[name=banner]')];
  let selectedBanner = 'standard';
  let generated = '';
  let busy = false;
  let version = 0;
  input.maxLength = MAX_INPUT_LENGTH;
  const saveDraft = () => writeStored('draft', { input: input.value, banner: selectedBanner }, 'sessionStorage');
  const showError = message => {
    error.textContent = message;
    error.hidden = false;
    status.textContent = '';
  };
  function markBanner() {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.value === selectedBanner)));
  }
  function display(result) {
    generated = result;
    // Both <pre> and readonly <textarea> preserve the generator's exact bytes.
    if (output.tagName === 'TEXTAREA') output.value = result;
    else output.textContent = result;
    section.hidden = result.length === 0;
  }
  function invalidate() {
    version++;
    display('');
    error.hidden = true;
    status.textContent = '';
    saveDraft();
  }
  input.addEventListener('input', invalidate);
  form.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      form.requestSubmit(buttons.find(button => button.value === selectedBanner));
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const banner = event.submitter?.value ?? selectedBanner;
    const submittedText = input.value;
    const submittedVersion = ++version;
    error.hidden = true;
    display('');
    try {
      normalizeInput(submittedText);
      if (!BANNERS.includes(banner)) throw new Error('Choose a valid banner.');
      selectedBanner = banner;
      markBanner();
      saveDraft();
      busy = true;
      form.setAttribute('aria-busy', 'true');
      buttons.forEach(button => { button.disabled = true; });
      status.textContent = 'Generating…';
      const font = await loadFont(banner);
      if (submittedVersion !== version) return;
      const result = generateASCII(submittedText, font);
      display(result);
      if (result.length > 0) {
        count = Math.min(Number.MAX_SAFE_INTEGER, readCount() + 1);
        writeStored('count', count);
        updateCount();
        status.textContent = 'ASCII art generated.';
        // Only play after an explicit successful generation; autoplay failures
        // must never prevent generation or downloads.
        document.querySelector('audio')?.play().catch(() => {});
      } else status.textContent = 'Enter text or line breaks to generate ASCII art.';
    } catch (failure) {
      if (submittedVersion === version) showError(failure.message || 'Could not generate ASCII art. Please try again.');
    } finally {
      busy = false;
      form.removeAttribute('aria-busy');
      buttons.forEach(button => { button.disabled = false; });
    }
  });
  document.querySelector('[data-download]').addEventListener('click', () => downloadASCII(generated));
  document.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(generated);
      status.textContent = 'ASCII art copied.';
    } catch {
      output.focus();
      if (output.tagName === 'TEXTAREA') output.select();
      else {
        const range = document.createRange();
        range.selectNodeContents(output);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      }
      status.textContent = 'Output selected. Press Ctrl+C or Command+C to copy.';
    }
  });
  const draft = readStored('draft', null, 'sessionStorage');
  if (draft && typeof draft.input === 'string' && draft.input.length <= MAX_INPUT_LENGTH) {
    input.value = draft.input;
    if (BANNERS.includes(draft.banner)) selectedBanner = draft.banner;
    if (input.value) {
      const restoredVersion = version;
      loadFont(selectedBanner).then(font => {
        if (version === restoredVersion) display(generateASCII(input.value, font));
      }).catch(failure => { if (version === restoredVersion) showError(failure.message); });
    }
  }
  markBanner();
  document.querySelectorAll('[data-time]').forEach(node => { node.textContent = new Date().toLocaleTimeString(); });
}
