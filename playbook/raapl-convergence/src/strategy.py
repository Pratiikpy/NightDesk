"""Deterministic off-hours mean-reversion (convergence) strategy on rAAPL spot.

Long-only: opens when price has stretched far below its recent fair-value path
(a temporary discount), exits when price reverts back toward fair value.
"""
from decimal import Decimal
from statistics import fmean, pstdev
from typing import Optional

from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.model.objects import Quantity
from nautilus_trader.trading.strategy import Strategy


class ConvergenceStrategyConfig(StrategyConfig):
    instrument_id: Optional[InstrumentId] = None
    bar_type: Optional[BarType] = None
    instrument_ids: tuple[InstrumentId, ...] = ()
    bar_types: tuple[BarType, ...] = ()
    trade_size: str = "1"
    lookback_period: int = 48
    entry_z: float = 1.5
    exit_z: float = 0.3


class ConvergenceStrategy(Strategy):
    def __init__(self, config: ConvergenceStrategyConfig) -> None:
        super().__init__(config)
        self.cfg = config
        self._closes: list[float] = []
        self._position: str = "NONE"
        self._instrument: Optional[Instrument] = None

    def on_start(self) -> None:
        bar_type = self.cfg.bar_type or (self.cfg.bar_types[0] if self.cfg.bar_types else None)
        instrument_id = self.cfg.instrument_id or (
            self.cfg.instrument_ids[0] if self.cfg.instrument_ids else None
        )
        if bar_type is None or instrument_id is None:
            raise RuntimeError("bar_type and instrument_id must be set")
        self._instrument = self.cache.instrument(instrument_id)
        self.subscribe_bars(bar_type)

    def on_bar(self, bar: Bar) -> None:
        close = float(bar.close)
        self._closes.append(close)

        n = int(self.cfg.lookback_period)
        if len(self._closes) < n + 1:
            return

        window = self._closes[-n:]
        mean = fmean(window)
        sd = pstdev(window)
        if sd <= 0.0:
            return
        z = (close - mean) / sd  # how far price has stretched from its fair-value path

        instrument = self._instrument
        if instrument is None:
            return
        qty = Quantity(Decimal(self.cfg.trade_size), instrument.size_precision)

        if self._position == "NONE":
            if z <= -float(self.cfg.entry_z):  # deep discount → expect convergence up
                self._submit(instrument.id, OrderSide.BUY, qty)
                self._position = "LONG"
        elif self._position == "LONG":
            if z >= -float(self.cfg.exit_z):  # reverted toward fair value → take it
                self._close_open(instrument.id, OrderSide.SELL)
                self._position = "NONE"

    def _submit(self, instrument_id: InstrumentId, side: OrderSide, quantity: Quantity) -> None:
        order = self.order_factory.market(
            instrument_id=instrument_id,
            order_side=side,
            quantity=quantity,
            time_in_force=TimeInForce.GTC,
        )
        self.submit_order(order)

    def _close_open(self, instrument_id: InstrumentId, side: OrderSide) -> None:
        for position in self.cache.positions_open(instrument_id=instrument_id):
            self._submit(instrument_id, side, position.quantity)

    def on_stop(self) -> None:
        if self._instrument is not None:
            self.cancel_all_orders(self._instrument.id)
            self.close_all_positions(self._instrument.id)
