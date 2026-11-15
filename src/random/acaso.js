// Aleatoriedade com semente: o mesmo ?seed= na URL gera o mesmo arranjo.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embaralhar(lista, rnd) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function lerSeed() {
  const p = new URLSearchParams(location.search).get('seed');
  return p && /^\d+$/.test(p) ? Number(p) : null;
}

export function novaSeed() {
  const s = Math.floor(Math.random() * 100000);
  const url = new URL(location.href);
  url.searchParams.set('seed', s);
  history.replaceState(null, '', url);
  return s;
}

// ---- histórico de leitura (por navegador) ----
const CHAVE = 'biblioteca-3d:historico';
function historico() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    return {};
  }
}
export function registrarAbertura(id) {
  try {
    const h = historico();
    const e = h[id] || { vezes: 0 };
    h[id] = { vezes: e.vezes + 1, ultima: Date.now() };
    localStorage.setItem(CHAVE, JSON.stringify(h));
  } catch {}
}

/** Sorteia um livro, favorecendo os nunca abertos e evitando os abertos recentemente. */
export function livroDoAcaso(livros) {
  const h = historico();
  const agora = Date.now();
  const pesos = livros.map((l) => {
    const e = h[l.id];
    if (!e) return 4;
    const dias = (agora - e.ultima) / 864e5;
    return Math.min(1, dias / 30) / (1 + e.vezes);
  });
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < livros.length; i++) {
    r -= pesos[i];
    if (r <= 0) return i;
  }
  return Math.floor(Math.random() * livros.length);
}
