// Desks, chairs and monitors. The occupied desk's monitor is a live canvas of the employee's real work.
import { RoundedBox } from '@react-three/drei';
import { DESKS } from './layout.js';

const DESK = { w: 1.4, d: 0.75, h: 0.74 };

const mat = {
  top: <meshStandardMaterial color="#f4f2ee" roughness={0.45} />,
  steel: <meshStandardMaterial color="#3a3d42" metalness={0.7} roughness={0.35} />,
  black: <meshStandardMaterial color="#141517" roughness={0.4} metalness={0.2} />,
  fabric: <meshStandardMaterial color="#2e3238" roughness={0.95} />,
  partition: <meshStandardMaterial color="#8c99a6" roughness={1} />,
};

function Desk() {
  return (
    <group>
      <mesh position={[0, DESK.h, 0]} castShadow receiveShadow>
        <boxGeometry args={[DESK.w, 0.035, DESK.d]} />{mat.top}
      </mesh>
      {[-1, 1].map(s => (
        <group key={s} position={[s * (DESK.w / 2 - 0.08), 0, 0]}>
          <mesh position={[0, DESK.h / 2, 0]} castShadow>{<boxGeometry args={[0.05, DESK.h - 0.02, 0.05]} />}{mat.steel}</mesh>
          <mesh position={[0, 0.02, 0]} castShadow>{<boxGeometry args={[0.06, 0.04, DESK.d - 0.06]} />}{mat.steel}</mesh>
          <mesh position={[0, DESK.h - 0.04, 0]}>{<boxGeometry args={[0.06, 0.04, DESK.d - 0.1]} />}{mat.steel}</mesh>
        </group>
      ))}
      {/* modesty panel */}
      <mesh position={[0, DESK.h - 0.2, -DESK.d / 2 + 0.04]} castShadow>{<boxGeometry args={[DESK.w - 0.2, 0.3, 0.015]} />}{mat.steel}</mesh>
    </group>
  );
}

function Monitor({ screen, on }) {
  return (
    <group position={[0, DESK.h + 0.02, -DESK.d / 2 + 0.2]}>
      <mesh position={[0, 0.01, 0]} castShadow>{<boxGeometry args={[0.24, 0.015, 0.17]} />}{mat.black}</mesh>
      <mesh position={[0, 0.17, -0.02]} castShadow>{<boxGeometry args={[0.04, 0.32, 0.025]} />}{mat.black}</mesh>
      <group position={[0, 0.38, 0]}>
        <mesh castShadow>{<boxGeometry args={[0.62, 0.37, 0.025]} />}{mat.black}</mesh>
        <mesh position={[0, 0.005, 0.0135]}>
          <planeGeometry args={[0.59, 0.332]} />
          {screen
            ? <meshBasicMaterial map={screen} toneMapped={false} />
            : <meshStandardMaterial color={on ? '#1f2937' : '#0a0b0c'} roughness={0.15} metalness={0.4} />}
        </mesh>
      </group>
      {/* keyboard + mouse */}
      <mesh position={[-0.04, 0.012, 0.3]} castShadow>{<boxGeometry args={[0.44, 0.018, 0.14]} />}<meshStandardMaterial color="#d9dbde" roughness={0.6} /></mesh>
      <mesh position={[-0.04, 0.023, 0.3]}>{<boxGeometry args={[0.41, 0.004, 0.115]} />}<meshStandardMaterial color="#bfc3c8" roughness={0.8} /></mesh>
      <mesh position={[0.28, 0.014, 0.31]} scale={[1, 0.55, 1.5]} castShadow>{<sphereGeometry args={[0.03, 16, 12]} />}<meshStandardMaterial color="#d9dbde" roughness={0.5} /></mesh>
    </group>
  );
}

