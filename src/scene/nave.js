import * as THREE from 'three';
import { texPedra, aplicarMapaMundo } from './texturas.js';

// Nave de catedral gótica em ruínas, flutuando no espaço:
// colunas em feixe, arcos ogivais, abóbada só de nervuras (o céu aparece entre elas),
// paredes altas com janelas em lanceta e lustres de ferro com velas.

export const NAVE = {
  xPilar: 2.65, // centro das colunas (atrás das estantes)
  xParede: 3.4, // centro das paredes laterais
  yArranque: 3.7, // onde os arcos começam a curvar
  vao: 4.8, // comprimento de cada tramo
  alturaParede: 7.2,
};

const pedra = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.92 });
aplicarMapaMundo(pedra, texPedra, 2.2);
const pedraEscura = new THREE.MeshStandardMaterial({ color: 0x6d6a64, roughness: 0.95 });
aplicarMapaMundo(pedraEscura, texPedra, 1.4);
const ferro = new THREE.MeshStandardMaterial({ color: 0x1b1a1c, metalness: 0.6, roughness: 0.55 });
const cera = new THREE.MeshStandardMaterial({ color: 0xe6d8b8, roughness: 0.6, emissive: 0x2a1a08 });
const chama = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.05, 0.35) });
export const MATERIAIS_NAVE = [pedra, pedraEscura, ferro, cera, chama];

// ---------------------------------------------------------------------------
// geometria de arco ogival

/** Pontos de um arco ogival no plano (x, y): vão 2a, raio r, de -a até +a. */
function pontosOgiva(a, r, n = 24) {
  const c = r - a; // centro do arco esquerdo fica em x = +c (e o direito em -c)
  const tApice = Math.acos(-c / r);
  const esq = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.PI + (tApice - Math.PI) * (i / n);
    esq.push(new THREE.Vector2(c + r * Math.cos(t), r * Math.sin(t)));
  }
  const dir = esq.slice(0, -1).reverse().map((p) => new THREE.Vector2(-p.x, p.y));
  return [...esq, ...dir];
}
const alturaOgiva = (a, r) => Math.sqrt(r * r - (r - a) * (r - a));

/** Faixa de arco ogival (contorno externo menos interno), extrudada em profundidade. */
function geoArco(a, r, largura, profundidade) {
  const fora = pontosOgiva(a + largura / 2, r + largura / 2);
  const dentro = pontosOgiva(a - largura / 2, r - largura / 2).reverse();
  const s = new THREE.Shape([...fora, ...dentro]);
  const g = new THREE.ExtrudeGeometry(s, { depth: profundidade, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -profundidade / 2);
  return g;
}

/** Nervura 3D: arco ogival entre p0 e p1 (mesma altura), subindo `subida`. */
function geoNervura(p0, p1, subida, raio) {
  const d = p0.distanceTo(p1);
  const a = d / 2;
  const r = (a * a + subida * subida) / (2 * a) > a ? (a * a + subida * subida) / (2 * a) : a * 1.001;
  const pts2 = pontosOgiva(a, Math.max(r, a * 1.001), 20);
  const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
  const meio = p0.clone().lerp(p1, 0.5);
  const pts = pts2.map((p) => meio.clone().addScaledVector(dir, p.x).add(new THREE.Vector3(0, p.y, 0)));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, raio, 6);
}

// ---------------------------------------------------------------------------
// peças

const geoFuste = new THREE.CylinderGeometry(1, 1, 1, 14);
const geoBase = new THREE.LatheGeometry(
  [[0, 0], [0.34, 0], [0.34, 0.22], [0.3, 0.26], [0.3, 0.3], [0.26, 0.34], [0.26, 0.38], [0, 0.38]].map(([x, y]) => new THREE.Vector2(x, y)),
  8,
);
const geoCapitel = new THREE.LatheGeometry(
  [[0, 0], [0.24, 0], [0.26, 0.04], [0.3, 0.2], [0.36, 0.26], [0.36, 0.34], [0, 0.34]].map(([x, y]) => new THREE.Vector2(x, y)),
  8,
);

