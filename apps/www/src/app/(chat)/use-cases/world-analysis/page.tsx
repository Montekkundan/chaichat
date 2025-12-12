'use client'

import type React from 'react'
import { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSidebar } from "~/components/ui/sidebar"
import { cn } from "~/lib/utils"
import { OverlayChat } from "./overlay-chat"
import MorphPanel from "./usecase-panel"
import { Button } from "~/components/ui/button"
import { Play, Pause } from "@phosphor-icons/react"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
function StarfieldMaterial() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
    }),
    [],
  );

  const vertexShader = `
    attribute float size;
    attribute vec3 customColor;
    varying vec3 vColor;
    uniform float uTime;

    void main() {
      vColor = customColor;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

      // Subtle star motion
      mvPosition.x += sin(uTime * 0.5 + position.y * 0.01) * 0.1;
      mvPosition.y += cos(uTime * 0.3 + position.x * 0.01) * 0.1;

      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    uniform float uTime;

    void main() {
      float d = distance(gl_PointCoord, vec2(0.5));
      float strength = 0.05 / d - 0.1;
      float twinkle = sin(uTime * 2.0 + gl_FragCoord.x * 0.01 + gl_FragCoord.y * 0.01) * 0.5 + 0.5;
      strength *= (0.7 + twinkle * 0.3);
      gl_FragColor = vec4(vColor, strength);
    }
  `;

  useFrame((state) => {
    if (materialRef.current?.uniforms?.uTime) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      transparent
      depthWrite={false}
      blending={THREE.AdditiveBlending}
    />
  );
}

function Starfield() {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, colors, sizes] = useMemo(() => {
    const count = 1400; // slightly reduced for perf
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 100 + 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const intensity = Math.random() * 0.5 + 0.5;
      colors[i * 3] = intensity;
      colors[i * 3 + 1] = intensity * (0.8 + Math.random() * 0.2);
      colors[i * 3 + 2] = intensity * (0.9 + Math.random() * 0.1);

      sizes[i] = Math.random() * 3 + 1;
    }

    return [positions, colors, sizes];
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-customColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <StarfieldMaterial />
    </points>
  );
}

// Load GLSL from colocated shader files
async function loadShaderText(publicPath: string): Promise<string> {
  try {
    const res = await fetch(publicPath, { cache: 'no-cache' });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

const earthVertexShaderInline = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    // Position
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    // Model normal
    vec3 modelNormal = (modelMatrix * vec4(normal, 0.0)).xyz;

    // Varyings
    vUv = uv;
    vNormal = modelNormal;
    vPosition = modelPosition.xyz;
}
`

const earthFragmentShaderInline = `
uniform sampler2D uDayTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uSpecularCloudsTexture;
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereDayColor;
uniform vec3 uAtmosphereTwilightColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);
    vec3 color = vec3(0.0);

    // Sun orientation
    float sunOrientation = dot(uSunDirection, normal);

    // Day / night color
    float dayMix = smoothstep(- 0.25, 0.5, sunOrientation);
    vec3 dayColor = texture(uDayTexture, vUv).rgb;
    vec3 nightColor = texture(uNightTexture, vUv).rgb;
    color = mix(nightColor, dayColor, dayMix);

    // Specular cloud color
    vec2 specularCloudsColor = texture(uSpecularCloudsTexture, vUv).rg;

    // Clouds
    float cloudsMix = smoothstep(0.5, 1.0, specularCloudsColor.g);
    cloudsMix *= dayMix;
    color = mix(color, vec3(1.0), cloudsMix);

    // Fresnel
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0);

    // Atmosphere
    float atmosphereDayMix = smoothstep(- 0.5, 1.0, sunOrientation);
    vec3 atmosphereColor = mix(uAtmosphereTwilightColor, uAtmosphereDayColor, atmosphereDayMix);
    color = mix(color, atmosphereColor, fresnel * atmosphereDayMix);

    // Specular
    vec3 reflection = reflect(- uSunDirection, normal);
    float specular = - dot(reflection, viewDirection);
    specular = max(specular, 0.0);
    specular = pow(specular, 32.0);
    specular *= specularCloudsColor.r;

    vec3 specularColor = mix(vec3(1.0), atmosphereColor, fresnel);
    color += specular * specularColor;

    // Final color
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`

const atmosphereVertexShaderInline = `
varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    // Position
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    // Model normal
    vec3 modelNormal = (modelMatrix * vec4(normal, 0.0)).xyz;

    // Varyings
    vNormal = modelNormal;
    vPosition = modelPosition.xyz;
}
`

const atmosphereFragmentShaderInline = `
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereDayColor;
uniform vec3 uAtmosphereTwilightColor;

varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);
    vec3 color = vec3(0.0);

    // Sun orientation
    float sunOrientation = dot(uSunDirection, normal);

    // Atmosphere
    float atmosphereDayMix = smoothstep(- 0.5, 1.0, sunOrientation);
    vec3 atmosphereColor = mix(uAtmosphereTwilightColor, uAtmosphereDayColor, atmosphereDayMix);
    color = mix(color, atmosphereColor, atmosphereDayMix);
    color += atmosphereColor;

    // Alpha
    float edgeAlpha = dot(viewDirection, normal);
    edgeAlpha = smoothstep(0.0, 0.5, edgeAlpha);

    float dayAlpha = smoothstep(- 0.5, 0.0, sunOrientation);

    float alpha = edgeAlpha * dayAlpha;

    // Final color
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`

// Earth parameters and GUI setup
const earthParameters: { atmosphereDayColor: string; atmosphereTwilightColor: string } = {
  atmosphereDayColor: '#00aaff',
  atmosphereTwilightColor: '#ff6600'
}
const DEFAULT_ATMOSPHERE = { day: '#00aaff', twilight: '#ff6600' } as const

const sunSpherical = new THREE.Spherical(1, Math.PI * 0.5, 0.5)
const sunDirection = new THREE.Vector3()

type OverlayPoint = { lat: number; lon: number; value?: number; color?: string; size?: number; label?: string };
type OverlayBar = { lat: number; lon: number; value?: number; height?: number; color?: string; radius?: number; label?: string };
// Highlight color defaults for geo masking
const HIGHLIGHT_COLORS = {
  basePlain: '#ffffff',        // outside areas
  highlightFill: '#064e3b',    // dark green for selected region
}

// Minimal GeoJSON types used for rendering
type SimpleGeoJSONGeometry = {
  type: 'Polygon' | 'MultiPolygon' | 'GeometryCollection' | 'LineString' | 'MultiLineString'
  coordinates?: number[][][] | number[][]
  geometries?: SimpleGeoJSONGeometry[]
}
type SimpleFeature = { type: 'Feature'; geometry: SimpleGeoJSONGeometry; properties?: Record<string, unknown> }
type SimpleFeatureCollection = { type: 'FeatureCollection'; features: SimpleFeature[] }

function EarthScene({
  rotateSpeed,
  points,
  bars,
  orientTo,
  overlayOffset,
  borders = [],
  textureOverride,
}: {
  rotateSpeed: number; points: OverlayPoint[]; bars: OverlayBar[]; orientTo?: { lat: number; lon: number } | null; overlayOffset: { lonDeg: number; latDeg: number };
  borders?: Array<Array<{ lat: number; lon: number }>>;
  textureOverride?: { day?: THREE.Texture | null; night?: THREE.Texture | null };
}) {
  const [earthVS, setEarthVS] = useState<string | null>(null)
  const [earthFS, setEarthFS] = useState<string | null>(null)

  // Load external shader sources once on mount. Fall back to inline if unavailable.
  useEffect(() => {
    let mounted = true
      ; (async () => {
        const [vs, fs] = await Promise.all([
          loadShaderText('/shaders/earth/vertex.glsl').catch(() => ''),
          loadShaderText('/shaders/earth/fragment.glsl').catch(() => ''),
        ])
        if (!mounted) return
        setEarthVS(vs && vs.trim().length > 0 ? vs : earthVertexShaderInline)
        setEarthFS(fs && fs.trim().length > 0 ? fs : earthFragmentShaderInline)
      })()
    return () => { mounted = false }
  }, [])
  const earthGroupRef = useRef<THREE.Group>(null)
  const earthRef = useRef<THREE.Mesh>(null)
  const atmosphereRef = useRef<THREE.Mesh>(null)
  const debugSunRef = useRef<THREE.Mesh>(null)
  const orientRef = useRef<{ lat: number; lon: number } | null>(null)
  const { camera } = useThree()

  // Loaders
  const textureLoader = useMemo(() => new THREE.TextureLoader(), [])

  // Textures - Note: These texture files need to be placed in /public/earth/
  const earthDayTexture = useMemo(() => {
    const texture = textureLoader.load('/earth/day.jpg')
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [textureLoader])

  const earthNightTexture = useMemo(() => {
    const texture = textureLoader.load('/earth/night.jpg')
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [textureLoader])

  const earthSpecularCloudsTexture = useMemo(() => {
    const texture = textureLoader.load('/earth/specularClouds.jpg')
    texture.anisotropy = 8
    return texture
  }, [textureLoader])

  // Materials
  const earthMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: earthVS ?? earthVertexShaderInline,
    fragmentShader: earthFS ?? earthFragmentShaderInline,
    uniforms: {
      uDayTexture: new THREE.Uniform(earthDayTexture),
      uNightTexture: new THREE.Uniform(earthNightTexture),
      uSpecularCloudsTexture: new THREE.Uniform(earthSpecularCloudsTexture),
      uSunDirection: new THREE.Uniform(new THREE.Vector3(0, 0, 1)),
      uAtmosphereDayColor: new THREE.Uniform(new THREE.Color(earthParameters.atmosphereDayColor)),
      uAtmosphereTwilightColor: new THREE.Uniform(new THREE.Color(earthParameters.atmosphereTwilightColor))
    }
  }), [earthDayTexture, earthNightTexture, earthSpecularCloudsTexture, earthVS, earthFS])

  const [atmVS, setAtmVS] = useState<string | null>(null)
  const [atmFS, setAtmFS] = useState<string | null>(null)

  const atmosphereMaterial = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    vertexShader: atmVS ?? atmosphereVertexShaderInline,
    fragmentShader: atmFS ?? atmosphereFragmentShaderInline,
    uniforms: {
      uSunDirection: new THREE.Uniform(new THREE.Vector3(0, 0, 1)),
      uAtmosphereDayColor: new THREE.Uniform(new THREE.Color(earthParameters.atmosphereDayColor)),
      uAtmosphereTwilightColor: new THREE.Uniform(new THREE.Color(earthParameters.atmosphereTwilightColor))
    },
  }), [atmVS, atmFS])

  // Load atmosphere shaders
  useEffect(() => {
    let mounted = true
      ; (async () => {
        const [vs, fs] = await Promise.all([
          loadShaderText('/shaders/atmosphere/vertex.glsl').catch(() => ''),
          loadShaderText('/shaders/atmosphere/fragment.glsl').catch(() => ''),
        ])
        if (!mounted) return
        setAtmVS(vs && vs.trim().length > 0 ? vs : atmosphereVertexShaderInline)
        setAtmFS(fs && fs.trim().length > 0 ? fs : atmosphereFragmentShaderInline)
      })()
    return () => { mounted = false }
  }, [])

  // Animation loop + sync GUI parameters to uniforms every frame
  useFrame((state, delta) => {
    // Slow rotation
    if (earthGroupRef.current && rotateSpeed > 0) {
      earthGroupRef.current.rotation.y += rotateSpeed * delta
    }
    // Sync sun direction from GUI spherical
    sunDirection.setFromSpherical(sunSpherical)
    earthMaterial.uniforms.uSunDirection?.value.copy(sunDirection)
    atmosphereMaterial.uniforms.uSunDirection?.value.copy(sunDirection)
    if (debugSunRef.current) {
      debugSunRef.current.position.copy(sunDirection).multiplyScalar(5)
    }
    // Sync colors from GUI params without recreating materials
    const dayCol = earthMaterial.uniforms.uAtmosphereDayColor?.value as THREE.Color | undefined
    if (dayCol) dayCol.set(earthParameters.atmosphereDayColor)
    const twiCol = earthMaterial.uniforms.uAtmosphereTwilightColor?.value as THREE.Color | undefined
    if (twiCol) twiCol.set(earthParameters.atmosphereTwilightColor)
    const aDayCol = atmosphereMaterial.uniforms.uAtmosphereDayColor?.value as THREE.Color | undefined
    if (aDayCol) aDayCol.set(earthParameters.atmosphereDayColor)
    const aTwiCol = atmosphereMaterial.uniforms.uAtmosphereTwilightColor?.value as THREE.Color | undefined
    if (aTwiCol) aTwiCol.set(earthParameters.atmosphereTwilightColor)
  })

  // Respond to texture overrides from outside (e.g., geo mask or custom base map)
  useEffect(() => {
    const uniforms = earthMaterial.uniforms
    if (!uniforms) return
    const dayTex: THREE.Texture = textureOverride?.day ?? earthDayTexture
    const nightTex: THREE.Texture = textureOverride?.night ?? earthNightTexture
    if (uniforms.uDayTexture) uniforms.uDayTexture.value = dayTex
    if (uniforms.uNightTexture) uniforms.uNightTexture.value = nightTex
  }, [textureOverride, earthMaterial.uniforms, earthDayTexture, earthNightTexture])

  // Smoothly rotate Earth so the given lat/lon faces the camera
  useEffect(() => {
    if (!orientTo || !(earthGroupRef.current || earthRef.current)) {
      orientRef.current = null
      return
    }
    orientRef.current = { ...orientTo }
    const mesh = earthGroupRef.current ?? earthRef.current
    if (!mesh) return
    const lat = orientTo.lat
    const lon = orientTo.lon
    // Local (unrotated) direction for the point
    const phi = (90 - (lat + overlayOffset.latDeg)) * (Math.PI / 180)
    const theta = (lon + overlayOffset.lonDeg + 180) * (Math.PI / 180)
    const localDir = new THREE.Vector3(
      -Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    ).normalize()
    // Current world-space direction of that local vector
    const worldDir = localDir.clone().applyQuaternion(mesh.quaternion)
    const camDir = camera.position.clone().normalize()
    // Rotation that takes worldDir -> camDir
    const q = new THREE.Quaternion().setFromUnitVectors(worldDir, camDir)

    // Compute local north tangent at the target point in object space
    // Using projection of world up (0,1,0) onto the tangent plane at the point
    const objectPoint = localDir.clone() // object space
    const worldUp = camera.up.clone().normalize()
    const northTangentObj = worldUp.clone().sub(objectPoint.clone().multiplyScalar(worldUp.dot(objectPoint)))
    if (northTangentObj.lengthSq() > 1e-8) northTangentObj.normalize()
    // Transform north tangent to world with current mesh orientation, then apply q
    const northWorldBefore = northTangentObj.clone().applyQuaternion(mesh.quaternion)
    const northWorldAfter = northWorldBefore.clone().applyQuaternion(q).normalize()

    // We want northWorldAfter to align with camera.up projected onto the camera plane
    const camForward = camDir.clone().normalize()
    const desiredUp = camera.up.clone().sub(camForward.clone().multiplyScalar(camera.up.clone().dot(camForward))).normalize()
    const currentUp = northWorldAfter.clone().sub(camForward.clone().multiplyScalar(northWorldAfter.dot(camForward))).normalize()
    let rollAngle = 0
    const cross = new THREE.Vector3().crossVectors(currentUp, desiredUp)
    const dot = THREE.MathUtils.clamp(currentUp.dot(desiredUp), -1, 1)
    if (currentUp.lengthSq() > 1e-8 && desiredUp.lengthSq() > 1e-8) {
      const sign = Math.sign(cross.dot(camForward)) || 1
      rollAngle = Math.acos(dot) * sign
    }
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(camForward, rollAngle)

    // Apply a slerp for a smooth 300ms turn (first align, then roll)
    const targetQ = mesh.quaternion.clone().premultiply(q).premultiply(rollQuat)
    const startQ = mesh.quaternion.clone()
    const start = performance.now()
    const duration = 300
    let raf = 0
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / duration)
      // Some three builds don’t expose static Quaternion.slerp; use instance API
      mesh.quaternion.slerpQuaternions(startQ, targetQ, t)
      if (t < 1) {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [orientTo, camera.position, camera.up, overlayOffset])

  // Wait for shaders to load the first time
  if (!earthVS || !earthFS) return null

  return (
    <>
      {/* Earth group so overlays inherit rotation */}
      <group ref={earthGroupRef}>
        {/* Earth */}
        <mesh ref={earthRef}>
          <sphereGeometry args={[2, 64, 64]} />
          <primitive object={earthMaterial} />
        </mesh>

        {/* Atmosphere */}
        <mesh ref={atmosphereRef} scale={[1.04, 1.04, 1.04]}>
          <sphereGeometry args={[2, 64, 64]} />
          <primitive object={atmosphereMaterial} />
        </mesh>

        {/* Debug Sun (hidden) */}
        {/* <mesh ref={debugSunRef} visible={false}>
        <icosahedronGeometry args={[0.1, 2]} />
        <meshBasicMaterial />
      </mesh> */}

        {/* Overlay points – parented to Earth so they rotate with it */}
        {Array.isArray(points) && points.length > 0 ? (
          <group>
            {points.map((p, i) => {
              const radius = 2.05
              // Convert lat/lon to 3D on sphere (degrees → radians). East-positive longitudes.
              const phi = (90 - (p.lat + overlayOffset.latDeg)) * (Math.PI / 180)
              const theta = (p.lon + overlayOffset.lonDeg + 180) * (Math.PI / 180)
              const x = -radius * Math.sin(phi) * Math.cos(theta)
              const z = radius * Math.sin(phi) * Math.sin(theta)
              const y = radius * Math.cos(phi)
              const size = Math.min(Math.max(p.size ?? (p.value ? 0.03 + (Math.log10(Math.max(1, p.value)) * 0.012) : 0.05), 0.02), 0.18)
              const color = p.color || '#ff5050'
              return (
                <mesh key={`pt-${p.lat}-${p.lon}-${i}`} position={[x, y, z]}>
                  <sphereGeometry args={[size, 16, 16]} />
                  <meshBasicMaterial color={color} toneMapped={false} />
                </mesh>
              )
            })}
          </group>
        ) : null}

        {/* Overlay bars – parented to Earth so they rotate with it */}
        {Array.isArray(bars) && bars.length > 0 ? (
          <group>
            {bars.map((b) => {
              const r = 2
              const phi = (90 - (b.lat + overlayOffset.latDeg)) * (Math.PI / 180)
              const theta = (b.lon + overlayOffset.lonDeg + 180) * (Math.PI / 180)
              const surface = new THREE.Vector3(
                -Math.sin(phi) * Math.cos(theta),
                Math.cos(phi),
                Math.sin(phi) * Math.sin(theta)
              )
              const pos = surface.clone().multiplyScalar(r)
              const height = typeof b.height === 'number' ? b.height : (b.value ? Math.max(0.1, Math.log10(Math.max(1, b.value)) * 0.25) : 0.3)
              const cylRadius = Math.min(0.08, Math.max(0.02, (b.radius ?? 0.03)))
              const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.clone().normalize())
              const offset = surface.clone().normalize().multiplyScalar(height / 2)
              const finalPos = pos.clone().add(offset)
              const color = b.color || '#ff6600'
              return (
                <mesh key={`bar-${b.lat}-${b.lon}-${b.value || 0}`} position={finalPos.toArray()} quaternion={quat}>
                  <cylinderGeometry args={[cylRadius, cylRadius, height, 12]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
                </mesh>
              )
            })}
          </group>
        ) : null}

        {/* Country borders (GeoJSON outlines) */}
        {Array.isArray(borders) && borders.length > 0 ? (
          <group>
            {borders.map((line) => {
              const r = 2.02
              const positions: number[] = []
              for (let i = 0; i < line.length; i++) {
                const p = line[i]
                if (!p) continue
                const phi = (90 - (p.lat + overlayOffset.latDeg)) * (Math.PI / 180)
                const theta = (p.lon + overlayOffset.lonDeg + 180) * (Math.PI / 180)
                const x = -r * Math.sin(phi) * Math.cos(theta)
                const z = r * Math.sin(phi) * Math.sin(theta)
                const y = r * Math.cos(phi)
                positions.push(x, y, z)
              }
              const keyStr = `${line[0]?.lat ?? 0}:${line[0]?.lon ?? 0}:${line.length}`
              return (
                <line key={`border-${keyStr}`}>
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[new Float32Array(positions), 3]} />
                  </bufferGeometry>
                  <lineBasicMaterial color="#ffffff" linewidth={1} transparent opacity={0.75} />
                </line>
              )
            })}
          </group>
        ) : null}
      </group>
    </>
  )
}

// lil-gui disabled; we use an on-canvas gizmo to adjust sun
const initGUI = () => { }

function WorldAnalysis() {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const [overlayPoints, setOverlayPoints] = useState<Array<{ lat: number; lon: number; value?: number; color?: string; size?: number; label?: string }>>([])
  const [overlayBars, setOverlayBars] = useState<Array<{ lat: number; lon: number; value?: number; height?: number; color?: string; radius?: number; label?: string }>>([])
  const orbitRef = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const [rotateSpeed, setRotateSpeed] = useState<number>(0.1)
  const [orientationRequest, setOrientationRequest] = useState<{ lat: number; lon: number } | null>(null)
  const [overlayOffset, setOverlayOffset] = useState<{ lonDeg: number; latDeg: number }>({ lonDeg: 0, latDeg: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [borders, setBorders] = useState<Array<Array<{ lat: number; lon: number }>>>([])
  const [textureOverride, setTextureOverride] = useState<{ day?: THREE.Texture | null; night?: THREE.Texture | null }>({})
  const [geoMaskFC, setGeoMaskFC] = useState<SimpleFeatureCollection | null>(null)

  const textureLoader = useMemo(() => new THREE.TextureLoader().setCrossOrigin('anonymous'), [])

  // Simple rasterizer: draw selected regions to a canvas in equirectangular projection
  async function rasterizeGeoMaskToTexture(geojson: SimpleFeatureCollection | SimpleFeature | SimpleGeoJSONGeometry, style: { plainColor?: string; fillColor?: string; fillOpacity?: number }) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 4096
      canvas.height = 2048
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = style.plainColor || HIGHLIGHT_COLORS.basePlain
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = style.fillColor || HIGHLIGHT_COLORS.highlightFill
      ctx.globalAlpha = typeof style.fillOpacity === 'number' ? style.fillOpacity : 1
      const drawPolygon = (coords?: number[][]) => {
        if (!coords || coords.length === 0) return
        ctx.beginPath()
        for (let i = 0; i < coords.length; i++) {
          const tuple = coords[i]
          if (!Array.isArray(tuple) || tuple.length < 2) continue
          const lon = Number(tuple[0])
          const lat = Number(tuple[1])
          const x = ((lon + 180) / 360) * canvas.width
          const y = ((90 - lat) / 180) * canvas.height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fill()
      }
      const walk = (g?: SimpleGeoJSONGeometry | null) => {
        const type = g?.type
        const c = g?.coordinates
        if (!type || !c) return
        if (type === 'Polygon') {
          const rings = c as number[][][]
          const ring = rings[0] as number[][] | undefined
          drawPolygon(ring)
        } else if (type === 'MultiPolygon') {
          const polys = c as unknown as number[][][][]
          for (const poly of polys) {
            const ring = poly[0] as number[][] | undefined
            drawPolygon(ring)
          }
        } else if (type === 'GeometryCollection') {
          for (const gg of g.geometries || []) walk(gg)
        }
      }
      if ((geojson as SimpleFeatureCollection)?.type === 'FeatureCollection') {
        for (const f of (geojson as SimpleFeatureCollection).features || []) walk(f.geometry)
      } else if ((geojson as SimpleFeature)?.type === 'Feature') {
        walk((geojson as SimpleFeature).geometry)
      } else {
        walk(geojson as SimpleGeoJSONGeometry)
      }
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      return tex
    } catch {
      return null
    }
  }

  function extractBordersFromGeoJSON(geojson: SimpleFeatureCollection | SimpleFeature | SimpleGeoJSONGeometry): Array<Array<{ lat: number; lon: number }>> {
    const lines: Array<Array<{ lat: number; lon: number }>> = []
    const pushRing = (ring: number[][]) => {
      const safe = (ring || []).filter(Array.isArray).map(([lon, lat]) => ({ lat: Number(lat) || 0, lon: Number(lon) || 0 }))
      lines.push(safe)
    }
    const walk = (g?: SimpleGeoJSONGeometry | null) => {
      const t = g?.type
      const c = g?.coordinates
      if (!t || !c) return
      if (t === 'Polygon') {
        const rings = c as number[][][]
        const ring = rings[0] as number[][] | undefined
        if (ring) pushRing(ring)
      } else if (t === 'MultiPolygon') {
        const polys = c as unknown as number[][][][]
        for (const poly of polys) {
          const ring = poly[0] as number[][] | undefined
          if (ring) pushRing(ring)
        }
      } else if (t === 'GeometryCollection') {
        for (const gg of g.geometries || []) walk(gg)
      } else if (t === 'LineString') {
        const arr = (c as number[][]) || []
        lines.push(arr.map(([lon, lat]) => ({ lat: Number(lat) || 0, lon: Number(lon) || 0 })))
      } else if (t === 'MultiLineString') {
        for (const ls of (c as number[][][])) lines.push(ls.map(([lon, lat]) => ({ lat: Number(lat) || 0, lon: Number(lon) || 0 })))
      }
    }
    if ((geojson as SimpleFeatureCollection)?.type === 'FeatureCollection') {
      for (const f of (geojson as SimpleFeatureCollection).features || []) walk(f.geometry)
    } else if ((geojson as SimpleFeature)?.type === 'Feature') {
      walk((geojson as SimpleFeature).geometry)
    } else {
      walk(geojson as SimpleGeoJSONGeometry)
    }
    return lines
  }

  // Listen for AI rotation control events
  useEffect(() => {
    const handler = (e: CustomEvent<{ running?: boolean; speed?: number }>) => {
      const { running, speed } = e.detail || {}
      if (typeof running === 'boolean') {
        setRotateSpeed(running ? (typeof speed === 'number' ? Math.max(0, Math.min(2, speed)) : 0.1) : 0)
        return
      }
      if (typeof speed === 'number') setRotateSpeed(Math.max(0, Math.min(2, speed)))
    }
    window.addEventListener('world-rotation-update', handler as EventListener)
    return () => window.removeEventListener('world-rotation-update', handler as EventListener)
  }, [])



  // Listen for clear overlays event
  useEffect(() => {
    const onClear = () => {
      setOverlayPoints([])
      setOverlayBars([])
      setBorders([])
      setTextureOverride({})
      setGeoMaskFC(null)
      setOverlayOffset({ lonDeg: 0, latDeg: 0 })
      setOrientationRequest(null)
      earthParameters.atmosphereDayColor = DEFAULT_ATMOSPHERE.day
      earthParameters.atmosphereTwilightColor = DEFAULT_ATMOSPHERE.twilight
      try { window.dispatchEvent(new CustomEvent('world-sun-updated')) } catch {}
    }
    window.addEventListener('world-clear-overlays', onClear)
    return () => window.removeEventListener('world-clear-overlays', onClear)
  }, [])

  // Removed external PointsOverlay; points now render inside EarthScene to stay aligned while Earth rotates
  // Country metric to bars converter: listen for country metrics and generate bars via centroid map
  useEffect(() => {
    const handler = (e: CustomEvent<{ type: string; items: Array<{ code: string; value: number; color?: string; radius?: number }> }>) => {
      const detail = e.detail
      if (!detail || detail.type !== 'country-metric') return
      // Local-first: try static centroids from public, fallback to external if missing
      const getCentroids = async (): Promise<Record<string, { lat: number; lng: number }> | null> => {
        try {
          const res = await fetch('/geo/country-centroids.json', { cache: 'force-cache' })
          if (res.ok) return await res.json()
        } catch {}
        try {
          const res = await fetch('https://unpkg.com/iso-country-codes@3.0.0/latlng.json', { cache: 'no-cache' })
          if (res.ok) return await res.json()
        } catch {}
        return null
      }

      getCentroids()
        .then((centroids: Record<string, { lat: number; lng: number }> | null) => {
          if (!centroids) return
          const bars = detail.items.map(({ code, value, color, radius }) => {
            const k = code.toUpperCase()
            const c = (centroids as Record<string, { lat: number; lng: number }>)[k] || (centroids as Record<string, { lat: number; lng: number }>)[k.slice(0,2)]
            if (!c) return null
            return { lat: c.lat, lon: c.lng, value, color: color || '#10B981', radius }
          }).filter(Boolean) as OverlayBar[]
          setOverlayBars(bars)
        }).catch(() => {})
    }
    window.addEventListener('world-country-metric', handler as EventListener)
    return () => window.removeEventListener('world-country-metric', handler as EventListener)
  }, [])



  useEffect(() => {
    initGUI()
  }, [])

  return (
    <div className={cn("relative h-full w-full bg-[#06070b]", !collapsed && "mt-3.5 rounded-tl-xl")}>
      {/* Chat overlay (bottom) */}
      <div className="absolute bottom-4 flex justify-center left-4 pointer-events-none right-4 z-20">
        <OverlayChat
          className="pointer-events-auto"
          isUserAuthenticated={false}
          onOverlayPoints={({ points }) => setOverlayPoints(points)}
          onOverlayBars={({ bars }) => setOverlayBars(bars)}
          onSetCamera={({ lat, lon }) => {
            // Rotate Earth to face the requested location; camera distance is unchanged
            setOrientationRequest({ lat, lon })
            // Pause rotation when orienting
            setRotateSpeed(0)
          }}
          onSetShader={(p) => {
            if (typeof p?.sun?.phi === 'number') sunSpherical.phi = p.sun.phi
            if (typeof p?.sun?.theta === 'number') sunSpherical.theta = p.sun.theta
            if (typeof p?.atmosphereDayColor === 'string') earthParameters.atmosphereDayColor = p.atmosphereDayColor
            if (typeof p?.atmosphereTwilightColor === 'string') earthParameters.atmosphereTwilightColor = p.atmosphereTwilightColor
            if (p?.overlayOffset) {
              const overlayOffset = p.overlayOffset;
              setOverlayOffset(oo => ({
                lonDeg: typeof overlayOffset.lonDeg === 'number' ? overlayOffset.lonDeg : oo.lonDeg,
                latDeg: typeof overlayOffset.latDeg === 'number' ? overlayOffset.latDeg : oo.latDeg,
              }))
            }
            try { window.dispatchEvent(new CustomEvent('world-sun-updated')) } catch { }
          }}
          onOverlayGeo={async (res) => {
            try {
              // Prefer provided geojson; otherwise fetch
              let data: SimpleFeatureCollection | SimpleFeature | SimpleGeoJSONGeometry | null = (res.geojson as unknown as SimpleFeatureCollection | SimpleFeature | SimpleGeoJSONGeometry | null)
              if (!data && typeof res.geojsonUrl === 'string' && res.geojsonUrl) {
                data = await fetch(res.geojsonUrl, { cache: 'no-cache' }).then(r => r.json() as Promise<SimpleFeatureCollection | SimpleFeature | SimpleGeoJSONGeometry>).catch(() => null)
              }
              // If only country codes/names were provided, load a public world dataset and filter
              if (!data && ((res.countryCodes?.length) || (res.countryNames?.length))) {
                // Local-first: try proxy (server-side fetch) then public copy, then external
                const proxyUrl = '/api/world-analysis/countries'
                const localUrl = '/geo/countries.geojson'
                const externalUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
                let world: unknown = null
                try {
                  world = await fetch(proxyUrl, { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error('proxy failed')))
                } catch {}
                if (!world) {
                  try { world = await fetch(localUrl, { cache: 'force-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error('local missing'))) } catch {}
                }
                if (!world) {
                  try { world = await fetch(externalUrl, { cache: 'no-cache' }).then(r => r.json()) } catch {}
                }
                const asFC = world as { type?: string; features?: Array<{ properties?: Record<string, unknown> }> }
                if (asFC?.type === 'FeatureCollection') {
                  const names = new Set((res.countryNames || []).map((s) => String(s).toLowerCase()))
                  const codes = new Set((res.countryCodes || []).map((s) => String(s).toUpperCase()))
                  const features = (asFC.features || []).filter((f) => {
                    const props = (f?.properties ?? {}) as Record<string, unknown>
                    const readStr = (obj: Record<string, unknown>, key: string): string => {
                      const v = obj[key]
                      return typeof v === 'string' ? v : ''
                    }
                    const n = (readStr(props, 'ADMIN') || readStr(props, 'NAME') || readStr(props, 'name')).toLowerCase()
                    const a3 = (readStr(props, 'ISO_A3') || readStr(props, 'iso_a3')).toUpperCase()
                    const a2 = (readStr(props, 'ISO_A2') || readStr(props, 'iso_a2')).toUpperCase()
                    if (names.size && names.has(n)) return true
                    if (codes.size && (codes.has(a3) || codes.has(a2))) return true
                    return false
                  })
                  data = { type: 'FeatureCollection', features: features as unknown as SimpleFeature[] }
                }
              }
              if (!data) return
              const merged: SimpleFeatureCollection = { type: 'FeatureCollection', features: [] as SimpleFeature[] }
              const append = (d: SimpleFeatureCollection | SimpleFeature | SimpleGeoJSONGeometry) => {
                const t: string | undefined = (d as { type?: string })?.type
                if (t === 'FeatureCollection') {
                  merged.features.push(...((d as SimpleFeatureCollection).features || []))
                } else if (t === 'Feature') {
                  merged.features.push(d as SimpleFeature)
                } else {
                  merged.features.push({ type: 'Feature', geometry: d as SimpleGeoJSONGeometry })
                }
              }
              if (geoMaskFC) append(geoMaskFC)
              append(data)
              setGeoMaskFC(merged)
              setBorders(extractBordersFromGeoJSON(merged))
              if (res.style?.maskOthers) {
                const tex = await rasterizeGeoMaskToTexture(merged, {
                  plainColor: res.style?.plainColor,
                  fillColor: res.style?.fillColor,
                  fillOpacity: res.style?.fillOpacity,
                })
                if (tex) setTextureOverride({ day: tex, night: tex })
                // Neutralize atmosphere tint so plainColor stays true (avoid yellowing)
                earthParameters.atmosphereDayColor = '#000000'
                earthParameters.atmosphereTwilightColor = '#000000'
                try { window.dispatchEvent(new CustomEvent('world-sun-updated')) } catch {}
              }
            } catch {}
          }}
          onSetBaseMap={async (p) => {
            try {
              if (p.mode === 'day') {
                const url = '/earth/day.jpg'
                const tex = await new Promise<THREE.Texture | null>((resolve) => {
                  textureLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t) }, () => resolve(null), () => resolve(null))
                })
                if (tex) setTextureOverride({ day: tex, night: tex })
                return
              }
              if (p.mode === 'night') {
                const url = '/earth/night.jpg'
                const tex = await new Promise<THREE.Texture | null>((resolve) => {
                  textureLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t) }, () => resolve(null), () => resolve(null))
                })
                if (tex) setTextureOverride({ day: tex, night: tex })
                return
              }
              if (p.mode === 'paleo') {
                const url = '/earth/paleo.jpg'
                const tex = await new Promise<THREE.Texture | null>((resolve) => {
                  textureLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t) }, () => resolve(null), () => resolve(null))
                })
                if (tex) setTextureOverride({ day: tex, night: tex })
                return
              }
              if (p.mode === 'custom' && p.url) {
                const customUrl = p.url as string
                const tex = await new Promise<THREE.Texture | null>((resolve) => {
                  textureLoader.load(customUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t) }, () => resolve(null), () => resolve(null))
                })
                if (tex) setTextureOverride({ day: tex, night: tex })
              }
            } catch {}
          }}
        />
      </div>

      {/* Scene */}
      <Canvas
        className="webgl"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          borderRadius: collapsed ? 0 : 16,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        camera={{
          position: [12, 5, 4],
          fov: 25,
          near: 0.1,
          far: 100
        }}
        gl={{
          antialias: true,
          alpha: true
        }}
      >
        {/* Background Starfield */}
        <Starfield />

        {/* Earth Scene (renders overlay points as children so they rotate together) */}
        <EarthScene rotateSpeed={rotateSpeed} points={overlayPoints} bars={overlayBars} orientTo={orientationRequest} overlayOffset={overlayOffset} borders={borders} textureOverride={textureOverride} />

        {/* Removed camera movement on setCamera; we rotate Earth instead */}

        {/* Controls */}
        <OrbitControls
          ref={orbitRef}
          enableDamping={true}
          dampingFactor={0.05}
          // Limit zoom distances to keep globe in view
          minDistance={3.2}
          maxDistance={12}
          // Prevent flipping through the poles
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI - 0.15}
          onStart={() => setIsDragging(true)}
          onEnd={() => setIsDragging(false)}
        />
      </Canvas>

      {(() => { const SUN_GIZMO_SIZE = 140; return (
        <>
          <SunGizmo size={SUN_GIZMO_SIZE} />
          <div className="absolute right-4 z-20 pointer-events-auto" style={{ top: 16 + SUN_GIZMO_SIZE + 8 }}>
            <div className="flex items-center gap-1 mr-8">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('world-rotation-update', { detail: { running: true, speed: 0.1 } }))}>
                    <Play size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Resume rotation</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('world-rotation-update', { detail: { running: false } }))}>
                    <Pause size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pause rotation</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </>
      )})()}

      {/* Bottom-right Use Case morph panel */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
        <MorphPanel />
      </div>
    </div>
  )
}

// 3D arcball-style sun controller. Drag on the disk to rotate the sun vector.
function SunGizmo({ size = 140 }: { size?: number }) {
  const ref = useRef<SVGSVGElement | null>(null)
  // Track drag start on sphere and starting sun vector
  const dragStartRef = useRef<{ v0: THREE.Vector3; sunStart: THREE.Vector3 } | null>(null)
  const [dragging, setDragging] = useState(false)

  const mapToSphere = useCallback((clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const R = Math.min(rect.width, rect.height) * 0.38
    const x = (clientX - cx) / R
    const y = (cy - clientY) / R
    const d = x * x + y * y
    if (d > 1) {
      const s = 1 / Math.sqrt(d)
      return new THREE.Vector3(x * s, y * s, 0).normalize()
    }
    const z = Math.sqrt(1 - d)
    return new THREE.Vector3(x, y, z).normalize()
  }, []) // size is static, no need to recreate callback

  const onPointerDown = (e: React.PointerEvent<SVGCircleElement | SVGSVGElement>) => {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const v0 = mapToSphere(e.clientX, e.clientY)
    if (!v0) return
    const currentSun = new THREE.Vector3().setFromSpherical(sunSpherical)
    dragStartRef.current = { v0, sunStart: currentSun }
    setDragging(true)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return
      const v1 = mapToSphere(e.clientX, e.clientY)
      if (!v1) return
      const { v0, sunStart } = dragStartRef.current
      const dot = Math.min(1, Math.max(-1, v0.dot(v1)))
      const angle = Math.acos(dot)
      if (!Number.isFinite(angle) || angle === 0) return
      const axis = new THREE.Vector3().crossVectors(v0, v1).normalize()
      if (axis.lengthSq() < 1e-8) return
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle)
      const newSun = sunStart.clone().applyQuaternion(q).normalize()
      // Convert to spherical and clamp phi
      const s = new THREE.Spherical().setFromVector3(newSun)
      s.phi = Math.min(Math.PI, Math.max(0, s.phi))
      sunSpherical.phi = s.phi
      sunSpherical.theta = s.theta
    }
    const onUp = () => { dragStartRef.current = null; setDragging(false) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [mapToSphere])

  // Listen for external sun updates (e.g., tool call) - component will re-render naturally
  useEffect(() => {
    const handler = () => {
      // External sun updates should trigger re-render through state changes
      // No explicit force update needed as React handles this
    }
    window.addEventListener('world-sun-updated', handler)
    return () => window.removeEventListener('world-sun-updated', handler)
  }, [])

  // Render simple 3D-looking widget with axes and current sun dot
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const v = new THREE.Vector3().setFromSpherical(sunSpherical).normalize()
  const px = cx + v.x * r
  const py = cy - v.y * r
  const front = v.z >= 0

  return (
    <div className="absolute pointer-events-none right-4 select-none top-4 z-20" style={{ width: size, height: size }}>
      <svg
        ref={ref}
        width={size}
        height={size}
        className="pointer-events-auto"
        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))', cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        role="img"
        aria-label="Sun position control gizmo"
      >
        {/* Outer disk */}
        <defs>
          <radialGradient id="gizmoShade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="url(#gizmoShade)" stroke="rgba(255,255,255,0.35)" />
        {/* Equator and prime meridian */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#F87171" strokeWidth="2" />
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#34D399" strokeWidth="2" />
        {/* Axis labels */}
        <text x={cx + r + 8} y={cy + 4} fill="#fff" fontSize="10">X</text>
        <text x={cx - 4} y={cy - r - 8} fill="#fff" fontSize="10">Y</text>
        <text x={cx + 4} y={cy - 4} fill="#60A5FA" fontSize="10">Z</text>
        {/* Current sun dot */}
        <circle cx={px} cy={py} r={front ? 6 : 4} fill={front ? '#60A5FA' : 'rgba(255,255,255,0.4)'} stroke="#fff" strokeWidth={front ? 2 : 1} />
      </svg>
    </div>
  )
}

export default function Page() {
  return <WorldAnalysis />
}
