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
  events: ServerEvent[];
  event?: ServerEvent;
  error?: { code: string; error: string };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const maxFrameBytes = 1024 * 1024;

function safeInteger(value: unknown): number {
  const result = Number(value ?? 0);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error("Invalid protocol revision or sequence");
  }
  return result;
}

function encodeJSON(value: unknown): Uint8Array {
  if (value === undefined) return new Uint8Array();
  const text = JSON.stringify(value);
  if (text === undefined) {
    throw new Error("Payload is not JSON serializable");
  }
  return encoder.encode(text);
}

function decodeJSON(bytes?: Uint8Array | null): unknown {
  if (!bytes?.length) return undefined;
  return JSON.parse(decoder.decode(bytes));
}

export function encodeClient(msg: ClientCmd): Uint8Array {
  const message = angel.ClientMsg.create({
    type: msg.type,
    id: msg.id ?? "",
    roomId: msg.roomId ?? "",
    rev: safeInteger(msg.rev),
    payload: encodeJSON(msg.payload),
  });
  const bytes = angel.ClientMsg.encode(message).finish();
  if (bytes.length > maxFrameBytes) {
    throw new Error("Client frame is too large");
  }
  return bytes;
}

export function decodeServer(
  data: ArrayBuffer | Uint8Array,
): ServerFrame {
  const bytes = data instanceof Uint8Array
    ? data
    : new Uint8Array(data);

  if (bytes.length > maxFrameBytes) {
    throw new Error("Server frame is too large");
  }

  const message = angel.ServerMsg.decode(bytes);
  const events: ServerEvent[] = (message.events ?? []).map(event => ({
    eventId: event.eventId ?? "",
    streamId: event.streamId ?? "",
    seq: safeInteger(event.seq),
    type: event.type ?? "",
    payload: decodeJSON(event.payload),
  }));

  return {
    type: message.type ?? "",
    roomId: message.roomId ?? "",
    gameId: message.gameId ?? "",
    rev: safeInteger(message.rev),
    from: message.from ?? "",
    state: decodeJSON(message.state),
    payload: decodeJSON(message.payload),
    events,
    event: events[0],
    error: message.error
      ? {
          code: message.error.code ?? "",
          error: message.error.error ?? "",
        }
      : undefined,
  };
}
