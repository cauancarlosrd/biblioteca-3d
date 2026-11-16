import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { texLajes } from './texturas.js';

// Chão: lajes de pedra antigas, levemente úmidas (um reflexo discreto por baixo).

const TAMANHO = 600;
const ESCALA_REFLEXO = 0.5; // resolução do reflexo em relação à tela

export function criarChao(renderer, { corredor = 1.8 } = {}) {
  const grupo = new THREE.Group();

  const tamanhoReflexo = () => {
    const px = renderer.getPixelRatio() * ESCALA_REFLEXO;
    return [Math.round(innerWidth * px), Math.round(innerHeight * px)];
  };
  const [w, h] = tamanhoReflexo();
  const espelho = new Reflector(new THREE.PlaneGeometry(TAMANHO, TAMANHO), {
    textureWidth: w,
    textureHeight: h,
    color: 0x17161c, // escurece e tinge o reflexo
    clipBias: 0.003,
  });
  espelho.rotation.x = -Math.PI / 2;
  grupo.add(espelho);

  // placas metálicas (textura do Gemini) por cima do espelho, deixando o reflexo aparecer
  const grade = new THREE.Mesh(
    new THREE.PlaneGeometry(TAMANHO, TAMANHO),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCamera: { value: new THREE.Vector3() },
        uTempo: { value: 0 },
        uPiso: { value: texLajes },
        uNevoa: { value: new THREE.Color(0x07061a) },
        uCorredor: { value: corredor },
      },
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
        uniform sampler2D uPiso;
        uniform vec3 uNevoa;
        uniform float uCorredor;
        varying vec3 vMundo;
        void main() {
          vec2 p = vMundo.xz;
          float d = distance(p, uCamera.xz);
          vec3 piso = texture2D(uPiso, p / 3.2).rgb;
          vec3 cor = piso * piso * 0.75;           // escurece e dá contraste
          float alfa = 0.93;                        // pedra: só um brilho úmido bem discreto
          // poça de luz quente sob os pés
          cor += vec3(1.0, 0.72, 0.45) * exp(-d * d * 0.25) * 0.05;
          // longe, dissolve na névoa
          float f = smoothstep(10.0, 48.0, d);
          cor = mix(cor, uNevoa, f);
          alfa = mix(alfa, 1.0, f);
          gl_FragColor = vec4(cor, alfa);
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
