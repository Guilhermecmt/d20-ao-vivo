import { env } from "cloudflare:workers";

const allowedOrigins = new Set([
  "https://guilhermecmt.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export const allowedDice = [4, 6, 8, 10, 12, 20, 100] as const;
export const rollDuration = 2400;
export const rollCooldown = 2800;

export function headers(request: Request) {
  const origin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://guilhermecmt.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

export function json(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers(request) });
}

export function options(request: Request) {
  return new Response(null, { status: 204, headers: headers(request) });
}

export function db(): D1Database {
  if (!env.DB) throw new Error("D1 binding ausente");
  return env.DB;
}

export function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function identity(body: unknown): { playerId: string; name: string } | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (typeof value.playerId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.playerId)) return null;
  if (typeof value.name !== "string") return null;
  const name = value.name.trim().replace(/\s+/g, " ").slice(0, 24);
  return name ? { playerId: value.playerId, name } : null;
}

export async function bodyOf(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 2048) return null;
  try { return await request.json(); } catch { return null; }
}

export function randomNumber(max: number) {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % max;
}

export function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[randomNumber(alphabet.length)]).join("");
}

export async function touchPlayer(code: string, playerId: string, name: string, now: number) {
  await db().prepare("INSERT INTO players (room_code, player_id, name, seen_at) VALUES (?, ?, ?, ?) ON CONFLICT (room_code, player_id) DO UPDATE SET name = excluded.name, seen_at = excluded.seen_at")
    .bind(code, playerId, name, now).run();
}

type RoomRow = {
  code: string; sequence: number; current_sides: number | null;
  current_value: number | null; current_by: string | null; current_at: number | null;
};

export async function roomState(code: string, now = Date.now()) {
  const database = db();
  const room = await database.prepare("SELECT code, sequence, current_sides, current_value, current_by, current_at FROM rooms WHERE code = ?")
    .bind(code).first<RoomRow>();
  if (!room) return null;
  const [players, rolls] = await Promise.all([
    database.prepare("SELECT name FROM players WHERE room_code = ? AND seen_at > ? ORDER BY seen_at ASC LIMIT 30")
      .bind(code, now - 15000).all<{ name: string }>(),
    database.prepare("SELECT sequence, sides, value, by, at FROM rolls WHERE room_code = ? ORDER BY sequence DESC LIMIT 6")
      .bind(code).all<{ sequence: number; sides: number; value: number; by: string; at: number }>(),
  ]);
  return {
    code,
    serverTime: now,
    rollDuration,
    sequence: room.sequence,
    current: room.current_value === null ? null : {
      sequence: room.sequence, sides: room.current_sides,
      value: room.current_value, by: room.current_by, at: room.current_at,
    },
    players: players.results.map((player) => player.name),
    history: rolls.results,
  };
}
