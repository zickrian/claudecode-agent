import { useEffect, useRef, useState } from 'react';
import { Scene } from './scene/Scene.jsx';
import { Panel } from './ui/Panel.jsx';
import { UsageBadge } from './ui/UsageBadge.jsx';
import { useOffice } from './useOffice.js';

const VIEW_LABEL = { kantor: 'Kantor', layar: 'Layar Raka', istirahat: 'Area istirahat' };

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="clock">
      <b>{now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</b>
      <span>{now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
    </div>
  );
}

export default function App() {
  const { state, connected, actions } = useOffice();
  const camera = useRef();
  const [view, setView] = useState('kantor');
  const [tab, setTab] = useState('perintah');

  const go = v => { setView(v); camera.current?.go(v); };

  if (!state) {
    return <div className="loading">{connected ? 'Memuat kantor…' : 'Menghubungkan ke server… (jalankan npm run dev)'}</div>;
  }
  const name = state.config.employee.name;
  // dev only: ?pose=working|done|error previews a status in the 3D scene without starting a run
  const pose = import.meta.env.DEV && new URLSearchParams(location.search).get('pose');
  const sceneState = pose ? { ...state, employee: { ...state.employee, status: pose } } : state;

  return (
    <div className="app">
      <div className="stage">
        <Scene ref={camera} data={sceneState} teleport={!!pose} onSelectEmployee={() => { setTab('aktivitas'); go('layar'); }} />
        <UsageBadge usage={state.usage} connected={connected} />
        <div className="views">
          {Object.keys(VIEW_LABEL).map(v => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => go(v)}>
              {v === 'layar' ? `Layar ${name}` : VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <Clock />
      </div>
      <Panel state={state} actions={actions} tab={tab} setTab={setTab} />
    </div>
  );
}
