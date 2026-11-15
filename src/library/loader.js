// Lê livros do disco do usuário. Nada é enviado pra lugar nenhum:
// os arquivos só são lidos pelo navegador, localmente.

export const EXTENSOES = ['pdf', 'epub', 'djvu', 'mobi', 'azw3', 'azw', 'cbz', 'cbr'];

const ext = (nome) => nome.split('.').pop().toLowerCase();
const ehLivro = (nome) => !nome.startsWith('.') && EXTENSOES.includes(ext(nome));

export function tituloDoArquivo(nome) {
  return nome
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+-\s+/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

function criarLivro(nome, pasta, tamanho, getFile) {
  return {
    id: `${pasta}/${nome}`,
    nome,
    titulo: tituloDoArquivo(nome),
    pasta, // caminho relativo, ex: "livros/Matemática/EDO"
    formato: ext(nome),
    tamanho,
    getFile,
  };
}

/** File System Access API (Chrome/Edge). Retorna o handle pra poder lembrar a pasta. */
export function suportaSeletorDePasta() {
  return 'showDirectoryPicker' in window;
}

export async function escolherPasta() {
  return window.showDirectoryPicker({ mode: 'read', id: 'biblioteca' });
}

export async function lerHandle(dir, aoProgredir) {
  const livros = [];
  async function andar(h, caminho) {
    for await (const [nome, filho] of h.entries()) {
      if (nome.startsWith('.') || nome.startsWith('$')) continue;
      if (filho.kind === 'directory') {
        await andar(filho, `${caminho}/${nome}`);
      } else if (ehLivro(nome)) {
        const f = await filho.getFile();
        livros.push(criarLivro(nome, caminho, f.size, () => filho.getFile()));
        aoProgredir?.(livros.length);
      }
    }
  }
  await andar(dir, dir.name);
  return livros;
}

/** Fallback: <input type="file" webkitdirectory> (Firefox, Safari). */
export function lerFileList(files) {
  const livros = [];
  for (const f of files) {
    if (!ehLivro(f.name)) continue;
    const rel = f.webkitRelativePath || f.name;
    const partes = rel.split('/');
    partes.pop();
    livros.push(criarLivro(f.name, partes.join('/') || 'Recebidos', f.size, async () => f));
  }
  return livros;
}

/** Arrastar-e-soltar arquivos ou pastas na janela ("receber livros"). */
export async function lerDrop(dataTransfer, aoProgredir) {
  const livros = [];
  const entradas = [...dataTransfer.items]
    .map((it) => it.webkitGetAsEntry?.())
    .filter(Boolean);

  const arquivoDe = (entry) => new Promise((res, rej) => entry.file(res, rej));
  const lerTodas = async (reader) => {
    const todas = [];
    for (;;) {
      const lote = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!lote.length) return todas;
      todas.push(...lote);
    }
  };

  async function andar(entry, caminho) {
    if (entry.isDirectory) {
      const filhos = await lerTodas(entry.createReader());
      for (const filho of filhos) await andar(filho, `${caminho}/${entry.name}`);
    } else if (ehLivro(entry.name)) {
      const f = await arquivoDe(entry);
      livros.push(criarLivro(f.name, caminho.replace(/^\//, '') || 'Recebidos', f.size, async () => f));
      aoProgredir?.(livros.length);
    }
  }
  for (const e of entradas) await andar(e, '');
  return livros;
}

// ---- lembrar a última pasta (só funciona com File System Access API) ----
const DB = 'biblioteca-3d';
function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function salvarHandle(handle) {
  try {
    const db = await abrirDB();
    db.transaction('kv', 'readwrite').objectStore('kv').put(handle, 'pasta');
  } catch {}
}
export async function carregarHandle() {
  try {
    const db = await abrirDB();
    return await new Promise((res) => {
      const r = db.transaction('kv').objectStore('kv').get('pasta');
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

// ---- demonstração (pra quem visita o site sem uma pasta de livros) ----
export function gerarDemo(n = 700) {
  const pastas = [
    'demo/Matemática/Cálculo', 'demo/Matemática/EDO', 'demo/Matemática/Álgebra Linear',
    'demo/Física/Mecânica', 'demo/Física/Eletromagnetismo', 'demo/Computação/Programação',
    'demo/Computação/Algoritmos', 'demo/Ficção/Ficção Científica', 'demo/Ficção/Clássicos',
    'demo/Divulgação Científica', 'demo/Filosofia', 'demo/Quadrinhos e Mangás',
  ];
  const a = ['Introdução à', 'Tratado de', 'Notas sobre', 'Uma breve história da', 'Fundamentos de', 'O livro da', 'Problemas de'];
  const b = ['Análise', 'Geometria', 'Teoria', 'Luz', 'Matéria', 'Lógica', 'Computação', 'Memória', 'Ordem', 'Incerteza'];
  const livros = [];
  for (let i = 0; i < n; i++) {
    const nome = `${a[i % a.length]} ${b[(i * 7) % b.length]} vol ${1 + (i % 13)}.pdf`;
    const pasta = pastas[(i * 31 + (i >> 3)) % pastas.length];
    const tamanho = 3e5 + ((i * 2654435761) % 4e7);
    livros.push({ ...criarLivro(nome, pasta, tamanho, null), demo: true });
  }
  return livros;
}
