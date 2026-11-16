// Visualizador em sobreposição.
// PDF: leitor nativo do navegador (o do Firefox já é o pdf.js).
// EPUB: epub.js, paginado, lembrando onde você parou.

const chavePosicao = (livro) => `biblioteca-3d:epub:${livro.id}`;

export function criarVisualizador({ aoFechar }) {
  const el = document.getElementById('visualizador');
  const titulo = el.querySelector('.vis-titulo');
  const pasta = el.querySelector('.vis-pasta');
  const corpo = el.querySelector('.vis-corpo');
  const novaAba = el.querySelector('.vis-nova-aba');
  let url = null;
  let epub = null; // { livro, rendicao }

  function fechar() {
    if (el.hidden) return;
    el.hidden = true;
    if (epub) {
      epub.rendicao.destroy();
      epub.livro.destroy();
      epub = null;
    }
    corpo.innerHTML = '';
    if (url) URL.revokeObjectURL(url);
    url = null;
    aoFechar?.();
  }

  el.querySelector('.vis-fechar').addEventListener('click', fechar);
  addEventListener('keydown', (e) => {
    if (el.hidden) return;
    if (e.key === 'Escape') fechar();
    if (epub && (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ')) {
      e.preventDefault();
      epub.rendicao.next();
    }
    if (epub && (e.key === 'ArrowLeft' || e.key === 'PageUp')) {
      e.preventDefault();
      epub.rendicao.prev();
    }
  });

  async function abrirEpub(livro, arquivo) {
    corpo.innerHTML = `
      <div class="epub">
        <button class="epub-nav epub-ant" title="Página anterior (←)">‹</button>
        <div class="epub-area"></div>
        <button class="epub-nav epub-prox" title="Próxima página (→)">›</button>
        <div class="epub-progresso"></div>
      </div>`;
    const area = corpo.querySelector('.epub-area');
    const progresso = corpo.querySelector('.epub-progresso');
    const { default: ePub } = await import('epubjs');
    const l = ePub(await arquivo.arrayBuffer());
    const rendicao = l.renderTo(area, { width: '100%', height: '100%', flow: 'paginated', spread: 'auto', allowScriptedContent: false });
    rendicao.themes.default({
      body: { background: '#f1e4cc !important', color: '#2a1c12 !important', 'font-family': 'Georgia, serif !important', 'line-height': '1.55 !important' },
      a: { color: '#7a3a1a !important' },
    });
    epub = { livro: l, rendicao };
    corpo.querySelector('.epub-ant').addEventListener('click', () => rendicao.prev());
    corpo.querySelector('.epub-prox').addEventListener('click', () => rendicao.next());

    let salvo = null;
    try {
      salvo = localStorage.getItem(chavePosicao(livro));
    } catch {}
    await rendicao.display(salvo || undefined);

    // porcentagem lida (gera as localizações em segundo plano)
    l.ready.then(() => l.locations.generate(1600)).then(() => {
      if (epub?.livro !== l) return;
      const loc = rendicao.currentLocation();
      if (loc?.start) progresso.textContent = `${Math.round(l.locations.percentageFromCfi(loc.start.cfi) * 100)}%`;
    }).catch(() => {});
    rendicao.on('relocated', (loc) => {
      try {
        localStorage.setItem(chavePosicao(livro), loc.start.cfi);
      } catch {}
      if (l.locations.length()) progresso.textContent = `${Math.round(l.locations.percentageFromCfi(loc.start.cfi) * 100)}%`;
    });
    // setas também funcionam com o foco dentro do iframe do livro
    rendicao.on('keyup', (e) => {
      if (e.key === 'ArrowRight') rendicao.next();
      if (e.key === 'ArrowLeft') rendicao.prev();
      if (e.key === 'Escape') fechar();
    });
  }

  async function abrir(livro) {
    titulo.textContent = livro.titulo;
    pasta.textContent = [livro.autor, livro.pasta].filter(Boolean).join(' · ');
    corpo.innerHTML = '<p class="vis-msg">Abrindo…</p>';
    el.hidden = false;

    if (livro.demo) {
      novaAba.hidden = true;
      corpo.innerHTML = '<p class="vis-msg">Este é um livro de demonstração.<br>Escolha sua própria pasta pra ler de verdade.</p>';
      return;
    }
    novaAba.hidden = false;
    const file = await livro.getFile();
    url = URL.createObjectURL(livro.formato === 'pdf' ? new Blob([file], { type: 'application/pdf' }) : file);
    novaAba.href = url;
    novaAba.download = livro.formato === 'pdf' ? '' : livro.nome;

    if (livro.formato === 'pdf') {
      corpo.innerHTML = '';
      const frame = document.createElement('iframe');
      frame.src = url;
      frame.title = livro.titulo;
      corpo.appendChild(frame);
    } else if (livro.formato === 'epub') {
      try {
        await abrirEpub(livro, file);
      } catch (e) {
        corpo.innerHTML = `<p class="vis-msg">Não consegui abrir este EPUB (${e.message}).<br>Use “Abrir fora”.</p>`;
      }
    } else {
      corpo.innerHTML = `<p class="vis-msg">O leitor de <b>.${livro.formato}</b> ainda não existe aqui.<br>
        Use “Abrir fora” pra ler no seu leitor de sempre.</p>`;
    }
  }

  return { abrir, fechar, get aberto() { return !el.hidden; } };
}
