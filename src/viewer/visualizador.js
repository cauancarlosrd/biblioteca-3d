// Visualizador em sobreposição. No MVP, PDFs abrem no leitor nativo do navegador.

export function criarVisualizador({ aoFechar }) {
  const el = document.getElementById('visualizador');
  const titulo = el.querySelector('.vis-titulo');
  const pasta = el.querySelector('.vis-pasta');
  const corpo = el.querySelector('.vis-corpo');
  const novaAba = el.querySelector('.vis-nova-aba');
  let url = null;

  function fechar() {
    if (el.hidden) return;
    el.hidden = true;
    corpo.innerHTML = '';
    if (url) URL.revokeObjectURL(url);
    url = null;
    aoFechar?.();
  }

  el.querySelector('.vis-fechar').addEventListener('click', fechar);
  addEventListener('keydown', (e) => e.key === 'Escape' && fechar());

  async function abrir(livro) {
    titulo.textContent = livro.titulo;
    pasta.textContent = livro.pasta;
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
    } else {
      corpo.innerHTML = `<p class="vis-msg">O leitor de <b>.${livro.formato}</b> ainda não existe aqui (vem na fase 4).<br>
        Use “Abrir fora” pra ler no seu leitor de sempre.</p>`;
    }
  }

  return { abrir, fechar, get aberto() { return !el.hidden; } };
}
