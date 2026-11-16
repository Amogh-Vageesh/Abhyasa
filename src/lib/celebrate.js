import confetti from 'canvas-confetti';
export function celebrate(big = false) {
  try {
    confetti({ particleCount: big ? 160 : 90, spread: big ? 100 : 70, origin: { y: 0.7 }, colors: ['#ffbf3c', '#ff8a1f', '#22b35e', '#3b82f6', '#8b5cf6', '#ef4f5a'] });
    if (big) setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 300);
  } catch {}
}
