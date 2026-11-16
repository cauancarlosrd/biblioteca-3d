// Indexador: abre cada livro em segundo plano e guarda no IndexedDB
// número de páginas, título, autor e uma miniatura da capa.
// Tudo local: os arquivos continuam só no seu computador.
import * as pdfjs from 'pdfjs-dist';
import urlWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ler, gravar, lerVarias } from './db.js';

pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;

const LARGURA_CAPA = 320;
const versao = 1; // mude pra reindexar tudo

// um worker do pdf.js pra todos os livros (criar um por livro custa caro)
let workerPdf = null;
const pegarWorker = () => (workerPdf ??= new pdfjs.PDFWorker());

// pede ao navegador pra não apagar o cache das capas quando faltar espaço
navigator.storage?.persist?.().catch(() => {});

export const chaveMeta = (livro) => `${versao}|${livro.id}|${livro.tamanho}|${livro.modificado || 0}`;

/** Lê do cache o que já foi indexado e pendura em livro.meta. */
export async function carregarMetas(livros) {
  try {
    const mapa = await lerVarias('meta', livros.map(chaveMeta));
    const semCor = [];
    for (const l of livros) {
      const m = mapa.get(chaveMeta(l));
      if (!m) continue;
      aplicarMeta(l, m);
      if (m.capa && !m.cor) semCor.push(l);
    }
    // capas indexadas antes de existir a cor da lombada: calcula agora (rápido, só miniaturas)
    await Promise.all(semCor.map(async (l) => {
      try {
        l.meta.cor = corDaCapa(await createImageBitmap(l.meta.capa));
        await gravar('meta', chaveMeta(l), l.meta);
      } catch {}
    }));
  } catch (e) {
    console.warn('cache indisponível', e);
  }
}

// ---------------------------------------------------------------------------
// cor da lombada: média da capa, puxando pros pixels com mais cor
// (a média simples vira um marrom-acinzentado em quase todo livro)

const amostra = document.createElement('canvas');
amostra.width = 24;
amostra.height = 36;
const ctxAmostra = amostra.getContext('2d', { willReadFrequently: true });

export function corDaCapa(imagem) {
  ctxAmostra.drawImage(imagem, 0, 0, amostra.width, amostra.height);
  const px = ctxAmostra.getImageData(0, 0, amostra.width, amostra.height).data;
  let r = 0, g = 0, b = 0, peso = 0;
  for (let i = 0; i < px.length; i += 4) {
    const R = px[i] / 255, G = px[i + 1] / 255, B = px[i + 2] / 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mn > 0.92) continue; // margem branca de página
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    const w = 0.12 + sat * sat * 3 * Math.min(1, mx * 2.5);
    r += R * w; g += G * w; b += B * w; peso += w;
  }
  if (!peso) return '#6b5a48';
  const hsl = {};
  const c = { r: r / peso, g: g / peso, b: b / peso };
  rgbParaHsl(c, hsl);
  // tom de encadernação: nem preto, nem pastel
  const l = Math.min(0.46, Math.max(0.17, hsl.l));
  const sa = Math.min(0.8, hsl.s * 1.25);
  return hslParaHex(hsl.h, sa, l);
}

function rgbParaHsl({ r, g, b }, out) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  out.l = (mx + mn) / 2;
  const d = mx - mn;
  if (!d) { out.h = 0; out.s = 0; return; }
  out.s = d / (1 - Math.abs(2 * out.l - 1));
  out.h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  out.h /= 6;
}

function hslParaHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const v = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// nome de arquivo que não parece título ("apostol-vol-I", "calc2_v3")
const nomeRuim = (t) => !/\s/.test(t) || t.length < 8;

function aplicarMeta(livro, meta) {
  livro.meta = meta;
  // o nome do arquivo costuma ser melhor que o metadado; só troca se o nome for ruim
  if (meta.titulo && nomeRuim(livro.titulo)) livro.titulo = meta.titulo;
  if (meta.autor) livro.autor = meta.autor;
  if (meta.paginas) livro.paginas = meta.paginas;
}

export async function capaDe(livro) {
  if (livro.demo) return null;
  const m = livro.meta ?? (await ler('meta', chaveMeta(livro)).catch(() => null));
  return m?.capa ?? null; // Blob jpeg
}

// títulos de metadado que não servem
const tituloRuim = (t) =>
  !t || t.length < 3 || /^(untitled|sem t[ií]tulo|document|\d+)$/i.test(t.trim()) || /^microsoft (word|powerpoint)/i.test(t.trim()) || /\.(pdf|docx?|tex|dvi)$/i.test(t) || /^[\w-]+$/.test(t.trim()) && t.length < 12;

