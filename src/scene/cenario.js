import * as THREE from 'three';
import { texLombadas, texMetal, texMadeira, aplicarMapaMundo, N_LOMBADAS } from './texturas.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Cenário de estação espacial: materiais, fitas de LED, arcos do corredor
// e adereços que ocupam (de forma organizada) o espaço vazio das prateleiras.

// cores acima de 1 passam do limiar do bloom e "acendem"
// âmbar de lamparina (tremula um pouco, ver tremularLuzes)
export const COR_LED = new THREE.Color(1.05, 0.48, 0.14);
const COR_LED_FRACA = new THREE.Color(0.55, 0.24, 0.08);

export const materiais = {
  metal: new THREE.MeshStandardMaterial({ color: 0xb4b4c2, metalness: 0.3, roughness: 0.55 }),
  metalEscuro: new THREE.MeshStandardMaterial({ color: 0x23232c, metalness: 0.45, roughness: 0.5 }),
  latao: new THREE.MeshStandardMaterial({ color: 0xc89a52, metalness: 0.8, roughness: 0.3, emissive: 0x2a1a08 }),
  lataoEscuro: new THREE.MeshStandardMaterial({ color: 0x7a5a2e, metalness: 0.75, roughness: 0.4, emissive: 0x140c04 }),
  led: new THREE.MeshBasicMaterial({ color: COR_LED }),
  ledFraco: new THREE.MeshBasicMaterial({ color: COR_LED_FRACA }),
  ledAzul: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.75, 1.3) }),
  folha: new THREE.MeshStandardMaterial({ color: 0x3f7f3a, roughness: 0.65, side: THREE.DoubleSide }),
  folhaClara: new THREE.MeshStandardMaterial({ color: 0x5f9c48, roughness: 0.65, side: THREE.DoubleSide }),
  caule: new THREE.MeshStandardMaterial({ color: 0x3c5a2a, roughness: 0.8 }),
  ceramica: new THREE.MeshStandardMaterial({ color: 0x2b4148, roughness: 0.35, metalness: 0.1 }),
  terra: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 1 }),
  vidro: new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  areia: new THREE.MeshStandardMaterial({ color: 0xd9b27a, roughness: 0.9 }),
  globo: new THREE.MeshStandardMaterial({ color: 0x2f5f8f, roughness: 0.5 }),
  holo: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.9, 1.25), wireframe: true, transparent: true, opacity: 0.75 }),
  holoLuz: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.55, 0.8), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
};
aplicarMapaMundo(materiais.metal, texMetal, 1.6);
materiais.madeira = new THREE.MeshStandardMaterial({ color: 0xc8b8a8, roughness: 0.7 });
aplicarMapaMundo(materiais.madeira, texMadeira, 1.2);

