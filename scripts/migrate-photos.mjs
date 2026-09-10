/**
 * Migrasi foto bukti dari file lokal ke Firestore (koleksi `bukti`).
 *
 * Pakai ini kalau Anda sudah mengunduh foto-foto bukti dari Google Drive ke satu folder.
 *
 * Konvensi nama file (case-insensitive):
 *   <REQ-id>-ppob.jpg     -> bukti tahap 0 (Pembayaran PPOB)  untuk permohonan tsb
 *   <REQ-id>-pasang.jpg   -> bukti tahap 1 (Pemasangan)       untuk permohonan tsb
 *   contoh: REQ-1515-ppob.jpg , REQ-1515-pasang.png
 *
 * Jalankan:
 *   node scripts/migrate-photos.mjs "C:/path/ke/folder/foto"
 *   node scripts/migrate-photos.mjs "C:/path/ke/folder/foto" --dry     (uji coba, tanpa tulis)
 *
 * Script akan:
 *   1. kompres tiap foto (maks 1080px, ~kualitas 72, target < 230 KB)
 *   2. simpan sebagai dokumen di koleksi `bukti` (data URL JPEG base64)
 *   3. set field `buktiId` pada dokumen kas Pengeluaran yang cocok (refId + PPOB/Pemasangan)
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';

const dir = process.argv[2];
const DRY = process.argv.includes('--dry');
if (!dir) {
  console.error('Pemakaian: node scripts/migrate-photos.mjs "<folder foto>" [--dry]');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: 'AIzaSyACIdEtcYrflNf6xZ3Fmm4So2EXbkBlKiE',
  authDomain: 'loket-pln-agats.firebaseapp.com',
  projectId: 'loket-pln-agats',
  storageBucket: 'loket-pln-agats.firebasestorage.app',
  messagingSenderId: '764562324958',
  appId: '1:764562324958:web:e21798e17967ca985ab14f',
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
await signInAnonymously(getAuth(app));

const KIND = { ppob: { m: 'PPOB', step: 0 }, pasang: { m: 'Pemasangan', step: 1 } };

async function compress(buf) {
  let q = 78;
  let out = await sharp(buf).rotate().resize(1080, 1080, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: q }).toBuffer();
  while (out.length > 230_000 && q > 40) {
    q -= 8;
    out = await sharp(buf).rotate().resize(1080, 1080, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: q }).toBuffer();
  }
  return `data:image/jpeg;base64,${out.toString('base64')}`;
}

const kasSnap = await getDocs(collection(db, 'kas'));
const kas = kasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f));
let ok = 0, skip = 0;

for (const f of files) {
  const name = basename(f, extname(f)).toLowerCase();
  const match = name.match(/^(req-\d+)-(ppob|pasang)$/);
  if (!match) {
    console.warn(`skip (nama tidak sesuai): ${f}`);
    skip++;
    continue;
  }
  const reqId = match[1].toUpperCase();
  const kind = KIND[match[2]];
  const target = kas.find((k) => k.refId === reqId && k.tipe === 'Pengeluaran' && (k.ket || '').includes(kind.m));
  if (!target) {
    console.warn(`skip (kas tidak ditemukan): ${f} -> ${reqId}/${kind.m}`);
    skip++;
    continue;
  }

  const dataUrl = await compress(await readFile(join(dir, f)));
  const kb = Math.round((dataUrl.length * 0.75) / 1024);
  const buktiId = 'IMG-' + Math.floor(1000 + Math.random() * 9000);

  console.log(`${DRY ? '[dry] ' : ''}${f} -> bukti/${buktiId} (${kb} KB) -> kas/${target.id}`);
  if (!DRY) {
    await setDoc(doc(db, 'bukti', buktiId), {
      id: buktiId,
      data: dataUrl,
      ket: kind.m === 'PPOB' ? 'Biaya Pembayaran BP di PPOB' : 'Biaya Pemasangan di Lokasi',
      refId: reqId,
      step: kind.step,
      createdAt: new Date().toISOString(),
      migrated: true,
    });
    await setDoc(doc(db, 'kas', target.id), { buktiId }, { merge: true });
  }
  ok++;
}

console.log(`\nSelesai. Berhasil: ${ok}, dilewati: ${skip}.`);
process.exit(0);