// ---------------------------------------------------------------------------
// PDF: lê só os pedaços necessários do arquivo (sem carregar 100 MB na memória)

class TransporteArquivo extends pdfjs.PDFDataRangeTransport {
  constructor(arquivo, inicial) {
    super(arquivo.size, inicial);
    this.arquivo = arquivo;
  }
  requestDataRange(ini, fim) {
    this.arquivo.slice(ini, fim).arrayBuffer().then((b) => this.onDataRange(ini, new Uint8Array(b)));
  }
}

async function canvasParaBlob(canvas) {
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
}

async function indexarPdf(arquivo) {
  const inicial = new Uint8Array(await arquivo.slice(0, 128 * 1024).arrayBuffer());
  const tarefa = pdfjs.getDocument({
    range: new TransporteArquivo(arquivo, inicial),
    length: arquivo.size,
    rangeChunkSize: 128 * 1024,
    disableAutoFetch: true,
    disableStream: true,
    isEvalSupported: false,
    worker: pegarWorker(),
  });
  const doc = await tarefa.promise;
  try {
    const meta = { paginas: doc.numPages };
    const { info } = await doc.getMetadata().catch(() => ({ info: {} }));
    if (!tituloRuim(info?.Title)) meta.titulo = info.Title.trim();
    if (info?.Author && info.Author.trim().length > 2) meta.autor = info.Author.trim();

    const pagina = await doc.getPage(1);
    const vp0 = pagina.getViewport({ scale: 1 });
    const vp = pagina.getViewport({ scale: LARGURA_CAPA / vp0.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
    meta.capa = await canvasParaBlob(canvas);
    meta.proporcao = canvas.width / canvas.height;
    meta.cor = corDaCapa(canvas);
    return meta;
  } finally {
    doc.destroy();
  }
}

// ---------------------------------------------------------------------------
// EPUB: metadados e capa via epub.js (carregado só quando precisa)

async function indexarEpub(arquivo) {
  const { default: ePub } = await import('epubjs');
  const livro = ePub(await arquivo.arrayBuffer());
  try {
    const md = await livro.loaded.metadata;
    const meta = {};
    if (!tituloRuim(md.title)) meta.titulo = md.title.trim();
    if (md.creator) meta.autor = md.creator.trim();
    // páginas estimadas pelo tamanho do texto (aprox. 2 kB de texto por página)
    meta.paginas = Math.max(40, Math.min(1500, Math.round(arquivo.size / 9000)));
    meta.estimado = true;
    const url = await livro.coverUrl().catch(() => null);
    if (url) {
      const img = await createImageBitmap(await (await fetch(url)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = LARGURA_CAPA;
      canvas.height = Math.round((LARGURA_CAPA * img.height) / img.width);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      meta.capa = await canvasParaBlob(canvas);
      meta.proporcao = canvas.width / canvas.height;
      meta.cor = corDaCapa(canvas);
    }
    return meta;
  } finally {
    livro.destroy();
  }
}

// ---------------------------------------------------------------------------

let rodada = 0;

/**
 * Indexa (em segundo plano, um por vez) os livros que ainda não têm meta.
 * aoProgredir(feitos, total) é chamado a cada livro; devolve quantos foram indexados.
 */
export async function indexar(livros, { aoProgredir, aoLivro } = {}) {
  const minha = ++rodada; // uma nova pasta cancela a rodada anterior
  const pendentes = livros.filter((l) => !l.meta && !l.demo && ['pdf', 'epub'].includes(l.formato));
  let feitos = 0;
  let proximo = 0;
  // duas filas em paralelo: enquanto uma espera o disco, a outra desenha
  async function fila() {
    while (proximo < pendentes.length) {
      if (minha !== rodada) return;
      const livro = pendentes[proximo++];
      try {
        const arquivo = await livro.getFile();
        const meta = livro.formato === 'pdf' ? await indexarPdf(arquivo) : await indexarEpub(arquivo);
        await gravar('meta', chaveMeta(livro), meta);
        aplicarMeta(livro, meta);
        aoLivro?.(livro);
      } catch (e) {
        // arquivo protegido/corrompido: marca pra não tentar de novo toda vez
        const meta = { falhou: String(e?.message || e).slice(0, 120) };
        await gravar('meta', chaveMeta(livro), meta).catch(() => {});
        livro.meta = meta;
      }
      feitos++;
      aoProgredir?.(feitos, pendentes.length);
      await new Promise((r) => setTimeout(r, 8)); // deixa a cena respirar
    }
  }
  await Promise.all([fila(), fila()]);
  return feitos;
}
