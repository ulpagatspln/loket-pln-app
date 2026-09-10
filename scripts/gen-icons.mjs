import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const icon = (bg) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <path d="M292 96 168 300h72l-20 132 148-196h-80z" fill="#FDB913"/>
</svg>`;

const maskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1B75BB"/>
  <path d="M286 150 196 310h52l-14 96 108-142h-58z" fill="#FDB913"/>
</svg>`;

await sharp(Buffer.from(icon('#1B75BB'))).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(icon('#1B75BB'))).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile('public/icons/icon-512-maskable.png');

console.log('icons generated');
