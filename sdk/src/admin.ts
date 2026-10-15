import type { AngelClient } from './client';
import type { RealtimeStats, DailyStats, PeriodStats } from '../../protocol/rest';
import type { GameID, UserID } from '../../protocol/models';

export class AdminApi {
  constructor(private c: AngelClient) {}

  listGames(): Promise<{ games: string[] }> {
    return this.c.http('/admin/games');
  }

  realtime(gameId: GameID): Promise<RealtimeStats> {
    return this.c.http('/admin/metrics/realtime?game=' + gameId);
  }

  daily(gameId: GameID, date: string): Promise<DailyStats> {
    return this.c.http('/admin/metrics/daily?game=' + gameId + '&date=' + date);
  }

  weekly(gameId: GameID, from: string, to: string): Promise<PeriodStats> {
    return this.c.http('/admin/metrics/period?game=' + gameId + '&gran=week&from=' + from + '&to=' + to);
  }

  monthly(gameId: GameID, year: number, month: number): Promise<PeriodStats> {
    return this.c.http('/admin/metrics/period?game=' + gameId + '&gran=month&y=' + year + '&m=' + month);
  }

  yearly(gameId: GameID, year: number): Promise<PeriodStats> {
    return this.c.http('/admin/metrics/period?game=' + gameId + '&gran=year&y=' + year);
  }

  player(gameId: GameID, userId: UserID): Promise<any> {
    return this.c.http('/admin/player?game=' + gameId + '&user=' + userId);
  }

  health(gameId: GameID): Promise<any> {
    return this.c.http('/admin/health?game=' + gameId);
  }
}
