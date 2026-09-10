import { buktiDoc, setDoc, getDoc } from '../firebase.js';
import { generateId } from './format.js';

/**
 * Kompres gambar di sisi klien memakai canvas.
 * Turunkan kualitas lalu dimensi sampai di bawah `maxBytes`.
 * Return { dataUrl, bytes, width, height }.
 */
export async function compressImage(file, { maxDim = 1080, maxBytes = 230_000 } = {}) {
  if (!file || !file.type.startsWith('image/')) throw new Error('File bukan gambar.');
  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const draw = (w, h) => {
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  draw(img.width * scale, img.height * scale);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (bytesOf(dataUrl) > maxBytes && quality > 0.42) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  while (bytesOf(dataUrl) > maxBytes && Math.max(canvas.width, canvas.height) > 600) {
    draw(canvas.width * 0.85, canvas.height * 0.85);
    dataUrl = canvas.toDataURL('image/jpeg', 0.6);
  }

  URL.revokeObjectURL(img.src);
  return { dataUrl, bytes: bytesOf(dataUrl), width: canvas.width, height: canvas.height };
}

function bytesOf(dataUrl) {
  const i = dataUrl.indexOf(',');
  return Math.ceil(((dataUrl.length - i - 1) * 3) / 4);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal membaca gambar.'));
    img.src = URL.createObjectURL(file);
  });
}

/** Simpan foto (data URL JPEG) ke koleksi `bukti`. Return id dokumen. */
export async function savePhoto(dataUrl, meta = {}) {
  const id = generateId('IMG');
  await setDoc(buktiDoc(id), {
    id,
    data: dataUrl,
    createdAt: new Date().toISOString(),
    ...meta,
  });
  return id;
}

const cache = new Map();

/** Ambil data URL foto dari koleksi `bukti` (dengan cache di memori). */
export async function getPhoto(id) {
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);
  try {
    const snap = await getDoc(buktiDoc(id));
    const data = snap.exists() ? snap.data().data : null;
    cache.set(id, data);
    return data;
  } catch {
    return null;
  }
}
