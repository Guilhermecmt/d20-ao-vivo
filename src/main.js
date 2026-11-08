import './style.css';
import './dice-picker.css';
import { createDiceStage } from './dice.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://d20-sala-api-guilherme.adroitmixer16.chatgpt.site';
const DICE = [4, 6, 8, 10, 12, 20, 100];
const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $('dice-canvas'), picker: document.querySelector('.dice-picker'), diceType: $('dice-type'),
  roll: $('roll-button'), rollLabel: $('roll-button-label'), result: $('result-number'),
  resultLabel: $('result-label'), resultCaption: $('result-caption'),
  create: $('create-button'), join: $('join-button'), nickname: $('nickname'),
  roomCode: $('room-code'), lobbyHelp: $('lobby-help'), lobby: $('lobby'), activeRoom: $('active-room'),
  activeCode: $('active-code'), hostBadge: $('host-badge'), copy: $('copy-button'),
  leave: $('leave-button'), roomStatus: $('room-status'), playerCount: $('player-count'),
  players: $('players'), history: $('history'), connectionPill: $('connection-pill'),
  connectionText: $('connection-text'), toast: $('toast'),
};
const stage = createDiceStage(ui.canvas);
const playerId = crypto.randomUUID();
let playerName = '';
let room = '';
let selectedSides = 20;
let connected = false;
let rolling = false;
let requestingRoll = false;
let lastSequence = -1;
let currentRoll = null;
let history = [];
let serverOffset = 0;
let pollTimer = null;
let revealTimer = null;
let toastTimer = null;
let syncInFlight = false;
let failures = 0;

const savedName = localStorage.getItem('d20-character-name');
if (savedName) ui.nickname.value = savedName;

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3200);
}

function setConnection(message, status = '') {
  ui.connectionText.textContent = message;
  ui.connectionPill.className = `connection-pill ${status}`;
}

function nameFromInput() {
  const name = ui.nickname.value.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!name) {
    ui.nickname.focus();
    showToast('Escreva o nome do seu personagem.');
    return null;
  }
  localStorage.setItem('d20-character-name', name);
  return name;
}

