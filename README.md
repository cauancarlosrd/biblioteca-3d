# Biblioteca 3D

Uma biblioteca navegável em 3D feita a partir da sua pasta de livros. Você anda entre as estantes, puxa um livro e lê ali mesmo. Também pode deixar o acaso escolher o próximo.

**Os livros nunca saem do seu computador.** O site só tem o código. Quando você escolhe uma pasta, o navegador lê os arquivos localmente, e nada é enviado pra lugar nenhum.

## Como usar

1. Abra o site e clique em **Escolher pasta de livros**, ou arraste livros e pastas pra janela.
2. Cada pasta na raiz vira uma estante (ou mais, se encher). As subpastas viram etiquetas na borda das prateleiras, com um divisor entre os livros.
3. Pra se mover:
   - **W A S D** ou as setas andam (Shift corre);
   - **arrastar** com o mouse olha em volta;
   - a **roda do mouse** avança.
4. **Clique num livro** pra puxá-lo da estante e abrir. Esc ou "Devolver" põe o livro de volta.
5. **🎲 Livro do acaso** sorteia um livro e voa até ele. O sorteio favorece os que você nunca abriu.
6. **🔀 Nova ordem** embaralha a biblioteca. A ordem vem da `?seed=` na URL, então dá pra guardar ou compartilhar um arranjo.

Navegadores:

- No **Chrome e no Edge**, o site lembra a pasta. Na próxima visita aparece o botão "Reabrir".
- No **Firefox**, você escolhe a pasta de novo a cada visita.
- PDFs abrem no leitor do próprio navegador. EPUB, DJVU, MOBI e CBZ aparecem nas estantes e abrem fora, por enquanto.

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:5173  (use ?demo pra carregar livros falsos)
npm run build    # gera dist/
```

A cada push na `main`, o GitHub Actions publica o site no GitHub Pages (`.github/workflows/deploy.yml`).

## Estrutura

```
src/
  library/   leitura da pasta, arrastar-e-soltar, lembrar a pasta (IndexedDB)
  scene/     estantes, livros (InstancedMesh), controles, animação de puxar
  random/    seed, embaralhamento, sorteio com peso, histórico de leitura
  viewer/    sobreposição com o leitor
```

## Roteiro

Veja [docs/IDEIA.md](docs/IDEIA.md).

- [x] **Fase 1 — MVP:** pasta → estantes → clicar → ler, mais o livro do acaso e a seed
- [ ] **Fase 2 — Biblioteca:** salas por área, capas reais (pdf.js), cache de metadados
- [ ] **Fase 3 — Acaso:** mesa de leitura, rastro de luz, histórico mais rico
- [ ] **Fase 4 — Acabamento:** leitor de EPUB, texto nas lombadas, busca, planta baixa, celular

## Créditos das imagens

- Galáxia NGC 1827 (`public/texturas/galaxia-ngc1827.jpg`): NASA/ESA Hubble Space Telescope, via nasa.gov.
- As outras texturas em `public/texturas/` foram geradas com o Google Gemini.
