import { angel } from "./angel_pb.js";

export interface ClientCmd {
  type: string;
  id?: string;
  roomId?: string;
  rev?: number;
  payload?: unknown;
}

export interface ServerEvent {
  eventId: string;
  streamId: string;
  seq: number;
  type: string;
  payload?: unknown;
}

export interface ServerFrame {
  type: string;
  roomId: string;
  gameId: string;
  rev: number;
  from: string;
  state?: unknown;
  payload?: unknown;
  event?: ServerEvent;
  error?: { code: string; error: string };
}

function parseJSON(raw: string): unknown {
  if (!raw) return undefined;
  return JSON.parse(raw);
}

export function encodeClient(msg: ClientCmd): Uint8Array {
  const m = angel.ClientMsg.create({
    type: msg.type,
    id: msg.id ?? "",
    roomId: msg.roomId ?? "",
    rev: msg.rev ?? 0,
    payloadJson: msg.payload === undefined ? "" : JSON.stringify(msg.payload),
  });
  return angel.ClientMsg.encode(m).finish();
}

export function decodeServer(data: ArrayBuffer | Uint8Array): ServerFrame {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const sm = angel.ServerMsg.decode(bytes);
  const ev = sm.event;
  const err = sm.error;
  return {
    type: sm.type ?? "",
    roomId: sm.roomId ?? "",
    gameId: sm.gameId ?? "",
    rev: Number(sm.rev ?? 0),
    from: sm.from ?? "",
    state: parseJSON(sm.stateJson ?? ""),
    payload: parseJSON(sm.payloadJson ?? ""),
    event: ev
      ? {
          eventId: ev.eventId ?? "",
          streamId: ev.streamId ?? "",
          seq: Number(ev.seq ?? 0),
          type: ev.type ?? "",
          payload: parseJSON(ev.payloadJson ?? ""),
        }
      : undefined,
    error: err ? { code: err.code ?? "", error: err.error ?? "" } : undefined,
  };
}
