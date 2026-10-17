// The employee: walks between the desk, the coffee cart and the lounge depending on the real run status,
// sits and types while Claude Code is working, claps when a run finishes. The Sims-style plumbob shows status.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SPOTS, APPROACH, AISLE_Z } from './layout.js';

const URL = '/assets/characters/employee.glb';
const HEIGHT = 1.74;
const SPEED = 1.2;          // m/s walking
const TURN = 8;             // how fast he turns towards where he walks

// Tuned offsets: where the root sits so the hips land on each seat.
const SEAT = {
  desk: { offset: [0, 0, 0.45], y: -0.02 },
  lounge: { offset: [0, 0, 0.45], y: 0.04, tilt: 0.35 },
};

// Extra rotations (radians, applied on top of the sitting clip) that bring the hands to the keyboard.
// Bone names lose their dots in three.js (UpperArm.L → UpperArmL).
const TYPING = {
  UpperArmL: [-0.25, 0, -0.7], UpperArmR: [-0.25, 0, 0.7],
  LowerArmL: [-1.15, 0, 0], LowerArmR: [-1.15, 0, 0],
};

const PLUMBOB = { working: '#3ddc84', idle: '#5aa9ff', done: '#ffd34d', error: '#ff5a5a' };
const STATUS_TEXT = { working: 'Bekerja', idle: 'Istirahat', done: 'Selesai!', error: 'Ada kendala' };

const v3 = a => new THREE.Vector3(...a);

function pathBetween(from, to) {
  const a = APPROACH[from] || null, b = APPROACH[to];
  const pts = [];
  if (a) pts.push(v3(a), v3([a[0], 0, AISLE_Z]));
  pts.push(v3([b[0], 0, AISLE_Z]), v3(b));
  return pts;
}

