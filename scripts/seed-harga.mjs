// Tulis ulang koleksi `harga` & `hargaTambahDaya` dari nilai bawaan di src/lib/harga.js.
// Jalankan setelah mengubah DEFAULT_HARGA / DEFAULT_TAMBAH_DAYA.
//   node scripts/seed-harga.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { DEFAULT_HARGA, DEFAULT_TAMBAH_DAYA } from '../src/lib/harga.js';

const app = initializeApp({
  apiKey: 'AIzaSyACIdEtcYrflNf6xZ3Fmm4So2EXbkBlKiE',
  authDomain: 'loket-pln-agats.firebaseapp.com',
  projectId: 'loket-pln-agats',
  storageBucket: 'loket-pln-agats.firebasestorage.app',
  messagingSenderId: '764562324958',
  appId: '1:764562324958:web:e21798e17967ca985ab14f',
});
const db = getFirestore(app);
await signInAnonymously(getAuth(app));

const now = new Date().toISOString();
const b = writeBatch(db);
DEFAULT_HARGA.forEach((r) => b.set(doc(db, 'harga', String(r.daya)), { ...r, updatedAt: now }));
DEFAULT_TAMBAH_DAYA.forEach((r) =>
  b.set(doc(db, 'hargaTambahDaya', `${r.sebelum}-${r.sesudah}`), { ...r, updatedAt: now })
);
await b.commit();

console.log(`OK: ${DEFAULT_HARGA.length} baris harga + ${DEFAULT_TAMBAH_DAYA.length} baris hargaTambahDaya ditulis.`);
console.log('contoh harga 900:', JSON.stringify(DEFAULT_HARGA[0]));
console.log('contoh TD 450->900:', JSON.stringify(DEFAULT_TAMBAH_DAYA[0]));
process.exit(0);
