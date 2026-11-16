import * as THREE from 'three';
import { texPedra, texMadeira, texRosacea, aplicarMapaMundo } from './texturas.js';

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
const madeiraAtril = new THREE.MeshStandardMaterial({ color: 0xb8a898, roughness: 0.65 });
aplicarMapaMundo(madeiraAtril, texMadeira, 0.8);
const couro = new THREE.MeshStandardMaterial({ color: 0x4a1a14, roughness: 0.6 });
const papel = new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.9 });
const vitral = new THREE.MeshBasicMaterial({ map: texRosacea, color: new THREE.Color(1.15, 1.1, 1.2), side: THREE.DoubleSide });
export const MATERIAIS_NAVE = [pedra, pedraEscura, ferro, cera, chama, madeiraAtril, couro, papel, vitral];

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
// fundo da nave

/** Parede do fundo: empena ogival, rosácea com vitral e arcada cega embaixo. */
function paredeFundo(xParede, altura, yApice) {
  const g = new THREE.Group();
  const meio = xParede + 0.25;
  const yRosa = 5.25;
  const rRosa = 1.7;
  const s = new THREE.Shape();
  s.moveTo(-meio, 0);
  s.lineTo(meio, 0);
  s.lineTo(meio, altura);
  // empena ogival até acima da abóbada
  const empena = pontosOgiva(meio, meio * 1.25).reverse();
  for (const p of empena) s.lineTo(p.x, altura + p.y * ((yApice + 1.6 - altura) / alturaOgiva(meio, meio * 1.25)));
  s.lineTo(-meio, 0);
  const furo = new THREE.Path();
  furo.absarc(0, yRosa, rRosa, 0, Math.PI * 2, true);
  s.holes.push(furo);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false, curveSegments: 48 });
  geo.translate(0, 0, -0.25);
  g.add(new THREE.Mesh(geo, pedra));

  // vitral + molduras de pedra (anel grosso na frente, anel fino atrás)
  const vidro = new THREE.Mesh(new THREE.CircleGeometry(rRosa, 64), vitral);
  vidro.position.set(0, yRosa, 0);
  g.add(vidro);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(rRosa + 0.02, 0.13, 10, 72), pedraEscura);
  anel.position.set(0, yRosa, 0.22);
  const anel2 = new THREE.Mesh(new THREE.TorusGeometry(rRosa + 0.25, 0.07, 8, 72), pedraEscura);
  anel2.position.set(0, yRosa, 0.24);
  g.add(anel, anel2);

  // arcada cega (5 nichos ogivais em relevo) abaixo da rosácea
  const n = 5;
  const larg = (2 * meio - 0.6) / n;
  for (let i = 0; i < n; i++) {
    const x = -meio + 0.3 + larg * (i + 0.5);
    const arq = new THREE.Mesh(geoArco(larg / 2 - 0.08, (larg / 2) * 1.5, 0.1, 0.12), pedraEscura);
    arq.position.set(x, 2.2, 0.28);
    g.add(arq);
    for (const sx of [-1, 1]) {
      const pil = new THREE.Mesh(geoFuste, pedraEscura);
      pil.scale.set(0.05, 2.2, 0.05);
      pil.position.set(x + sx * (larg / 2 - 0.08), 1.1, 0.3);
      g.add(pil);
    }
  }
  const friso = new THREE.Mesh(new THREE.BoxGeometry(2 * meio, 0.18, 0.2), pedraEscura);
  friso.position.set(0, 3.3, 0.32);
  g.add(friso);
  return g;
}

