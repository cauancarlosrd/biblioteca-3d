import * as THREE from 'three';
import { hash, mulberry32 } from '../random/acaso.js';
import { areaESub } from '../library/loader.js';
import { criarCeu } from './ceu.js';
import { criarChao } from './chao.js';
import { criarMagia } from './magia.js';
import { materiais, MATERIAIS_FIXOS, materialLavagem, geoPlano, comporVao, tremularLuzes, geoCoroamento } from './cenario.js';
import { criarNave, MATERIAIS_NAVE } from './nave.js';
import { materialLivro, N_LOMBADAS, LOMBADA_NEUTRA, texAmbiente } from './texturas.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Dimensões em metros
const CASE_W = 2.4;
const CASE_H = 2.6;
const CASE_D = 0.42;
const PRATELEIRAS = 6;
const TABUA = 0.04;
const VAO = (CASE_H - TABUA) / PRATELEIRAS;
const CORREDOR = 1.8; // metade da largura do corredor
const ESPACO = 0.12; // entre estantes vizinhas
const PASSO = CASE_W + ESPACO;
const OLHO = 1.55;

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const EIXO_Y = new THREE.Vector3(0, 1, 0);

const FONTE = 'Georgia, "Times New Roman", serif';

// placa de madeira escura com letras douradas e filete duplo
function texturaRotulo(texto, sub) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const g = c.getContext('2d');
  const fundo = g.createLinearGradient(0, 0, 0, 160);
  fundo.addColorStop(0, '#24180e');
  fundo.addColorStop(1, '#140d07');
  g.fillStyle = fundo;
  g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = '#b8924e';
  g.lineWidth = 4;
  g.strokeRect(10, 10, 1004, 140);
  g.lineWidth = 1.5;
  g.strokeRect(20, 20, 984, 120);
  g.fillStyle = '#b8924e';
  for (const x of [52, 972]) {
    g.save();
    g.translate(x, 80);
    g.rotate(Math.PI / 4);
    g.fillRect(-9, -9, 18, 18); // losango nos cantos
    g.restore();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const maiusc = texto.toUpperCase();
  let tam = 60;
  g.font = `600 ${tam}px ${FONTE}`;
  g.letterSpacing = '6px';
  while (g.measureText(maiusc).width > 840 && tam > 26) g.font = `600 ${(tam -= 3)}px ${FONTE}`;
  g.fillStyle = '#e3c27f';
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowOffsetY = 2;
  g.fillText(maiusc, 512, sub ? 68 : 82);
  if (sub) {
    g.letterSpacing = '2px';
    g.fillStyle = '#b8924e';
    g.font = `italic 28px ${FONTE}`;
    g.fillText(sub, 512, 120);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// plaquinha de latão com letras gravadas
function texturaEtiqueta(texto, proporcao) {
  const h = 64;
  const w = Math.round(h * proporcao);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const lat = g.createLinearGradient(0, 0, 0, h);
  lat.addColorStop(0, '#b8955a');
  lat.addColorStop(0.5, '#8f6d36');
  lat.addColorStop(1, '#6e5228');
  g.fillStyle = lat;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#4a3516';
  g.lineWidth = 3;
  g.strokeRect(2, 2, w - 4, h - 4);
  g.fillStyle = '#3a2810';
  for (const x of [9, w - 9]) {
    g.beginPath();
    g.arc(x, h / 2, 3, 0, Math.PI * 2); // parafusinhos
    g.fill();
  }
  g.fillStyle = '#2a1a0a';
  g.textBaseline = 'middle';
  let tam = 36;
  g.font = `600 ${tam}px ${FONTE}`;
  while (g.measureText(texto).width > w - 34 && tam > 18) g.font = `600 ${(tam -= 2)}px ${FONTE}`;
  let t = texto;
  while (g.measureText(t).width > w - 34 && t.length > 3) t = t.slice(0, -2) + '…';
  g.fillText(t, 18, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function corDoLivro(livro) {
  // com capa: a cor da capa tinge a lombada de tecido
  if (livro.meta?.cor) return new THREE.Color(livro.meta.cor);
  // sem capa: a cor vem da textura; aqui só uma variação sutil de tom e brilho
  const h = hash(livro.titulo);
  const c = new THREE.Color().setHSL((h % 360) / 360, 0.25, 0.5);
  return new THREE.Color(1, 1, 1).lerp(c, 0.18).multiplyScalar(0.85 + ((h >> 11) % 30) / 100);
}
// índice no atlas (0–15; +8 = de ponta-cabeça). +16 = faixa neutra tingida com a cor da capa.
const lombadaDoLivro = (livro) =>
  livro.meta?.cor
    ? 16 + LOMBADA_NEUTRA + (hash(livro.id + '#') % 2) * 8
    : hash(livro.id + '#') % (N_LOMBADAS * 2);

// altura e largura da capa: segue a proporção real da capa quando conhecida
function formato(hh, proporcao) {
  let altura = 0.25 + (hh % 100) / 900;
  const p = proporcao || 0.64 + ((hh >> 8) % 80) / 1000;
  let prof = altura * p;
  if (prof < 0.15 || prof > 0.36) {
    prof = Math.min(0.36, Math.max(0.15, prof));
    altura = Math.min(0.37, Math.max(0.2, prof / p));
  }
  return { altura, prof };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function criarBiblioteca(canvas, { aoEscolher, aoPassar, aoAtril }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x03020a);
  // a névoa só apaga as estantes distantes; céu e estrelas ignoram névoa
  cena.fog = new THREE.Fog(0x07061a, 10, 48);
  // a luz do espaço entra pela abóbada aberta e pelas janelas: ambiente vindo do céu
  cena.environment = texAmbiente;
  cena.environmentIntensity = 0.32;
  cena.environmentRotation.set(0.15, 0.3, 1.25);

  const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 400);
  camera.rotation.order = 'YXZ';
  cena.add(camera);

  const ceu = criarCeu();
  cena.add(ceu.grupo);
  const chao = criarChao(renderer);
  cena.add(chao.grupo);

  cena.add(new THREE.HemisphereLight(0xa8b0e8, 0x2a1a30, 0.22));
  const luar = new THREE.DirectionalLight(0x9aa6ff, 0.3);
  luar.position.set(-3, 10, 4);
  cena.add(luar);
  const magia = criarMagia(cena, camera, renderer);

  // pós-processamento: bloom faz o que é muito claro (estrelas, orbe, placas) brilhar
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(cena, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.6, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const geoCaixa = new THREE.BoxGeometry(1, 1, 1);
  const matLivro = materialLivro({ instanciado: true });
  const geoLivro = new THREE.BoxGeometry(1, 1, 1);
  const matMadeira = materiais.madeira;
  const FIXOS = new Set([...MATERIAIS_FIXOS, ...MATERIAIS_NAVE]);
  const geoCoroa = geoCoroamento(CASE_W, CASE_D);
  let nave = null;

  // destaque do "livro do acaso"
  const brilho = new THREE.Mesh(
    geoCaixa,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 1.6, 0.7),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  brilho.matrixAutoUpdate = false;
  brilho.visible = false;
  cena.add(brilho);

  // brilho suave no livro sob o mouse
  const realce = new THREE.Mesh(
    geoCaixa,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.75, 0.4),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  realce.matrixAutoUpdate = false;
  realce.visible = false;
  cena.add(realce);
  const luzDestaque = new THREE.PointLight(0xffb85c, 0, 3, 1.5);
  cena.add(luzDestaque);

  let grupo = new THREE.Group();
  cena.add(grupo);
  let livros = [];
  let dados = []; // { matriz, normal, posicao }
  let malha = null;
  let comprimento = PASSO;
  let destacado = -1;
  let puxado = null; // { i, mesh, ida: {p0,q0,p1,p2,q2,s} }
  let animacoes = [];
  let animaveis = []; // adereços que se mexem (esfera armilar)

  // ---------------- montagem ----------------
  function montar(lista, { manterCamera = false } = {}) {
    cena.remove(grupo);
    grupo.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || o.material === matLivro || FIXOS.has(o.material)) return;
      o.material.map?.dispose();
      o.material.dispose();
    });
    grupo = new THREE.Group();
    cena.add(grupo);
    livros = lista;
    dados = [];
    animaveis = [];
    destacado = -1;
    brilho.visible = false;
    luzDestaque.intensity = 0;

    const tabuas = [];
    const cursorLado = { [-1]: 0, [1]: 0 }; // quanto cada lado do corredor já ocupou (em z)
    const xMin = -CASE_W / 2 + TABUA + 0.01;
    const xMax = CASE_W / 2 - TABUA - 0.01;
    const UTIL = xMax - xMin;
    const DIVISOR = 0.022; // espaço ocupado por um divisor de subtópico

    // dimensões de cada livro (determinísticas pelo id)
    const dims = lista.map((livro) => {
      const hh = hash(livro.id);
      return {
        // espessura real pelo número de páginas (quando já indexado); senão, pelo tamanho do arquivo
        espessura: livro.paginas
          ? Math.min(0.1, Math.max(0.014, 0.01 + livro.paginas * 0.000105))
          : Math.min(0.09, Math.max(0.025, 0.018 + Math.sqrt(livro.tamanho / 1e6) * 0.011)),
        ...formato(hh, livro.meta?.proporcao),
      };
    });
    const ocupa = (d) => d.espessura + 0.002;

    // grupos consecutivos (área, subpasta); a lista já vem agrupada assim
    const grupos = [];
    lista.forEach((l, i) => {
      const { area, sub } = areaESub(l.pasta);
      const g = grupos[grupos.length - 1];
      if (g && g.pasta === l.pasta) g.idx.push(i);
      else grupos.push({ pasta: l.pasta, area, sub, idx: [i] });
    });

    // ---- 1ª passada: distribui livros em estantes/prateleiras (coordenadas locais) ----
    const estantes = [];
    let atual = null;
    let prat = 0;
    let x = xMin;
    // guarda o espaço que sobrou na estante atual (vira lugar de adereços)
    const fecharEstante = () => {
      if (!atual || prat >= PRATELEIRAS) return;
      if (xMax - x > 0.3) atual.vazios.push({ prat, x0: x > xMin ? x + 0.03 : xMin, x1: xMax });
      for (let p = prat + 1; p < PRATELEIRAS; p++) atual.vazios.push({ prat: p, x0: xMin, x1: xMax });
    };
    const novaEstante = () => {
      fecharEstante();
      atual = { areas: [], continua: false, livros: [], marcadores: [], divisores: [], vazios: [] };
      estantes.push(atual);
      prat = 0;
      x = xMin;
    };
    const novaPrateleira = () => {
      prat++;
      x = xMin;
      if (prat >= PRATELEIRAS) novaEstante();
    };
    const marcar = (texto) => {
      if (x > xMin) {
        atual.divisores.push({ prat, x: x + DIVISOR / 2 - 0.002 });
        x += DIVISOR;
      }
      atual.marcadores.push({ prat, x, texto });
    };

    let areaAnterior = null;
    for (const g of grupos) {
      const novaArea = g.area !== areaAnterior;
      if (!atual) novaEstante();
      else if (novaArea) {
        // cada pasta da raiz (área) tem sua própria estante; só ganha outra se encher
        novaEstante();
      } else if (x > xMax - 0.3) {
        novaPrateleira();
      }
      if (!atual.areas.includes(g.area)) atual.areas.push(g.area);
      const rotulo = g.sub || g.area;
      marcar(novaArea && atual.areas.length > 1 && g.sub ? `${g.area} › ${g.sub}` : rotulo);
      areaAnterior = g.area;

      for (const i of g.idx) {
        if (x + dims[i].espessura > xMax) {
          const antes = atual;
          novaPrateleira();
          if (atual !== antes) {
            // a área continua numa estante nova
            atual.areas.push(g.area);
            atual.continua = true;
            atual.marcadores.push({ prat, x, texto: rotulo });
          }
        }
        atual.livros.push({ i, prat, x });
        x += ocupa(dims[i]);
      }
    }

    fecharEstante();

    // ---- 2ª passada: geometria ----
    const leds = [];
    const lavagens = [];
    const coroas = [];
    estantes.forEach((e, ie) => {
      const lado = cursorLado[-1] <= cursorLado[1] ? -1 : 1;
      const z = -(cursorLado[lado] + CASE_W / 2);
      cursorLado[lado] += CASE_W + ESPACO;
      const posE = new THREE.Vector3(lado * (CORREDOR + CASE_D / 2), 0, z);
      const q = new THREE.Quaternion().setFromAxisAngle(EIXO_Y, lado < 0 ? Math.PI / 2 : -Math.PI / 2);
      const matrizEstante = new THREE.Matrix4().compose(posE, q, new THREE.Vector3(1, 1, 1));
      const noMundo = (px, py, pz, sx = 1, sy = 1, sz = 1) =>
        matrizEstante.clone().multiply(new THREE.Matrix4().compose(
          new THREE.Vector3(px, py, pz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz),
        ));
      const base = (p) => (PRATELEIRAS - 1 - p) * VAO + TABUA;

      tabuas.push(noMundo(-CASE_W / 2 + TABUA / 2, CASE_H / 2, 0, TABUA, CASE_H, CASE_D));
      tabuas.push(noMundo(CASE_W / 2 - TABUA / 2, CASE_H / 2, 0, TABUA, CASE_H, CASE_D));
      tabuas.push(noMundo(0, CASE_H / 2, -CASE_D / 2 + TABUA / 2, CASE_W, CASE_H, TABUA));
      for (let k = 0; k <= PRATELEIRAS; k++) tabuas.push(noMundo(0, k * VAO + TABUA / 2, 0, CASE_W, TABUA, CASE_D));

      // fita de LED sob cada tábua (ilumina a prateleira de baixo) + luz lavando os livros
      const vaoUtil = VAO - TABUA;
      for (let k = 1; k <= PRATELEIRAS; k++) {
        leds.push(noMundo(0, k * VAO - 0.007, CASE_D / 2 - 0.03, CASE_W - 0.14, 0.01, 0.012));
        lavagens.push(noMundo(0, (k - 1) * VAO + TABUA + vaoUtil / 2, CASE_D / 2 - 0.004, CASE_W - 2 * TABUA, vaoUtil, 1));
      }
      // coroamento gótico no topo e rodapé na base
      coroas.push(noMundo(0, CASE_H, 0));
      tabuas.push(noMundo(0, 0.05, 0.015, CASE_W + 0.06, 0.1, CASE_D + 0.05));

      // adereços no espaço que sobrou
      const rnd = mulberry32(hash(e.areas.join('|')) + ie);
      const giro = Math.floor(rnd() * 7);
      e.vazios.forEach((v, j) => {
        for (const a of comporVao(v, xMin, xMax, rnd, giro + j)) {
          a.obj.applyMatrix4(noMundo(a.x, base(v.prat), -0.02));
          grupo.add(a.obj);
          if (a.animar) animaveis.push(a.animar);
        }
      });

      // divisores finos entre subtópicos
      for (const d of e.divisores) {
        tabuas.push(noMundo(d.x, base(d.prat) + 0.15, -0.02, 0.008, 0.3, CASE_D * 0.85));
      }

      // placa no topo: a(s) área(s) desta estante
      const texto = e.areas.join(' · ');
      const placa = new THREE.Mesh(
        new THREE.PlaneGeometry(CASE_W * 0.9, CASE_W * 0.9 * (160 / 1024)),
        // cor acima de 1: o texto dourado passa do limiar do bloom e brilha
        new THREE.MeshBasicMaterial({
          map: texturaRotulo(texto, e.continua ? 'continuação' : null),
          color: new THREE.Color(1.0, 1.0, 1.0),
          fog: true,
        }),
      );
      placa.applyMatrix4(noMundo(0, CASE_H + 0.2, CASE_D / 2));
      grupo.add(placa);

      // plaquinhas na borda da prateleira, onde cada subtópico começa
      for (const m of e.marcadores) {
        // não invade a etiqueta seguinte na mesma prateleira
        const proxima = e.marcadores.find((o) => o.prat === m.prat && o.x > m.x);
        const largura = Math.max(0.12, Math.min(0.42, xMax - m.x, proxima ? proxima.x - m.x - 0.01 : Infinity));
        const etiqueta = new THREE.Mesh(
          new THREE.PlaneGeometry(largura, 0.06),
          new THREE.MeshBasicMaterial({
            map: texturaEtiqueta(m.texto, largura / 0.06),
            color: new THREE.Color(0.95, 0.95, 0.95),
            fog: true,
          }),
        );
        etiqueta.applyMatrix4(noMundo(m.x + largura / 2, base(m.prat) - TABUA / 2 - 0.006, CASE_D / 2 + 0.004));
        grupo.add(etiqueta);
      }

      for (const { i, prat: p, x: bx } of e.livros) {
        const { espessura, altura, prof } = dims[i];
        const matriz = noMundo(bx + espessura / 2, base(p) + altura / 2, CASE_D / 2 - prof / 2 - 0.015, espessura, altura, prof);
        dados[i] = {
          matriz,
          normal: new THREE.Vector3(-lado, 0, 0),
          posicao: new THREE.Vector3().setFromMatrixPosition(matriz),
        };
      }
    });
    const estante = estantes.length - 1;
    comprimento = Math.max(cursorLado[-1], cursorLado[1]);

    const instanciar = (geometria, material, matrizes) => {
      const im = new THREE.InstancedMesh(geometria, material, Math.max(1, matrizes.length));
      im.count = matrizes.length;
      matrizes.forEach((m, i) => im.setMatrixAt(i, m));
      im.computeBoundingSphere();
      grupo.add(im);
      return im;
    };
    instanciar(geoCaixa, matMadeira, tabuas);
    instanciar(geoCaixa, materiais.led, leds);
    instanciar(geoCoroa, matMadeira, coroas);
    instanciar(geoPlano, materialLavagem, lavagens).renderOrder = 2;
    nave = criarNave({ comprimento });
    grupo.add(nave.grupo);

    const n = Math.max(1, lista.length);
    geoLivro.setAttribute('aLombada', new THREE.InstancedBufferAttribute(
      Float32Array.from({ length: n }, (_, i) => (lista[i] ? lombadaDoLivro(lista[i]) : 0)), 1));
    malha = new THREE.InstancedMesh(geoLivro, matLivro, n);
    malha.count = lista.length;
    lista.forEach((l, i) => {
      malha.setMatrixAt(i, dados[i].matriz);
      malha.setColorAt(i, corDoLivro(l));
    });
    malha.computeBoundingSphere();
    grupo.add(malha);

    if (!manterCamera) {
      pos.set(0, OLHO, 2.5);
      yaw = 0;
      pitch = -0.05;
    }
    return { estantes: estante + 1 };
  }

  // ---------------- controles (WASD + arrastar pra olhar) ----------------
  const pos = new THREE.Vector3(0, OLHO, 2.5);
  let yaw = 0;
  let pitch = 0;
  const teclas = new Set();
  let arrasto = null;
  let pausado = false;

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    teclas.add(e.code);
  });
  addEventListener('keyup', (e) => teclas.delete(e.code));
  addEventListener('blur', () => teclas.clear());

  canvas.addEventListener('pointerdown', (e) => {
    arrasto = { x: e.clientX, y: e.clientY, moveu: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (arrasto && !pausado) {
      const dx = e.clientX - arrasto.x;
      const dy = e.clientY - arrasto.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) arrasto.moveu = true;
      if (arrasto.moveu) {
        yaw += dx * 0.004;
        pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.004));
        arrasto.x = e.clientX;
        arrasto.y = e.clientY;
        voo = null;
      }
    }
    ponteiro = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (arrasto && !arrasto.moveu && !pausado) {
      const i = escolherNo(e.clientX, e.clientY);
      if (i >= 0) aoEscolher?.(i);
      else if (tocouAtril(e.clientX, e.clientY)) aoAtril?.();
    }
    arrasto = null;
  });
  canvas.addEventListener('pointerleave', () => {
    ponteiro = null;
    aoPassar?.(-1);
  });
  canvas.addEventListener('wheel', (e) => {
    if (pausado) return;
    e.preventDefault();
    andar(-e.deltaY * 0.004, 0);
    voo = null;
  }, { passive: false });

  function andar(frente, direita) {
    pos.x += -Math.sin(yaw) * frente + Math.cos(yaw) * direita;
    pos.z += -Math.cos(yaw) * frente - Math.sin(yaw) * direita;
    pos.x = Math.max(-CORREDOR + 0.35, Math.min(CORREDOR - 0.35, pos.x));
    pos.z = Math.max((nave ? nave.zFundo + 1.6 : -comprimento - 0.5), Math.min(5, pos.z));
  }

  // ---------------- seleção ----------------
  const ray = new THREE.Raycaster();
  let ponteiro = null;
  function escolherNo(cx, cy) {
    if (!malha) return -1;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    ray.far = 8;
    const hit = ray.intersectObject(malha)[0];
    return hit && (!puxado || hit.instanceId !== puxado.i) ? hit.instanceId : -1;
  }
  function tocouAtril(cx, cy) {
    if (!nave) return false;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    ray.far = 5;
    return ray.intersectObject(nave.atril.paginas).length > 0;
  }

  // ---------------- animações ----------------
  function animar(dur, passo) {
    return new Promise((res) => animacoes.push({ t: 0, dur, passo, res }));
  }

  function alvoNaFrente() {
    // um pouco à esquerda, deixando o lado direito pro cartão com os dados do livro
    const frente = new THREE.Vector3(-0.17, 0.0, -0.85).applyQuaternion(camera.quaternion);
    const p2 = camera.position.clone().add(frente);
    const q2 = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EIXO_Y, -Math.PI / 2));
    return { p2, q2 };
  }

  /** capa: ImageBitmap (ou null) — vai na face +x, que fica virada pra câmera. */
  async function puxar(i, capa = null) {
    if (puxado) return;
    const d = dados[i];
    const p0 = new THREE.Vector3();
    const q0 = new THREE.Quaternion();
    const s = new THREE.Vector3();
    d.matriz.decompose(p0, q0, s);
    const cor = new THREE.Color();
    malha.getColorAt(i, cor);
    const matPuxado = materialLivro({ instanciado: false, cor });
    matPuxado.userData.uLombada.value = lombadaDoLivro(livros[i]);
    let matCapa = matPuxado;
    if (capa) {
      const tex = new THREE.Texture(capa);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      tex.flipY = false; // ImageBitmap ignora flipY: inverte pela transformação de UV
      tex.repeat.set(1, -1);
      tex.offset.set(0, 1);
      // a luz que te acompanha fica atrás do livro; a capa brilha um pouco por conta própria
      matCapa = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0.62, 0.58, 0.52),
        roughness: 0.6,
        color: 0x9a9088,
      });
    }
    // faces: +x (capa), -x, +y, -y, +z (lombada), -z
    const mesh = new THREE.Mesh(geoCaixa, [matCapa, matPuxado, matPuxado, matPuxado, matPuxado, matPuxado]);
    mesh.position.copy(p0);
    mesh.quaternion.copy(q0);
    mesh.scale.copy(s);
    cena.add(mesh);
    malha.setMatrixAt(i, tmpM.makeScale(0, 0, 0));
    malha.instanceMatrix.needsUpdate = true;
    if (destacado === i) destacar(-1);

    const p1 = p0.clone().addScaledVector(d.normal, 0.3);
    puxado = { i, mesh, p0, q0, p1 };
    pausado = true;
    await animar(0.35, (t) => mesh.position.lerpVectors(p0, p1, ease(t)));
    const { p2, q2 } = alvoNaFrente();
    const s2 = s.clone().multiplyScalar(1.6); // de perto, maior, pra ver a capa
    await animar(0.55, (t) => {
      const e = ease(t);
      mesh.position.lerpVectors(p1, p2, e);
      mesh.quaternion.slerpQuaternions(q0, q2, e);
      mesh.scale.lerpVectors(s, s2, e);
    });
  }

  async function devolver() {
    if (!puxado) {
      pausado = false;
      return;
    }
    const { i, mesh, p0, q0, p1 } = puxado;
    const pA = mesh.position.clone();
    const qA = mesh.quaternion.clone();
    const sA = mesh.scale.clone();
    const s0 = new THREE.Vector3();
    dados[i].matriz.decompose(new THREE.Vector3(), new THREE.Quaternion(), s0);
    await animar(0.5, (t) => {
      const e = ease(t);
      mesh.position.lerpVectors(pA, p1, e);
      mesh.quaternion.slerpQuaternions(qA, q0, e);
      mesh.scale.lerpVectors(sA, s0, e);
    });
    await animar(0.3, (t) => mesh.position.lerpVectors(p1, p0, ease(t)));
    cena.remove(mesh);
    for (const m of new Set(mesh.material)) {
      m.map?.isTexture && m.map !== matLivro.map && m.map.image instanceof ImageBitmap && m.map.dispose();
      m.dispose();
    }
    malha.setMatrixAt(i, dados[i].matriz);
    malha.instanceMatrix.needsUpdate = true;
    puxado = null;
    pausado = false;
  }

  function destacar(i) {
    destacado = i;
    brilho.visible = i >= 0;
    luzDestaque.intensity = 0;
    if (i < 0) return;
    dados[i].matriz.decompose(tmpV, tmpQ, tmpS);
    brilho.matrix.compose(tmpV, tmpQ, tmpS.clone().multiplyScalar(1.12));
    luzDestaque.position.copy(dados[i].posicao).addScaledVector(dados[i].normal, 0.5);
  }

  let voo = null;
  function voarAte(i) {
    const d = dados[i];
    const alvo = new THREE.Vector3(
      Math.max(-CORREDOR + 0.35, Math.min(CORREDOR - 0.35, d.posicao.x + d.normal.x * 1.5)),
      OLHO,
      d.posicao.z,
    );
    const dir = d.posicao.clone().sub(alvo);
    const yawAlvo = Math.atan2(-dir.x, -dir.z);
    const pitchAlvo = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    let dy = ((yawAlvo - yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    voo = {
      t: 0,
      dur: Math.min(3.5, 1 + pos.distanceTo(alvo) / 12),
      p0: pos.clone(), p1: alvo,
      y0: yaw, y1: yaw + dy,
      x0: pitch, x1: pitchAlvo,
    };
    destacar(i);
  }

  /** Voa até ficar de frente pro atril, olhando as páginas. */
  function voarAteAtril() {
    if (!nave) return;
    const livro = new THREE.Vector3(0, 1.5, nave.zAtril);
    const alvo = new THREE.Vector3(0, OLHO + 0.15, nave.zAtril + 1.05);
    const dir = livro.clone().sub(alvo);
    const yawAlvo = Math.atan2(-dir.x, -dir.z);
    const dy = ((yawAlvo - yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    voo = {
      t: 0,
      dur: Math.min(4, 1.2 + pos.distanceTo(alvo) / 10),
      p0: pos.clone(), p1: alvo,
      y0: yaw, y1: yaw + dy,
      x0: pitch, x1: Math.atan2(dir.y, Math.hypot(dir.x, dir.z)),
    };
  }

  // ---------------- loop ----------------
  function redimensionar() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    chao.redimensionar();
  }
  addEventListener('resize', redimensionar);
  redimensionar();

  const relogio = new THREE.Clock();
  let ultimoHover = -1;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(relogio.getDelta(), 0.05);

    if (!pausado) {
      const v = (teclas.has('ShiftLeft') || teclas.has('ShiftRight') ? 7 : 2.8) * dt;
      let f = 0;
      let r = 0;
      if (teclas.has('KeyW') || teclas.has('ArrowUp')) f += v;
      if (teclas.has('KeyS') || teclas.has('ArrowDown')) f -= v;
      if (teclas.has('KeyD')) r += v;
      if (teclas.has('KeyA')) r -= v;
      if (teclas.has('ArrowLeft')) yaw += 1.8 * dt;
      if (teclas.has('ArrowRight')) yaw -= 1.8 * dt;
      if (f || r) {
        andar(f, r);
        voo = null;
      }
    }
    if (voo) {
      voo.t += dt;
      const e = ease(Math.min(1, voo.t / voo.dur));
      pos.lerpVectors(voo.p0, voo.p1, e);
      yaw = voo.y0 + (voo.y1 - voo.y0) * e;
      pitch = voo.x0 + (voo.x1 - voo.x0) * e;
      if (voo.t >= voo.dur) voo = null;
    }
    camera.position.copy(pos);
    camera.rotation.set(pitch, yaw, 0);
    ceu.atualizar(relogio.elapsedTime, camera.position);
    chao.atualizar(relogio.elapsedTime, camera.position);
    magia.atualizar(dt, relogio.elapsedTime);
    nave?.atualizar(relogio.elapsedTime);
    tremularLuzes(relogio.elapsedTime);
    for (const animar of animaveis) animar(relogio.elapsedTime);

    for (const a of animacoes) {
      a.t = Math.min(a.dur, a.t + dt);
      a.passo(a.t / a.dur);
    }
    animacoes = animacoes.filter((a) => (a.t >= a.dur ? (a.res(), false) : true));

    if (brilho.visible) {
      const s = 0.5 + 0.5 * Math.sin(relogio.elapsedTime * 3);
      brilho.material.opacity = 0.25 + 0.35 * s;
      luzDestaque.intensity = 1.5 + 2 * s;
    }

    if (ponteiro && !pausado && !arrasto?.moveu) {
      const i = escolherNo(ponteiro.x, ponteiro.y);
      if (i !== ultimoHover) {
        ultimoHover = i;
        canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
        realce.visible = i >= 0;
        if (i >= 0) {
          dados[i].matriz.decompose(tmpV, tmpQ, tmpS);
          realce.matrix.compose(tmpV, tmpQ, tmpS.multiplyScalar(1.06));
        }
      }
      aoPassar?.(i, ponteiro.x, ponteiro.y);
    } else if (realce.visible && (pausado || !ponteiro)) {
      realce.visible = false;
      ultimoHover = -1;
    }

    composer.render();
  });

  return {
    montar,
    puxar,
    devolver,
    voarAte,
    voarAteAtril,
    definirAtril: (livro, capa) => nave?.atril.definir(livro, capa),
    pausar: () => (pausado = true),
    destacar,
    get destacado() { return destacado; },
  };
}
