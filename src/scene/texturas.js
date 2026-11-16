import * as THREE from 'three';

// Texturas geradas no Gemini (public/texturas) e os shaders que as aplicam.

const carregador = new THREE.TextureLoader();
const url = (nome) => `${import.meta.env.BASE_URL}texturas/${nome}`;

function carregar(nome, { repetir = false, cor = true } = {}) {
  const t = carregador.load(url(nome));
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repetir) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; // espelhar esconde emendas
  return t;
}

export const texLombadas = carregar('lombadas.jpg');
export const texMetal = carregar('metal.jpg', { repetir: true });
export const texPiso = carregar('piso.jpg', { repetir: true });

export const N_LOMBADAS = 8; // faixas verticais de 128 px no atlas

/**
 * Material de livro: a face da frente (+z, lombada) usa uma faixa do atlas;
 * topo, base e fundo viram páginas cor de papel.
 * instanciado=true lê o índice do atributo aLombada; senão, do uniforme uLombada.
 * Índice 0–7 = faixa; 8–15 = mesma faixa de cabeça pra baixo.
 */
export function materialLivro({ instanciado = true, cor } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: texLombadas, roughness: 0.72, color: cor });
  const uLombada = { value: 0 };
  m.userData.uLombada = uLombada;
  m.onBeforeCompile = (s) => {
    s.uniforms.uLombada = uLombada;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        ${instanciado ? 'attribute float aLombada;' : 'uniform float uLombada;'}
        varying float vPagina;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        {
          float idx = ${instanciado ? 'aLombada' : 'uLombada'};
          vec2 u = vMapUv;
          if (idx > 7.5) { u.y = 1.0 - u.y; idx -= 8.0; }
          vMapUv = vec2((idx + mix(0.035, 0.965, u.x)) / ${N_LOMBADAS}.0, u.y);
          vPagina = (abs(normal.y) > 0.5 || normal.z < -0.5) ? 1.0 : 0.0;
        }`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPagina;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vPagina > 0.5) diffuseColor.rgb = vec3(0.80, 0.75, 0.64);`);
  };
  m.customProgramCacheKey = () => (instanciado ? 'livro-inst' : 'livro-uni');
  return m;
}

/**
 * Projeção "triplanar simples": escolhe o plano pelo eixo dominante da normal
 * no mundo e amostra a textura pela posição no mundo. Nada estica, seja tábua
 * fina ou viga longa.
 */
export function aplicarMapaMundo(material, textura, metrosPorRepeticao) {
  material.map = textura;
  material.onBeforeCompile = (s) => {
    s.uniforms.uEscalaMundo = { value: 1 / metrosPorRepeticao };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;\nvarying vec3 vNormMundo;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        {
          mat4 mm = modelMatrix;
          #ifdef USE_INSTANCING
            mm = modelMatrix * instanceMatrix;
          #endif
          vPosMundo = (mm * vec4(position, 1.0)).xyz;
          vNormMundo = normalize(mat3(mm) * normal);
        }`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;\nvarying vec3 vNormMundo;\nuniform float uEscalaMundo;')
      .replace('#include <map_fragment>', `
        {
          vec3 n = abs(vNormMundo);
          vec2 uvM = n.x > max(n.y, n.z) ? vPosMundo.zy : (n.y > n.z ? vPosMundo.xz : vPosMundo.xy);
          vec4 sampledDiffuseColor = texture2D(map, uvM * uEscalaMundo);
          diffuseColor *= sampledDiffuseColor;
        }`);
  };
  material.customProgramCacheKey = () => `mundo-${metrosPorRepeticao}`;
  material.needsUpdate = true;
}
