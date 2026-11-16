import { ler, gravar } from './db.js';

// Lê livros do disco do usuário. Nada é enviado pra lugar nenhum:
// os arquivos só são lidos pelo navegador, localmente.

export const EXTENSOES = ['pdf', 'epub', 'djvu', 'mobi', 'azw3', 'azw', 'cbz', 'cbr'];

const ext = (nome) => nome.split('.').pop().toLowerCase();
const ehLivro = (nome) => !nome.startsWith('.') && EXTENSOES.includes(ext(nome));

export function tituloDoArquivo(nome) {
  return nome
    .replace(/\.[^.]+$/, '')
    .replace(/\s*[-–]\s*libgen\.(li|is|rs)\b/gi, '')
    .replace(/\s*\((z-?lib(rary)?(\.(org|io))?)\)/gi, '')
    .replace(/\s*\(\d{4}[^)]*\)/g, '') // (2016, Editora)
    .replace(/_\s/g, ': ') // "Título_ subtítulo" (dois-pontos que viraram _)
    .replace(/[_]+/g, ' ')
    .replace(/\s+-\s+/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

function criarLivro(nome, pasta, tamanho, getFile, modificado = 0) {
  return {
    modificado,
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
        livros.push(criarLivro(nome, caminho, f.size, () => filho.getFile(), f.lastModified));
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
    livros.push(criarLivro(f.name, partes.join('/') || 'Recebidos', f.size, async () => f, f.lastModified));
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
      livros.push(criarLivro(f.name, caminho.replace(/^\//, '') || 'Recebidos', f.size, async () => f, f.lastModified));
      aoProgredir?.(livros.length);
    }
  }
  for (const e of entradas) await andar(e, '');
  return livros;
}

// ---- lembrar a última pasta (só funciona com File System Access API) ----
export async function salvarHandle(handle) {
  try {
    await gravar('kv', 'pasta', handle);
  } catch {}
}
export async function carregarHandle() {
  try {
    return (await ler('kv', 'pasta')) || null;
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

/** "livros/Matemática/Cálculo" → { area: "Matemática", sub: "Cálculo" }. */
export function areaESub(pasta) {
  const partes = pasta.split('/');
  return { area: partes[1] ?? 'Avulsos', sub: partes.slice(2).join(' › ') };
}