/** Coluna em feixe: núcleo + 8 colunelos, base octogonal e capitel. */
function coluna(altura) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geoBase, pedraEscura));
  const nucleo = new THREE.Mesh(geoFuste, pedra);
  nucleo.scale.set(0.2, altura - 0.7, 0.2);
  nucleo.position.y = 0.38 + (altura - 0.7) / 2;
  g.add(nucleo);
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2;
    const r = k % 2 ? 0.075 : 0.06;
    const f = new THREE.Mesh(geoFuste, pedra);
    f.scale.set(r, altura - 0.7, r);
    f.position.set(Math.cos(ang) * 0.21, nucleo.position.y, Math.sin(ang) * 0.21);
    g.add(f);
  }
  const cap = new THREE.Mesh(geoCapitel, pedraEscura);
  cap.position.y = altura - 0.32;
  g.add(cap);
  return g;
}

/** Parede de um tramo, com janela em lanceta (furo) e rendilhado. */
function paredeComJanela(comprimento, altura) {
  const meio = comprimento / 2;
  const s = new THREE.Shape();
  s.moveTo(-meio, 0);
  s.lineTo(meio, 0);
  s.lineTo(meio, altura);
  s.lineTo(-meio, altura);
  s.closePath();
  // janela: peitoril 2.9, arranque 5.2, ponta ogival (equilátera)
  const larg = 1.6;
  const a = larg / 2;
  const y0 = 2.9;
  const y1 = 5.2;
  const furo = new THREE.Path();
  furo.moveTo(-a, y0);
  furo.lineTo(a, y0);
  furo.lineTo(a, y1);
  for (const p of pontosOgiva(a, larg).reverse()) furo.lineTo(p.x, y1 + p.y);
  furo.lineTo(-a, y0);
  s.holes.push(furo);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -0.225);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, pedra));

  // rendilhado: mainel central, dois arquinhos e um óculo no topo
  const mainel = new THREE.Mesh(new THREE.BoxGeometry(0.09, y1 - y0 + 0.3, 0.16), pedraEscura);
  mainel.position.set(0, (y0 + y1 + 0.3) / 2, 0);
  g.add(mainel);
  for (const sx of [-1, 1]) {
    const arq = new THREE.Mesh(geoArco(a / 2 - 0.02, a * 0.75, 0.07, 0.14), pedraEscura);
    arq.position.set(sx * a / 2, y1 + 0.3, 0);
    g.add(arq);
  }
  const oculo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 24), pedraEscura);
  oculo.position.set(0, y1 + 0.3 + alturaOgiva(a / 2, a * 0.75) + 0.26, 0);
  g.add(oculo);
  // peitoril saliente e cornija no topo
  const peitoril = new THREE.Mesh(new THREE.BoxGeometry(larg + 0.3, 0.1, 0.6), pedraEscura);
  peitoril.position.set(0, y0 - 0.05, 0);
  const cornija = new THREE.Mesh(new THREE.BoxGeometry(comprimento + 0.02, 0.22, 0.65), pedraEscura);
  cornija.position.set(0, altura + 0.11, 0);
  g.add(peitoril, cornija);
  return g;
}

/** Lustre de ferro com velas. Devolve o grupo, as chamas (pra tremular) e a luz. */
function lustre(alturaTeto) {
  const g = new THREE.Group();
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.022, 6, 40), ferro);
  anel.rotation.x = Math.PI / 2;
  const anel2 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.018, 6, 32), ferro);
  anel2.rotation.x = Math.PI / 2;
  anel2.position.y = 0.18;
  g.add(anel, anel2);
  // haste central com pinha
  const haste = new THREE.Mesh(geoFuste, ferro);
  haste.scale.set(0.02, 0.6, 0.02);
  haste.position.y = 0.1;
  const pinha = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), ferro);
  pinha.rotation.x = Math.PI;
  pinha.position.y = -0.25;
  g.add(haste, pinha);
  // correntes até o teto
  const subida = alturaTeto;
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const de = new THREE.Vector3(Math.cos(ang) * 0.6, 0, Math.sin(ang) * 0.6);
    const ate = new THREE.Vector3(0, subida, 0);
    const d = new THREE.Vector3().subVectors(ate, de);
    const c = new THREE.Mesh(geoFuste, ferro);
    c.scale.set(0.006, d.length(), 0.006);
    c.position.copy(de).addScaledVector(d, 0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.add(c);
    // braço curvo ligando anel interno ao externo
    const braco = new THREE.Mesh(geoFuste, ferro);
    braco.scale.set(0.012, 0.32, 0.012);
    braco.position.set(Math.cos(ang) * 0.46, 0.09, Math.sin(ang) * 0.46);
    braco.rotation.set(0, -ang, Math.PI / 2 - 0.55);
    g.add(braco);
  }
  // velas
  const chamas = [];
  const n = 10;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2;
    const x = Math.cos(ang) * 0.6;
    const z = Math.sin(ang) * 0.6;
    const prato = new THREE.Mesh(geoFuste, ferro);
    prato.scale.set(0.04, 0.012, 0.04);
    prato.position.set(x, 0.02, z);
    const altura = 0.1 + ((k * 7) % 5) * 0.015;
    const vela = new THREE.Mesh(geoFuste, cera);
    vela.scale.set(0.022, altura, 0.022);
    vela.position.set(x, 0.026 + altura / 2, z);
    const fogo = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), chama);
    fogo.scale.set(0.012, 0.03, 0.012);
    fogo.position.set(x, 0.026 + altura + 0.025, z);
    g.add(prato, vela, fogo);
    chamas.push({ fogo, fase: k * 1.7 });
  }
  const luz = new THREE.PointLight(0xffa955, 3.2, 10, 1.6);
  luz.position.y = 0.2;
  g.add(luz);
  return { g, chamas, luz };
}

