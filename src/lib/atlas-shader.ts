import * as THREE from 'three';

export type DentalFarAO = { value: number };
type Tissue = 'enamel' | 'cementum' | 'gum';
type Options = {
  wrap?: number;
  scatterColor?: number;
  transColor?: number;
  transScale?: number;
  transPower?: number;
  transDistortion?: number;
  aoIndirect?: number;
  aoDirect?: number;
};

// This is the physical lighting hook in Three r186; tests pin it against the installed chunk.
export const DENTAL_DIRECT_DIFFUSE =
  'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );';

const GUM_ZONE_GLSL = `
float dentalZone5( float p, float a, float b, float c, float d, float e ) {
  float x = clamp( p, 0.0, 1.0 ) * 4.0;
  vec4 w1 = clamp( 1.0 - abs( vec4( x ) - vec4( 0.0, 1.0, 2.0, 3.0 ) ), 0.0, 1.0 );
  float w5 = clamp( 1.0 - abs( x - 4.0 ), 0.0, 1.0 );
  return dot( w1, vec4( a, b, c, d ) ) + w5 * e;
}`;

/** Baked channels: R near AO, G thickness, B tissue zone/height, A far-mouth AO. */
export function patchAtlasMaterial(
  material: THREE.MeshPhysicalMaterial,
  kind: Tissue,
  farAO: DentalFarAO,
  options: Options = {},
) {
  const uniforms = {
    uWrap: { value: options.wrap ?? 0.3 },
    uScatterColor: { value: new THREE.Color(options.scatterColor ?? 0xff5a40) },
    uTransColor: { value: new THREE.Color(options.transColor ?? 0xff8a60) },
    uTransScale: { value: options.transScale ?? 1 },
    uTransPower: { value: options.transPower ?? 3 },
    uTransDistortion: { value: options.transDistortion ?? 0.2 },
    uAOIndirect: { value: options.aoIndirect ?? 1 },
    uAODirect: { value: options.aoDirect ?? 0.35 },
    uFarAO: farAO,
  };
  material.userData.tissue = uniforms;
  const gum = kind === 'gum';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec4 dentalData;\nvarying vec4 vDental;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDental = dentalData;');
    const bumpMask = gum
      ? 'return saturate( 1.0 - abs( vDental.b - 0.25 ) * 7.0 ) + 0.35 * saturate( 1.0 - abs( vDental.b - 0.75 ) * 7.0 );'
      : 'return smoothstep( 0.02, 0.12, vDental.b ) * ( 1.0 - smoothstep( 0.82, 0.98, vDental.b ) );';
    let fragment = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uWrap, uTransScale, uTransPower, uTransDistortion, uAOIndirect, uAODirect, uFarAO;
uniform vec3 uScatterColor, uTransColor;
varying vec4 vDental;
float dentalAO() { return clamp( vDental.r * mix( 1.0, vDental.a, uFarAO ), 0.0, 1.0 ); }
float dentalBumpMask() { ${bumpMask} }
${gum ? GUM_ZONE_GLSL : ''}`,
      )
      .replace(
        '#include <bumpmap_pars_fragment>',
        THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll(
          'bumpScale *',
          'bumpScale * dentalBumpMask() *',
        ),
      )
      .replace(
        '#include <lights_physical_pars_fragment>',
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          DENTAL_DIRECT_DIFFUSE,
          `
  float NdLraw = dot( geometryNormal, directLight.direction );
  float wrapNL = saturate( ( NdLraw + uWrap ) / ( 1.0 + uWrap ) );
  vec3 scatterIrr = directLight.color * max( wrapNL - saturate( NdLraw ), 0.0 ) * uScatterColor;
  reflectedLight.directDiffuse += ( irradiance + scatterIrr ) * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );`,
        ),
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
  {
    float transK = uTransScale${gum ? ' * dentalZone5( vDental.b, 0.8, 0.8, 1.0, 0.4, 0.9 )' : ''};
    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
      vec3 Lt = normalize( directionalLights[ i ].direction + geometryNormal * uTransDistortion );
      float t = pow( saturate( dot( geometryViewDir, -Lt ) ), uTransPower ) * transK;
      reflectedLight.directDiffuse += directionalLights[ i ].color * t * ( 1.0 - vDental.g ) * uTransColor * material.diffuseContribution;
    }
  }
#endif`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
  {
    float vao = mix( 1.0, dentalAO(), uAOIndirect );
    reflectedLight.indirectDiffuse *= vao;
    reflectedLight.directDiffuse *= mix( 1.0, vDental.r, uAODirect ) * mix( 1.0, vDental.a, 0.5 * uFarAO );
    #if defined( USE_CLEARCOAT )
      clearcoatSpecularIndirect *= vao;
    #endif
    float dotNVao = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNVao, vao, material.roughness );
  }`,
      );
    if (gum) {
      fragment = fragment
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
  roughnessFactor = dentalZone5( vDental.b, 0.46, 0.52, 0.42, 0.52, 0.42 );`,
        )
        .replace(
          '#include <lights_physical_fragment>',
          `#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
    material.clearcoat = dentalZone5( vDental.b, 0.25, 0.18, 0.28, 0.20, 0.28 );
    material.clearcoatRoughness = min( max( dentalZone5( vDental.b, 0.22, 0.28, 0.20, 0.25, 0.20 ), 0.0525 ) + geometryRoughness, 1.0 );
  #endif`,
        );
    }
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => `dental-${kind}-v3`;
  return material;
}

/** Three's clone/copy deliberately omits program callbacks and copies userData as JSON. */
export function preserveMaterialProgram<T extends THREE.Material>(
  target: T,
  source: THREE.Material,
): T {
  target.onBeforeCompile = source.onBeforeCompile;
  target.customProgramCacheKey = source.customProgramCacheKey;
  if (source.userData.tissue) target.userData.tissue = source.userData.tissue;
  return target;
}