export function Employee({ status = 'idle', activity, name, onSelect, teleport = false }) {
  const { scene, animations } = useGLTF(URL);

  const model = useMemo(() => {
    const m = clone(scene);
    const colors = { Shirt: '#26324a', Pants: '#2b2d33', Skin: '#b97c55', Hair: '#1a1410', Details: '#f2f2f0', TieTexture: '#1f7a72', Eyes: '#111111' };
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map(src => {
        const mm = src.clone();
        if (colors[src.name]) mm.color.set(colors[src.name]);
        mm.roughness = src.name === 'Skin' ? 0.65 : src.name === 'Hair' ? 0.5 : 0.8;
        mm.metalness = 0;
        return mm;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m, true);
    m.userData.scale = HEIGHT / (box.max.y - box.min.y);
    m.userData.minY = box.min.y;
    return m;
  }, [scene]);

  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const out = {};
    for (const clip of animations) out[clip.name.replace(/^.*Man_/, '')] = mixer.clipAction(clip);
    return out;
  }, [animations, mixer]);
  const bones = useMemo(() => {
    const b = {};
    model.traverse(o => { if (o.isBone) b[o.name] = o; });
    return b;
  }, [model]);

  const root = useRef();
  const overhead = useRef(); // plumbob + name tag, kept above the head bone
  const sim = useRef({
    spot: 'lounge', target: 'lounge', path: [], walking: false, pose: null, current: null,
    pos: v3(SPOTS.lounge.pos), rot: SPOTS.lounge.rot, breakTimer: 0,
  });

  if (import.meta.env.DEV) window.__emp = { actions, mixer, bones, model, sim };

  const play = (name, fade = 0.35) => {
    const s = sim.current;
    if (s.current === name) return;
    const next = actions[name];
    if (!next) return;
    next._seated = false;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (name === 'Clapping') { next.setLoop(THREE.LoopRepeat, 3); next.clampWhenFinished = true; }
    if (s.current && actions[s.current]) actions[s.current].fadeOut(fade);
    s.current = name;
  };

  // Where he should be for each real status. On a break he alternates between the coffee cart and the lounge.
  useEffect(() => {
    const s = sim.current;
    if (status === 'working' || status === 'error') s.target = 'desk';
    else if (status === 'done') s.target = 'deskStand';
    else { s.target = s.spot === 'coffee' ? 'coffee' : 'lounge'; s.breakTimer = 0; }
  }, [status]);

  // first frame: seated in the lounge
  useEffect(() => { play('Sitting', 0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, dt) => {
    const s = sim.current;
    dt = Math.min(dt, 0.05);

    // break routine: ~25 s at the coffee cart, ~60 s in the lounge chair, repeat
    if (status === 'idle' && !s.walking) {
      s.breakTimer += dt;
      if (s.spot === 'coffee' && s.breakTimer > 25) { s.target = 'lounge'; s.breakTimer = 0; }
      if (s.spot === 'lounge' && s.breakTimer > 60) { s.target = 'coffee'; s.breakTimer = 0; }
    }

    // start walking when the target changes
    const targetKey = s.target === 'deskStand' ? 'desk' : s.target;
    if (teleport && !s.walking && s.spot !== s.target) { // dev preview: skip the walk
      s.spot = s.target;
      if (s.spot === 'deskStand') { s.pos.set(...APPROACH.desk); s.rot = Math.PI; play(status === 'done' ? 'Clapping' : 'Idle', 0); }
      else { const sp = SPOTS[s.spot]; s.pos.set(...sp.pos); s.rot = sp.rot; play(sp.pose === 'sit' ? 'Sitting' : 'Idle', 0); }
    }
    if (!s.walking && s.spot !== s.target) {
      const fromKey = s.spot === 'deskStand' ? 'desk' : s.spot;
      if (fromKey === targetKey) {
        s.path = [s.target === 'deskStand' ? v3(APPROACH.desk) : v3(SPOTS.desk.pos)];
      } else {
        s.path = pathBetween(fromKey, targetKey);
        if (s.target !== 'deskStand') s.path.push(v3(SPOTS[targetKey].pos));
        // stand up from the seat: start from the approach point
        if (s.spot !== 'deskStand') s.pos.copy(s.path[0]);
      }
      s.walking = true;
      play('Walk', 0.25);
    }

    if (s.walking) {
      const next = s.path[0];
      const to = next.clone().sub(s.pos); to.y = 0;
      const dist = to.length();
      const step = SPEED * dt;
      if (dist <= step) {
        s.pos.copy(next); s.path.shift();
        if (!s.path.length) {
          s.walking = false; s.spot = s.target;
          if (s.spot === 'deskStand') { s.rot = Math.PI; play(status === 'done' ? 'Clapping' : 'Idle'); }
          else { const sp = SPOTS[s.spot]; s.rot = sp.rot; s.pos.set(...sp.pos); play(sp.pose === 'sit' ? 'Sitting' : 'Idle'); }
        }
      } else {
        s.pos.addScaledVector(to.normalize(), step);
        const want = Math.atan2(to.x, to.z);
        let d = want - s.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
        s.rot += d * Math.min(1, TURN * dt);
      }
    } else if (s.spot === 'deskStand' && status === 'error') play('Idle');

    mixer.update(dt);
    const sit = actions.Sitting;
    if (s.current === 'Sitting' && sit && sit.time < 0.5 && sit._seated) sit.time = 0.5;
    if (sit) sit._seated = s.current === 'Sitting' && sit.time >= 0.5;

    // typing: lift the forearms to the keyboard and let the hands move while Claude is working
    const seated = !s.walking && s.spot === 'desk';
    if (seated && status === 'working') {
      const t = state.clock.elapsedTime;
      for (const [bone, [x, y, z]] of Object.entries(window.__typing || TYPING)) {
        const b = bones[bone]; if (!b) continue;
        const side = bone.endsWith('L') ? 1 : -1;
        const tap = bone.startsWith('Lower') ? Math.sin(t * 14 + side) * 0.05 : 0;
        b.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x + tap, y, z)));
      }
      if (bones.Head) bones.Head.rotation.x += Math.sin(t * 0.7) * 0.03;
    }

    // place the root (seat offsets apply only while seated)
    const seat = !s.walking && SPOTS[s.spot]?.pose === 'sit' ? (window.__seat || SEAT)[s.spot] : null;
    const off = seat ? v3(seat.offset).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.rot) : new THREE.Vector3();
    root.current.position.set(s.pos.x + off.x, (seat?.y || 0), s.pos.z + off.z);
    root.current.rotation.set(-(seat?.tilt || 0), s.rot, 0, 'YXZ'); // tilt: lean back into a reclined seat
    if (bones.Head) {
      root.current.updateMatrixWorld(true);
      bones.Head.getWorldPosition(overhead.current.position);
    }
  });

  const color = PLUMBOB[status] || PLUMBOB.idle;
  const k = model.userData.scale;
  // a short line over his head: URLs reduced to their host, long text cut
  const bubble = status === 'working' && activity
    ? activity.text.replace(/https?:\/\/(www\.)?([^/\s]+)\S*/g, '$2').replace(/(www\.)?(threads\.com)\/\S*/g, '$2')
    : null;

  return (
    <group>
      <group ref={root} onClick={e => { e.stopPropagation(); onSelect?.(); }}>
        <primitive object={model} scale={k} position-y={-model.userData.minY * k} />
      </group>
      <group ref={overhead}>
        <Plumbob color={color} y={0.5} />
        <Html position={[0, 0.98, 0]} center distanceFactor={9} zIndexRange={[20, 0]} className="tag-wrap">
          <div className="name-tag">
            <b>{name}</b><span style={{ color }}>● {STATUS_TEXT[status] || status}</span>
            {bubble && <em>{bubble.length > 44 ? bubble.slice(0, 44) + '…' : bubble}</em>}
          </div>
        </Html>
      </group>
    </group>
  );
}

function Plumbob({ color, y }) {
  const ref = useRef();
  useFrame((s) => {
    ref.current.rotation.y += 0.02;
    ref.current.position.y = y + Math.sin(s.clock.elapsedTime * 2) * 0.03;
  });
  return (
    <mesh ref={ref} scale={[0.075, 0.14, 0.075]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} roughness={0.25} metalness={0.1} transparent opacity={0.92} />
    </mesh>
  );
}

useGLTF.preload(URL);
