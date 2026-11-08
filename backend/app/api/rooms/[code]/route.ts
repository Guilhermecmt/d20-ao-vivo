import { bodyOf, identity, json, normalizeCode, options, roomState, touchPlayer } from "@/lib/rooms";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export { options as OPTIONS } from "@/lib/rooms";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await context.params).code);
  const user = identity(await bodyOf(request));
  if (!code || !user) return json(request, { error: "Informe o código e o nome do personagem." }, 400);
  const now = Date.now();
  const state = await roomState(code, now);
  if (!state) return json(request, { error: "Sala não encontrada. Confira o link." }, 404);
  await touchPlayer(code, user.playerId, user.name, now);
  return json(request, await roomState(code, now));
}
