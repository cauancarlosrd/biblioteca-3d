// IndexedDB da biblioteca: 'kv' (pasta lembrada) e 'meta' (capas e dados dos livros).
const NOME = 'biblioteca-3d';
let promessa = null;

export function abrirDB() {
  promessa ??= new Promise((res, rej) => {
    const r = indexedDB.open(NOME, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return promessa;
}

const pedido = (r) => new Promise((res, rej) => {
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

export async function ler(store, chave) {
  const db = await abrirDB();
  return pedido(db.transaction(store).objectStore(store).get(chave));
}

export async function gravar(store, chave, valor) {
  const db = await abrirDB();
  return pedido(db.transaction(store, 'readwrite').objectStore(store).put(valor, chave));
}

/** Lê várias chaves numa transação só. Devolve Map chave → valor (só as que existem). */
export async function lerVarias(store, chaves) {
  const db = await abrirDB();
  const os = db.transaction(store).objectStore(store);
  const resultado = new Map();
  await Promise.all(chaves.map(async (k) => {
    const v = await pedido(os.get(k));
    if (v !== undefined) resultado.set(k, v);
  }));
  return resultado;
}
