import WebSocket from "ws";
import { generateJwt } from "./auth.ts";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
const WS_BASE = BACKEND_URL.replace(/^http/, "ws");

export interface WsClient {
  ws: WebSocket;
  messages: Array<Record<string, unknown>>;
  waitForMessage: (
    type: string,
    timeout?: number,
  ) => Promise<Record<string, unknown>>;
  send: (data: Record<string, unknown>) => void;
  close: () => Promise<void>;
}

function createClient(url: string): Promise<WsClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages: Array<Record<string, unknown>> = [];
    const waiters: Array<{
      type: string;
      resolve: (msg: Record<string, unknown>) => void;
      reject: (err: Error) => void;
    }> = [];

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      messages.push(msg);

      const idx = waiters.findIndex((w) => w.type === msg.type);
      if (idx !== -1) {
        const waiter = waiters.splice(idx, 1)[0];
        waiter.resolve(msg);
      }
    });

    ws.on("open", () => {
      resolve({
        ws,
        messages,
        waitForMessage(type: string, timeout = 10_000) {
          const existing = messages.find((m) => m.type === type);
          if (existing) return Promise.resolve(existing);

          return new Promise((res, rej) => {
            const timer = setTimeout(
              () =>
                rej(
                  new Error(
                    `Timeout waiting for WS message type="${type}"`,
                  ),
                ),
              timeout,
            );
            waiters.push({
              type,
              resolve: (msg) => {
                clearTimeout(timer);
                res(msg);
              },
              reject: rej,
            });
          });
        },
        send(data: Record<string, unknown>) {
          ws.send(JSON.stringify(data));
        },
        close() {
          return new Promise<void>((res) => {
            if (ws.readyState === WebSocket.CLOSED) {
              res();
              return;
            }
            ws.on("close", () => res());
            ws.close();
          });
        },
      });
    });

    ws.on("error", reject);
  });
}

export async function connectHub(
  topics: string[],
  sub = "e2e-ws-user",
): Promise<WsClient> {
  const token = generateJwt(sub);
  const topicParam = encodeURIComponent(topics.join(","));
  const url = `${WS_BASE}/ws?topics=${topicParam}&token=${token}`;
  return createClient(url);
}

export async function connectP2P(
  roomId: string,
  sub = "e2e-p2p-user",
): Promise<WsClient> {
  const token = generateJwt(sub);
  const url = `${WS_BASE}/ws/p2p?room=${encodeURIComponent(roomId)}&token=${token}`;
  return createClient(url);
}
