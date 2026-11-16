import './style.css';
import {
  suportaSeletorDePasta, escolherPasta, lerHandle, lerFileList, lerDrop,
  salvarHandle, carregarHandle, gerarDemo, areaESub,
} from './library/loader.js';
import { mulberry32, embaralhar, lerSeed, novaSeed, livroDoAcaso, registrarAbertura } from './random/acaso.js';
import { criarBiblioteca } from './scene/biblioteca.js';
import { criarVisualizador } from './viewer/visualizador.js';

const $ = (s) => document.querySelector(s);
const inicio = $('#inicio');
const hud = $('#hud');
const info = $('#info');
const dica = $('#dica');
const status = $('#status');
const inputPasta = $('#input-pasta');

let todos = []; // livros carregados (ordem original)
let ordem = []; // livros na ordem da cena
let seed = lerSeed() ?? novaSeed();

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
    registrarAbertura(livro.id);
    await biblioteca.puxar(i);
    visualizador.abrir(livro);
  },
  aoPassar: (i, x, y) => {
    if (i < 0 || visualizador.aberto) return (dica.hidden = true);
    const l = ordem[i];
    dica.innerHTML = `<b>${escapar(l.titulo)}</b><span>${escapar(l.pasta)} · ${l.formato.toUpperCase()} · ${(l.tamanho / 1e6).toFixed(1)} MB</span>`;
    dica.style.transform = `translate(${Math.min(x + 16, innerWidth - 340)}px, ${y + 16}px)`;
    dica.hidden = false;
  },
  });
}

function escapar(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Agrupa por área → subpasta e embaralha tudo (áreas, subpastas, livros) com a semente. */
function arranjar() {
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
  const { estantes } = biblioteca.montar(ordem);
  info.textContent = `${ordem.length} livros · ${porArea.size} áreas · ${nPastas} pastas · ${estantes} estantes · seed ${seed}`;
}

function carregar(livros, { somar = false } = {}) {
  if (!livros.length) {
    status.textContent = 'Não achei nenhum livro (pdf, epub, djvu, mobi, cbz…) aí.';
    return;
  }
  const ids = new Set(somar ? todos.map((l) => l.id) : []);
  todos = somar ? todos.concat(livros.filter((l) => !ids.has(l.id))) : livros;
  inicio.hidden = true;
  hud.hidden = false;
  arranjar();
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

$('#btn-acaso').addEventListener('click', () => {
  if (!ordem.length || visualizador.aberto) return;
  biblioteca.voarAte(livroDoAcaso(ordem));
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
