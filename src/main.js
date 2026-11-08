import * as THREE from 'three';
import Peer from 'peerjs';
import './style.css';

const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $('dice-canvas'), roll: $('roll-button'), result: $('result-number'),
  resultLabel: $('result-label'), resultCaption: $('result-caption'),
  create: $('create-button'), join: $('join-button'), nickname: $('nickname'),
  roomCode: $('room-code'), lobby: $('lobby'), activeRoom: $('active-room'),
  activeCode: $('active-code'), hostBadge: $('host-badge'), copy: $('copy-button'),
  leave: $('leave-button'), roomStatus: $('room-status'), playerCount: $('player-count'),
  players: $('players'), history: $('history'), connectionPill: $('connection-pill'),
  connectionText: $('connection-text'), toast: $('toast'),
};

let peer = null;
let hostConnection = null;
const guests = new Map();
let room = null;
let isHost = false;
let connected = false;
let rolling = false;
let members = [];
let history = [];
let toastTimer;

const savedName = localStorage.getItem('d20-name');
if (savedName) ui.nickname.value = savedName;

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3000);
}

function setConnection(text, status = '') {
  ui.connectionText.textContent = text;
  ui.connectionPill.className = `connection-pill ${status}`;
}

function safeName() {
  const name = ui.nickname.value.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Aventureiro';
  localStorage.setItem('d20-name', name);
  return name;
}

function cleanCode(value) { return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}
function randomD20() {
  const byte = new Uint32Array(1);
  const max = Math.floor(0x100000000 / 20) * 20;
  do { crypto.getRandomValues(byte); } while (byte[0] >= max);
  return (byte[0] % 20) + 1;
}
function roomLink() { return `${location.origin}${location.pathname}${location.search}#sala=${room}`; }

function enterRoom(code, host) {
  room = code;
  isHost = host;
  connected = false;
  history = [];
  members = [];
  ui.lobby.hidden = true;
  ui.activeRoom.hidden = false;
  ui.activeCode.textContent = code;
  ui.hostBadge.hidden = !host;
  ui.roomStatus.textContent = host ? 'Preparando sua mesa...' : 'Entrando na mesa...';
  ui.roll.disabled = true;
  renderMembers();
  renderHistory();
  location.hash = `sala=${code}`;
  setConnection('Conectando...');
}

function renderMembers() {
  ui.playerCount.textContent = String(members.length);
  ui.players.replaceChildren();
  if (!members.length) {
    ui.players.className = 'players-empty';
    ui.players.textContent = 'Aguardando aventureiros...';
    return;
  }
  ui.players.className = 'player-list';
  members.forEach((member, index) => {
    const chip = document.createElement('span');
    chip.className = `player-chip ${index === 0 ? 'host' : ''}`;
    chip.textContent = member;
    ui.players.append(chip);
  });
}

