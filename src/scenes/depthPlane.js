import * as THREE from 'three';

const vertexShader = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float d = texture2D(uDepth, uv).r;
    p.z += d * uDepthScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uFog;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    c.rgb = mix(c.rgb, uFogColor, uFog);
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
    if (gl_FragColor.a < 0.003) discard;
  }
`;

export function createDepthPlane({ colorTex, depthTex, size = 16, segments = 128, depthScale = 2.5 }) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: colorTex },
      uDepth: { value: depthTex },
      uDepthScale: { value: depthScale },
      uOpacity: { value: 0 },
      uFog: { value: 0 },
      uFogColor: { value: new THREE.Color('#0a0d12') },
    },
  });
  return new THREE.Mesh(geo, mat);
}
