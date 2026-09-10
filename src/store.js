import {
  permCol, kasCol, gvCol, hargaCol, hargaTdCol, permDoc, kasDoc, hargaDoc, hargaTdDoc,
  setDoc, deleteDoc, onSnapshot, connectAnonymously,
} from './firebase.js';
import { generateId } from './lib/format.js';

export const GV_META_ID = 'zz-import-meta';

export const PROGRESS_STEPS = [
  'Pembayaran BP di PPOB',
  'Pemasangan di Lokasi',
  'Penginputan FSO',
  'Peremajaan di AP2T',
  'Pembayaran NIDI & SLO',
  'Upload Berkas NIDI & SLO',
];

export const state = {
  permohonan: [],
  kas: [],
  gvAgenda: [], // baris hasil import GV (tanpa dok meta)
  gvMeta: null, // { lastImportAt, rows, fileName }
  harga: [], // daftar harga pasang baru per daya
  hargaTd: [], // daftar harga tambah daya (matriks sebelum->sesudah)
  ready: false,
  user: null,
};

// Set noAgenda milik permohonan (sudah di-trim) untuk pencocokan cepat.
export const permAgendaSet = () =>
  new Set(state.permohonan.filter((p) => p.noAgenda).map((p) => String(p.noAgenda).trim()));

// Baris GV yang belum ada di permohonan mana pun.
export function gvBelumMasuk() {
  const inPerm = permAgendaSet();
  const namaToPerm = new Map();
  state.permohonan.forEach((p) => {
    if (p.nama) namaToPerm.set(p.nama.trim().toLowerCase(), p);
  });
  return state.gvAgenda
    .filter((r) => !inPerm.has(String(r.noAgenda).trim()))
    .map((r) => ({ ...r, namaMatch: namaToPerm.get((r.nama || '').trim().toLowerCase()) || null }))
    .sort((a, b) => String(b.tglMohon).localeCompare(String(a.tglMohon)));
}

const listeners = new Set();
export const onChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn(state));