function renderHistory() {
  ui.history.replaceChildren();
  if (!history.length) {
    const item = document.createElement('li');
    item.className = 'history-empty';
    item.textContent = 'A história ainda não começou.';
    ui.history.append(item);
    return;
  }
  history.slice(0, 6).forEach((roll) => {
    const item = document.createElement('li');
    item.className = 'history-item';
    const value = document.createElement('span');
    value.className = 'history-value';
    value.textContent = String(roll.value);
    const name = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = roll.by;
    name.append(strong, ' jogou o dado');
    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = new Date(roll.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    item.append(value, name, time);
    ui.history.append(item);
  });
}

function broadcast(payload) {
  for (const connection of guests.values()) {
    if (connection.open) connection.send(payload);
  }
}
function updatePresence() {
  members = [safeName(), ...[...guests.values()].filter((conn) => conn.open && conn.guestName).map((conn) => conn.guestName)];
  renderMembers();
  broadcast({ type: 'presence', members });
}
function validRoll(data) {
  return data && Number.isInteger(data.value) && data.value >= 1 && data.value <= 20
    && typeof data.by === 'string' && data.by.length <= 24 && Number.isFinite(data.at);
}

function receiveRoll(roll) {
  if (!validRoll(roll) || history.some((entry) => entry.id === roll.id)) return;
  rolling = true;
  ui.roll.disabled = true;
  ui.resultLabel.textContent = 'O DADO ESTÁ ROLANDO';
  ui.resultCaption.textContent = `${roll.by} desafiou o destino...`;
  ui.result.textContent = '✦';
  ui.result.className = 'result-number';
  const delay = Math.max(0, Math.min(1000, roll.at - Date.now()));
  setTimeout(() => animateDie(roll.value).then(() => {
    history.unshift(roll);
    history = history.slice(0, 20);
    renderHistory();
    ui.result.textContent = String(roll.value);
    ui.result.className = `result-number ${roll.value === 20 ? 'critical' : roll.value === 1 ? 'fumble' : ''}`;
    ui.resultLabel.textContent = roll.value === 20 ? 'ACERTO CRÍTICO!' : roll.value === 1 ? 'FALHA CRÍTICA' : 'O DESTINO ESCOLHEU';
    ui.resultCaption.textContent = `${roll.by} tirou ${roll.value} no D20.`;
    rolling = false;
    ui.roll.disabled = !connected;
  }), delay);
}

function startRoll(by) {
  if (!isHost || !connected || rolling) return;
  const roll = { type: 'roll', id: crypto.randomUUID(), value: randomD20(), by, at: Date.now() + 350 };
  broadcast(roll);
  receiveRoll(roll);
}

function hostRoom() {
  const code = randomCode();
  enterRoom(code, true);
  peer = new Peer(`d20-${code.toLowerCase()}`);
  peer.on('open', () => {
    connected = true;
    ui.roll.disabled = false;
    ui.roomStatus.textContent = 'Sala aberta. Compartilhe o link e mantenha esta aba aberta.';
    setConnection('Sala ao vivo', 'connected');
    updatePresence();
  });
  peer.on('connection', (connection) => {
    guests.set(connection.peer, connection);
    connection.on('data', (data) => {
      if (!data || typeof data !== 'object') return;
      if (data.type === 'hello') {
        connection.guestName = String(data.name || 'Aventureiro').trim().slice(0, 24) || 'Aventureiro';
        connection.send({ type: 'state', history, members });
        updatePresence();
      } else if (data.type === 'request-roll' && connection.guestName) {
        startRoll(connection.guestName);
      }
    });
    connection.on('close', () => { guests.delete(connection.peer); updatePresence(); });
    connection.on('error', () => { guests.delete(connection.peer); updatePresence(); });
  });
  peer.on('disconnected', () => {
    connected = false;
    ui.roll.disabled = true;
    setConnection('Reconectando...', 'error');
    ui.roomStatus.textContent = 'Conexão interrompida. Tentando reconectar...';
    if (!peer.destroyed) peer.reconnect();
  });
  peer.on('error', (error) => {
    connected = false;
    ui.roll.disabled = true;
    setConnection('Sala indisponível', 'error');
    ui.roomStatus.textContent = error.type === 'unavailable-id'
      ? 'Este código já está em uso. Saia e crie outra sala.'
      : 'Não foi possível conectar. Verifique sua internet e tente novamente.';
  });
}

function joinRoom(code) {
  if (!code) { showToast('Digite o código da sala.'); return; }
  enterRoom(code, false);
  peer = new Peer();
  peer.on('open', () => {
    hostConnection = peer.connect(`d20-${code.toLowerCase()}`, { reliable: true });
    hostConnection.on('open', () => {
      connected = true;
      ui.roll.disabled = false;
      ui.roomStatus.textContent = 'Você está na mesa. Cada rolagem aparece para todos.';
      setConnection('Na sala ao vivo', 'connected');
      hostConnection.send({ type: 'hello', name: safeName() });
    });
    hostConnection.on('data', (data) => {
      if (!data || typeof data !== 'object') return;
      if (data.type === 'state') {
        history = Array.isArray(data.history) ? data.history.filter(validRoll).slice(0, 20) : [];
        members = Array.isArray(data.members) ? data.members.map((name) => String(name).slice(0, 24)).slice(0, 30) : [];
        renderHistory();
        renderMembers();
        if (history.length) {
          const last = history[0];
          settleDie(last.value);
          ui.result.textContent = String(last.value);
          ui.resultLabel.textContent = 'ÚLTIMA ROLAGEM';
          ui.resultCaption.textContent = `${last.by} tirou ${last.value} no D20.`;
        }
      } else if (data.type === 'presence' && Array.isArray(data.members)) {
        members = data.members.map((name) => String(name).slice(0, 24)).slice(0, 30);
        renderMembers();
      } else if (data.type === 'roll') receiveRoll(data);
    });
    hostConnection.on('close', () => {
      connected = false;
      ui.roll.disabled = true;
      setConnection('Mesa desconectada', 'error');
      ui.roomStatus.textContent = 'O criador saiu ou perdeu a conexão. Peça um novo link de sala.';
    });
    hostConnection.on('error', () => {
      connected = false;
      ui.roll.disabled = true;
      setConnection('Conexão perdida', 'error');
      ui.roomStatus.textContent = 'Não foi possível manter a conexão com a sala.';
    });
  });
  peer.on('error', (error) => {
    connected = false;
    ui.roll.disabled = true;
    setConnection('Sala indisponível', 'error');
    ui.roomStatus.textContent = error.type === 'peer-unavailable'
      ? 'Esta sala não está aberta. Peça ao criador para manter a página aberta.'
      : 'Não foi possível entrar. Verifique sua internet e tente novamente.';
  });
}

ui.create.addEventListener('click', hostRoom);
ui.join.addEventListener('click', () => joinRoom(cleanCode(ui.roomCode.value)));
ui.roomCode.addEventListener('keydown', (event) => { if (event.key === 'Enter') ui.join.click(); });
ui.nickname.addEventListener('keydown', (event) => { if (event.key === 'Enter') ui.create.click(); });
ui.roll.addEventListener('click', () => {
  if (!connected || rolling) return;
  if (isHost) startRoll(safeName());
  else if (hostConnection?.open) hostConnection.send({ type: 'request-roll' });
});
ui.copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(roomLink()); showToast('Link copiado! Envie para seus amigos.'); }
  catch { showToast('Copie o endereço desta página para convidar.'); }
});
ui.leave.addEventListener('click', () => {
  if (peer) peer.destroy();
  location.href = `${location.pathname}${location.search}`;
});

