import { normalize, shuffle } from '../utils/vocabulary.js';
export const rounds = [
  { name: 'Recognise', instruction: 'Choose the correct meaning.', color: 'coral' },
  { name: 'Connect', instruction: 'Choose the correct English word.', color: 'violet' },
  { name: 'Build', instruction: 'Complete the English word or phrase.', color: 'aqua' },
  { name: 'Recall', instruction: 'Type the English word or phrase.', color: 'yellow' },
];
export function optionsFor(items, index, reverse = false) {
  const promptKey = reverse ? 'meaning' : 'term', answerKey = reverse ? 'term' : 'meaning';
  const item = items[index];
  const valid = items.filter(x => normalize(x[promptKey]) === normalize(item[promptKey])).map(x => normalize(x[answerKey]));
  const used = new Set(valid);
  const distractors = shuffle(items).filter(x => {
    const key = normalize(x[answerKey]);
    if (used.has(key)) return false;
    used.add(key); return true;
  }).slice(0, 3).map(x => x[answerKey]);
  return { options: shuffle([item[answerKey], ...distractors]), valid };
}
export function hint(term) {
  return term.split(/(\s+)/u).map(word => Array.from(word).map((c, i) => i === 0 || !/[\p{L}\p{N}]/u.test(c) ? c : '·').join('')).join('');
}
export function createSession(items, indices = null) {
  const review = indices !== null;
  return { items, review, queue: (review ? [4] : [0, 1, 2, 3]).flatMap(round => shuffle(indices || items.map((_, i) => i)).map(index => ({ round, index }))), position: 0, correct: 0, mistakes: new Set(), answered: false };
}
export function answer(session, value) {
  if (session.answered) return null;
  const { round, index } = session.queue[session.position], item = session.items[index];
  const valid = round < 2 ? optionsFor(session.items, index, round === 1).valid : session.items.filter(x => normalize(x.meaning) === normalize(item.meaning)).map(x => normalize(x.term));
  const correct = valid.includes(normalize(value));
  if (correct) session.correct++; else session.mistakes.add(index);
  session.answered = true;
  return { correct, expected: round === 0 ? item.meaning : item.term };
}

export function sessionResult(session) {
  return { correct: session.correct, total: session.queue.length, accuracy: Math.round(session.correct / session.queue.length * 100), remaining: [...session.mistakes] };
}

// One attempt per difficult item per review pass. Incorrect words stay available
// on Results; only an explicit new Review starts another pass, so there is no loop.
export function resultAfterReview(original, review) {
  return { ...original, remaining: [...review.mistakes], review: { correct: review.correct, total: review.queue.length } };
}