// ---------------------------------------------------------------------------

export function criarNave({ comprimento }) {
  const grupo = new THREE.Group();
  const { xPilar, xParede, yArranque, vao, alturaParede } = NAVE;
  const zIni = 2.4;
  const nTramos = Math.ceil((comprimento + zIni + 1) / vao) + 1;
  const a = xPilar; // meio-vão do arco transversal
  const r = a * 1.5;
  const subida = alturaOgiva(a, r);
  const yApice = yArranque + subida;

  const geoTransversal = geoArco(a, r, 0.34, 0.42);
  const chamas = [];
  const luzes = [];

  for (let k = 0; k <= nTramos; k++) {
    const z = zIni - k * vao;
    // colunas dos dois lados
    for (const s of [-1, 1]) {
      const c = coluna(yArranque);
      c.position.set(s * xPilar, 0, z);
      grupo.add(c);
    }
    // arco transversal
    const arco = new THREE.Mesh(geoTransversal, pedra);
    arco.position.set(0, yArranque, z);
    grupo.add(arco);

    if (k === nTramos) break;
    const z1 = z - vao;
    // nervuras diagonais da abóbada (cruzaria) + chave no cruzamento
    for (const s of [-1, 1]) {
      const n = new THREE.Mesh(
        geoNervura(new THREE.Vector3(s * xPilar, yArranque, z), new THREE.Vector3(-s * xPilar, yArranque, z1), subida, 0.09),
        pedraEscura,
      );
      grupo.add(n);
    }
    const chave = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), pedraEscura);
    chave.position.set(0, yApice + 0.02, (z + z1) / 2);
    grupo.add(chave);
    // cumeeira (nervura longitudinal no topo)
    const cume = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, vao, 8), pedraEscura);
    cume.rotation.x = Math.PI / 2;
    cume.position.set(0, yApice, (z + z1) / 2);
    grupo.add(cume);

    // paredes com janela dos dois lados
    for (const s of [-1, 1]) {
      const p = paredeComJanela(vao, alturaParede);
      p.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      p.position.set(s * xParede, 0, (z + z1) / 2);
      grupo.add(p);
    }

    // lustre no meio do tramo (em naves longas, um sim um não, pra poupar luzes)
    if (k % (nTramos > 7 ? 2 : 1) === 0) {
      const l = lustre(yApice - 5.2);
      l.g.position.set(0, 5.2, (z + z1) / 2);
      grupo.add(l.g);
      chamas.push(...l.chamas);
      luzes.push(l.luz);
    }
  }

  return {
    grupo,
    atualizar(t) {
      for (const { fogo, fase } of chamas) {
        const f = 1 + Math.sin(t * 13 + fase) * 0.12 + Math.sin(t * 7.3 + fase * 2) * 0.08;
        fogo.scale.set(0.012 * (2 - f), 0.03 * f, 0.012 * (2 - f));
      }
      luzes.forEach((l, i) => (l.intensity = 3.2 + Math.sin(t * 9 + i) * 0.25 + Math.sin(t * 23 + i * 3) * 0.15));
    },
  };
}
