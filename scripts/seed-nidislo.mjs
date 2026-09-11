// Isi koleksi `nidiSlo` dari DEFAULT_NIDI_SLO di src/lib/harga.js.
// Koleksi baru — aman dijalankan, tidak menyentuh `harga` / `hargaTambahDaya`.
//   node scripts/seed-nidislo.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { DEFAULT_NIDI_SLO } from '../src/lib/harga.js';

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
DEFAULT_NIDI_SLO.forEach((r) => b.set(doc(db, 'nidiSlo', String(r.daya)), { ...r, updatedAt: now }));
await b.commit();

console.log(`OK: ${DEFAULT_NIDI_SLO.length} baris nidiSlo ditulis.`);
console.log(DEFAULT_NIDI_SLO.map((r) => `${r.daya}: ${r.nidiSlo.toLocaleString('id-ID')}`).join('\n'));
process.exit(0);
