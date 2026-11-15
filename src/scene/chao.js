import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// Chão de vidro escuro: reflete o céu e as estantes, com uma grade
// dourada bem fraca que some com a distância e um halo sob os pés.

const TAMANHO = 600;
const ESCALA_REFLEXO = 0.5; // resolução do reflexo em relação à tela

export function criarChao(renderer) {
  const grupo = new THREE.Group();

  const tamanhoReflexo = () => {
    const px = renderer.getPixelRatio() * ESCALA_REFLEXO;
    return [Math.round(innerWidth * px), Math.round(innerHeight * px)];
  };
  const [w, h] = tamanhoReflexo();
  const espelho = new Reflector(new THREE.PlaneGeometry(TAMANHO, TAMANHO), {
    textureWidth: w,
    textureHeight: h,
    color: 0x3a3850, // escurece e tinge o reflexo
    clipBias: 0.003,
  });
  espelho.rotation.x = -Math.PI / 2;
  grupo.add(espelho);

  const grade = new THREE.Mesh(
    new THREE.PlaneGeometry(TAMANHO, TAMANHO),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uCamera: { value: new THREE.Vector3() }, uTempo: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vMundo;
        void main() {
          vec4 m = modelMatrix * vec4(position, 1.0);
          vMundo = m.xyz;
          gl_Position = projectionMatrix * viewMatrix * m;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCamera;
        uniform float uTempo;
        varying vec3 vMundo;
        float linha(vec2 p, float passo) {
          vec2 g = abs(fract(p / passo - 0.5) - 0.5) / fwidth(p / passo);
          return 1.0 - min(min(g.x, g.y), 1.0);
        }
        void main() {
          vec2 p = vMundo.xz;
          float d = distance(p, uCamera.xz);
          float fina = linha(p, 1.0) * 0.35;
          float grossa = linha(p, 4.0);
          float fade = exp(-d * 0.09);
          vec3 ouro = vec3(0.95, 0.72, 0.40);
          vec3 cor = ouro * (fina + grossa) * 0.10 * fade;
          // halo do orbe/lanterna sob os pés
          float halo = exp(-d * d * 0.35) * (0.9 + 0.1 * sin(uTempo * 1.7));
          cor += vec3(1.0, 0.78, 0.5) * halo * 0.07;
          gl_FragColor = vec4(cor, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  grade.rotation.x = -Math.PI / 2;
  grade.position.y = 0.002;
  grade.renderOrder = 1;
  grupo.add(grade);

  // a grade não aparece dentro do próprio reflexo
  const renderReflexo = espelho.onBeforeRender;
  espelho.onBeforeRender = function (...args) {
    grade.visible = false;
    renderReflexo.apply(this, args);
    grade.visible = true;
  };

  return {
    grupo,
    atualizar(tempo, posCamera) {
      grade.material.uniforms.uCamera.value.copy(posCamera);
      grade.material.uniforms.uTempo.value = tempo;
    },
    redimensionar() {
      espelho.getRenderTarget().setSize(...tamanhoReflexo());
    },
  };
}
