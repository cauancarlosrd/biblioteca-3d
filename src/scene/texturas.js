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
export const texPedra = carregar('pedra.jpg', { repetir: true });
export const texMadeira = carregar('madeira.jpg', { repetir: true });
export const texLajes = carregar('lajes.jpg', { repetir: true });
export const texRosacea = carregar('rosacea.jpg');
export const texNebulosa = carregar('nebulosa.jpg', { repetir: true });
export const texPlaneta = carregar('planeta.jpg');
// galáxia NGC 1827 (Hubble — NASA/ESA), fundo preto: somada ao céu
export const texGalaxia = carregar('galaxia-ngc1827.jpg');
// o mesmo panorama, como mapa de ambiente: a luz do espaço "reflete" dentro da nave
export const texAmbiente = carregar('nebulosa.jpg');
texAmbiente.mapping = THREE.EquirectangularReflectionMapping;

export const N_LOMBADAS = 8; // faixas verticais de 128 px no atlas

/**
 * Material de livro: a face da frente (+z, lombada) usa uma faixa do atlas;
 * topo, base e fundo viram páginas cor de papel.
 * instanciado=true lê o índice do atributo aLombada; senão, do uniforme uLombada.
 * Índice 0–7 = faixa; 8–15 = mesma faixa de cabeça pra baixo.
 */
// faixa do atlas que é tecido cinza neutro: a que recebe a cor da capa
export const LOMBADA_NEUTRA = 6;
const LUM_NEUTRA = '0.127'; // luminância média (linear) dessa faixa

export function materialLivro({ instanciado = true, cor } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: texLombadas, roughness: 0.72, color: cor });
  const uLombada = { value: 0 };
  m.userData.uLombada = uLombada;
  m.onBeforeCompile = (s) => {
    s.uniforms.uLombada = uLombada;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        ${instanciado ? 'attribute float aLombada;' : 'uniform float uLombada;'}
        varying float vPagina;
        varying float vTinta;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        {
          float idx = ${instanciado ? 'aLombada' : 'uLombada'};
          vTinta = 0.0;
          if (idx > 15.5) { vTinta = 1.0; idx -= 16.0; }
          vec2 u = vMapUv;
          if (idx > 7.5) { u.y = 1.0 - u.y; idx -= 8.0; }
          vMapUv = vec2((idx + mix(0.035, 0.965, u.x)) / ${N_LOMBADAS}.0, u.y);
          vPagina = (abs(normal.y) > 0.5 || normal.z < -0.5) ? 1.0 : 0.0;
        }`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPagina;\nvarying float vTinta;')
      .replace('#include <map_fragment>', `
        vec4 texel = texture2D(map, vMapUv);
        if (vTinta > 0.5) {
          // lombada de tecido neutra tingida com a cor da capa; o dourado continua dourado
          float mx = max(texel.r, max(texel.g, texel.b));
          float mn = min(texel.r, min(texel.g, texel.b));
          float ouro = smoothstep(0.3, 0.55, (mx - mn) / max(mx, 1e-3)) * step(texel.b, texel.r);
          float lum = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722)) / ${LUM_NEUTRA};
          diffuseColor.rgb = mix(clamp(lum, 0.0, 2.0) * ${instanciado ? 'vColor' : 'diffuse'}, texel.rgb * 1.3, ouro);
        } else {
          diffuseColor *= texel;
        }
        if (vPagina > 0.5) diffuseColor.rgb = vec3(0.80, 0.75, 0.64);`)
      .replace('#include <color_fragment>', 'if (vTinta < 0.5) {\n#include <color_fragment>\n}');
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
