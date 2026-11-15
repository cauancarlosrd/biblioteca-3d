import * as THREE from 'three';
import { hash } from '../random/acaso.js';
import { criarCeu } from './ceu.js';
import { criarChao } from './chao.js';

// Dimensões em metros
const CASE_W = 2.4;
const CASE_H = 2.6;
const CASE_D = 0.42;
const PRATELEIRAS = 6;
const TABUA = 0.04;
const VAO = (CASE_H - TABUA) / PRATELEIRAS;
const CORREDOR = 1.8; // metade da largura do corredor
const PASSO = CASE_W + 0.12;
const OLHO = 1.55;

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const EIXO_Y = new THREE.Vector3(0, 1, 0);

function texturaLivro() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, '#b8b8b8');
  grad.addColorStop(0.5, '#e6e6e6');
  grad.addColorStop(1, '#b0b0b0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#fff4d0';
  for (const y of [22, 32, 220, 230]) g.fillRect(0, y, 64, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaRotulo(texto, sub) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#2b1d12';
  g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = '#a8834f';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 1008, 144);
  g.fillStyle = '#f1dfbf';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let tam = 64;
  g.font = `600 ${tam}px Georgia, serif`;
  while (g.measureText(texto).width > 960 && tam > 28) g.font = `600 ${(tam -= 4)}px Georgia, serif`;
  g.fillText(texto, 512, sub ? 68 : 82);
  if (sub) {
    g.fillStyle = '#b89a6e';
    g.font = 'italic 30px Georgia, serif';
    g.fillText(sub, 512, 124);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function corDoLivro(livro) {
  const h = hash(livro.titulo);
  const c = new THREE.Color();
  c.setHSL((h % 360) / 360, 0.3 + ((h >> 9) % 30) / 100, 0.22 + ((h >> 17) % 22) / 100);
  return c;
}

function rotuloDaPasta(pasta) {
  const partes = pasta.split('/');
  if (partes.length === 1) return { texto: 'Avulsos', sub: partes[0] };
  const resto = partes.slice(1);
  return { texto: resto[resto.length - 1], sub: resto.length > 1 ? resto.slice(0, -1).join(' › ') : null };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function criarBiblioteca(canvas, { aoEscolher, aoPassar }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x03020a);
  // a névoa só apaga as estantes distantes; céu e estrelas ignoram névoa
  cena.fog = new THREE.Fog(0x07061a, 10, 48);

  const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 400);
  camera.rotation.order = 'YXZ';
  cena.add(camera);

  const ceu = criarCeu();
  cena.add(ceu.grupo);
  const chao = criarChao(renderer);
  cena.add(chao.grupo);

  cena.add(new THREE.HemisphereLight(0xb4bcff, 0x24163f, 0.75));
  const luar = new THREE.DirectionalLight(0x9aa6ff, 0.5);
  luar.position.set(-3, 10, 4);
  cena.add(luar);
  const lanterna = new THREE.PointLight(0xffcf8f, 5, 10, 1.4);
  lanterna.position.set(0, 0.3, 0);
  camera.add(lanterna);

  const geoCaixa = new THREE.BoxGeometry(1, 1, 1);
  const matLivro = new THREE.MeshStandardMaterial({ map: texturaLivro(), roughness: 0.7 });
  const matMadeira = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.8 });

  // destaque do "livro do acaso"
  const brilho = new THREE.Mesh(
    geoCaixa,
    new THREE.MeshBasicMaterial({
      color: 0xffc46a,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  brilho.matrixAutoUpdate = false;
  brilho.visible = false;
  cena.add(brilho);
  const luzDestaque = new THREE.PointLight(0xffb85c, 0, 3, 1.5);
  cena.add(luzDestaque);

  let grupo = new THREE.Group();
  cena.add(grupo);
  let livros = [];
  let dados = []; // { matriz, normal, posicao }
  let malha = null;
  let fileiras = 1;
  let destacado = -1;
  let puxado = null; // { i, mesh, ida: {p0,q0,p1,p2,q2,s} }
  let animacoes = [];

  // ---------------- montagem ----------------
  function montar(lista) {
    cena.remove(grupo);
    grupo.traverse((o) => {
      if (o.material?.map && o.material !== matLivro) o.material.map.dispose();
      if (o.isMesh && o.material !== matLivro && o.material !== matMadeira) o.material.dispose();
    });
    grupo = new THREE.Group();
    cena.add(grupo);
    livros = lista;
    dados = [];
    destacado = -1;
    brilho.visible = false;
    luzDestaque.intensity = 0;

    const tabuas = [];
    let estante = -1;
    let matrizEstante = null;
    let lado = 1;
    let prat = 0;
    let x = 0;
    const xMin = -CASE_W / 2 + TABUA + 0.01;
    const xMax = CASE_W / 2 - TABUA - 0.01;

    function novaEstante(pasta, continuacao) {
      estante++;
      lado = estante % 2 === 0 ? -1 : 1;
      const fileira = Math.floor(estante / 2);
      const pos = new THREE.Vector3(lado * (CORREDOR + CASE_D / 2), 0, -fileira * PASSO - CASE_W / 2);
      const q = new THREE.Quaternion().setFromAxisAngle(EIXO_Y, lado < 0 ? Math.PI / 2 : -Math.PI / 2);
      matrizEstante = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
      prat = 0;
      x = xMin;

      const local = (px, py, pz, sx, sy, sz) =>
        tabuas.push(
          matrizEstante.clone().multiply(new THREE.Matrix4().compose(
            new THREE.Vector3(px, py, pz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz),
          )),
        );
      local(-CASE_W / 2 + TABUA / 2, CASE_H / 2, 0, TABUA, CASE_H, CASE_D);
      local(CASE_W / 2 - TABUA / 2, CASE_H / 2, 0, TABUA, CASE_H, CASE_D);
      local(0, CASE_H / 2, -CASE_D / 2 + TABUA / 2, CASE_W, CASE_H, TABUA);
      for (let k = 0; k <= PRATELEIRAS; k++) local(0, k * VAO + TABUA / 2, 0, CASE_W, TABUA, CASE_D);

      const { texto, sub } = rotuloDaPasta(pasta);
      const placa = new THREE.Mesh(
        new THREE.PlaneGeometry(CASE_W * 0.9, CASE_W * 0.9 * (160 / 1024)),
        new THREE.MeshBasicMaterial({ map: texturaRotulo(continuacao ? `${texto} (cont.)` : texto, sub), fog: true }),
      );
      placa.applyMatrix4(matrizEstante.clone().multiply(new THREE.Matrix4().makeTranslation(0, CASE_H + 0.2, CASE_D / 2)));
      grupo.add(placa);
    }

    let pastaAtual = null;
    for (const livro of lista) {
      const espessura = Math.min(0.09, Math.max(0.025, 0.018 + Math.sqrt(livro.tamanho / 1e6) * 0.011));
      const hh = hash(livro.id);
      const altura = 0.25 + (hh % 100) / 900;
      const prof = 0.18 + ((hh >> 8) % 80) / 1000;

      if (livro.pasta !== pastaAtual) {
        pastaAtual = livro.pasta;
        novaEstante(livro.pasta, false);
      } else if (x + espessura > xMax) {
        prat++;
        x = xMin;
        if (prat >= PRATELEIRAS) novaEstante(livro.pasta, true);
      }
      const base = (PRATELEIRAS - 1 - prat) * VAO + TABUA;
      const local = new THREE.Matrix4().compose(
        new THREE.Vector3(x + espessura / 2, base + altura / 2, CASE_D / 2 - prof / 2 - 0.015),
        new THREE.Quaternion(),
        new THREE.Vector3(espessura, altura, prof),
      );
      x += espessura + 0.002;
      const matriz = matrizEstante.clone().multiply(local);
      dados.push({
        matriz,
        normal: new THREE.Vector3(-lado, 0, 0),
        posicao: new THREE.Vector3().setFromMatrixPosition(matriz),
      });
    }
    fileiras = Math.floor(estante / 2) + 1;

    const tabuasMesh = new THREE.InstancedMesh(geoCaixa, matMadeira, tabuas.length);
    tabuas.forEach((m, i) => tabuasMesh.setMatrixAt(i, m));
    grupo.add(tabuasMesh);

    malha = new THREE.InstancedMesh(geoCaixa, matLivro, Math.max(1, lista.length));
    malha.count = lista.length;
    lista.forEach((l, i) => {
      malha.setMatrixAt(i, dados[i].matriz);
      malha.setColorAt(i, corDoLivro(l));
    });
    malha.computeBoundingSphere();
    grupo.add(malha);

    pos.set(0, OLHO, 2.5);
    yaw = 0;
    pitch = -0.05;
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
    pos.z = Math.max(-fileiras * PASSO - 0.5, Math.min(5, pos.z));
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

  // ---------------- animações ----------------
  function animar(dur, passo) {
    return new Promise((res) => animacoes.push({ t: 0, dur, passo, res }));
  }

  function alvoNaFrente() {
    const frente = new THREE.Vector3(0, -0.05, -0.8).applyQuaternion(camera.quaternion);
    const p2 = camera.position.clone().add(frente);
    const q2 = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EIXO_Y, -Math.PI / 2));
    return { p2, q2 };
  }

  async function puxar(i) {
    if (puxado) return;
    const d = dados[i];
    const p0 = new THREE.Vector3();
    const q0 = new THREE.Quaternion();
    const s = new THREE.Vector3();
    d.matriz.decompose(p0, q0, s);
    const cor = new THREE.Color();
    malha.getColorAt(i, cor);
    const mesh = new THREE.Mesh(geoCaixa, new THREE.MeshStandardMaterial({ map: matLivro.map, color: cor, roughness: 0.7 }));
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
    await animar(0.55, (t) => {
      const e = ease(t);
      mesh.position.lerpVectors(p1, p2, e);
      mesh.quaternion.slerpQuaternions(q0, q2, e);
    });
  }

  async function devolver() {
    if (!puxado) return;
    const { i, mesh, p0, q0, p1 } = puxado;
    const pA = mesh.position.clone();
    const qA = mesh.quaternion.clone();
    await animar(0.5, (t) => {
      const e = ease(t);
      mesh.position.lerpVectors(pA, p1, e);
      mesh.quaternion.slerpQuaternions(qA, q0, e);
    });
    await animar(0.3, (t) => mesh.position.lerpVectors(p1, p0, ease(t)));
    cena.remove(mesh);
    mesh.material.dispose();
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

  // ---------------- loop ----------------
  function redimensionar() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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
      }
      aoPassar?.(i, ponteiro.x, ponteiro.y);
    }

    renderer.render(cena, camera);
  });

  return {
    montar,
    puxar,
    devolver,
    voarAte,
    destacar,
    get destacado() { return destacado; },
  };
}
