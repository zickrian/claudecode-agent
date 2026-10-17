// The 3D office: room, furniture, desks, the employee, the live screens, camera views and post-processing.
import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Environment } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Room, Lights } from './Room.jsx';
import { Furniture } from './Furniture.jsx';
import { Workstations } from './Workstation.jsx';
import { Employee } from './Employee.jsx';
import { makeScreen, drawMonitor, drawTv } from './screens.js';

export const VIEWS = {
  kantor: { pos: [7.6, 9.2, 12.4], target: [0.2, 0.2, -0.6] },
  layar: { pos: [-2.7, 1.9, 0.45], target: [-3.55, 1.1, -1.15] },
  istirahat: { pos: [8.4, 3.6, 5.6], target: [4.2, 0.7, -0.6] },
};

function LiveScreens({ data, monitor, tv }) {
  const last = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  useFrame(() => {
    const now = Date.now();
    if (now - last.current < 250) return;
    last.current = now;
    const d = dataRef.current;
    drawMonitor(monitor, { ...d, now });
    drawTv(tv, { ...d, now });
    monitor.texture.needsUpdate = true;
    tv.texture.needsUpdate = true;
  });
  return null;
}

const Controls = forwardRef(function Controls(_, ref) {
  const cc = useRef();
  useImperativeHandle(ref, () => ({
    go: (name, smooth = true) => {
      const v = VIEWS[name]; if (!v || !cc.current) return;
      cc.current.setLookAt(...v.pos, ...v.target, smooth);
    },
  }));
  useEffect(() => {
    cc.current?.setLookAt(...VIEWS.kantor.pos, ...VIEWS.kantor.target, false);
    if (import.meta.env.DEV) window.__cam = cc.current; // dev: drive the camera from the console
  }, []);
  return (
    <CameraControls
      ref={cc} makeDefault
      minDistance={1.2} maxDistance={22}
      minPolarAngle={0.15} maxPolarAngle={Math.PI / 2 - 0.06}
      smoothTime={0.6}
    />
  );
});

export const Scene = forwardRef(function Scene({ data, onSelectEmployee, teleport }, ref) {
  const monitor = useMemo(() => makeScreen(1024, 576), []);
  const tv = useMemo(() => makeScreen(1024, 576), []);
  const { employee, config } = data;
  const lastActivity = data.activity[data.activity.length - 1];

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.1, far: 120, position: VIEWS.kantor.pos }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
    >
      <color attach="background" args={['#e9e4dc']} />
      <fog attach="fog" args={['#e9e4dc', 26, 60]} />
      <Suspense fallback={null}>
        <Environment files="/assets/hdri/modern_buildings_2.hdr" environmentIntensity={0.42} />
        <Lights />
        <Room />
        <Furniture tvScreen={tv.texture} />
        <Workstations screen={monitor.texture} working={employee?.status === 'working'} />
        <Employee
          status={employee?.status}
          activity={lastActivity}
          name={config?.employee?.name}
          onSelect={onSelectEmployee}
          teleport={teleport}
        />
        <LiveScreens data={data} monitor={monitor} tv={tv} />
      </Suspense>
      <Controls ref={ref} />
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={0.6} distanceFalloff={0.6} intensity={2.2} halfRes />
        <Bloom luminanceThreshold={0.95} intensity={0.25} mipmapBlur />
        <Vignette offset={0.25} darkness={0.45} />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </Canvas>
  );
});
