export function makeTextBlob(output) {
  // Do not use endings:'native': the file must retain the generator's LF bytes.
  return new Blob([output], { type: 'text/plain;charset=utf-8' });
}

export function downloadASCII(output) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const url = URL.createObjectURL(makeTextBlob(output));
  const link = document.createElement('a');
  link.href = url;
  link.download = `ascii-art-${timestamp}.txt`;
  document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    // Allow browsers to begin reading the Blob before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
