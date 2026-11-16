import './style.css';
import {
  suportaSeletorDePasta, escolherPasta, lerHandle, lerFileList, lerDrop,
  salvarHandle, carregarHandle, gerarDemo, areaESub,
} from './library/loader.js';
import { mulberry32, embaralhar, lerSeed, novaSeed, livroDoAcaso, registrarAbertura } from './random/acaso.js';
import { criarBiblioteca } from './scene/biblioteca.js';
import { criarVisualizador } from './viewer/visualizador.js';
import { carregarMetas, indexar, capaDe } from './library/indice.js';

const $ = (s) => document.querySelector(s);
const inicio = $('#inicio');
const hud = $('#hud');
const info = $('#info');
const dica = $('#dica');
const status = $('#status');
const inputPasta = $('#input-pasta');
const cartao = $('#cartao-livro');
const indiceEl = $('#indice');
const busca = $('#busca');
const resultados = $('#resultados');

let todos = []; // livros carregados (ordem original)
let ordem = []; // livros na ordem da cena
let seed = lerSeed() ?? novaSeed();
let sugestao = -1; // índice (em ordem) do livro aberto no atril

const visualizador = criarVisualizador({ aoFechar: () => biblioteca.devolver() });

let biblioteca;
try {
  biblioteca = criarBibliotecaNaTela();
} catch (e) {
  $('.cartao').innerHTML = `<h1>Biblioteca</h1><p class="lema">Seu navegador não conseguiu iniciar o WebGL, que a biblioteca 3D precisa.</p>
    <p class="nota">Ative a aceleração por hardware nas configurações do navegador e recarregue a página.</p>`;
  throw e;
}

function criarBibliotecaNaTela() {
  return criarBiblioteca($('#cena'), {
  aoEscolher: async (i) => {
    const livro = ordem[i];
    dica.hidden = true;
    const capa = await capaBitmap(livro);
    await biblioteca.puxar(i, capa);
    mostrarCartao(livro);
  },
  aoAtril: () => {
    if (sugestao < 0 || visualizador.aberto) return;
    const livro = ordem[sugestao];
    registrarAbertura(livro.id);
    biblioteca.pausar();
    visualizador.abrir(livro);
  },
  aoPassar: (i, x, y) => {
    if (i < 0 || visualizador.aberto) return (dica.hidden = true);
    const l = ordem[i];
    const pags = l.paginas ? `${l.meta?.estimado ? '~' : ''}${l.paginas} págs · ` : '';
    dica.innerHTML = `<b>${escapar(l.titulo)}</b>${l.autor ? `<i>${escapar(l.autor)}</i>` : ''}<span>${escapar(l.pasta)} · ${pags}${l.formato.toUpperCase()}</span>`;
    dica.style.transform = `translate(${Math.min(x + 16, innerWidth - 340)}px, ${y + 16}px)`;
    dica.hidden = false;
  },
  });
}

async function capaBitmap(livro) {
  try {
    const blob = await capaDe(livro);
    return blob ? await createImageBitmap(blob) : null;
  } catch {
    return null;
  }
}

// ---- cartão do livro puxado: capa na mão, dados ao lado, Ler / Devolver ----
let livroNaMao = null;
function mostrarCartao(livro) {
  livroNaMao = livro;
  const pags = livro.paginas ? `${livro.meta?.estimado ? 'cerca de ' : ''}${livro.paginas} páginas` : null;
  cartao.querySelector('.c-titulo').textContent = livro.titulo;
  cartao.querySelector('.c-autor').textContent = livro.autor || '';
  cartao.querySelector('.c-detalhes').textContent = [pags, livro.formato.toUpperCase(), `${(livro.tamanho / 1e6).toFixed(1)} MB`].filter(Boolean).join(' · ');
  cartao.querySelector('.c-pasta').textContent = livro.pasta.split('/').slice(1).join(' › ') || livro.pasta;
  cartao.hidden = false;
  cartao.querySelector('.c-ler').focus();
}
function esconderCartao() {
  cartao.hidden = true;
  livroNaMao = null;
}
cartao.querySelector('.c-ler').addEventListener('click', () => {
  const livro = livroNaMao;
  esconderCartao();
  registrarAbertura(livro.id);
  visualizador.abrir(livro); // ao fechar o leitor, o livro volta pra estante
});
cartao.querySelector('.c-devolver').addEventListener('click', () => {
  esconderCartao();
  biblioteca.devolver();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !cartao.hidden) {
    esconderCartao();
    biblioteca.devolver();
  }
});

