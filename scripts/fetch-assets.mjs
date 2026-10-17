// Downloads the CC0 assets the office uses into public/assets/.
// Poly Haven (furniture, textures, HDRI) and Quaternius via Poly Pizza (the employee).
// Safe to re-run: files already on disk are skipped.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/assets');

const MODELS = [
  'mid_century_lounge_chair', 'modern_coffee_table_01', 'CoffeeCart_01',
  'potted_plant_01', 'potted_plant_02', 'potted_plant_04',
  'steel_frame_shelves_03', 'book_encyclopedia_set_01',
  'drawer_cabinet', 'modern_wooden_cabinet',
  'desk_lamp_arm_01', 'hanging_picture_frame_02',
];
const TEXTURES = ['wood_floor', 'painted_plaster_wall'];
const HDRI = { id: 'modern_buildings_2', res: '2k' };
const CHARACTERS = {
  // Quaternius "Man in Suit" (CC0): Idle, Walk, Sitting, Standing, Clapping…
  'employee.glb': 'https://static.poly.pizza/66b57880-bcb0-479a-8d72-5c3e88afaa39.glb',
};

async function download(url, dest) {
  if (fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

const files = id => fetch(`https://api.polyhaven.com/files/${id}`).then(r => r.json());

async function model(id) {
  const g = (await files(id)).gltf['1k'].gltf;
  const dir = path.join(OUT, 'models', id);
  await download(g.url, path.join(dir, `${id}.gltf`));
  for (const [rel, f] of Object.entries(g.include || {})) await download(f.url, path.join(dir, rel));
}

async function texture(id) {
  const f = await files(id);
  const maps = { diff: f.Diffuse, nor: f.nor_gl, rough: f.Rough };
  for (const [name, m] of Object.entries(maps)) {
    if (m) await download(m['1k'].jpg.url, path.join(OUT, 'textures', id, `${name}.jpg`));
  }
}

async function hdri({ id, res }) {
  const f = await files(id);
  await download(f.hdri[res].hdr.url, path.join(OUT, 'hdri', `${id}.hdr`));
}

const jobs = [
  ...MODELS.map(id => ['model', id, () => model(id)]),
  ...TEXTURES.map(id => ['texture', id, () => texture(id)]),
  ['hdri', HDRI.id, () => hdri(HDRI)],
  ...Object.entries(CHARACTERS).map(([name, url]) => ['character', name, () => download(url, path.join(OUT, 'characters', name))]),
];

for (const [kind, id, run] of jobs) {
  try { await run(); console.log(`✓ ${kind} ${id}`); }
  catch (e) { console.error(`✗ ${kind} ${id}: ${e.message}`); process.exitCode = 1; }
}
