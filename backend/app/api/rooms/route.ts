import { bodyOf, db, identity, json, newCode, options, roomState, touchPlayer } from "@/lib/rooms";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export { options as OPTIONS } from "@/lib/rooms";

export async function POST(request: Request) {
  const user = identity(await bodyOf(request));
  if (!user) return json(request, { error: "Informe o nome do personagem." }, 400);
  const now = Date.now();
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    code = newCode();
    try {
      await db().prepare("INSERT INTO rooms (code, created_at, sequence) VALUES (?, ?, 0)")
        .bind(code, now).run();
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      code = "";
    }
  }
  await touchPlayer(code, user.playerId, user.name, now);
  return json(request, await roomState(code, now), 201);
}
