# Biblioteca 3D

Vite + Three.js puro (sem framework). Código e UI em português. Visão e roadmap em `docs/IDEIA.md`.

- `npm run dev` → http://localhost:5173. Use `?demo` pra testar sem pasta real, e `?seed=N` pra um arranjo fixo.
- O navegador embutido do app de desktop não tem WebGL. Pra testar a cena, use Chromium headless (Playwright) com `--use-angle=swiftshader`.
- Os livros do usuário nunca entram no repositório. `organizacao/` está no .gitignore porque lista arquivos pessoais.
- Coleção real: `/mnt/shared/Documentos/livros`. Nunca mover nada de `/mnt/shared/Documentos/ufv/bibliografia` (só copiar), nem da biblioteca do Calibre.
