// Poly Haven furniture (CC0, real-world scale) placed around the room.
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';

const url = id => `/assets/models/${id}/${id}.gltf`;

export function Model({ id, position = [0, 0, 0], rotation = 0, scale = 1 }) {
  const { scene } = useGLTF(url(id));
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return c;
  }, [scene]);
  return <primitive object={obj} position={position} rotation-y={rotation} scale={scale} />;
}

function Tv({ screen }) {
  return (
    <group position={[3.6, 1.62, -4.89]}>
      <mesh castShadow>
        <boxGeometry args={[1.66, 0.96, 0.04]} />
        <meshStandardMaterial color="#111214" roughness={0.3} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <planeGeometry args={[1.6, 0.9]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Furniture({ tvScreen }) {
  return (
    <group>
      {/* lounge: two mid-century chairs around a coffee table */}
      <Model id="mid_century_lounge_chair" position={[2.75, 0, 0.55]} rotation={Math.PI / 2} />
      <Model id="mid_century_lounge_chair" position={[4.85, 0, 0.55]} rotation={-Math.PI / 2} />
      <Model id="modern_coffee_table_01" position={[3.8, 0, 0.55]} />
      <Model id="potted_plant_04" position={[3.75, 0.39, 0.3]} />

      {/* media wall: credenza + TV on the teal accent wall */}
      <Model id="modern_wooden_cabinet" position={[3.2, 0, -4.62]} scale={0.7} />
      <Tv screen={tvScreen} />

      {/* coffee corner: where breaks happen */}
      <Model id="CoffeeCart_01" position={[5.75, 0, -4.35]} />
      <Model id="potted_plant_01" position={[6.4, 0, -1.6]} />

      {/* storage along the left wall */}
      <Model id="steel_frame_shelves_03" position={[-6.55, 0, 2.6]} rotation={Math.PI / 2} />
      <Model id="book_encyclopedia_set_01" position={[-6.6, 1.17, 2.2]} rotation={Math.PI / 2} />
      <Model id="potted_plant_04" position={[-6.6, 1.69, 3.1]} />
      <Model id="drawer_cabinet" position={[1.5, 0, -4.7]} />

      {/* plants */}
      <Model id="potted_plant_01" position={[-6.35, 0, -4.35]} />
      <Model id="potted_plant_02" position={[-0.5, 0, -4.4]} />
      <Model id="potted_plant_02" position={[-6.4, 0, 4.2]} />

      {/* the occupied desk's things */}
      <Model id="desk_lamp_arm_01" position={[-4.15, 0.76, -1.05]} rotation={0.4} />
      <Model id="hanging_picture_frame_02" position={[1.5, 2.25, -4.9]} scale={1.2} />
    </group>
  );
}

['mid_century_lounge_chair', 'modern_coffee_table_01', 'potted_plant_04', 'modern_wooden_cabinet', 'CoffeeCart_01',
  'potted_plant_01', 'steel_frame_shelves_03', 'book_encyclopedia_set_01', 'drawer_cabinet', 'potted_plant_02',
  'desk_lamp_arm_01', 'hanging_picture_frame_02'].forEach(id => useGLTF.preload(url(id)));
