// Alert bot (PRD §8.2): formats depeg alerts + nightly recaps, posts to Telegram/X.
// Dry-run by default (prints + buffers); real senders activate when creds are present.
import type { PegRow } from "../pegwatch/collect";
import type { Scorecard } from "../ledger/scorecard";

const TAG = "#BitgetHackathon @Bitget_AI";

export function formatDepegAlert(row: PegRow): string {
  const p = row.premiumPct ?? 0;
  const sign = p >= 0 ? "+" : "";
  const arrow = p >= 0 ? "rich" : "cheap";
  return `⚠️ PegWatch — r${row.ticker} ${row.state} ${sign}${p.toFixed(2)}% vs Bitget perp anchor (rToken ${arrow}). Off-hours dislocation. ${TAG}`;
}

export function formatNightlyRecap(s: Scorecard, isoDate: string): string {
  return [
    `🌙 NightDesk recap ${isoDate.slice(0, 10)}`,
    `${s.trades} convergence trades, ${s.graded} graded — hit-rate ${s.hitRatePct}%, convergence captured ${s.convergenceRatePct}%.`,
    `Sim PnL ${s.totalSimPnl >= 0 ? "+" : ""}${s.totalSimPnl}. ${s.gated} blocked by risk gates. 0 human interventions.`,
    TAG,
  ].join("\n");
}

/** Pick the rows worth alerting on (STRETCHED/DISLOCATED + tradeable), capped. */
export function alertableRows(rows: PegRow[], max = 5): PegRow[] {
  return rows
    .filter((r) => r.state && r.state !== "NORMAL" && r.tradeable && r.premiumPct != null)
    .sort((a, b) => Math.abs(b.premiumPct!) - Math.abs(a.premiumPct!))
    .slice(0, max);
}

export interface TelegramCreds {
  botToken: string;
  chatId: string;
}
export interface AlertBotOpts {
  dryRun?: boolean;
  telegram?: TelegramCreds;
}

export class AlertBot {
  sent: string[] = [];
  private dryRun: boolean;
  private telegram?: TelegramCreds;

  constructor(opts: AlertBotOpts = {}) {
    this.telegram = opts.telegram;
    // dry-run unless explicitly disabled AND creds present
    this.dryRun = opts.dryRun ?? !opts.telegram;
  }

  async send(text: string): Promise<void> {
    this.sent.push(text);
    if (this.dryRun || !this.telegram) {
      console.log(`[alert:dry-run]\n${text}\n`);
      return;
    }
    const url = `https://api.telegram.org/bot${this.telegram.botToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: this.telegram.chatId, text }),
      signal: AbortSignal.timeout(15_000),
    });
  }
}

export function alertBotFromEnv(env: NodeJS.ProcessEnv = process.env): AlertBot {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) return new AlertBot({ telegram: { botToken, chatId }, dryRun: false });
  return new AlertBot({ dryRun: true });
}