// A tidy desk: pen cup with pens, a closed notebook with a pen on it, a coffee mug.
function DeskProps() {
  const top = DESK.h + 0.018;
  const pens = [['#1f2937', -0.12, 0.08], ['#1d4ed8', 0.1, -0.06], ['#b91c1c', 0.02, 0.12]];
  return (
    <group position={[0, top, 0]}>
      {/* pen cup */}
      <group position={[0.5, 0, -0.18]}>
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.034, 0.03, 0.1, 24, 1, true]} />
          <meshStandardMaterial color="#2b2f35" roughness={0.6} side={2} />
        </mesh>
        <mesh position={[0, 0.002, 0]}><cylinderGeometry args={[0.03, 0.03, 0.004, 24]} /><meshStandardMaterial color="#2b2f35" /></mesh>
        {pens.map(([c, rx, rz], i) => (
          <group key={i} position={[(i - 1) * 0.012, 0.075, (i % 2) * 0.01 - 0.005]} rotation={[rx, 0, rz]}>
            <mesh castShadow><cylinderGeometry args={[0.0045, 0.0045, 0.14, 8]} /><meshStandardMaterial color={c} roughness={0.4} /></mesh>
            <mesh position={[0, 0.072, 0]}><cylinderGeometry args={[0.005, 0.005, 0.012, 8]} /><meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.3} /></mesh>
          </group>
        ))}
      </group>
      {/* notebook with a pen on it */}
      <group position={[0.42, 0, 0.14]} rotation-y={-0.12}>
        <mesh position={[0, 0.008, 0]} castShadow receiveShadow><boxGeometry args={[0.16, 0.016, 0.22]} /><meshStandardMaterial color="#2f4858" roughness={0.85} /></mesh>
        <mesh position={[0.079, 0.008, 0]}><boxGeometry args={[0.004, 0.012, 0.21]} /><meshStandardMaterial color="#f3efe6" /></mesh>
        <mesh position={[0.05, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.0045, 0.0045, 0.15, 8]} /><meshStandardMaterial color="#111827" roughness={0.4} /></mesh>
      </group>
      {/* coffee mug */}
      <group position={[-0.5, 0, 0.16]} rotation-y={0.6}>
        <mesh position={[0, 0.045, 0]} castShadow receiveShadow><cylinderGeometry args={[0.037, 0.034, 0.09, 24]} /><meshStandardMaterial color="#2f5d62" roughness={0.4} /></mesh>
        <mesh position={[0, 0.087, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.033, 24]} /><meshStandardMaterial color="#3b2416" roughness={0.2} /></mesh>
        <mesh position={[0.036, 0.047, 0]} rotation-z={-Math.PI / 2} castShadow><torusGeometry args={[0.022, 0.006, 8, 16, Math.PI]} /><meshStandardMaterial color="#2f5d62" roughness={0.4} /></mesh>
      </group>
    </group>
  );
}

export function OfficeChair({ rotation = 0 }) {
  return (
    <group rotation-y={rotation}>
      {/* star base + casters */}
      {[0, 1, 2, 3, 4].map(i => (
        <group key={i} rotation-y={(i / 5) * Math.PI * 2}>
          <mesh position={[0, 0.07, 0.17]} castShadow>{<boxGeometry args={[0.04, 0.035, 0.34]} />}{mat.black}</mesh>
          <mesh position={[0, 0.03, 0.32]}>{<sphereGeometry args={[0.03, 10, 8]} />}{mat.black}</mesh>
        </group>
      ))}
      <mesh position={[0, 0.25, 0]} castShadow>{<cylinderGeometry args={[0.025, 0.03, 0.32, 12]} />}{mat.steel}</mesh>
      <RoundedBox args={[0.5, 0.08, 0.48]} radius={0.03} position={[0, 0.46, 0]} castShadow receiveShadow>{mat.fabric}</RoundedBox>
      <group position={[0, 0.5, 0.24]} rotation-x={-0.12}>
        <mesh position={[0, 0.1, 0]} castShadow>{<boxGeometry args={[0.05, 0.22, 0.03]} />}{mat.black}</mesh>
        <RoundedBox args={[0.46, 0.5, 0.06]} radius={0.03} position={[0, 0.4, 0.02]} castShadow>{mat.fabric}</RoundedBox>
      </group>
      {[-1, 1].map(s => (
        <group key={s} position={[s * 0.27, 0.55, 0.02]}>
          <mesh position={[0, 0.06, 0]}>{<boxGeometry args={[0.03, 0.12, 0.03]} />}{mat.black}</mesh>
          <mesh position={[0, 0.13, -0.02]} castShadow>{<boxGeometry args={[0.05, 0.03, 0.24]} />}{mat.black}</mesh>
        </group>
      ))}
    </group>
  );
}

export function Workstations({ screen, working }) {
  return (
    <group>
      {DESKS.map(d => {
        const rot = d.facing === 'back' ? 0 : Math.PI; // 'back' = the person faces the back wall
        return (
          <group key={d.id} position={[d.x, 0, d.z]} rotation-y={rot}>
            <Desk />
            <Monitor screen={d.occupied ? screen : null} on={d.occupied && working} />
            {/* chair: pulled out at the occupied desk, tucked in elsewhere */}
            <group position={[0, 0, d.occupied ? 0.62 : 0.5]}>
              <OfficeChair />
            </group>
            {d.occupied && <DeskProps />}
          </group>
        );
      })}
      {/* partition between the two rows */}
      <group position={[-2.8, 0, -1.53]}>
        <mesh position={[0, 0.62, 0]} castShadow receiveShadow>{<boxGeometry args={[3.2, 1.24, 0.04]} />}{mat.partition}</mesh>
        <mesh position={[0, 1.255, 0]} castShadow>{<boxGeometry args={[3.22, 0.03, 0.06]} />}{mat.steel}</mesh>
      </group>
    </group>
  );
}
