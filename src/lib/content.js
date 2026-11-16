// Karnataka State General Holidays 2026 (Govt. of Karnataka Notification I, Nov 2025),
// plus festivals that fall on Sundays/2nd Saturdays (not separately listed by the Govt.).
// 2027: only fixed-date national/state days until the 2027 notification is published.
export const HOLIDAYS = [
  ['2026-01-15', 'Makara Sankranti'], ['2026-01-26', 'Republic Day'], ['2026-02-15', 'Maha Shivaratri (Sunday)'],
  ['2026-03-19', 'Ugadi'], ['2026-03-21', 'Khutub-E-Ramzan'], ['2026-03-31', 'Mahaveera Jayanthi'],
  ['2026-04-03', 'Good Friday'], ['2026-04-14', 'Dr. B.R. Ambedkar Jayanthi'], ['2026-04-20', 'Basava Jayanthi / Akshaya Tritiya'],
  ['2026-05-01', 'May Day'], ['2026-05-28', 'Bakrid'], ['2026-06-26', 'Last Day of Moharam'],
  ['2026-08-15', 'Independence Day'], ['2026-08-26', 'Eid-Milad'], ['2026-09-14', 'Varasiddhi Vinayaka Vrata'],
  ['2026-10-02', 'Gandhi Jayanthi'], ['2026-10-20', 'Mahanavami / Ayudha Pooja'], ['2026-10-21', 'Vijayadashami'],
  ['2026-10-25', 'Maharshi Valmiki Jayanthi (Sunday)'], ['2026-11-01', 'Kannada Rajyotsava (Sunday)'],
  ['2026-11-08', 'Naraka Chaturdashi (Sunday)'], ['2026-11-10', 'Balipadyami / Deepavali'],
  ['2026-11-27', 'Kanakadasa Jayanthi'], ['2026-12-25', 'Christmas'],
  ['2027-01-26', 'Republic Day'], ['2027-05-01', 'May Day'], ['2027-08-15', 'Independence Day'],
  ['2027-10-02', 'Gandhi Jayanthi'], ['2027-11-01', 'Kannada Rajyotsava'], ['2027-12-25', 'Christmas']
].map(([date, title]) => ({ id: `hol-${date}`, date, title, type: 'holiday', builtin: true }));

// "2026-12-24 Christmas break" / "24/12/2026 - Annual day" / "2026-12-24,2027-01-01 Winter vacation"
export function parseSchoolCalendar(text) {
  const out = [];
  const errors = [];
  const toISO = (s) => {
    s = s.trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY (Indian)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  };
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([\d/.-]+)(?:\s*(?:to|–|—|,)\s*([\d/.-]+))?\s*[-:|,]?\s*(.+)$/i);
    const start = m && toISO(m[1]);
    if (!start) { errors.push(`Couldn't read a date in: "${line}"`); continue; }
    const end = m[2] ? toISO(m[2]) : null;
    const title = m[3].trim();
    const type = /exam|test|assessment|FA\d|SA\d|PT\d|unit/i.test(title) ? 'test' : /holiday|vacation|break|leave|closed/i.test(title) ? 'holiday' : /ptm|parent/i.test(title) ? 'ptm' : 'school';
    out.push({ date: start, endDate: end && end > start ? end : null, title, type });
  }
  return { events: out, errors };
}

