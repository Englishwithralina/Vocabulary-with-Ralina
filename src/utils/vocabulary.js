export const normalize = value => String(value).trim().toLocaleLowerCase('en');
export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function parseVocabulary(text) {
  const items = [], errors = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const match = line.match(/^(.+?)\s*(?:\||=|\s[-–—]\s)\s*(.+)$/u);
    if (!match || !match[1].trim() || !match[2].trim()) errors.push(`Line ${index + 1}: use word | meaning.`);
    else items.push({ term: match[1].trim(), meaning: match[2].trim(), example: '' });
  });
  return { items, errors };
}
export function validateItems(items) {
  const errors = [], warnings = [], pairs = new Set(), terms = new Set();
  if (!Array.isArray(items) || items.length < 4) errors.push('Add at least 4 word pairs for meaningful practice.');
  if (!Array.isArray(items)) return { errors, warnings };
  items.forEach((item, i) => {
    if (!item || typeof item.term !== 'string' || typeof item.meaning !== 'string' || !item.term.trim() || !item.meaning.trim()) {
      errors.push(`Row ${i + 1}: enter both a word and a meaning.`); return;
    }
    if (item.term.length > 200 || item.meaning.length > 500 || (item.example || '').length > 1000) errors.push(`Row ${i + 1}: shorten the word (200), meaning (500), or example (1,000 characters).`);
    const term = normalize(item.term), pair = JSON.stringify([term, normalize(item.meaning)]);
    if (pairs.has(pair)) errors.push(`Row ${i + 1}: this word and meaning are already included.`);
    else if (terms.has(term)) warnings.push(`“${item.term}” has more than one meaning. Recognition accepts equivalent answers.`);
    pairs.add(pair); terms.add(term);
  });
  if (items.length > 20) warnings.push('Longer set: students will practise every word in all four rounds.');
  return { errors, warnings };
}
export function cleanItems(items) { return items.map(({ term, meaning, example }) => ({ term: term.trim(), meaning: meaning.trim(), example: (example || '').trim() })); }
