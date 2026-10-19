import { decodeServer, encodeClient, type ServerFrame } from "../../protocol/wire.js";

type Handler = (frame: ServerFrame) => void;

export class AngelClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  rev = 0;

  constructor(
    private url: string,
    private roomId: string,
    private userId: string,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      ws.onopen = () => {
        ws.send(encodeClient({ type: "join", id: this.userId, roomId: this.roomId }));
        resolve();
      };
      ws.onerror = () => reject(new Error("ws error"));
      ws.onmessage = (ev) => {
        if (!(ev.data instanceof ArrayBuffer)) return;
        const frame = decodeServer(ev.data);
        this.noteRev(frame);
        this.emit(frame.type, frame);
        if (frame.event?.type) this.emit(frame.event.type, frame);
        if (frame.type === "error" && frame.error) this.emit("error", frame);
      };
    });
  }

  move(payload: unknown): void {
    this.send({ type: "move", roomId: this.roomId, rev: this.rev, payload });
  }

  command(type: string, payload?: unknown): void {
    this.send({ type, roomId: this.roomId, rev: this.rev, payload });
  }

  on(type: string, fn: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  private noteRev(frame: ServerFrame): void {
    if (frame.rev > this.rev) this.rev = frame.rev;
  }

  private emit(type: string, frame: ServerFrame): void {
    this.handlers.get(type)?.forEach((fn) => fn(frame));
  }

  private send(msg: Parameters<typeof encodeClient>[0]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeClient(msg));
  }
}
