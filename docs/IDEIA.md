# Biblioteca 3D: ideia e roteiro

## Por quê
Uma coleção grande e bagunçada de livros que raramente é lida. Andar por uma biblioteca e deixar o acaso sugerir algo ajuda a criar o hábito de ler.

## Princípios
- O repositório publica só o app. Os livros ficam no computador do usuário (direitos autorais e tamanho).
- O site lê a pasta localmente (File System Access API no Chrome/Edge, `webkitdirectory` e arrastar-e-soltar nos demais).
- Aleatoriedade com semente: surpresa, mas reproduzível (`?seed=`).

## Arquitetura
pasta → indexador (nome, pasta, tamanho; depois metadados e capas via pdf.js/epub.js) → cache (IndexedDB) → cena 3D → animação de puxar o livro → visualizador.

## Cena
- Subpasta = estante; estantes ao longo de um corredor, com placa do nome da pasta.
- Lombada: cor por hash do título, espessura pelo tamanho (depois, pelo nº de páginas).
- `InstancedMesh` para milhares de livros.
- Primeira pessoa (WASD + arrastar).

## Acaso
1. Ordem embaralhada por seed na URL.
2. Livro do acaso com peso (nunca abertos pesam mais, abertos recentemente menos) e destaque luminoso.
3. Ideias futuras: rastro de luz até o livro, mesa de leitura com livros sorteados abertos, salas hexagonais estilo Borges.

## Fases
1. **MVP** (feito): escolher pasta, estantes por subpasta, clicar e abrir PDF, livro do acaso, nova ordem, demo, arrastar-e-soltar.
2. **Biblioteca:** salas por pasta de nível superior, cache no IndexedDB, nº de páginas e capas via pdf.js.
3. **Acaso:** rastro de luz, mesa de leitura, histórico de leitura visível.
4. **Acabamento:** iluminação, texto nas lombadas, leitor EPUB (epub.js), busca, planta baixa.

## Organização da coleção
Pasta-alvo: `/mnt/shared/Documentos/livros`, taxonomia Área/Subárea em português. O plano local fica em `organizacao/` (fora do git). `ufv/bibliografia` e a biblioteca do Calibre são só copiadas, nunca movidas.
