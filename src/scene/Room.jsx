// The room itself: wooden floor, plaster walls with windows onto the city, a rug, and the light.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { ROOM } from './layout.js';

const T = ROOM.w / 2, D = ROOM.d / 2, H = ROOM.h;
const WALL_T = 0.16;
const SILL = 0.85, HEAD = 2.55; // window bottom / top

function tiled(maps, rx, ry) {
  for (const t of Object.values(maps)) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 8;
  }
  return maps;
}

function Floor() {
  const maps = useTexture({
    map: '/assets/textures/wood_floor/diff.jpg',
    normalMap: '/assets/textures/wood_floor/nor.jpg',
    roughnessMap: '/assets/textures/wood_floor/rough.jpg',
  });
  useMemo(() => { tiled(maps, ROOM.w / 2.2, ROOM.d / 2.2); maps.map.colorSpace = THREE.SRGBColorSpace; }, [maps]);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[ROOM.w, ROOM.d]} />
      <meshStandardMaterial {...maps} color="#d8c4a8" roughness={0.75} normalScale={[0.6, 0.6]} envMapIntensity={0.6} />
    </mesh>
  );
}

// A wall from a start point along an axis, with window openings cut as gaps (in metres along the wall).
function Wall({ from, axis, length, windows = [], material, height = H }) {
  const pieces = [];
  const along = (a, b, y0, y1) => pieces.push({ a, b, y0, y1 });
  let cursor = 0;
  for (const [a, b] of windows) {
    along(cursor, a, 0, height);       // solid up to the window
    along(a, b, 0, SILL);              // under the window
    along(a, b, HEAD, height);         // over the window
    cursor = b;
  }
  along(cursor, length, 0, height);
  return pieces.filter(p => p.b - p.a > 0.001 && p.y1 - p.y0 > 0.001).map((p, i) => {
    const len = p.b - p.a, mid = (p.a + p.b) / 2, h = p.y1 - p.y0;
    const pos = axis === 'x' ? [from[0] + mid, p.y0 + h / 2, from[2]] : [from[0], p.y0 + h / 2, from[2] + mid];
    const size = axis === 'x' ? [len, h, WALL_T] : [WALL_T, h, len];
    return (
      <mesh key={i} position={pos} castShadow receiveShadow material={material}>
        <boxGeometry args={size} />
      </mesh>
    );
  });
}

// Black steel window frame with mullions, plus the city outside it.
function Window({ center, axis, width, view }) {
  const h = HEAD - SILL, y = (SILL + HEAD) / 2;
  const frame = <meshStandardMaterial color="#1d1f22" metalness={0.6} roughness={0.35} />;
  const bars = [
    // [offset along wall, offset y, w, h]
    [0, h / 2, width, 0.05], [0, -h / 2, width, 0.07], [-width / 2, 0, 0.05, h], [width / 2, 0, 0.05, h],
    [0, 0, 0.035, h], [0, h * 0.18, width, 0.03],
  ];
  const place = (u, v) => axis === 'x' ? [center[0] + u, y + v, center[2]] : [center[0], y + v, center[2] + u];
  const size = (w, hh) => axis === 'x' ? [w, hh, 0.06] : [0.06, hh, w];
  const out = axis === 'x' ? [0, 0, -0.35] : [-0.35, 0, 0];
  return (
    <group>
      {bars.map(([u, v, w, hh], i) => (
        <mesh key={i} position={place(u, v)} castShadow>{<boxGeometry args={size(w, hh)} />}{frame}</mesh>
      ))}
      {/* sill */}
      <mesh position={place(0, -h / 2 - 0.03).map((c, i) => c + (axis === 'x' ? [0, 0, 0.1][i] : [0.1, 0, 0][i]))} castShadow receiveShadow>
        <boxGeometry args={axis === 'x' ? [width + 0.1, 0.04, 0.22] : [0.22, 0.04, width + 0.1]} />
        <meshStandardMaterial color="#f3f0ea" roughness={0.5} />
      </mesh>
      {/* glass */}
      <mesh position={place(0, 0)} rotation-y={axis === 'x' ? 0 : Math.PI / 2}>
        <planeGeometry args={[width, h]} />
        <meshPhysicalMaterial color="#cfe3f0" transparent opacity={0.12} roughness={0.05} metalness={0} envMapIntensity={1.5} depthWrite={false} />
      </mesh>
      {/* the view: a slice of the city panorama, set back behind the glass */}
      <mesh position={place(0, 0).map((c, i) => c + out[i])} rotation-y={axis === 'x' ? 0 : Math.PI / 2}>
        <planeGeometry args={[width + 0.5, h + 0.3]} />
        <meshBasicMaterial map={view} toneMapped />
      </mesh>
    </group>
  );
}

