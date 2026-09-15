// Upstream interpolates instructions into YAML; retrieved LaTeX/backslashes
// must remain readable text rather than YAML escape sequences.
export function duplexText(text) {
  return String(text).replace(/\\/g, '＼').replace(/"/g, '＂').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ');
}
