// The desktop app's icon: the portal's purple gradient with rising bars. Run once; the result is electron/icon.png.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d946ef"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="url(#g)"/>
<g fill="#fff"><rect x="96" y="288" width="68" height="128" rx="14"/><rect x="190" y="224" width="68" height="192" rx="14"/><rect x="284" y="160" width="68" height="256" rx="14"/></g>
<path d="M104 236 L226 150 L300 104 L400 78" fill="none" stroke="#fde68a" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M360 70 L412 74 L404 126" fill="none" stroke="#fde68a" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'electron', 'icon.png'));
console.log('icon written');
