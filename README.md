# Biblioteca 3D

Uma biblioteca navegável em 3D (Three.js) para a sua pasta de livros. Ande entre as estantes, deixe o acaso escolher, puxe um livro e leia.

**Seus livros nunca saem do seu computador.** O site só lê a pasta que você escolhe, localmente no navegador. Nada é enviado.

## Usar

- **Escolher pasta de livros:** cada subpasta vira uma estante. Formatos: pdf, epub, djvu, mobi, azw3, cbz, cbr.
- **Arrastar** livros ou pastas para a janela também funciona (e soma à biblioteca aberta).
- **🎲 Livro do acaso:** sorteia um livro, favorecendo os que você nunca abriu, e voa até ele.
- **🔀 Nova ordem:** embaralha estantes e livros. A ordem fica no `?seed=` da URL, dá pra compartilhar ou voltar.
- **Controles:** WASD/setas andam, Shift corre, arrastar olha, roda do mouse avança, clique abre o livro, Esc devolve.
- `?demo` carrega uma biblioteca de demonstração.

No Chrome/Edge o app lembra a última pasta. No Firefox, escolha a pasta a cada visita.

## Desenvolver

```bash
npm install
npm run dev
```

## Estrutura

```
src/
  library/   leitura da pasta, arrastar-e-soltar, demo
  scene/     estantes, livros (InstancedMesh), controles, animações
  random/    seed, embaralhamento, livro do acaso, histórico
  viewer/    visualizador (PDF nativo do navegador no MVP)
docs/IDEIA.md  visão e fases do projeto
```

Deploy automático no GitHub Pages a cada push na `main` (`.github/workflows/deploy.yml`).