/** Castiçal de pé, de ferro, com um círio grosso. */
function castical() {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const ang = (k / 3) * Math.PI * 2;
    const pe = new THREE.Mesh(geoFuste, ferro);
    pe.scale.set(0.018, 0.32, 0.018);
    pe.position.set(Math.cos(ang) * 0.12, 0.11, Math.sin(ang) * 0.12);
    pe.rotation.set(Math.sin(ang) * 0.9, 0, -Math.cos(ang) * 0.9);
    g.add(pe);
  }
  const fuste = new THREE.Mesh(
    new THREE.LatheGeometry([[0.03, 0], [0.05, 0.05], [0.025, 0.12], [0.022, 0.7], [0.045, 0.75], [0.022, 0.8], [0.02, 1.35], [0.12, 1.4], [0.13, 1.43], [0, 1.43]].map(([x, y]) => new THREE.Vector2(x, y)), 12),
    ferro,
  );
  fuste.position.y = 0.2;
  g.add(fuste);
  const cirio = new THREE.Mesh(geoFuste, cera);
  cirio.scale.set(0.045, 0.34, 0.045);
  cirio.position.y = 1.63 + 0.17;
  const fogo = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), chama);
  fogo.scale.set(0.016, 0.04, 0.016);
  fogo.position.y = 1.63 + 0.34 + 0.035;
  g.add(cirio, fogo);
  return { g, chamas: [{ fogo, fase: Math.random() * 10, base: 0.016, alto: 0.04 }] };
}

/** Texto das páginas abertas do atril (canvas). */
function texturaPaginas(titulo, pasta) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 680;
  const g = c.getContext('2d');
  const papelGrad = g.createRadialGradient(512, 340, 100, 512, 340, 640);
  papelGrad.addColorStop(0, '#efe4c8');
  papelGrad.addColorStop(1, '#cdb98f');
  g.fillStyle = papelGrad;
  g.fillRect(0, 0, 1024, 680);
  // sombra da dobra no meio
  const dobra = g.createLinearGradient(452, 0, 572, 0);
  dobra.addColorStop(0, 'rgba(80,55,25,0)');
  dobra.addColorStop(0.5, 'rgba(80,55,25,0.45)');
  dobra.addColorStop(1, 'rgba(80,55,25,0)');
  g.fillStyle = dobra;
  g.fillRect(452, 0, 120, 680);
  g.fillStyle = '#5a1f14';
  g.textAlign = 'center';
  g.font = 'italic 600 46px Georgia, serif';
  g.fillText('O livro do acaso', 256, 150);
  g.font = 'italic 28px Georgia, serif';
  g.fillStyle = '#4a3418';
  for (const [i, l] of ['Entre tantos, este', 'esperou por você.', '', '— toque na página —'].entries()) g.fillText(l, 256, 250 + i * 46);
  g.fillStyle = '#8a6a30';
  g.font = '90px Georgia, serif';
  g.fillText('❦', 256, 560);
  // título quebrado em linhas na página direita
  g.fillStyle = '#2a1a0a';
  let tam = 52;
  const palavras = (titulo || '').split(/\s+/);
  let linhas;
  do {
    g.font = `600 ${tam}px Georgia, serif`;
    linhas = [];
    let atual = '';
    for (const p of palavras) {
      const t = atual ? `${atual} ${p}` : p;
      if (g.measureText(t).width > 400 && atual) {
        linhas.push(atual);
        atual = p;
      } else atual = t;
    }
    if (atual) linhas.push(atual);
    tam -= 4;
  } while (linhas.length * (tam + 12) > 380 && tam > 22);
  const y0 = 300 - (linhas.length * (tam + 14)) / 2;
  linhas.forEach((l, i) => g.fillText(l, 768, y0 + i * (tam + 14)));
  g.fillStyle = '#6a4a20';
  g.font = `italic 26px Georgia, serif`;
  g.fillText(pasta || '', 768, 560);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Atril de madeira com um livro aberto. definir(livro) troca o texto das páginas. */