function cleanCode(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function roomLink() {
  return `${location.origin}${location.pathname}${location.search}#sala=${room}`;
}

async function request(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  const started = Date.now();
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível conversar com a sala.');
    if (Number.isFinite(data.serverTime)) serverOffset = data.serverTime - (started + Date.now()) / 2;
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function setSelectedDie(sides, clearResult = true) {
  if (!DICE.includes(sides)) return;
  selectedSides = sides;
  ui.picker.querySelectorAll('button').forEach((button) => {
    const selected = Number(button.dataset.sides) === sides;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  ui.diceType.innerHTML = `D${sides} <span>✧</span>`;
  ui.rollLabel.textContent = `JOGAR D${sides}`;
  stage.setDice(sides);
  if (clearResult) {
    ui.result.textContent = '—';
    ui.result.className = 'result-number';
    ui.resultLabel.textContent = 'SUA PRÓXIMA ROLAGEM';
    ui.resultCaption.textContent = `Pronto para rolar o D${sides}.`;
  }
}

function updateButton() {
  ui.roll.disabled = !connected || rolling || requestingRoll;
  ui.picker.querySelectorAll('button').forEach((button) => { button.disabled = rolling; });
}

function renderMembers(players) {
  ui.playerCount.textContent = String(players.length);
  ui.players.replaceChildren();
  if (!players.length) {
    ui.players.className = 'players-empty';
    ui.players.textContent = 'Aguardando personagens...';
    return;
  }
  ui.players.className = 'player-list';
  players.forEach((name) => {
    const chip = document.createElement('span');
    chip.className = 'player-chip';
    chip.textContent = String(name).slice(0, 24);
    ui.players.append(chip);
  });
}

function renderHistory() {
  ui.history.replaceChildren();
  const now = Date.now() + serverOffset;
  const visible = history.filter((roll) => roll.at + 2400 <= now).slice(0, 6);
  if (!visible.length) {
    const item = document.createElement('li');
    item.className = 'history-empty';
    item.textContent = 'A história ainda não começou.';
    ui.history.append(item);
    return;
  }
  visible.forEach((roll) => {
    const item = document.createElement('li');
    item.className = 'history-item';
    const value = document.createElement('span');
    value.className = 'history-value';
    value.textContent = String(roll.value);
    const name = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = String(roll.by).slice(0, 24);
    name.append(strong, ` jogou D${roll.sides}`);
    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = new Date(roll.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    item.append(value, name, time);
    ui.history.append(item);
  });
}

function validRoll(roll) {
  return roll && Number.isInteger(roll.sequence) && DICE.includes(roll.sides)
    && Number.isInteger(roll.value) && roll.value >= 1 && roll.value <= roll.sides
    && typeof roll.by === 'string' && Number.isFinite(roll.at);
}

function finishRoll(sequence) {
  if (!currentRoll || currentRoll.sequence !== sequence) return;
  clearTimeout(revealTimer);
  const roll = currentRoll;
  stage.settle(roll.sides, roll.value);
  ui.result.textContent = String(roll.value);
  ui.result.className = `result-number ${roll.value === roll.sides ? 'critical' : roll.value === 1 ? 'fumble' : ''}`;
  ui.resultLabel.textContent = roll.value === roll.sides ? 'RESULTADO MÁXIMO!' : roll.value === 1 ? 'RESULTADO MÍNIMO' : 'O DESTINO ESCOLHEU';
  ui.resultCaption.textContent = `${roll.by} tirou ${roll.value} no D${roll.sides}.`;
  rolling = false;
  updateButton();
  renderHistory();
}

function showRoll(roll, duration) {
  if (!validRoll(roll)) return;
  lastSequence = roll.sequence;
  currentRoll = roll;
  clearTimeout(revealTimer);
  setSelectedDie(roll.sides, false);
  const remaining = roll.at + duration - (Date.now() + serverOffset);
  if (remaining <= 0) {
    finishRoll(roll.sequence);
    return;
  }
  rolling = true;
  updateButton();
  ui.result.textContent = '✦';
  ui.result.className = 'result-number';
  ui.resultLabel.textContent = `D${roll.sides} ROLANDO`;
  ui.resultCaption.textContent = `${roll.by} desafiou o destino...`;
  stage.roll(roll.sides, roll.value, remaining);
  revealTimer = setTimeout(() => finishRoll(roll.sequence), remaining);
}

function receiveState(state) {
  failures = 0;
  if (!connected) {
    connected = true;
    setConnection('Sala ao vivo', 'connected');
    ui.roomStatus.textContent = 'Sala conectada. Todas as jogadas aparecem para todos.';
  }
  if (Array.isArray(state.players)) renderMembers(state.players);
  history = Array.isArray(state.history) ? state.history.filter(validRoll) : [];
  if (validRoll(state.current) && state.current.sequence > lastSequence) {
    showRoll(state.current, Number(state.rollDuration) || 2400);
  } else if (rolling && currentRoll && Date.now() + serverOffset >= currentRoll.at + 2400) {
    finishRoll(currentRoll.sequence);
  }
  renderHistory();
  updateButton();
}

async function sync() {
  if (!room || syncInFlight) return;
  syncInFlight = true;
  try {
    const state = await request(`/api/rooms/${room}`, { playerId, name: playerName });
    receiveState(state);
  } catch {
    failures++;
    if (failures >= 3) {
      connected = false;
      setConnection('Reconectando...', 'error');
      ui.roomStatus.textContent = 'Sem conexão com a sala. Tentando novamente...';
      updateButton();
    }
  } finally {
    syncInFlight = false;
  }
}

function enterRoom(code, state, creator) {
  room = code;
  ui.lobby.hidden = true;
  ui.activeRoom.hidden = false;
  ui.activeCode.textContent = code;
  ui.hostBadge.hidden = !creator;
  location.hash = `sala=${code}`;
  receiveState(state);
  pollTimer = setInterval(sync, 700);
}

async function begin(creator) {
  const name = nameFromInput();
  if (!name) return;
  const code = cleanCode(ui.roomCode.value);
  if (!creator && !code) { ui.roomCode.focus(); showToast('Digite o código da sala.'); return; }
  ui.create.disabled = true;
  ui.join.disabled = true;
  setConnection('Conectando...');
  try {
    const state = await request(creator ? '/api/rooms' : `/api/rooms/${code}`, { playerId, name });
    playerName = name;
    enterRoom(creator ? state.code : code, state, creator);
  } catch (error) {
    setConnection('Pronto para jogar');
    showToast(error.message === 'Failed to fetch' ? 'Não foi possível conectar. Tente novamente.' : error.message);
  } finally {
    ui.create.disabled = false;
    ui.join.disabled = false;
  }
}

async function rollSelected() {
  if (!connected || rolling || requestingRoll) return;
  requestingRoll = true;
  updateButton();
  try {
    const state = await request(`/api/rooms/${room}/roll`, { playerId, name: playerName, sides: selectedSides });
    receiveState(state);
  } catch (error) {
    showToast(error.message);
    sync();
  } finally {
    requestingRoll = false;
    updateButton();
  }
}

ui.create.addEventListener('click', () => begin(true));
ui.join.addEventListener('click', () => begin(false));
ui.roll.addEventListener('click', rollSelected);
ui.picker.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-sides]');
  if (button && !rolling) setSelectedDie(Number(button.dataset.sides));
});
ui.roomCode.addEventListener('keydown', (event) => { if (event.key === 'Enter') ui.join.click(); });
ui.nickname.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') (ui.roomCode.value ? ui.join : ui.create).click();
});
ui.copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(roomLink()); showToast('Link copiado! Envie para seus amigos.'); }
  catch { showToast('Copie o endereço desta página para convidar.'); }
});
ui.leave.addEventListener('click', () => {
  clearInterval(pollTimer);
  location.href = `${location.pathname}${location.search}`;
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && room) {
    if (rolling && currentRoll && Date.now() + serverOffset >= currentRoll.at + 2400) {
      finishRoll(currentRoll.sequence);
    }
    sync();
  }
});

const invitation = cleanCode(new URLSearchParams(location.hash.slice(1)).get('sala') || '');
if (invitation) {
  ui.roomCode.value = invitation;
  ui.nickname.value = '';
  ui.lobbyHelp.textContent = 'Convite recebido. Digite o nome do personagem e clique em Entrar.';
  ui.nickname.focus();
}
