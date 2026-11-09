export const CONDITIONS = ['', 'Caído', 'Atordoado', 'Envenenado', 'Imobilizado', 'Invisível', 'Concentrando'];
export const LIMITS = { combatants: 60, quests: 100, items: 150 };
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const integer = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : fallback;
};

export function emptyCampaign() {
  return { version: 1, name: '', combatants: [], activeId: null, round: 1, quests: [], notes: '', items: [] };
}

export function normalizeCampaign(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.combatants)
    || !Array.isArray(input.quests) || !Array.isArray(input.items)) {
    throw new Error('Escolha um arquivo de campanha exportado nesta página.');
  }
  const state = emptyCampaign();
  const usedIds = new Set();
  const id = (value) => {
    let result = text(value, 80);
    if (!result || usedIds.has(result)) result = crypto.randomUUID();
    usedIds.add(result);
    return result;
  };
  state.name = text(input.name, 64);
  state.round = integer(input.round, 1, 99999, 1);
  state.notes = typeof input.notes === 'string' ? input.notes.slice(0, 20000) : '';
  state.combatants = input.combatants.filter(entry => entry && text(entry.name, 40)).slice(0, LIMITS.combatants).map(entry => {
    const maxHp = integer(entry.maxHp, 1, 9999, 10);
    return { id: id(entry.id), name: text(entry.name, 40), kind: entry.kind === 'enemy' ? 'enemy' : 'ally',
      initiative: integer(entry.initiative, -99, 999), maxHp, hp: integer(entry.hp, 0, maxHp, maxHp),
      condition: CONDITIONS.includes(entry.condition) ? entry.condition : '' };
  });
  state.quests = input.quests.filter(entry => entry && text(entry.title, 160)).slice(0, LIMITS.quests)
    .map(entry => ({ id: id(entry.id), title: text(entry.title, 160), done: entry.done === true }));
  state.items = input.items.filter(entry => entry && text(entry.name, 80)).slice(0, LIMITS.items)
    .map(entry => ({ id: id(entry.id), name: text(entry.name, 80), quantity: integer(entry.quantity, 0, 9999, 1), owner: text(entry.owner, 40) }));
  state.activeId = state.combatants.some(entry => entry.id === input.activeId) ? input.activeId : null;
  return state;
}

export function turnOrder(state) {
  return [...state.combatants].sort((a, b) => b.initiative - a.initiative);
}

export function nextTurn(state) {
  const order = turnOrder(state);
  if (!order.length) return;
  const current = order.findIndex(entry => entry.id === state.activeId);
  const next = (current + 1) % order.length;
  if (current >= 0 && next === 0) state.round = Math.min(99999, state.round + 1);
  state.activeId = order[next].id;
}

export function removeCombatant(state, id) {
  const order = turnOrder(state);
  const index = order.findIndex(entry => entry.id === id);
  if (index === -1) return;
  if (state.activeId === id) {
    state.activeId = order.length > 1 ? order[(index + 1) % order.length].id : null;
    if (order.length > 1 && index === order.length - 1) state.round = Math.min(99999, state.round + 1);
  }
  state.combatants = state.combatants.filter(entry => entry.id !== id);
  if (!state.combatants.length) state.round = 1;
}

export function changeHp(entry, amount) {
  entry.hp = integer(entry.hp + amount, 0, entry.maxHp);
}

export function storageKey(room = '') {
  return `d20-campaign-v1:${room || 'solo'}`;
}