// lua da luminária: textura de crateras desenhada em canvas
function texturaLua() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2e6cc';
  g.fillRect(0, 0, 256, 128);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 256;
    const y = rnd() * 128;
    const r = 2 + rnd() ** 3 * 16;
    g.fillStyle = `rgba(150,130,105,${0.15 + rnd() * 0.25})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
materiais.lua = new THREE.MeshBasicMaterial({ map: texturaLua(), color: new THREE.Color(1.05, 0.9, 0.7) });

// uma faixa do atlas de lombadas por material (para livros deitados)
const matsLombada = Array.from({ length: N_LOMBADAS }, (_, k) => {
  const t = texLombadas.clone();
  t.repeat.set(1 / N_LOMBADAS * 0.93, 1);
  t.offset.set((k + 0.035) / N_LOMBADAS, 0);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.72 });
});
const matPaginas = new THREE.MeshStandardMaterial({ color: 0xcfc2a6, roughness: 0.9 });

export const MATERIAIS_FIXOS = new Set([...Object.values(materiais), ...matsLombada, matPaginas]);

const geo = {
  caixa: new THREE.BoxGeometry(1, 1, 1),
  esfera: new THREE.SphereGeometry(1, 32, 20),
  cilindro: new THREE.CylinderGeometry(1, 1, 1, 24),
  anel: new THREE.TorusGeometry(1, 0.04, 8, 64),
  faixa: new THREE.TorusGeometry(1, 0.11, 4, 64),
  icosa: new THREE.IcosahedronGeometry(1, 1),
  cone: new THREE.ConeGeometry(1, 1, 24, 1, true),
};

// textura de "luz lavando" a prateleira: forte em cima, some embaixo
function texturaLavagem() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}
export const materialLavagem = new THREE.MeshBasicMaterial({
  map: texturaLavagem(),
  color: new THREE.Color(1.0, 0.55, 0.22),
  transparent: true,
  opacity: 0.055,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
MATERIAIS_FIXOS.add(materialLavagem);
export const geoPlano = new THREE.PlaneGeometry(1, 1);

// ---------------------------------------------------------------------------
// modelos de adereços (origem no centro da base; cabem num vão de ~0,38 m)

const malha = (g, m, px = 0, py = 0, pz = 0, sx = 1, sy = sx, sz = sx) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(px, py, pz);
  o.scale.set(sx, sy, sz);
  return o;
};
// sólido de revolução a partir de pares [raio, altura]
const torno = (perfil, segmentos = 40) =>
  new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), segmentos);
// cilindro entre dois pontos
function haste(a, b, raio, material) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = malha(geo.cilindro, material, 0, 0, 0, raio, d.length(), raio);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

const geoBaseArmilar = torno([[0, 0], [0.068, 0], [0.07, 0.006], [0.062, 0.014], [0.04, 0.02], [0.02, 0.028], [0.012, 0.04], [0, 0.04]]);
function esferaArmilar() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoBaseArmilar, materiais.lataoEscuro));
  g.add(haste(new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0, 0.115, 0), 0.006, materiais.latao));
  const centro = new THREE.Vector3(0, 0.225, 0);
  // meridiano fixo, inclinado na latitude
  const fixo = new THREE.Group();
  fixo.position.copy(centro);
  fixo.add(malha(geo.anel, materiais.lataoEscuro, 0, 0, 0, 0.11));
  fixo.rotation.y = Math.PI / 2;
  g.add(fixo);
  // esfera que gira: equador, eclíptica larga, coluros, eixo e globo
  const gira = new THREE.Group();
  gira.position.copy(centro);
  gira.rotation.z = 0.41;
  const eq = malha(geo.anel, materiais.latao, 0, 0, 0, 0.095);
  eq.rotation.x = Math.PI / 2;
  const ecl = malha(geo.faixa, materiais.latao, 0, 0, 0, 0.095, 0.095, 0.095);
  ecl.rotation.set(Math.PI / 2 + 0.41, 0, 0);
  const c1 = malha(geo.anel, materiais.latao, 0, 0, 0, 0.095);
  const c2 = malha(geo.anel, materiais.latao, 0, 0, 0, 0.095);
  c2.rotation.y = Math.PI / 2;
  for (const tr of [0.04, -0.04]) {
    const t = malha(geo.anel, materiais.latao, 0, tr, 0, Math.sqrt(0.095 ** 2 - tr ** 2));
    t.rotation.x = Math.PI / 2;
    gira.add(t);
  }
  gira.add(eq, ecl, c1, c2, malha(geo.esfera, materiais.globo, 0, 0, 0, 0.028));
  gira.add(haste(new THREE.Vector3(0, -0.125, 0), new THREE.Vector3(0, 0.125, 0), 0.003, materiais.latao));
  g.add(gira);
  return { obj: g, largura: 0.24, animar: (t) => (gira.rotation.y = t * 0.25) };
}

const geoBaseLua = torno([[0, 0], [0.06, 0], [0.062, 0.008], [0.05, 0.016], [0.012, 0.022], [0, 0.022]]);
const geoTacaLua = torno([[0, 0], [0.006, 0], [0.03, 0.025], [0.034, 0.03], [0.03, 0.031]]);
function luminariaLua() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoBaseLua, materiais.metalEscuro));
  g.add(haste(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 0.1, 0), 0.005, materiais.latao));
  g.add(malha(geoTacaLua, materiais.latao, 0, 0.098, 0));
  const lua = malha(geo.esfera, materiais.lua, 0, 0.2, 0, 0.085);
  lua.rotation.set(0.3, 1.2, 0);
  g.add(lua);
  return { obj: g, largura: 0.2, animar: (t) => (lua.rotation.y = 1.2 + t * 0.05) };
}

// faces da BoxGeometry: +x, -x, +y, -y, +z, -z. Deitado (girado 90° em z):
// ±x viram capas (em cima/embaixo), ±y viram as pontas de páginas, +z é a lombada, -z o corte das páginas.
function livroDeitado(rnd, comprimento, espessura, profundidade) {
  const lomb = matsLombada[Math.floor(rnd() * N_LOMBADAS)];
  const livro = malha(geo.caixa, [lomb, lomb, matPaginas, matPaginas, lomb, matPaginas], 0, 0, 0, espessura, comprimento, profundidade);
  livro.rotation.z = Math.PI / 2;
  const g = new THREE.Group();
  g.add(livro);
  return g;
}
function pilhaDeLivros(rnd) {
  const g = new THREE.Group();
  let y = 0;
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const esp = 0.022 + rnd() * 0.03;
    const comp = 0.26 - i * 0.012 - rnd() * 0.02; // maiores embaixo
    const livro = livroDeitado(rnd, comp, esp, 0.16 + rnd() * 0.03);
    livro.position.set((rnd() - 0.5) * 0.015, y + esp / 2, 0);
    livro.rotation.y = (rnd() - 0.5) * 0.12;
    g.add(livro);
    y += esp;
  }
  return { obj: g, largura: 0.27 };
}

// folha em forma de lança (geometria plana levemente dobrada)
function geoFolha(comp, larg, curva = 0.25) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(larg, comp * 0.35, 0, comp);
  s.quadraticCurveTo(-larg, comp * 0.35, 0, 0);
  const geom = new THREE.ShapeGeometry(s, 8);
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / comp;
    p.setZ(i, curva * comp * y * y + Math.abs(p.getX(i)) * 0.3); // arqueia e faz a nervura
  }
  geom.computeVertexNormals();
  return geom;
}
const folhas = [geoFolha(0.13, 0.03), geoFolha(0.1, 0.025), geoFolha(0.16, 0.028, 0.4)];
const folhinha = geoFolha(0.035, 0.018, 0.1);
const geoVaso = torno([[0, 0.004], [0.042, 0], [0.047, 0.006], [0.058, 0.085], [0.064, 0.09], [0.064, 0.102], [0.057, 0.102], [0.052, 0.09], [0, 0.09]]);

function planta(rnd, { pendente = true } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoVaso, materiais.ceramica));
  g.add(malha(geo.cilindro, materiais.terra, 0, 0.092, 0, 0.051, 0.004, 0.051));
  // tufo de folhas abrindo em leque
  const n = 9 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(folhas[i % 3], i % 4 === 0 ? materiais.folhaClara : materiais.folha);
    f.position.set((rnd() - 0.5) * 0.02, 0.094, (rnd() - 0.5) * 0.02);
    f.rotation.order = 'YXZ';
    f.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.4;
    f.rotation.x = -(0.15 + rnd() * 0.75); // inclina pra fora
    g.add(f);
  }
  if (pendente) {
    // rama que passa pela beira da prateleira e cai na frente
    const lado = rnd() < 0.5 ? -1 : 1;
    const curva = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.03 * lado, 0.1, 0.02),
      new THREE.Vector3(0.06 * lado, 0.06, 0.2),
      new THREE.Vector3(0.07 * lado, 0.0, 0.27),
      new THREE.Vector3(0.08 * lado, -0.26, 0.25),
    );
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 20, 0.0025, 5), materiais.caule));
    for (let i = 1; i <= 12; i++) {
      const t = i / 12.5;
      const p = curva.getPoint(t);
      const tan = curva.getTangent(t);
      const f = new THREE.Mesh(folhinha, i % 3 === 0 ? materiais.folhaClara : materiais.folha);
      f.position.copy(p);
      f.lookAt(p.clone().add(new THREE.Vector3(i % 2 ? 1 : -1, 0, 0.6)));
      f.rotateX(Math.atan2(tan.y, 1) * 0.5 - 0.6);
      g.add(f);
    }
  }
  return { obj: g, largura: 0.2 };
}

const geoBulbo = torno([[0.006, 0], [0.038, 0.012], [0.042, 0.035], [0.03, 0.06], [0.007, 0.078], [0.006, 0.08]]);
function ampulheta() {
  const g = new THREE.Group();
  for (const y of [0.006, 0.2]) g.add(malha(geo.cilindro, materiais.lataoEscuro, 0, y, 0, 0.055, 0.012, 0.055));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    g.add(haste(new THREE.Vector3(Math.cos(a) * 0.046, 0.012, Math.sin(a) * 0.046), new THREE.Vector3(Math.cos(a) * 0.046, 0.194, Math.sin(a) * 0.046), 0.004, materiais.latao));
  }
  const baixo = malha(geoBulbo, materiais.vidro, 0, 0.012, 0);
  const cima = malha(geoBulbo, materiais.vidro, 0, 0.194, 0);
  cima.scale.y = -1;
  g.add(baixo, cima);
  // areia: monte embaixo, resto em cima, filete no meio
  const monte = malha(new THREE.ConeGeometry(1, 1, 24), materiais.areia, 0, 0.012 + 0.014, 0, 0.034, 0.028, 0.034);
  const resto = malha(new THREE.ConeGeometry(1, 1, 24), materiais.areia, 0, 0.194 - 0.05, 0, 0.026, -0.022, 0.026);
  g.add(monte, resto, malha(geo.cilindro, materiais.areia, 0, 0.1, 0, 0.0012, 0.07, 0.0012));
  return { obj: g, largura: 0.14 };
}

const geoProjetor = torno([[0, 0], [0.06, 0], [0.064, 0.01], [0.058, 0.028], [0.03, 0.032], [0, 0.032]]);
function holograma() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoProjetor, materiais.metalEscuro));
  const anel = malha(geo.anel, materiais.ledAzul, 0, 0.03, 0, 0.034, 0.034, 0.034);
  anel.rotation.x = Math.PI / 2;
  g.add(anel);
  g.add(malha(geo.cone, materiais.holoLuz, 0, 0.1, 0, 0.07, -0.14, 0.07)); // feixe abrindo pra cima
  const forma = malha(geo.icosa, materiais.holo, 0, 0.2, 0, 0.065);
  const nucleo = malha(geo.icosa, materiais.holo, 0, 0.2, 0, 0.03);
  g.add(forma, nucleo);
  return {
    obj: g,
    largura: 0.2,
    animar: (t) => {
      forma.rotation.set(t * 0.4, t * 0.6, 0);
      nucleo.rotation.set(-t * 0.7, -t * 0.5, 0);
      forma.position.y = nucleo.position.y = 0.2 + Math.sin(t * 1.3) * 0.008;
    },
  };
}

// aparador de livros em L (segura a fileira onde ela termina)
function aparador() {
  const g = new THREE.Group();
  g.add(malha(geo.caixa, materiais.metalEscuro, 0, 0.11, 0, 0.01, 0.22, 0.15));
  g.add(malha(geo.caixa, materiais.metalEscuro, 0.045, 0.003, 0, 0.09, 0.006, 0.15));
  g.add(malha(geo.caixa, materiais.latao, -0.0055, 0.11, 0.0, 0.002, 0.2, 0.004)); // filete de latão
  return { obj: g, largura: 0.02 };
}

// --- adereços góticos ------------------------------------------------------
const matsGoticos = {
  cera: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.55, emissive: 0x2a1808 }),
  chama: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.95, 0.32) }),
  osso: new THREE.MeshStandardMaterial({ color: 0xcfc3a6, roughness: 0.75 }),
  oco: new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 }),
  pergaminho: new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 0.85, side: THREE.DoubleSide }),
  fita: new THREE.MeshStandardMaterial({ color: 0x7a1a1a, roughness: 0.6 }),
  tinta: new THREE.MeshStandardMaterial({ color: 0x0c0d18, roughness: 0.1, metalness: 0.2 }),
  pena: new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.8, side: THREE.DoubleSide }),
};
for (const m of Object.values(matsGoticos)) MATERIAIS_FIXOS.add(m);

/** Castiçal de latão com vela gasta (chama tremula). */
const geoCastical = torno([[0, 0], [0.055, 0], [0.058, 0.008], [0.03, 0.02], [0.014, 0.035], [0.012, 0.09], [0.022, 0.1], [0.012, 0.11], [0.03, 0.125], [0.034, 0.132], [0.02, 0.135], [0, 0.135]]);
function castical(rnd) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoCastical, materiais.latao));
  const h = 0.06 + rnd() * 0.08;
  g.add(malha(geo.cilindro, matsGoticos.cera, 0, 0.135 + h / 2, 0, 0.016, h, 0.016));
  // pingos de cera escorrendo
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2;
    g.add(malha(geo.esfera, matsGoticos.cera, Math.cos(a) * 0.016, 0.135 + h * (0.4 + rnd() * 0.5), Math.sin(a) * 0.016, 0.006, 0.014, 0.006));
  }
  const fogo = malha(geo.esfera, matsGoticos.chama, 0, 0.135 + h + 0.02, 0, 0.008, 0.022, 0.008);
  g.add(fogo);
  const fase = rnd() * 10;
  return {
    obj: g,
    largura: 0.12,
    animar: (t) => {
      const f = 1 + Math.sin(t * 12 + fase) * 0.12 + Math.sin(t * 6.7 + fase) * 0.08;
      fogo.scale.set(0.008 * (2 - f), 0.022 * f, 0.008 * (2 - f));
    },
  };
}
function parDeCasticais(rnd) {
  const g = new THREE.Group();
  const a = castical(rnd);
  const b = castical(rnd);
  a.obj.position.x = -0.07;
  b.obj.position.set(0.07, 0, 0.02);
  g.add(a.obj, b.obj);
  return { obj: g, largura: 0.26, animar: (t) => (a.animar(t), b.animar(t)) };
}

/** Crânio de leitura (memento mori), apoiado sobre um livro deitado. */
function cranio(rnd) {
  const g = new THREE.Group();
  const livro = livroDeitado(rnd, 0.22, 0.035, 0.17);
  livro.position.y = 0.0175;
  g.add(livro);
  const c = new THREE.Group();
  c.position.set(0, 0.035, 0);
  c.rotation.y = (rnd() - 0.5) * 0.8;
  c.add(malha(geo.esfera, matsGoticos.osso, 0, 0.085, -0.01, 0.07, 0.068, 0.082)); // calota
  c.add(malha(geo.esfera, matsGoticos.osso, 0, 0.045, 0.03, 0.055, 0.045, 0.05)); // face
  for (const sx of [-1, 1]) {
    c.add(malha(geo.esfera, matsGoticos.oco, sx * 0.024, 0.06, 0.068, 0.017, 0.015, 0.01)); // órbitas
    c.add(malha(geo.esfera, matsGoticos.osso, sx * 0.045, 0.04, 0.045, 0.018, 0.014, 0.02)); // maçãs
  }
  const nariz = malha(new THREE.ConeGeometry(1, 1, 3), matsGoticos.oco, 0, 0.038, 0.074, 0.009, 0.018, 0.006);
  nariz.rotation.x = Math.PI;
  c.add(nariz);
  c.add(malha(geo.caixa, matsGoticos.osso, 0, 0.016, 0.052, 0.05, 0.018, 0.035)); // maxilar
  for (let i = -3; i <= 3; i++) c.add(malha(geo.caixa, matsGoticos.oco, i * 0.0068, 0.02, 0.07, 0.0012, 0.012, 0.002)); // vãos dos dentes
  g.add(c);
  return { obj: g, largura: 0.24 };
}

/** Pergaminhos enrolados, um amarrado com fita. */
function pergaminhos(rnd) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const comp = 0.16 + rnd() * 0.08;
    const r = 0.016 + rnd() * 0.008;
    const rolo = malha(geo.cilindro, matsGoticos.pergaminho, 0, 0, 0, r, comp, r);
    rolo.rotation.z = Math.PI / 2;
    // pirâmide: 2-3 embaixo, 1 em cima
    const base = i < n - 1;
    rolo.position.set((rnd() - 0.5) * 0.03, base ? r : 0.045, base ? (i - (n - 2) / 2) * 0.045 : 0);
    rolo.rotation.y = (rnd() - 0.5) * 0.4;
    g.add(rolo);
    if (i === n - 1) {
      // fita em volta do rolo (no espaço local do cilindro: raio 1, eixo y)
      const fita = malha(new THREE.TorusGeometry(1, 0.15, 6, 16), matsGoticos.fita, 0, 0, 0, 1.06);
      fita.rotation.x = Math.PI / 2;
      rolo.add(fita);
    }
  }
  return { obj: g, largura: 0.25 };
}

/** Tinteiro de vidro escuro com pena. */
const geoTinteiro = torno([[0, 0], [0.036, 0], [0.04, 0.01], [0.04, 0.04], [0.02, 0.055], [0.014, 0.058], [0.014, 0.068], [0.018, 0.07], [0, 0.07]]);
const geoPena = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.02, 0.09, 0.006, 0.2);
  s.quadraticCurveTo(-0.008, 0.12, 0, 0);
  const g = new THREE.ShapeGeometry(s, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.12 * (p.getY(i) / 0.2) ** 2 * 0.4);
  g.computeVertexNormals();
  return g;
})();
function tinteiro(rnd) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoTinteiro, matsGoticos.tinta));
  const pena = new THREE.Mesh(geoPena, matsGoticos.pena);
  pena.position.set(0, 0.05, 0);
  pena.rotation.set(-0.25, rnd() * Math.PI, 0.35);
  g.add(pena);
  // folha solta ao lado
  const folha = malha(geo.caixa, matsGoticos.pergaminho, 0.1, 0.002, 0.01, 0.12, 0.003, 0.16);
  folha.rotation.y = 0.3;
  g.add(folha);
  return { obj: g, largura: 0.24 };
}

const MODELOS = { esferaArmilar, luminariaLua, pilhaDeLivros, planta, ampulheta, holograma, castical, parDeCasticais, cranio, pergaminhos, tinteiro };

// composições simétricas para prateleiras vazias: [modelo, posição relativa 0–1]
const COMPOSICOES = [
  [['castical', 0.15], ['cranio', 0.5], ['castical', 0.85]],
  [['pilhaDeLivros', 0.2], ['esferaArmilar', 0.78]],
  [['pergaminhos', 0.22], ['tinteiro', 0.75]],
  [['pilhaDeLivros', 0.14], ['ampulheta', 0.5], ['pilhaDeLivros', 0.86]],
  [['planta', 0.25], ['luminariaLua', 0.72]],
  [['parDeCasticais', 0.5]],
  [['ampulheta', 0.25], ['pergaminhos', 0.75]],
  [['planta', 0.22], ['holograma', 0.78]],
  [['esferaArmilar', 0.5]],
];
const SOLO = ['planta', 'castical', 'ampulheta', 'cranio', 'tinteiro', 'luminariaLua', 'pergaminhos', 'esferaArmilar'];

/**
 * Decide os adereços de um vão de prateleira.
 * parcial: vão no fim de uma fileira de livros → aparador + no máximo 1 peça.
 * vazio: prateleira inteira → uma composição simétrica.
 */
export function comporVao(vao, xMin, xMax, rnd, ordem) {
  const itens = [];
  const add = (nome, x) => {
    const m = MODELOS[nome](rnd);
    itens.push({ ...m, x });
  };
  if (vao.x0 > xMin + 0.001) {
    const ap = aparador();
    itens.push({ ...ap, x: vao.x0 + 0.006 });
    const livre0 = vao.x0 + 0.08;
    if (vao.x1 - livre0 > 0.34) add(SOLO[ordem % SOLO.length], (livre0 + vao.x1) / 2);
  } else {
    const comp = COMPOSICOES[ordem % COMPOSICOES.length];
    for (const [nome, rel] of comp) add(nome, xMin + 0.12 + (xMax - xMin - 0.24) * rel);
  }
  return itens;
}

// ---------------------------------------------------------------------------
// luz das lamparinas tremulando (fitas sob as prateleiras + luz lavando os livros)
export function tremularLuzes(t) {
  const f = 1 + Math.sin(t * 7.1) * 0.035 + Math.sin(t * 13.7) * 0.025 + Math.sin(t * 2.3) * 0.03;
  materiais.led.color.copy(COR_LED).multiplyScalar(f);
  materialLavagem.opacity = 0.055 * f;
}

/**
 * Coroamento gótico de uma estante (geometria única, instanciada):
 * frontão ogival atrás da placa, moldura em arco, três pináculos.
 * Origem no topo central da estante, frente em +z.
 */
export function geoCoroamento(largura, profundidade) {
  const partes = [];
  const a = 0.62;
  const r = a * 1.4;
  const c = r - a;
  const tA = Math.acos(-c / r);
  const arco = (aa, rr, n = 16) => {
    const cc = rr - aa;
    const t0 = Math.acos(-cc / rr);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = Math.PI + (t0 - Math.PI) * (i / n);
      pts.push(new THREE.Vector2(cc + rr * Math.cos(t), rr * Math.sin(t)));
    }
    return [...pts, ...pts.slice(0, -1).reverse().map((p) => new THREE.Vector2(-p.x, p.y))];
  };
  void tA;
  // painel do frontão: retângulo 0.28 + ogiva
  const base = 0.28;
  const contorno = [new THREE.Vector2(-a, 0), new THREE.Vector2(a, 0), ...arco(a, r).reverse().map((p) => new THREE.Vector2(p.x, p.y + base))];
  const painel = new THREE.ExtrudeGeometry(new THREE.Shape(contorno), { depth: 0.04, bevelEnabled: false });
  painel.translate(0, 0, -profundidade / 2 + 0.06);
  partes.push(painel);
  // moldura em arco na frente do painel
  const fora = arco(a + 0.035, r + 0.035);
  const dentro = arco(a - 0.035, r - 0.035).reverse();
  const moldura = new THREE.ExtrudeGeometry(new THREE.Shape([...fora, ...dentro]), { depth: 0.03, bevelEnabled: false });
  moldura.translate(0, base, -profundidade / 2 + 0.1);
  partes.push(moldura);
  // pináculos: um no ápice, dois nos cantos da estante
  const apice = base + Math.sqrt(r * r - c * c);
  const pinaculo = (x, y, z, h) => {
    const cubo = new THREE.BoxGeometry(0.07, 0.08, 0.07);
    cubo.translate(x, y + 0.04, z);
    const cone = new THREE.ConeGeometry(0.045, h, 4);
    cone.rotateY(Math.PI / 4);
    cone.translate(x, y + 0.08 + h / 2, z);
    const bola = new THREE.SphereGeometry(0.018, 6, 4);
    bola.translate(x, y + 0.08 + h, z);
    partes.push(cubo, cone, bola);
  };
  pinaculo(0, apice - 0.02, -profundidade / 2 + 0.08, 0.22);
  for (const s of [-1, 1]) pinaculo(s * (largura / 2 - 0.05), 0.0, profundidade / 2 - 0.06, 0.28);
  // cornija (aba saliente no topo da estante)
  const cornija = new THREE.BoxGeometry(largura + 0.1, 0.07, profundidade + 0.08);
  cornija.translate(0, -0.035, 0.02);
  partes.push(cornija);
  // remove atributos que nem todas têm, pra poder juntar
  for (const p of partes) {
    for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k);
  }
  return mergeGeometries(partes.map((p) => (p.index ? p.toNonIndexed() : p)));
}

// ---------------------------------------------------------------------------
// estrutura do corredor: arcos metálicos, trilhos no teto e fitas no chão

export function criarEstrutura({ corredor, fundoEstante, comprimento }) {
  const grupo = new THREE.Group();
  const metal = [];
  const leds = [];
  const ledsFracos = [];
  const caixa = (lista, x, y, z, sx, sy, sz, rz = 0) =>
    lista.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)),
      new THREE.Vector3(sx, sy, sz),
    ));

  const xPilar = corredor + fundoEstante + 0.22;
  const ALTO = 3.35;
  const passo = 4.8;
  const n = Math.ceil((comprimento + 2) / passo) + 1;
  for (let k = 0; k < n; k++) {
    const z = 1.2 - k * passo;
    for (const s of [-1, 1]) {
      caixa(metal, s * xPilar, ALTO / 2, z, 0.3, ALTO, 0.4);
      caixa(metal, s * (xPilar - 0.32), ALTO - 0.28, z, 0.62, 0.2, 0.38, s * Math.PI / 4); // chanfro
      caixa(ledsFracos, s * (xPilar - 0.16), 1.6, z, 0.015, 2.2, 0.03); // filete vertical
    }
    caixa(metal, 0, ALTO, z, 2 * xPilar + 0.3, 0.3, 0.4);
    caixa(leds, 0, ALTO - 0.16, z, 2 * xPilar - 1.4, 0.025, 0.05); // fita sob a viga
  }
  // trilhos longitudinais no teto
  const zIni = 1.2;
  const zFim = 1.2 - (n - 1) * passo;
  for (const s of [-1, 1]) {
    caixa(metal, s * (corredor + 0.25), ALTO + 0.05, (zIni + zFim) / 2, 0.14, 0.14, zIni - zFim);
    // fitas de luz no chão, junto às estantes
    caixa(ledsFracos, s * (corredor - 0.04), 0.006, (zIni + zFim) / 2, 0.025, 0.01, zIni - zFim);
  }

  for (const [lista, mat] of [[metal, materiais.metal], [leds, materiais.led], [ledsFracos, materiais.ledFraco]]) {
    const im = new THREE.InstancedMesh(geo.caixa, mat, lista.length);
    lista.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    grupo.add(im);
  }
  return grupo;
}