function criarAtril() {
  const g = new THREE.Group();
  const pe = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [0.34, 0], [0.34, 0.06], [0.26, 0.1], [0.14, 0.16], [0.1, 0.22], [0, 0.22]].map(([x, y]) => new THREE.Vector2(x, y)), 8),
    madeiraAtril,
  );
  const coluna = new THREE.Mesh(
    new THREE.LatheGeometry([[0.1, 0], [0.075, 0.06], [0.065, 0.42], [0.09, 0.47], [0.065, 0.52], [0.058, 0.86], [0.1, 0.92], [0.12, 0.96], [0, 0.96]].map(([x, y]) => new THREE.Vector2(x, y)), 12),
    madeiraAtril,
  );
  coluna.position.y = 0.22;
  g.add(pe, coluna);
  // tampo inclinado (desce na direção de quem chega pelo corredor, +z)
  const tampo = new THREE.Group();
  tampo.position.set(0, 1.25, 0);
  tampo.rotation.x = 0.42;
  tampo.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 0.5), madeiraAtril));
  const aba = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.03), madeiraAtril);
  aba.position.set(0, 0.035, 0.24);
  tampo.add(aba);
  // livro aberto: capa de couro, miolo, páginas com texto
  const capa = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.012, 0.4), couro);
  capa.position.y = 0.024;
  const miolo = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.03, 0.37), papel);
  miolo.position.y = 0.045;
  const paginas = new THREE.Mesh(new THREE.PlaneGeometry(0.57, 0.37), new THREE.MeshBasicMaterial({ color: 0xc8bea8 }));
  paginas.rotation.x = -Math.PI / 2;
  paginas.position.y = 0.061;
  tampo.add(capa, miolo, paginas);
  g.add(tampo);
  return {
    g,
    paginas,
    definir(livro) {
      paginas.material.map?.dispose();
      paginas.material.map = texturaPaginas(livro?.titulo, livro?.pasta);
      paginas.material.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------------

export function criarNave({ comprimento }) {
  const grupo = new THREE.Group();
  const { xPilar, xParede, yArranque, vao, alturaParede } = NAVE;
  const zIni = 2.4;
  const ATRIO = 7.5; // espaço livre depois das estantes, antes da parede do fundo
  const nTramos = Math.ceil((comprimento + zIni + ATRIO) / vao);
  const zFundo = zIni - nTramos * vao;
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
    if (k % (nTramos > 4 ? 2 : 1) === 0) {
      const l = lustre(yApice - 5.2);
      l.g.position.set(0, 5.2, (z + z1) / 2);
      grupo.add(l.g);
      chamas.push(...l.chamas);
      luzes.push(l.luz);
    }
  }

  // ---- fundo: parede com rosácea, estrado e atril com o "livro do acaso" ----
  const parede = paredeFundo(xParede, alturaParede, yApice);
  parede.position.set(0, 0, zFundo - 0.35);
  grupo.add(parede);
  const luzVitral = new THREE.PointLight(0x9a70ff, 2.2, 14, 1.5);
  luzVitral.position.set(0, 5.0, zFundo + 1.2);
  grupo.add(luzVitral);

  const zAtril = (-comprimento + zFundo) / 2;
  for (const [w, d, h, y] of [[3.4, 2.8, 0.12, 0.06], [2.5, 2.0, 0.12, 0.18]]) {
    const degrau = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pedraEscura);
    degrau.position.set(0, y, zAtril);
    grupo.add(degrau);
  }
  const atril = criarAtril();
  atril.g.position.set(0, 0.24, zAtril);
  grupo.add(atril.g);
  for (const sx of [-1, 1]) {
    const c = castical();
    c.g.position.set(sx * 0.95, 0.24, zAtril - 0.35);
    grupo.add(c.g);
    chamas.push(...c.chamas);
  }
  const luzAtril = new THREE.PointLight(0xffb060, 2.6, 6, 1.6);
  luzAtril.position.set(0, 2.3, zAtril + 0.4);
  grupo.add(luzAtril);
  luzes.push(luzAtril);

  return {
    grupo,
    zFundo,
    zAtril,
    atril,
    atualizar(t) {
      for (const { fogo, fase, base = 0.012, alto = 0.03 } of chamas) {
        const f = 1 + Math.sin(t * 13 + fase) * 0.12 + Math.sin(t * 7.3 + fase * 2) * 0.08;
        fogo.scale.set(base * (2 - f), alto * f, base * (2 - f));
      }
      luzes.forEach((l, i) => (l.intensity = 3.2 + Math.sin(t * 9 + i) * 0.25 + Math.sin(t * 23 + i * 3) * 0.15));
    },
  };
}
