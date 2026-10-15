import type { AngelClient } from './client';
import type { GameID, UserID } from '../../protocol/models';

export interface MatchEndPayload {
  match_id: string;
  winner: UserID;
  duration_sec: number;
  players: UserID[];
}

export interface MoveEvent {
  match_id: string;
  from: UserID;
  type: string;
  payload?: any;
}

export class Metrics {
  private q: any[] = [];
  private timer: any = null;

  constructor(private c: AngelClient, private gameId: GameID) {}

  trackMove(ev: MoveEvent): void {
    this.q.push({ k: 'move', ev });
    this.schedule();
  }

  trackMatchEnd(p: MatchEndPayload): void {
    this.q.push({ k: 'match_end', p });
    this.schedule();
  }

  trackError(code: string, msg: string): void {
    this.q.push({ k: 'error', code, msg });
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 3000);
  }

  private async flush(): Promise<void> {
    this.timer = null;
    if (this.q.length === 0) return;
    const batch = this.q.splice(0, this.q.length);
    try {
      await this.c.http('/metrics/ingest', {
        method: 'POST',
        body: JSON.stringify({ game_id: this.gameId, batch })
      });
    } catch {
      // fail silently — try again on next schedule
    }
  }
}
