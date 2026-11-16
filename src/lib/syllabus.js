// NCERT Class 7 (CBSE) 2026-27 books
const mk = (prefix, book, titles) => titles.map((t, i) => ({ id: `${prefix}-${i + 1}`, no: i + 1, title: t, book }));

export const SUBJECTS = [
  { id: 'maths', name: 'Maths', color: '#3b82f6', chapters: [
    ...mk('m1', 'Ganita Prakash I', ['Large Numbers Around Us', 'Arithmetic Expressions', 'A Peek Beyond the Point', 'Expressions Using Letter-Numbers', 'Parallel and Intersecting Lines', 'Number Play', 'A Tale of Three Intersecting Lines', 'Working with Fractions']),
    ...mk('m2', 'Ganita Prakash II', ['Geometric Twins', 'Operations with Integers', 'Finding Common Ground', 'Another Peek Beyond the Point', 'Connecting the Dots', 'Constructions and Tilings', 'Finding the Unknown'])
  ]},
  { id: 'science', name: 'Science', color: '#10b981', chapters: mk('sc', 'Curiosity', [
    'The Ever-Evolving World of Science', 'Exploring Substances: Acidic, Basic, and Neutral', 'Electricity: Circuits and their Components', 'The World of Metals and Non-metals', 'Changes Around Us: Physical and Chemical', 'Adolescence: A Stage of Growth and Change', 'Heat Transfer in Nature', 'Measurement of Time and Motion', 'Life Processes in Animals', 'Life Processes in Plants', 'Light: Shadows and Reflections', 'Earth, Moon, and the Sun'
  ])},
  { id: 'social', name: 'Social Science', color: '#f97316', chapters: [
    ...mk('ss1', 'Exploring Society I', ['Geographical Diversity of India', 'Understanding the Weather', 'Climates of India', 'New Beginnings: Cities and States', 'The Rise of Empires', 'The Age of Reorganisation', 'The Gupta Era: An Age of Tireless Creativity', 'How the Land Becomes Sacred', 'From the Rulers to the Ruled: Types of Governments', 'The Constitution of India: An Introduction', 'From Barter to Money', 'Understanding Markets']),
    ...mk('ss2', 'Exploring Society II', ['The Story of Indian Farming', 'India and Her Neighbours', 'Empires and Kingdoms: 6th to 10th Centuries', 'Turning Tides: 11th and 12th Centuries', 'India, a Home to Many', 'The State, the Government, and You', "Infrastructure: Engine of India's Development", 'Banks and the Magic of Finance'])
  ]},
  { id: 'english', name: 'English', color: '#8b5cf6', chapters: mk('en', 'Poorvi', [
    'The Day the River Spoke', 'Try Again', 'Three Days to See', 'Animals, Birds, and Dr. Dolittle', 'A Funny Man', 'Say the Right Thing', "My Brother's Great Invention", 'Paper Boats', 'North, South, East, West', 'The Tunnel', 'Travel', 'Conquering the Summit', 'A Homage to Our Brave Soldiers', 'My Dear Soldiers', 'Rani Abbakka'
  ])},
  { id: 'other', name: 'Other / 2nd Language', color: '#ec4899', chapters: [] }
];

export const CHAPTERS = Object.fromEntries(
  SUBJECTS.flatMap((s) => s.chapters.map((c) => [c.id, { ...c, subject: s.id, subjectName: s.name, color: s.color }]))
);

export function chapterLabel(id) {
  const c = CHAPTERS[id];
  if (!c) return id || '';
  const part = id.startsWith('m2') || id.startsWith('ss2') ? 'II-' : id.startsWith('m1') || id.startsWith('ss1') ? 'I-' : '';
  return `${c.subjectName} ${part}${c.no}: ${c.title}`;
}