function escapar(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Agrupa por área → subpasta e embaralha tudo (áreas, subpastas, livros) com a semente. */
function arranjar({ manterCamera = false } = {}) {
  const rnd = mulberry32(seed);
  const porArea = new Map(); // área → (pasta → livros)
  for (const l of todos) {
    const { area } = areaESub(l.pasta);
    if (!porArea.has(area)) porArea.set(area, new Map());
    const pastas = porArea.get(area);
    if (!pastas.has(l.pasta)) pastas.set(l.pasta, []);
    pastas.get(l.pasta).push(l);
  }
  let nPastas = 0;
  ordem = embaralhar([...porArea.keys()].sort(), rnd).flatMap((area) => {
    const pastas = porArea.get(area);
    nPastas += pastas.size;
    return embaralhar([...pastas.keys()].sort(), rnd).flatMap((p) => embaralhar(pastas.get(p), rnd));
  });
  const sugerido = manterCamera && sugestao >= 0 ? ordem[sugestao] : null;
  const { estantes } = biblioteca.montar(ordem, { manterCamera });
  if (sugerido) {
    sugestao = ordem.indexOf(sugerido);
    mostrarNoAtril();
  } else sortearSugestao();
  info.textContent = `${ordem.length} livros · ${porArea.size} áreas · ${nPastas} pastas · ${estantes} estantes · seed ${seed}`;
}

async function carregar(livros, { somar = false } = {}) {
  if (!livros.length) {
    status.textContent = 'Não achei nenhum livro (pdf, epub, djvu, mobi, cbz…) aí.';
    return;
  }
  const ids = new Set(somar ? todos.map((l) => l.id) : []);
  todos = somar ? todos.concat(livros.filter((l) => !ids.has(l.id))) : livros;
  inicio.hidden = true;
  hud.hidden = false;
  await carregarMetas(todos); // capas/páginas já lidas em visitas anteriores
  arranjar();
  lerCapas();
}

// lê capas e páginas dos livros novos em segundo plano; no fim, reacomoda as estantes
async function lerCapas() {
  const novos = await indexar(todos, {
    aoProgredir: (n, total) => {
      indiceEl.hidden = n >= total;
      indiceEl.textContent = `📖 lendo capas ${n}/${total}`;
    },
    aoLivro: (livro) => {
      if (sugestao >= 0 && ordem[sugestao] === livro) mostrarNoAtril();
    },
  });
  indiceEl.hidden = true;
  if (novos > 0 && !livroNaMao && !visualizador.aberto) arranjar({ manterCamera: true });
}

const progresso = (n) => (status.textContent = `Lendo… ${n} livros encontrados`);

async function abrirHandle(handle) {
  status.textContent = 'Lendo…';
  carregar(await lerHandle(handle, progresso));
}

async function escolher() {
  if (suportaSeletorDePasta()) {
    try {
      const handle = await escolherPasta();
      salvarHandle(handle);
      await abrirHandle(handle);
    } catch (e) {
      if (e.name !== 'AbortError') status.textContent = `Erro: ${e.message}`;
    }
  } else {
    inputPasta.click();
  }
}

$('#btn-pasta').addEventListener('click', escolher);
$('#btn-demo').addEventListener('click', () => carregar(gerarDemo()));
if (new URLSearchParams(location.search).has('demo')) carregar(gerarDemo());
$('#btn-trocar').addEventListener('click', () => {
  hud.hidden = true;
  inicio.hidden = false;
  status.textContent = '';
});
inputPasta.addEventListener('change', () => carregar(lerFileList(inputPasta.files)));

function sortearSugestao() {
  if (!ordem.length) return;
  sugestao = livroDoAcaso(ordem);
  mostrarNoAtril();
}
async function mostrarNoAtril() {
  const livro = ordem[sugestao];
  biblioteca.definirAtril(livro, null);
  biblioteca.destacar(sugestao); // o livro também brilha na estante
  const capa = await capaBitmap(livro);
  if (capa && ordem[sugestao] === livro) biblioteca.definirAtril(livro, capa);
}

// ---- busca: digite, escolha, e a câmera voa até o livro ----
const normalizar = (t) => (t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
let achados = [];
function buscar() {
  const termos = normalizar(busca.value).split(/\s+/).filter(Boolean);
  if (!termos.length) {
    resultados.hidden = true;
    return;
  }
  achados = [];
  for (let i = 0; i < ordem.length && achados.length < 8; i++) {
    const l = ordem[i];
    const alvo = normalizar(`${l.titulo} ${l.autor || ''} ${l.pasta}`);
    if (termos.every((t) => alvo.includes(t))) achados.push(i);
  }
  resultados.innerHTML = achados.length
    ? achados.map((i, k) => `<li data-k="${k}"><b>${escapar(ordem[i].titulo)}</b><span>${escapar(ordem[i].pasta.split('/').slice(1).join(' › '))}</span></li>`).join('')
    : '<li class="vazio">Nenhum livro com esse nome</li>';
  resultados.hidden = false;
}
function irPara(k) {
  const i = achados[k];
  if (i === undefined) return;
  busca.value = '';
  resultados.hidden = true;
  busca.blur();
  biblioteca.voarAte(i);
}
busca.addEventListener('input', buscar);
busca.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') irPara(0);
  if (e.key === 'Escape') {
    busca.value = '';
    resultados.hidden = true;
    busca.blur();
  }
  e.stopPropagation();
});
resultados.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-k]');
  if (li) irPara(Number(li.dataset.k));
});
busca.addEventListener('blur', () => setTimeout(() => (resultados.hidden = true), 150));
addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== busca && !visualizador.aberto && !hud.hidden) {
    e.preventDefault();
    busca.focus();
  }
});

// 🎲: sorteia outro livro, abre no atril do fundo da nave e leva você até lá
$('#btn-acaso').addEventListener('click', () => {
  if (!ordem.length || visualizador.aberto) return;
  sortearSugestao();
  biblioteca.voarAteAtril();
});
$('#btn-ordem').addEventListener('click', () => {
  if (visualizador.aberto) return;
  seed = novaSeed();
  arranjar();
});

// reabrir a última pasta (Chrome/Edge)
carregarHandle().then((handle) => {
  if (!handle) return;
  const b = $('#btn-reabrir');
  b.textContent = `Reabrir “${handle.name}”`;
  b.hidden = false;
  b.addEventListener('click', async () => {
    try {
      if ((await handle.requestPermission({ mode: 'read' })) === 'granted') await abrirHandle(handle);
    } catch (e) {
      status.textContent = `Não consegui reabrir: ${e.message}`;
    }
  });
});

// receber livros arrastando arquivos/pastas pra janela
addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('soltando');
});
addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('soltando');
});
addEventListener('drop', async (e) => {
  e.preventDefault();
  document.body.classList.remove('soltando');
  const livros = await lerDrop(e.dataTransfer, progresso);
  carregar(livros, { somar: todos.length > 0 });
});
