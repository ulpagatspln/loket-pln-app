import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, deleteDoc, getDoc, getDocs, onSnapshot, collection, writeBatch,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyACIdEtcYrflNf6xZ3Fmm4So2EXbkBlKiE',
  authDomain: 'loket-pln-agats.firebaseapp.com',
  projectId: 'loket-pln-agats',
  storageBucket: 'loket-pln-agats.firebasestorage.app',
  messagingSenderId: '764562324958',
  appId: '1:764562324958:web:e21798e17967ca985ab14f',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const permCol = collection(db, 'permohonan');
export const kasCol = collection(db, 'kas');
export const gvCol = collection(db, 'gvAgenda');
export const hargaCol = collection(db, 'harga');
export const hargaTdCol = collection(db, 'hargaTambahDaya');

export const permDoc = (id) => doc(db, 'permohonan', id);
export const kasDoc = (id) => doc(db, 'kas', id);
export const buktiDoc = (id) => doc(db, 'bukti', id);
export const gvDoc = (id) => doc(db, 'gvAgenda', id);
export const hargaDoc = (id) => doc(db, 'harga', String(id));
export const hargaTdDoc = (id) => doc(db, 'hargaTambahDaya', String(id));

export const newBatch = () => writeBatch(db);

export { signInAnonymously, setDoc, deleteDoc, getDoc, getDocs, onSnapshot };

export async function connectAnonymously() {
  const cred = await signInAnonymously(auth);
  return cred.user;
}
