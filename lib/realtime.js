import realtime from "./realtime.cjs";

export const emitRealtime = realtime.emitRealtime;

export async function broadcastRealtime(event, payload = {}) {
  try {
    const host = process.env.HOST || "127.0.0.1";
    const port = process.env.PORT || 3000;
    await fetch(`http://${host}:${port}/api/realtime/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload })
    });
  } catch {
    emitRealtime(event, payload);
  }
}
