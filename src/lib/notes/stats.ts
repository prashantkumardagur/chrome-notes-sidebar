/** Number of whitespace-separated words in the text (empty/blank → 0). */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Number of lines in the text (empty → 0; otherwise \n-separated segments). */
export function lineCount(text: string): number {
  return text.length === 0 ? 0 : text.split("\n").length;
}
