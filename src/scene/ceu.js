import * as THREE from 'three';
import { mulberry32 } from '../random/acaso.js';
import { texNebulosa, texPlaneta } from './texturas.js';

// Céu: panorama de nebulosa (Gemini) + campo de estrelas que piscam.
// O grupo acompanha a câmera, então o céu parece infinito.

const RAIO = 180;
// O panorama tem a via láctea no "equador". Giramos o céu pra faixa passar
// por cima da nave, no sentido do corredor (visível entre as nervuras e no fim).
const GIRO_CEU = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.15, 0.3, 1.25, 'YXZ'));
const GIRO3 = new THREE.Matrix3().setFromMatrix4(GIRO_CEU);
// eixo da faixa no mundo = Gᵀ·ŷ (estrelas mais densas perto dela)
const EIXO_FAIXA = new THREE.Vector3(0, 1, 0).applyMatrix3(GIRO3.clone().transpose()).normalize();

function criarNebulosa() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uGiro: { value: GIRO3 }, uPanorama: { value: texNebulosa } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform mat3 uGiro;
      uniform sampler2D uPanorama;
      varying vec3 vDir;
      void main() {
        vec3 d = uGiro * normalize(vDir);
        // equirretangular; u espelhado (x2) pra não ter emenda na volta
        float u = atan(d.z, d.x) / 6.2831853 + 0.5;
        float v = asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5;
        vec2 uv = vec2(u * 2.0, mix(0.04, 0.96, v));
        vec3 cor = texture2D(uPanorama, uv).rgb * 0.75;
        cor *= smoothstep(1.0, 0.75, abs(d.y));             // polos escuros
        cor += vec3(0.006, 0.005, 0.016);
        gl_FragColor = vec4(cor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const malha = new THREE.Mesh(new THREE.SphereGeometry(RAIO + 10, 64, 32), mat);
  malha.renderOrder = -2;
  malha.frustumCulled = false;
  return malha;
}

function criarEstrelas(n = 7000) {
  const rnd = mulberry32(1337);
  const pos = new Float32Array(n * 3);
  const cor = new Float32Array(n * 3);
  const tam = new Float32Array(n);
  const fase = new Float32Array(n);

  // base ortonormal da faixa, pra concentrar metade das estrelas nela
  const u = new THREE.Vector3(1, 0, 0).cross(EIXO_FAIXA).normalize();
  const v = EIXO_FAIXA.clone().cross(u);
  const d = new THREE.Vector3();
  const c = new THREE.Color();

  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      // uniforme na esfera
      const z = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      d.set(r * Math.cos(a), z, r * Math.sin(a));
    } else {
      // perto da faixa
      const a = rnd() * Math.PI * 2;
      const desvio = (rnd() + rnd() + rnd() - 1.5) * 0.25;
      d.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)).addScaledVector(EIXO_FAIXA, desvio).normalize();
    }
    d.multiplyScalar(RAIO).toArray(pos, i * 3);

    // temperatura: maioria branca-azulada, algumas amarelas/alaranjadas
    const t = rnd();
    if (t < 0.6) c.setHSL(0.6, 0.35, 0.85);
    else if (t < 0.85) c.setHSL(0.12, 0.25, 0.9);
    else if (t < 0.97) c.setHSL(0.08, 0.6, 0.75);
    else c.setHSL(0.75, 0.5, 0.8);
    c.toArray(cor, i * 3);

    const brilho = Math.pow(rnd(), 6); // poucas estrelas grandes
    tam[i] = 1.2 + brilho * 5.5;
    fase[i] = rnd() * 100;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  geo.setAttribute('tamanho', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('fase', new THREE.BufferAttribute(fase, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uTempo: { value: 0 },
      uPixel: { value: Math.min(devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float tamanho;
      attribute float fase;
      uniform float uTempo;
      uniform float uPixel;
      varying vec3 vCor;
      varying float vBrilho;
      void main() {
        vCor = color;
        float pisca = 0.65 + 0.35 * sin(uTempo * (0.6 + fract(fase) * 2.2) + fase);
        vBrilho = pisca;
        gl_PointSize = tamanho * uPixel * (0.85 + 0.3 * pisca);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCor;
      varying float vBrilho;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float r = length(p) * 2.0;
        float nucleo = smoothstep(1.0, 0.0, r);
        float a = pow(nucleo, 2.5) * vBrilho;
        gl_FragColor = vec4(vCor * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const pontos = new THREE.Points(geo, mat);
  pontos.renderOrder = -1;
  pontos.frustumCulled = false;
  return pontos;
}


// Planeta gigante com faixas e atmosfera azul, mais duas luas.
const DIR_SOL = new THREE.Vector3(-0.6, 0.35, 0.7).normalize();

function criarPlaneta() {
  const grupo = new THREE.Group();
  const corpo = new THREE.Mesh(
    new THREE.SphereGeometry(42, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { uSol: { value: DIR_SOL }, uMapa: { value: texPlaneta } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vLocal;
        varying vec3 vVista;
        void main() {
          vUv = uv;
          vLocal = normalize(position);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 m = modelMatrix * vec4(position, 1.0);
          vVista = normalize(cameraPosition - m.xyz);
          gl_Position = projectionMatrix * viewMatrix * m;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSol;
        uniform sampler2D uMapa;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vLocal;
        varying vec3 vVista;
        void main() {
          vec3 cor = texture2D(uMapa, vUv).rgb * 0.9;
          float luz = clamp(dot(vNormal, uSol), 0.0, 1.0);
          float borda = pow(1.0 - max(dot(vNormal, vVista), 0.0), 3.0);
          vec3 c = cor * (0.04 + luz * 1.1) + vec3(0.3, 0.6, 1.4) * borda * (0.25 + luz);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  corpo.rotation.set(0, -Math.PI / 2, 0.22); // emenda da textura fica do lado de trás; eixo inclinado
  grupo.add(corpo);

  // atmosfera: halo azul aditivo em volta
  const atmosfera = new THREE.Mesh(
    new THREE.SphereGeometry(46, 48, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: { uSol: { value: DIR_SOL } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vVista;
        void main() {
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 m = modelMatrix * vec4(position, 1.0);
          vVista = normalize(cameraPosition - m.xyz);
          gl_Position = projectionMatrix * viewMatrix * m;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSol;
        varying vec3 vNormal;
        varying vec3 vVista;
        void main() {
          float f = pow(max(dot(-vNormal, vVista), 0.0), 4.0);
          float luz = 0.35 + 0.65 * clamp(dot(-vNormal, uSol) + 0.4, 0.0, 1.0);
          vec3 c = vec3(0.25, 0.55, 1.3) * f * luz * 1.0;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  grupo.add(atmosfera);

  const matLua = new THREE.MeshStandardMaterial({ color: 0x9a948c, roughness: 0.95, fog: false });
  for (const [x, y, z, r] of [[-70, 18, 10, 3.2], [-48, -6, 30, 1.6]]) {
    const lua = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), matLua);
    lua.position.set(x, y, z);
    grupo.add(lua);
  }

  // longe, acima e um pouco à direita do fim da nave (visível entre as nervuras)
  grupo.position.set(18, 40, -125);
  return grupo;
}

export function criarCeu() {
  const grupo = new THREE.Group();
  const nebulosa = criarNebulosa();
  const estrelas = criarEstrelas();
  grupo.add(nebulosa, estrelas, criarPlaneta());

  return {
    grupo,
    raio: RAIO,
    atualizar(tempo, posCamera) {
      grupo.position.copy(posCamera);
      estrelas.material.uniforms.uTempo.value = tempo;
    },
  };
}