export const calculateSaldo = () =>
  state.kas.reduce((sum, t) => (t.tipe === 'Pemasukan' ? sum + t.nominal : sum - t.nominal), 0);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function subscribe(col, apply) {
  let stop = null;
  const start = () => {
    stop = onSnapshot(
      col,
      (snap) => {
        apply(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        state.ready = true;
        emit();
      },
      async (err) => {
        console.warn('listener error, reconnecting:', err?.code || err);
        stop?.();
        await sleep(2500);
        start();
      }
    );
  };
  start();
}

export async function initStore() {
  // Auth dulu (dengan retry untuk koneksi awal yang kadang reset), baru pasang listener.
  let authed = false;
  for (let attempt = 1; attempt <= 5 && !authed; attempt++) {
    try {
      state.user = await connectAnonymously();
      authed = true;
    } catch (err) {
      console.warn(`Auth anonim gagal (percobaan ${attempt}):`, err?.code || err);
      if (attempt === 5) throw err;
      await sleep(attempt * 1500);
    }
  }
  subscribe(permCol, (rows) => (state.permohonan = rows));
  subscribe(kasCol, (rows) => (state.kas = rows));
  subscribe(gvCol, (rows) => {
    state.gvMeta = rows.find((r) => r.id === GV_META_ID) || null;
    state.gvAgenda = rows.filter((r) => r.id !== GV_META_ID);
  });
  subscribe(hargaCol, (rows) => (state.harga = rows));
  subscribe(hargaTdCol, (rows) => (state.hargaTd = rows));
}

export async function saveHargaRow(daya, data) {
  await setDoc(hargaDoc(daya), { ...data, daya: Number(daya), updatedAt: new Date().toISOString() }, { merge: true });
}

export async function seedHarga(defaults) {
  for (const row of defaults) {
    await setDoc(hargaDoc(row.daya), { ...row, updatedAt: new Date().toISOString() });
  }
}

const tdId = (sebelum, sesudah) => `${sebelum}-${sesudah}`;

export async function saveTambahDayaRow(sebelum, sesudah, data) {
  await setDoc(
    hargaTdDoc(tdId(sebelum, sesudah)),
    { ...data, sebelum: Number(sebelum), sesudah: Number(sesudah), updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function seedTambahDaya(defaults) {
  for (const row of defaults) {
    await setDoc(hargaTdDoc(tdId(row.sebelum, row.sesudah)), { ...row, updatedAt: new Date().toISOString() });
  }
}

/* ============ PERMOHONAN ============ */

export async function createPermohonan(data) {
  const id = generateId('REQ');
  await setDoc(permDoc(id), {
    ...data,
    id,
    status: 'Menunggu Pembayaran',
    step: 0,
    date: new Date().toISOString(),
  });
  return id;
}

export async function updatePermohonan(id, updates) {
  await setDoc(permDoc(id), updates, { merge: true });
}

// Update data + kemungkinan rollback progres (menghapus kas terkait)
export async function updatePermohonanWithProgress(id, fields, progVal) {
  const p = state.permohonan.find((x) => x.id === id);
  if (!p) return;
  const updates = { ...fields };
  const oldStep = p.status === 'Selesai' ? 6 : p.status === 'Lunas' ? p.step : -1;
  let newStep = oldStep;

  if (progVal === 'menunggu') { updates.status = 'Menunggu Pembayaran'; updates.step = 0; newStep = -1; }
  else if (progVal === 'selesai') { updates.status = 'Selesai'; updates.step = 6; newStep = 6; }
  else if (progVal.startsWith('step-')) {
    updates.status = 'Lunas';
    updates.step = parseInt(progVal.split('-')[1], 10);
    newStep = updates.step;
  }

  if (newStep < oldStep) {
    const related = state.kas.filter((k) => k.refId === id);
    let toDelete = [];
    if (newStep < 0) {
      toDelete = related.map((k) => k.id);
    } else {
      if (newStep <= 4) toDelete.push(...related.filter((k) => k.ket.includes('NIDI')).map((k) => k.id));
      if (newStep <= 1) toDelete.push(...related.filter((k) => k.ket.includes('Pemasangan')).map((k) => k.id));
      if (newStep <= 0) toDelete.push(...related.filter((k) => k.ket.includes('PPOB')).map((k) => k.id));
    }
    for (const kid of [...new Set(toDelete)]) await deleteDoc(kasDoc(kid));
  }

  await setDoc(permDoc(id), updates, { merge: true });
}

export async function deletePermohonan(id) {
  await deleteDoc(permDoc(id));
  const related = state.kas.filter((k) => k.refId === id);
  for (const k of related) await deleteDoc(kasDoc(k.id));
}

export async function prosesBayar(id, nominal, link) {
  const p = state.permohonan.find((x) => x.id === id);
  await setDoc(permDoc(id), { status: 'Lunas', step: 0 }, { merge: true });
  const kId = generateId('K');
  await setDoc(kasDoc(kId), {
    id: kId,
    date: new Date().toISOString(),
    ket: `Pembayaran ${p.jenis} - ID: ${p.id}`,
    tipe: 'Pemasukan',
    nominal,
    refId: p.id,
    link,
  });
}

// Menyelesaikan tahap yang butuh input biaya kas (step 0,1,4)
export async function completeStepWithCost(id, stepIndex, costName, { cost, link, buktiId, agenda, pemasang }) {
  const p = state.permohonan.find((x) => x.id === id);
  if (!p || p.step !== stepIndex) return;
  const kId = generateId('K');
  const kasData = {
    id: kId,
    date: new Date().toISOString(),
    ket: `${costName} (${p.id})${
      stepIndex === 0 ? ` - Agenda: ${agenda}` : stepIndex === 1 ? ` - Pemasang: ${pemasang}` : ''
    }`,
    tipe: 'Pengeluaran',
    nominal: cost,
    refId: p.id,
  };
  if (buktiId) kasData.buktiId = buktiId;
  if (link) kasData.link = link;
  await setDoc(kasDoc(kId), kasData);
  await advanceStep(id, stepIndex, { agenda, pemasang });
}

export async function completeStepBerkas(id, stepIndex, link) {
  await setDoc(permDoc(id), { linkNidiSlo: link, step: stepIndex + 1, status: 'Selesai' }, { merge: true });
}

export async function advanceStep(id, stepIndex, { agenda = '', pemasang = '' } = {}) {
  const p = state.permohonan.find((x) => x.id === id);
  if (!p || p.step !== stepIndex) return;
  const updates = { step: p.step + 1 };
  if (updates.step >= PROGRESS_STEPS.length) updates.status = 'Selesai';
  if (agenda) updates.noAgenda = agenda;
  if (pemasang) updates.namaPemasang = pemasang;
  await setDoc(permDoc(id), updates, { merge: true });
}

/* ============ KAS ============ */

export async function tambahKas(nominal, ket) {
  const kId = generateId('IN');
  await setDoc(kasDoc(kId), { id: kId, date: new Date().toISOString(), ket, tipe: 'Pemasukan', nominal });
}

export async function tarikKas(nominal, ket) {
  const kId = generateId('TRK');
  await setDoc(kasDoc(kId), { id: kId, date: new Date().toISOString(), ket, tipe: 'Penarikan', nominal });
}

export async function updateKas(id, ket, nominal) {
  await setDoc(kasDoc(id), { ket, nominal }, { merge: true });
}

export async function deleteKas(id) {
  await deleteDoc(kasDoc(id));
}
