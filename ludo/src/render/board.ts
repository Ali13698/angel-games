import { Application, Graphics, Container } from 'pixi.js';
import { COLORS, TOKENS_PER_SEAT, BOARD_SIZE, CELL, LudoState } from '../types';

export class BoardRenderer {
  app!: Application;
  boardLayer!: Container;
  tokenLayer!: Container;
  private ready = false;

  async init(canvas: HTMLCanvasElement) {
    this.app = new Application();
    await this.app.init({
      canvas,
      width: BOARD_SIZE * CELL,
      height: BOARD_SIZE * CELL,
      background: 0x0a0e1a,
      antialias: true
    });
    this.boardLayer = new Container();
    this.tokenLayer = new Container();
    this.app.stage.addChild(this.boardLayer);
    this.app.stage.addChild(this.tokenLayer);
    this.drawBoard();
    this.ready = true;
  }

  private drawBoard() {
    const bg = new Graphics();
    bg.rect(0, 0, BOARD_SIZE * CELL, BOARD_SIZE * CELL).fill(0x1a1f3a);
    this.boardLayer.addChild(bg);

    const grid = new Graphics();
    for (let i = 0; i <= BOARD_SIZE; i++) {
      grid.moveTo(i * CELL, 0).lineTo(i * CELL, BOARD_SIZE * CELL);
      grid.moveTo(0, i * CELL).lineTo(BOARD_SIZE * CELL, i * CELL);
    }
    grid.stroke({ width: 1, color: 0x2a3050, alpha: 0.5 });
    this.boardLayer.addChild(grid);

    const bases = [
      { x: 0, y: 0, c: COLORS[0] },
      { x: 9, y: 0, c: COLORS[1] },
      { x: 9, y: 9, c: COLORS[2] },
      { x: 0, y: 9, c: COLORS[3] }
    ];
    for (const b of bases) {
      const g = new Graphics();
      g.rect(b.x * CELL, b.y * CELL, 6 * CELL, 6 * CELL).fill({ color: b.c, alpha: 0.15 });
      g.rect(b.x * CELL, b.y * CELL, 6 * CELL, 6 * CELL).stroke({ width: 2, color: b.c });
      this.boardLayer.addChild(g);
    }

    const center = new Graphics();
    center.rect(6 * CELL, 6 * CELL, 3 * CELL, 3 * CELL).fill(0x2a3050);
    center.rect(6 * CELL, 6 * CELL, 3 * CELL, 3 * CELL).stroke({ width: 2, color: 0x555555 });
    this.boardLayer.addChild(center);

    const offsets = [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]];
    for (let s = 0; s < 4; s++) {
      const bx = [0, 9, 9, 0][s];
      const by = [0, 0, 9, 9][s];
      for (const [ox, oy] of offsets) {
        const g = new Graphics();
        g.circle((bx + ox) * CELL, (by + oy) * CELL, CELL * 0.4)
          .stroke({ width: 2, color: COLORS[s], alpha: 0.4 });
        this.boardLayer.addChild(g);
      }
    }
  }

  private relToCell(seat: number, rel: number): [number, number] {
    if (rel < 0) return [-1, -1];
    const total = 52;
    const abs = (seat * 13 + rel) % total;
    const ring: [number, number][] = [];
    for (let c = 0; c <= 14; c++) ring.push([c, 0]);
    for (let r = 1; r <= 14; r++) ring.push([14, r]);
    for (let c = 13; c >= 0; c--) ring.push([c, 14]);
    for (let r = 13; r >= 1; r--) ring.push([0, r]);
    const picked: [number, number][] = [];
    for (let i = 0; i < 52; i++) {
      const idx = Math.floor((i / 52) * ring.length);
      picked.push(ring[idx]);
    }
    return picked[abs] || [7, 7];
  }

  render(state: LudoState) {
    if (!this.ready) return;
    this.tokenLayer.removeChildren();
    const offsets = [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]];
    for (let seat = 0; seat < 4; seat++) {
      for (let t = 0; t < TOKENS_PER_SEAT; t++) {
        const rel = state.tokens[seat * TOKENS_PER_SEAT + t];
        let cx = 0, cy = 0;
        if (rel < 0) {
          const bx = [0, 9, 9, 0][seat];
          const by = [0, 0, 9, 9][seat];
          const [ox, oy] = offsets[t];
          cx = (bx + ox) * CELL;
          cy = (by + oy) * CELL;
        } else {
          const [c, r] = this.relToCell(seat, rel);
          cx = (c + 0.5) * CELL;
          cy = (r + 0.5) * CELL;
        }
        const g = new Graphics();
        g.circle(cx, cy, CELL * 0.32)
          .fill(COLORS[seat])
          .stroke({ width: 2, color: 0xffffff });
        this.tokenLayer.addChild(g);
      }
    }
  }
}