const hashCode = cleanCode(new URLSearchParams(location.hash.slice(1)).get('sala') || '');
if (hashCode) joinRoom(hashCode);

// The die is a true twenty-face icosahedron. Each face gets its own raised numeral.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
camera.position.set(0, 5.1, 8.2);
camera.lookAt(0, 0.5, 0);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;
  ui.canvas.append(renderer.domElement);
} catch {
  const fallback = document.createElement('div');
  fallback.textContent = '✦ D20 ✦';
  fallback.style.cssText = 'height:100%;display:grid;place-items:center;font:700 64px Cinzel,serif;color:#d7ad77';
  ui.canvas.append(fallback);
}
scene.add(new THREE.AmbientLight(0xa8a4e6, 2));
const key = new THREE.DirectionalLight(0xffdfae, 5);
key.position.set(-4, 7, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9877ec, 4);
rim.position.set(5, 2, -4);
scene.add(rim);
const die = new THREE.Group();
scene.add(die);
const radius = 1.65;
const geometry = new THREE.IcosahedronGeometry(radius, 0);
const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x582e8d, metalness: 0.32, roughness: 0.33, flatShading: true, side: THREE.DoubleSide });
die.add(new THREE.Mesh(geometry, faceMaterial));
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xe7bf7e, transparent: true, opacity: 0.92 }));
die.add(edges);
const normals = [];
const positions = geometry.getAttribute('position');
for (let face = 0; face < 20; face++) {
  const a = new THREE.Vector3().fromBufferAttribute(positions, face * 3);
  const b = new THREE.Vector3().fromBufferAttribute(positions, face * 3 + 1);
  const c = new THREE.Vector3().fromBufferAttribute(positions, face * 3 + 2);
  const center = a.clone().add(b).add(c).divideScalar(3);
  const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  if (normal.dot(center) < 0) normal.negate();
  normals.push(normal);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff0d4';
  ctx.font = 'bold 150px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffffff55'; ctx.shadowBlur = 10;
  ctx.fillText(String(face + 1), 128, 134);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.73, 0.73), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  label.position.copy(center.addScaledVector(normal, 0.024));
  label.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  die.add(label);
}
die.rotation.set(0.18, 0.48, 0.12);
const up = new THREE.Vector3(0, 1, 0);
function targetRotation(value) {
  const target = new THREE.Quaternion().setFromUnitVectors(normals[value - 1], up);
  target.premultiply(new THREE.Quaternion().setFromAxisAngle(up, 0.25));
  return target;
}
function settleDie(value) { die.quaternion.copy(targetRotation(value)); die.position.y = 0; }
let animation = null;
function animateDie(value) {
  if (!renderer) return Promise.resolve();
  if (animation) animation.resolve();
  return new Promise((resolve) => {
    animation = { start: performance.now(), from: die.quaternion.clone(), to: targetRotation(value), resolve };
  });
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!renderer) return;
  const width = ui.canvas.clientWidth;
  const height = ui.canvas.clientHeight;
  if (width && height && (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(height * renderer.getPixelRatio()))) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  if (animation) {
    const t = Math.min((now - animation.start) / 2300, 1);
    const ease = 1 - Math.pow(1 - t, 4);
    die.quaternion.copy(animation.from).slerp(animation.to, ease);
    const spin = (1 - ease) * Math.PI * 8;
    die.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(spin * 0.65, spin, spin * 0.28)));
    die.position.y = Math.sin(Math.PI * t) * 0.65 + (t > 0.73 ? Math.abs(Math.sin((t - 0.73) * 23)) * (1 - t) * 0.38 : 0);
    if (t === 1) {
      die.quaternion.copy(animation.to);
      die.position.y = 0;
      const done = animation.resolve;
      animation = null;
      done();
    }
  } else if (!history.length) {
    die.rotation.y += 0.0022;
    die.position.y = Math.sin(now * 0.0015) * 0.07;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
