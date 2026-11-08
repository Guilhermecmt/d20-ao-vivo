import assert from 'node:assert/strict';
import { test } from 'node:test';

const base = process.env.DICE_API_BASE || 'http://127.0.0.1:8787';

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://guilhermecmt.github.io' },
    body: JSON.stringify(body),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}

test('três personagens recebem as mesmas rolagens de D6 e D100', async () => {
  const preflight = await fetch(`${base}/api/rooms`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://guilhermecmt.github.io',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://guilhermecmt.github.io');
  assert.match(preflight.headers.get('access-control-allow-headers') || '', /content-type/i);
  const alice = { playerId: crypto.randomUUID(), name: 'Aria' };
  const bruno = { playerId: crypto.randomUUID(), name: 'Bruno' };
  const clara = { playerId: crypto.randomUUID(), name: 'Clara' };
  const created = await post('/api/rooms', alice);
  assert.equal(created.status, 201);
  const code = created.body.code;
  assert.match(code, /^[A-Z0-9]{8}$/);
  assert.equal(created.headers.get('access-control-allow-origin'), 'https://guilhermecmt.github.io');

  const joined = await Promise.all([bruno, clara].map((player) => post(`/api/rooms/${code}`, player)));
  joined.forEach((reply) => assert.equal(reply.status, 200));
  const rolled = await post(`/api/rooms/${code}/roll`, { ...bruno, sides: 6 });
  assert.equal(rolled.status, 200);
  assert.equal(rolled.body.current.sides, 6);
  assert.ok(rolled.body.current.value >= 1 && rolled.body.current.value <= 6);

  const views = await Promise.all([alice, bruno, clara].map((player) => post(`/api/rooms/${code}`, player)));
  const values = views.map((view) => view.body.current.value);
  assert.deepEqual(values, [rolled.body.current.value, rolled.body.current.value, rolled.body.current.value]);
  views.forEach((view) => {
    assert.equal(view.body.current.sequence, rolled.body.current.sequence);
    assert.equal(view.body.current.by, 'Bruno');
    assert.equal(view.body.players.length, 3);
  });

  const busy = await post(`/api/rooms/${code}/roll`, { ...clara, sides: 20 });
  assert.equal(busy.status, 409);
  await new Promise((resolve) => setTimeout(resolve, 2900));

  const percentile = await post(`/api/rooms/${code}/roll`, { ...clara, sides: 100 });
  assert.equal(percentile.status, 200);
  assert.ok(percentile.body.current.value >= 1 && percentile.body.current.value <= 100);
  const again = await Promise.all([alice, bruno, clara].map((player) => post(`/api/rooms/${code}`, player)));
  again.forEach((view) => {
    assert.equal(view.body.current.sequence, percentile.body.current.sequence);
    assert.equal(view.body.current.value, percentile.body.current.value);
    assert.equal(view.body.history[0].sides, 100);
  });
});

test('todos os tipos de dado são aceitos e respeitam seus limites', async () => {
  await Promise.all([4, 6, 8, 10, 12, 20, 100].map(async (sides) => {
    const player = { playerId: crypto.randomUUID(), name: `Herói D${sides}` };
    const created = await post('/api/rooms', player);
    assert.equal(created.status, 201);
    const rolled = await post(`/api/rooms/${created.body.code}/roll`, { ...player, sides });
    assert.equal(rolled.status, 200, `D${sides}`);
    assert.equal(rolled.body.current.sides, sides);
    assert.ok(rolled.body.current.value >= 1 && rolled.body.current.value <= sides);
  }));
});
