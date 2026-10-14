import { LudoState, COLORS } from '../types';

export class HudRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private lastFrame = performance.now();
  private fps = 0;
  private state: LudoState | null = null;
  private turnInfo = '';

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d ctx');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.w = r.width;
    this.h = r.height;
  }

  setState(s: LudoState, turnInfo: string) {
    this.state = s;
    this.turnInfo = turnInfo;
  }

  private loop = () => {
    const now = performance.now();
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    this.fps = Math.round(1000 / Math.max(dt, 1));
    this.draw();
    requestAnimationFrame(this.loop);
  };

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('FPS ' + this.fps, 8, this.h - 8);

    if (this.state && this.turnInfo) {
      const text = this.turnInfo;
      ctx.font = 'bold 13px system-ui';
      const tw = ctx.measureText(text).width;
      const pad = 10;
      const bx = (this.w - tw) / 2 - pad;
      const by = 8;
      ctx.fillStyle = 'rgba(20,20,40,0.8)';
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + pad * 2, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(text, this.w / 2, by + 19);
    }

    if (this.state) {
      const seat = this.state.turn;
      ctx.beginPath();
      ctx.arc(this.w - 20, this.h - 20, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#' + COLORS[seat].toString(16).padStart(6, '0');
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
