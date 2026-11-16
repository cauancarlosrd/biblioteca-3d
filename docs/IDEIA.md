# A ideia

Uma biblioteca 3D pra navegar na minha coleção de livros. O ponto principal é a **aleatoriedade**: descobrir o que ler por acaso, como quando a gente passeia numa biblioteca de verdade. Eu coleciono muito e leio pouco, e o projeto é um empurrão pro hábito de leitura.

## Princípios

- **Os livros ficam comigo.** O repositório é público e só tem o código. Os livros são lidos localmente pelo navegador (File System Access API, com `<input webkitdirectory>` e arrastar-e-soltar como alternativa). Isso evita problemas de direitos autorais e o limite de tamanho do GitHub.
- **A pasta vira o espaço.** Cada pasta da raiz é uma estante (ou mais, só se encher), seguindo rigorosamente as pastas. Subpastas viram etiquetas e divisores nas prateleiras. Organizar a biblioteca = organizar as pastas.
- **Os livros vêm dos dados.** A espessura sai do tamanho do arquivo (depois, do número de páginas). A cor sai de um hash do título, então é estável mas variada.

## Arquitetura

```
pasta escolhida → indexador (nome, pasta, tamanho; depois pdf.js/epub.js pra metadados e capa)
               → cache IndexedDB (fase 2)
               → cena Three.js (InstancedMesh: milhares de livros em uma chamada de desenho)
               → clique: animação de puxar o livro → visualizador (PDF nativo; pdf.js/epub.js depois)
```

## Aleatoriedade

1. As estantes são embaralhadas a cada visita com uma seed na URL (`?seed=4821`), que dá pra compartilhar.
2. **Livro do acaso:** o sorteio dá mais peso aos nunca abertos e menos aos abertos recentemente. ✅
3. **Mesa de leitura:** alguns livros sorteados já abertos numa mesa quando você entra.
4. Um rastro de luz até o livro sorteado.
5. Uma opção mais conceitual: salas hexagonais infinitas, à la Borges.

## Fases

1. **MVP:** escolher a pasta, estantes por subpasta, clicar e abrir o PDF, livro do acaso e seed. ✅
2. **Biblioteca:** salas por área, navegação melhor, capas e páginas com pdf.js, cache.
3. **Acaso:** mesa de leitura, rastro de luz, estatísticas de leitura.
4. **Acabamento:** iluminação, texto nas lombadas, EPUB, busca, planta baixa, celular, deploy.

## Organização da coleção

A pasta real é `/mnt/shared/Documentos/livros`, organizada em `Área/Subárea`. O plano de reorganização (`organizacao/`, fora do git) foi gerado sem mexer em nada e é aplicado por `organizacao/scripts/aplicar.py`. Ele simula por padrão e grava `desfazer.sh` quando executa.

- `Documentos/ufv/bibliografia` é **copiada**, não movida: os originais continuam lá.
- A biblioteca do Calibre também é copiada, pra não quebrar o banco dele.
