import { allowedDice, bodyOf, db, identity, json, normalizeCode, options, rollCooldown, roomState, touchPlayer } from "@/lib/rooms";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export { options as OPTIONS } from "@/lib/rooms";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await context.params).code);
  const body = await bodyOf(request);
  const user = identity(body);
  const sides = Number((body as { sides?: unknown } | null)?.sides);
  if (!code || !user || !allowedDice.includes(sides as (typeof allowedDice)[number])) {
    return json(request, { error: "Escolha um dado e informe o nome do personagem." }, 400);
  }
  const now = Date.now();
  const state = await roomState(code, now);
  if (!state) return json(request, { error: "Sala não encontrada." }, 404);
  const value = cryptoRandom(sides);
  const row = await db().prepare("UPDATE rooms SET sequence = sequence + 1, current_sides = ?, current_value = ?, current_by = ?, current_at = ? WHERE code = ? AND (current_at IS NULL OR current_at <= ?) RETURNING sequence")
    .bind(sides, value, user.name, now, code, now - rollCooldown).first<{ sequence: number }>();
  if (!row) return json(request, { error: "O dado ainda está rolando. Aguarde um instante." }, 409);
  await db().prepare("INSERT INTO rolls (room_code, sequence, sides, value, by, at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(code, row.sequence, sides, value, user.name, now).run();
  await touchPlayer(code, user.playerId, user.name, now);
  return json(request, await roomState(code, now));
}

function cryptoRandom(sides: number) {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return (values[0] % sides) + 1;
}
