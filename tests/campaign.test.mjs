import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCampaign, normalizeCampaign, turnOrder, nextTurn, removeCombatant, changeHp, storageKey } from '../src/campaign-state.js';

const fighter = (id, initiative, hp = 20) => ({ id, name: id, kind: 'ally', initiative, hp, maxHp: hp, condition: '' });

test('turns follow initiative, preserve ties and advance the round only after the last turn', () => {
  const state = emptyCampaign();
  state.combatants = [fighter('goblin', 8), fighter('Lyra', 18), fighter('Borin', 18)];
  assert.deepEqual(turnOrder(state).map(entry => entry.id), ['Lyra', 'Borin', 'goblin']);
  assert.equal(state.combatants[0].id, 'goblin');
  nextTurn(state);
  assert.equal(state.activeId, 'Lyra');
  assert.equal(state.round, 1);
  nextTurn(state);
  assert.equal(state.activeId, 'Borin');
  nextTurn(state);
  assert.equal(state.activeId, 'goblin');
  assert.equal(state.round, 1);
  nextTurn(state);
  assert.equal(state.activeId, 'Lyra');
  assert.equal(state.round, 2);
});

test('removing a participant preserves or advances the active turn without skipping anyone', () => {
  const state = emptyCampaign();
  state.combatants = [fighter('A', 20), fighter('B', 10), fighter('C', 5)];
  state.activeId = 'B';
  removeCombatant(state, 'A');
  assert.equal(state.activeId, 'B');
  removeCombatant(state, 'B');
  assert.equal(state.activeId, 'C');
  assert.equal(state.round, 1);
  removeCombatant(state, 'C');
  assert.equal(state.activeId, null);
  assert.equal(state.round, 1);
  nextTurn(state);
  assert.equal(state.activeId, null);
});

test('removing the active last participant wraps to the next round', () => {
  const state = emptyCampaign();
  state.combatants = [fighter('A', 20), fighter('B', 10)];
  state.activeId = 'B';
  removeCombatant(state, 'B');
  assert.equal(state.activeId, 'A');
  assert.equal(state.round, 2);
});

test('damage and healing stay within zero and maximum HP', () => {
  const entry = fighter('Lyra', 15, 25);
  changeHp(entry, -100);
  assert.equal(entry.hp, 0);
  changeHp(entry, 7);
  assert.equal(entry.hp, 7);
  changeHp(entry, 100);
  assert.equal(entry.hp, 25);
});

test('campaign backup round trip preserves notes, quests, conditions and inventory', () => {
  const state = emptyCampaign();
  state.name = 'As ruínas de Janos';
  state.combatants = [{ ...fighter('Lyra', 19), hp: 8, condition: 'Envenenado' }];
  state.activeId = 'Lyra';
  state.round = 4;
  state.quests = [{ id: 'quest', title: 'Encontrar a chave', done: true }];
  state.items = [{ id: 'item', name: 'Poção', quantity: 0, owner: 'Borin' }];
  state.notes = 'Primeira linha\nSegunda linha com acentuação: ação.';
  assert.deepEqual(normalizeCampaign(JSON.parse(JSON.stringify(state))), state);
});

test('unrelated, malformed or future backups are rejected', () => {
  for (const input of [null, {}, [], { ...emptyCampaign(), version: 2 }, { ...emptyCampaign(), items: {} }]) {
    assert.throws(() => normalizeCampaign(input), /arquivo de campanha/);
  }
});

test('import bounds quantities, HP and record counts, removes invalid entries and repairs duplicate IDs', () => {
  const state = emptyCampaign();
  state.round = -3;
  state.name = 'X'.repeat(100);
  state.notes = 'Y'.repeat(21000);
  state.combatants = [null, {}, { ...fighter('duplicate', 9000), hp: 900, maxHp: 10, condition: '<script>' }, fighter('duplicate', 10)];
  state.activeId = 'missing';
  state.items = Array.from({ length: 170 }, () => ({ id: 'duplicate', name: 'Moeda', quantity: -8 }));
  state.quests = [null, { id: 'duplicate', title: 'Missão', done: 'false' }];
  const imported = normalizeCampaign(state);
  assert.equal(imported.name.length, 64);
  assert.equal(imported.notes.length, 20000);
  assert.equal(imported.round, 1);
  assert.equal(imported.activeId, null);
  assert.equal(imported.combatants.length, 2);
  assert.equal(imported.combatants[0].hp, 10);
  assert.equal(imported.combatants[0].initiative, 999);
  assert.equal(imported.combatants[0].condition, '');
  assert.equal(imported.items.length, 150);
  assert.equal(imported.items[0].quantity, 0);
  assert.equal(imported.quests[0].done, false);
  const ids = [...imported.combatants, ...imported.items, ...imported.quests].map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('solo and each room use separate notebook storage', () => {
  assert.equal(storageKey(), storageKey(''));
  assert.notEqual(storageKey(), storageKey('ABC123'));
  assert.notEqual(storageKey('ABC123'), storageKey('DEF456'));
});
