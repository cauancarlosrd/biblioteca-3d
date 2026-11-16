import * as THREE from 'three';

// Cenário de estação espacial: materiais, fitas de LED, arcos do corredor
// e adereços que ocupam o espaço vazio das prateleiras.

// cores acima de 1 passam do limiar do bloom e "acendem"
export const COR_LED = new THREE.Color(1.35, 0.62, 0.2);
const COR_LED_FRACA = new THREE.Color(0.55, 0.24, 0.08);

export const materiais = {
  metal: new THREE.MeshStandardMaterial({ color: 0x34343e, metalness: 0.6, roughness: 0.45 }),
  metalEscuro: new THREE.MeshStandardMaterial({ color: 0x1c1c24, metalness: 0.5, roughness: 0.55 }),
  latao: new THREE.MeshStandardMaterial({ color: 0xc89a52, metalness: 0.85, roughness: 0.3, emissive: 0x2a1a08 }),
  led: new THREE.MeshBasicMaterial({ color: COR_LED }),
  ledFraco: new THREE.MeshBasicMaterial({ color: COR_LED_FRACA }),
  lua: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.58) }),
  ledAzul: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.7, 1.3) }),
  folha: new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.8, flatShading: true }),
  vaso: new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7 }),
};
export const MATERIAIS_FIXOS = new Set(Object.values(materiais));

const geo = {
  caixa: new THREE.BoxGeometry(1, 1, 1),
  esfera: new THREE.SphereGeometry(1, 24, 16),
  cilindro: new THREE.CylinderGeometry(1, 1, 1, 20),
  anel: new THREE.TorusGeometry(1, 0.035, 8, 48),
  folhagem: new THREE.IcosahedronGeometry(1, 0),
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
// adereços (origem no centro da base; cabem num vão de prateleira ~0,38 m)

const malha = (g, m, px, py, pz, sx, sy, sz) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(px, py, pz);
  o.scale.set(sx, sy ?? sx, sz ?? sx);
  return o;
};

function esferaArmilar() {
  const grupo = new THREE.Group();
  grupo.add(malha(geo.cilindro, materiais.latao, 0, 0.01, 0, 0.07, 0.02, 0.07));
  grupo.add(malha(geo.cilindro, materiais.latao, 0, 0.06, 0, 0.008, 0.1, 0.008));
  const aneis = new THREE.Group();
  aneis.position.y = 0.2;
  for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 2, Math.PI / 2], [0.4, 0.9]]) {
    const a = malha(geo.anel, materiais.latao, 0, 0, 0, 0.1);
    a.rotation.set(rx, ry, 0);
    aneis.add(a);
  }
  aneis.add(malha(geo.esfera, materiais.lua, 0, 0, 0, 0.025));
  aneis.rotation.z = 0.4;
  grupo.add(aneis);
  return { obj: grupo, largura: 0.24, animar: (t) => (aneis.rotation.y = t * 0.3) };
}

function luminariaLua() {
  const grupo = new THREE.Group();
  grupo.add(malha(geo.cilindro, materiais.metalEscuro, 0, 0.012, 0, 0.06, 0.024, 0.06));
  grupo.add(malha(geo.cilindro, materiais.metalEscuro, 0, 0.06, 0, 0.006, 0.08, 0.006));
  grupo.add(malha(geo.esfera, materiais.lua, 0, 0.19, 0, 0.1));
  return { obj: grupo, largura: 0.24 };
}

function pilhaDeLivros(rnd) {
  const grupo = new THREE.Group();
  let y = 0;
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.025 + rnd() * 0.03;
    const cor = new THREE.Color().setHSL(rnd(), 0.35, 0.18 + rnd() * 0.15);
    const m = new THREE.Mesh(geo.caixa, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.75 }));
    m.scale.set(0.2 + rnd() * 0.06, h, 0.15 + rnd() * 0.04);
    m.position.set((rnd() - 0.5) * 0.02, y + h / 2, 0);
    m.rotation.y = (rnd() - 0.5) * 0.35;
    grupo.add(m);
    y += h;
  }
  return { obj: grupo, largura: 0.28 };
}

function planta(rnd) {
  const grupo = new THREE.Group();
  grupo.add(malha(geo.cilindro, materiais.vaso, 0, 0.05, 0, 0.055, 0.1, 0.055));
  const n = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd();
    const r = 0.03 + rnd() * 0.05;
    const f = malha(geo.folhagem, materiais.folha, Math.cos(a) * r, 0.13 + rnd() * 0.12, Math.sin(a) * r * 0.6, 0.035 + rnd() * 0.03);
    f.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    grupo.add(f);
  }
  // folhas que caem pela beira da prateleira
  for (let i = 0; i < 3; i++) {
    const f = malha(geo.folhagem, materiais.folha, (rnd() - 0.5) * 0.08, 0.04 - i * 0.07, 0.08 + i * 0.012, 0.028);
    grupo.add(f);
  }
  return { obj: grupo, largura: 0.2 };
}

function maleta(rnd) {
  const grupo = new THREE.Group();
  const w = 0.3 + rnd() * 0.06;
  grupo.add(malha(geo.caixa, materiais.metalEscuro, 0, 0.07, 0, w, 0.14, 0.24));
  grupo.add(malha(geo.caixa, materiais.metal, 0, 0.145, 0, w * 0.4, 0.012, 0.03));
  grupo.add(malha(geo.caixa, rnd() < 0.5 ? materiais.ledAzul : materiais.led, w * 0.3, 0.1, 0.121, 0.03, 0.008, 0.002));
  return { obj: grupo, largura: w };
}

const TIPOS = [esferaArmilar, luminariaLua, pilhaDeLivros, planta, planta, maleta, pilhaDeLivros];

export function adereco(rnd) {
  return TIPOS[Math.floor(rnd() * TIPOS.length)](rnd);
}

/** Preenche um vão [x0, x1] de prateleira com alguns adereços, deixando respiro entre eles. */
export function preencherVao(x0, x1, rnd, max = 3) {
  const itens = [];
  let x = x0 + 0.05 + rnd() * 0.15;
  while (itens.length < max) {
    const a = adereco(rnd);
    if (x + a.largura > x1 - 0.03) break;
    itens.push({ ...a, x: x + a.largura / 2 });
    x += a.largura + 0.12 + rnd() * 0.45;
  }
  return itens;
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