function useCityView(u0) {
  const hdr = useLoader(HDRLoader, '/assets/hdri/modern_buildings_2.hdr');
  return useMemo(() => {
    const t = hdr.clone();
    t.mapping = THREE.UVMapping;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(0.1, 0.22);   // ~36° of the panorama, around the horizon
    t.offset.set(u0, 0.4);
    t.needsUpdate = true;
    return t;
  }, [hdr, u0]);
}

function Rug({ position, radius }) {
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} receiveShadow>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial color="#cdbb9f" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.008} receiveShadow>
        <ringGeometry args={[radius - 0.22, radius - 0.12, 64]} />
        <meshStandardMaterial color="#8a6f52" roughness={1} />
      </mesh>
    </group>
  );
}

export function Room() {
  const plaster = useTexture({ normalMap: '/assets/textures/painted_plaster_wall/nor.jpg' });
  useMemo(() => tiled(plaster, 4, 1.5), [plaster]);
  const walls = useMemo(() => ({
    warm: new THREE.MeshStandardMaterial({ color: '#efe8de', roughness: 0.92, normalMap: plaster.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }),
    accent: new THREE.MeshStandardMaterial({ color: '#35575a', roughness: 0.9, normalMap: plaster.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }),
    low: new THREE.MeshStandardMaterial({ color: '#e7dfd3', roughness: 0.9 }),
    base: new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.6 }),
  }), [plaster]);
  const viewA = useCityView(0.05), viewB = useCityView(0.55);

  // back wall: windows over the work area, solid teal accent behind the lounge
  const backWindows = [[0.7, 2.5], [2.9, 4.7], [5.1, 6.9]];
  const leftWindows = [[1.2, 3.0], [3.4, 5.2]];
  return (
    <group>
      <Floor />
      {/* back wall (z = -D): left part warm white with windows, right part accent */}
      <Wall from={[-T, 0, -D]} axis="x" length={7.6} windows={backWindows} material={walls.warm} />
      <Wall from={[0.6, 0, -D]} axis="x" length={T - 0.6} material={walls.accent} />
      {backWindows.map(([a, b], i) => <Window key={i} center={[-T + (a + b) / 2, 0, -D]} axis="x" width={b - a} view={i % 2 ? viewB : viewA} />)}
      {/* left wall (x = -T) */}
      <Wall from={[-T, 0, -D]} axis="z" length={ROOM.d} windows={leftWindows} material={walls.warm} />
      {leftWindows.map(([a, b], i) => <Window key={i} center={[-T, 0, -D + (a + b) / 2]} axis="z" width={b - a} view={i ? viewA : viewB} />)}
      {/* cutaway walls, Sims "walls down" */}
      <Wall from={[-T, 0, D]} axis="x" length={ROOM.w} material={walls.low} height={0.32} />
      <Wall from={[T, 0, -D]} axis="z" length={ROOM.d} material={walls.low} height={0.32} />
      {/* baseboards */}
      <mesh position={[0, 0.05, -D + WALL_T / 2 + 0.01]} material={walls.base}><boxGeometry args={[ROOM.w, 0.1, 0.02]} /></mesh>
      <mesh position={[-T + WALL_T / 2 + 0.01, 0.05, 0]} material={walls.base}><boxGeometry args={[0.02, 0.1, ROOM.d]} /></mesh>
      {/* ground around the room so it doesn't float */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#d9d4cc" roughness={1} />
      </mesh>
      <Rug position={[3.8, 0, 0.55]} radius={1.75} />
    </group>
  );
}

export function Lights() {
  return (
    <>
      <hemisphereLight args={['#fff6e8', '#b9a58c', 0.35]} />
      {/* afternoon sun through the back and left windows */}
      <directionalLight
        position={[-9, 9, -7]} intensity={3.2} color="#ffe9c9" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={9} shadow-camera-bottom={-9}
        shadow-camera-near={1} shadow-camera-far={40}
      />
      {/* soft overhead fill over the desks and the lounge */}
      <pointLight position={[-2.8, 2.7, -1.5]} intensity={6} distance={7} decay={2} color="#fff3df" />
      <pointLight position={[3.8, 2.6, 0.5]} intensity={5} distance={6} decay={2} color="#ffe2bd" />
      <pointLight position={[5, 2.6, -3.5]} intensity={3} distance={5} decay={2} color="#fff3df" />
    </>
  );
}
