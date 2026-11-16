// Copies pdf.js font/cmap/wasm assets into public/pdfjs so the PDF viewer works offline
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public/pdfjs', { recursive: true });
for (const d of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) cpSync(`node_modules/pdfjs-dist/${d}`, `public/pdfjs/${d}`, { recursive: true });
console.log('pdf.js assets copied');