// Subject-wise exam preparation guidance (CBSE Class 7, NCERT 2026-27 books)
export const EXAM_GUIDES = {
  maths: {
    name: 'Maths', color: '#2f7fe0',
    pattern: 'Mostly problem-solving: short calculations, word problems, constructions and a few reasoning questions. Steps carry marks.',
    tips: [
      'Do every “Figure it Out” question in Ganita Prakash — school tests are built from these.',
      'Practise daily, not just before the test: 20–30 minutes of problems beats 3 hours on the last day.',
      'Write every step neatly. Even if the final answer is wrong, correct steps earn marks.',
      'Keep a formula & rules page (divisibility, angle sum, fraction rules) and read it before each test.',
      'Redo every question in your Fix-it list without looking at the answer.',
      'For word problems: underline what is given, circle what is asked, then decide the operation.',
      'Check answers by estimating (is the answer sensible?) and by substituting back for equations.'
    ],
    before: ['Re-solve 2 problems of each type per chapter', 'Revise formula page', 'Practise constructions with a sharp pencil & compass'],
    inExam: ['Attempt questions you are sure of first', 'Keep 10 minutes at the end to check calculations', 'Draw figures for geometry even if not asked']
  },
  science: {
    name: 'Science', color: '#1f9d55',
    pattern: 'Mix of MCQs, short answers, “give reasons”, diagram-based and activity/experiment questions.',
    tips: [
      'Understand the activities in Curiosity — many questions ask what happens and why.',
      'Learn labelled diagrams (circuits, digestive system, plant parts) and practise drawing them.',
      'For “give reason” questions use the pattern: fact → because → science idea.',
      'Make a one-page summary per chapter with key terms and examples from daily life.',
      'Use real examples (kitchen, weather, electricity at home) — they make answers stronger.',
      'Practise the end-of-chapter questions and the app’s practice daily.'
    ],
    before: ['Read your chapter summaries', 'Draw each key diagram once from memory', 'Revise definitions and differences (e.g. physical vs chemical change)'],
    inExam: ['Label diagrams clearly with a pencil', 'Use keywords from the textbook', 'Answer to the marks: 2 marks ≈ 2 points']
  },
  social: {
    name: 'Social Science', color: '#ee8a12',
    pattern: 'Short and long answers, map work, source/case-based questions across geography, history, civics and economics.',
    tips: [
      'Make a timeline for history chapters (dynasties, rulers, key events) and revise it often.',
      'Practise map work every week: rivers, mountains, states, climate regions.',
      'Learn key terms with one example each (e.g. barter, market, constitution).',
      'Write long answers in points with a heading and an example.',
      'Connect topics to news and places you have visited — easier to remember.',
      'Use the “Let’s explore / Think about it” boxes in Exploring Society for practice.'
    ],
    before: ['Revise timelines and maps', 'Revise key terms list', 'Practise 2 long answers in points'],
    inExam: ['Underline keywords in your answers', 'Write in points, not paragraphs', 'Mark maps neatly and add a legend']
  },
  english: {
    name: 'English', color: '#8b5cf6',
    pattern: 'Reading comprehension (unseen passages), grammar, writing (letters, paragraphs, notices) and literature from Poorvi.',
    tips: [
      'Read something every day — a story, newspaper or magazine for 15–20 minutes.',
      'For each Poorvi chapter know: theme, characters, main events and the message.',
      'Practise one writing task a week (letter, paragraph, diary entry) and get it checked.',
      'Keep a vocabulary notebook: new word, meaning, your own sentence.',
      'Revise grammar topics with short exercises: tenses, voice, reported speech, prepositions.',
      'For comprehension, read the questions first, then the passage.'
    ],
    before: ['Revise chapter summaries and characters', 'Practise one letter and one paragraph', 'Do a grammar worksheet'],
    inExam: ['Follow the word limit in writing tasks', 'Quote the text briefly for literature answers', 'Leave time to check spelling and punctuation']
  },
  other: {
    name: 'Kannada', color: '#d6457a',
    pattern: 'Reading, grammar, vocabulary, writing and lessons/poems from the textbook.',
    tips: [
      'Read the lesson aloud daily — it improves fluency and spelling.',
      'Make a word list with meanings for every lesson.',
      'Practise writing letters and essays in the language every week.',
      'Learn poems with their meaning and practise writing them without mistakes.'
    ],
    before: ['Revise word lists', 'Write one essay/letter', 'Read each lesson once aloud'],
    inExam: ['Write neatly with correct letters/matras', 'Re-read answers for spelling']
  }
};

export const GENERAL_EXAM_TIPS = [
  'Start revising 2 weeks before a test, not 2 days.',
  'Use the app’s calendar: add the test with its chapters so practice focuses on them.',
  'Sleep well the night before — no late-night cramming.',
  'Read the whole paper first, then start with what you know best.',
  'Watch the clock: marks ÷ total marks × time = minutes per question.'
];
