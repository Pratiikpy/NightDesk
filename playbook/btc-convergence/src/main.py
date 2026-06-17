"""Entry point for the BTC Mean-Reversion Convergence Playbook (backtest path).

backtest_support: full → the platform injects runtime.evaluation_mode="historical".
Fetches BTC perpetual bars, replays the deterministic convergence strategy, emits metrics.
"""
import math
from typing import Any

from getagent import backtest, data, runtime


def _sanitize(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def run() -> None:
    cfg = runtime.manifest.get("strategy_config", {}) or {}
    symbols = cfg.get("trading_symbols") or ["BTCUSDT"]
    symbol = symbols[0]

    bars = data.crypto.futures.kline(symbol=symbol, interval="1h", limit=1000)
    replay_frame = backtest.prepare_frame(bars, datetime_index="date")

    if replay_frame.empty:
        runtime.emit_signal(
            action="watch",
            symbol=symbol,
            confidence=0.0,
            metrics={"rows": 0},
            meta={"reason": "no historical bars returned"},
        )
        return

    instrument_key = f"{symbol}.BINANCE"
    result = backtest.run(ohlcv_data={instrument_key: replay_frame}, spec=runtime.backtest_spec)

    chart_path = backtest.generate_chart(result)
    summary = result.summary or {}
    try:
        net_pnl = float(summary.get("net_pnl", 0) or 0)
    except (TypeError, ValueError):
        net_pnl = 0.0

    metrics = {
        key: _sanitize(val)
        for key, val in {
            "total_return_pct": result.total_return_pct,
            "net_pnl": net_pnl,
            "starting_balance": summary.get("starting_balance"),
            "sharpe_ratio": result.sharpe_ratio,
            "max_drawdown_pct": result.max_drawdown_pct,
            "win_rate": result.win_rate,
            "total_trades": result.total_trades,
            "profit_factor": result.profit_factor,
            "rows": len(replay_frame),
        }.items()
    }

    runtime.emit_signal(
        action="long" if net_pnl > 0 else "watch",
        symbol=symbol,
        confidence=_sanitize(result.win_rate) or 0.0,
        metrics=metrics,
        meta={
            "chart_path": chart_path,
            "lookback_period": cfg.get("lookback_period"),
            "entry_z": cfg.get("entry_z"),
            "exit_z": cfg.get("exit_z"),
        },
    )


if __name__ == "__main__":
    run()
