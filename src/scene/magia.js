import * as THREE from 'three';
import { mulberry32 } from '../random/acaso.js';

// Luz que te acompanha + poeira mágica flutuando no ar.

const OFFSET_ORBE = new THREE.Vector3(0.55, 0.28, -1.3); // no espaço da câmera
const CAIXA = new THREE.Vector3(24, 7, 24); // volume de poeira ao redor da câmera

// Luz quente invisível que acompanha a câmera (o orbe visível atrapalhava a visão).
function criarOrbe() {
  const grupo = new THREE.Group();
  const luz = new THREE.PointLight(0xffcf8f, 5, 10, 1.4);
  grupo.add(luz);
  return { grupo, luz };
}

function criarPoeira(n = 1800) {
  const rnd = mulberry32(7);
  const pos = new Float32Array(n * 3);
  const extra = new Float32Array(n * 3); // tamanho, fase, matiz
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rnd() * CAIXA.x;
    pos[i * 3 + 1] = rnd() * CAIXA.y;
    pos[i * 3 + 2] = rnd() * CAIXA.z;
    extra[i * 3] = 0.6 + Math.pow(rnd(), 3) * 2.2;
    extra[i * 3 + 1] = rnd() * 100;
    extra[i * 3 + 2] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('extra', new THREE.BufferAttribute(extra, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTempo: { value: 0 },
      uCamera: { value: new THREE.Vector3() },
      uCaixa: { value: CAIXA },
      uEscala: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 extra;
      uniform float uTempo;
      uniform vec3 uCamera;
      uniform vec3 uCaixa;
      uniform float uEscala;
      varying vec3 vCor;
      varying float vAlfa;
      void main() {
        float fase = extra.y;
        // sobe devagar e balança
        vec3 p = position + vec3(
          sin(uTempo * 0.3 + fase) * 0.4,
          uTempo * (0.05 + fract(fase) * 0.08),
          cos(uTempo * 0.25 + fase * 1.3) * 0.4);
        // embrulha numa caixa centrada na câmera (poeira infinita)
        vec3 base = vec3(uCamera.x, 0.0, uCamera.z) - vec3(uCaixa.x, 0.0, uCaixa.z) * 0.5;
        p = mod(p - base, uCaixa) + base;
        // some nas bordas da caixa e muito perto do olho
        vec3 rel = (p - base) / uCaixa;
        vec3 borda = smoothstep(0.0, 0.12, rel) * smoothstep(1.0, 0.88, rel);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        vAlfa = borda.x * borda.y * borda.z * smoothstep(0.3, 1.2, dist);
        vAlfa *= 0.55 + 0.45 * sin(uTempo * 1.5 + fase * 3.0);
        // ouro na maioria, alguns ciano/violeta
        vCor = extra.z < 0.75 ? vec3(1.0, 0.75, 0.4) : (extra.z < 0.9 ? vec3(0.45, 0.8, 1.0) : vec3(0.8, 0.5, 1.0));
        gl_PointSize = extra.x * uEscala * 18.0 / dist;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCor;
      varying float vAlfa;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(smoothstep(1.0, 0.0, r), 2.0) * vAlfa;
        gl_FragColor = vec4(vCor * a * 1.6, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.frustumCulled = false;
  return pontos;
}

export function criarMagia(cena, camera, renderer) {
  const orbe = criarOrbe();
  const poeira = criarPoeira();
  cena.add(orbe.grupo, poeira);

  const alvo = new THREE.Vector3();
  let primeiro = true;

  return {
    atualizar(dt, tempo) {
      // o orbe segue um ponto à direita da câmera, com atraso (parece vivo)
      alvo.copy(OFFSET_ORBE);
      alvo.x += Math.sin(tempo * 0.7) * 0.06;
      alvo.y += Math.sin(tempo * 1.3) * 0.05;
      camera.localToWorld(alvo);
      if (primeiro) {
        orbe.grupo.position.copy(alvo);
        primeiro = false;
      } else {
        orbe.grupo.position.lerp(alvo, 1 - Math.exp(-dt * 3.5));
      }
      const pulso = 0.5 + 0.5 * Math.sin(tempo * 2.1);
      orbe.luz.intensity = 4.5 + pulso;

      const u = poeira.material.uniforms;
      u.uTempo.value = tempo;
      u.uCamera.value.copy(camera.position);
      u.uEscala.value = renderer.domElement.height / 800;
    },
  };
}
