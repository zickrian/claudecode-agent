// Where everything stands, in metres. x → right, z → towards the camera, y → up.
// The room is 14 × 10 with the back (z = -5) and left (x = -7) walls standing, Sims-style cutaway in front.
export const ROOM = { w: 14, d: 10, h: 3 };

export const DESKS = [
  // front row faces the back wall: its screens face the camera
  { id: 'raka', x: -3.6, z: -0.9, facing: 'back', occupied: true },
  { id: 'desk2', x: -2.0, z: -0.9, facing: 'back' },
  // back row, across the partition
  { id: 'desk3', x: -3.6, z: -2.15, facing: 'front' },
  { id: 'desk4', x: -2.0, z: -2.15, facing: 'front' },
];

// Spots the employee goes to. rot = rotation about y (0 faces +z, the camera side).
export const SPOTS = {
  desk: { pos: [-3.6, 0, -0.3], rot: Math.PI, pose: 'sit' },
  coffee: { pos: [5.25, 0, -3.45], rot: Math.PI, pose: 'stand' },
  lounge: { pos: [2.75, 0, 0.55], rot: Math.PI / 2, pose: 'sit' },
};

// Walking goes through the aisle so nobody walks through a desk.
export const AISLE_Z = 2.3;
export const APPROACH = {
  desk: [-3.6, 0, 0.45],
  coffee: [5.6, 0, -2.6],
  lounge: [2.0, 0, 1.4],
};
