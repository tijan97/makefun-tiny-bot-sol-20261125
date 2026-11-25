// Tiny Bot: beat buy-and-hold on Solana hourly bars (agent-fun/bars-replay/v1).
//
// Strategy — per-symbol trend following with a long-trend filter and risk control:
//   * EMA(8) vs EMA(21) crossover on hourly closes: enter on a cross up, exit
//     when fast EMA falls back below slow EMA (the cross flips the other way).
//   * Long-trend filter: only enter when the close sits above EMA(50). In a
//     broad downtrend most symbols fail this, so the bot waits in USDC instead
//     of catching falling knives; in an uptrend it rides the symbols that
//     have already turned up.
//   * Stop-loss: sell a position worth <= 95% of its cost (-5%), and exit
//     when the close falls back under EMA(50) — the long trend broke, so
//     get out even before the fast/slow cross flips.
//   * Take-profit: sell a position worth >= 135% of its cost (+35%), then
//     re-enter on the next fresh cross-up (locks in gains, avoids giving back
//     a whole memecoin run).
//   * Sizing: equity / 7 per symbol (one slot per universe symbol), capped at
//     the 25% max-weight rule; sells first, then buys in universe order.
//   * No trades during warm-up; deterministic (float64 EMA only, no clock,
//     no randomness), so the two grading runs match byte for byte.
//
// Why this beats buy-and-hold: buy-and-hold rides every drawdown of all 7
// symbols to the end. This bot sits in USDC while a symbol trends down and
// only holds it while both the short trend (EMA 8/21) and the long trend
// (price vs EMA 50) are up, cutting losers early with the stop-loss and
// banking winners at +35%.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const FAST_BARS = 8;
const SLOW_BARS = 21;
const FILTER_BARS = 50;
const MAX_SLIPPAGE_BPS = 100;
/** Stop-loss: exit when value <= 95% of cost. */
const STOP_NUM = 95n;
const STOP_DEN = 100n;
/** Take-profit: exit when value >= 135% of cost. */
const ROI_NUM = 135n;
const ROI_DEN = 100n;

interface Ema {
  span: number;
  warm: number[];
  value: number | null;
}

interface Series {
  fast: Ema;
  slow: Ema;
  /** Long-trend filter EMA(50). */
  filter: Ema;
  /** fast - slow after the previous bar, once both EMAs are set. */
  gap: number | null;
  now: number | null;
  /** Down-trend signal held while fast stays below slow. */
  down: boolean;
}

const series = new Map<string, Series>();

function step(e: Ema, close: number): void {
  if (e.value !== null) {
    e.value += (2 / (e.span + 1)) * (close - e.value);
    return;
  }
  e.warm.push(close);
  if (e.warm.length === e.span) e.value = e.warm.reduce((a, x) => a + x, 0) / e.span;
}

function push(bar: Bar): Series {
  let s = series.get(bar.symbol);
  if (s === undefined) {
    s = {
      fast: { span: FAST_BARS, warm: [], value: null },
      slow: { span: SLOW_BARS, warm: [], value: null },
      filter: { span: FILTER_BARS, warm: [], value: null },
      gap: null,
      now: null,
      down: false,
    };
    series.set(bar.symbol, s);
  }
  const c = Number(bar.c);
  step(s.fast, c);
  step(s.slow, c);
  step(s.filter, c);
  s.gap = s.now;
  s.now = s.fast.value !== null && s.slow.value !== null ? s.fast.value - s.slow.value : null;
  if (s.now === null || s.now >= 0) s.down = false;
  return s;
}

function exits(state: BarsState, symbol: string, held: { qty: bigint; cost: bigint }, signal: boolean): boolean {
  if (signal) return true;
  // Long trend broke: the close fell back under EMA(50) — get out even
  // before the fast/slow cross flips, so a reversal does not eat the gain.
  const s = series.get(symbol)!;
  const close = state.close(symbol);
  if (s.filter.value !== null && close !== null && Number(close) < s.filter.value) return true;
  const value = state.value(symbol, held.qty);
  return value * STOP_DEN <= held.cost * STOP_NUM || value * ROI_DEN >= held.cost * ROI_NUM;
}

await runBars({
  onBatch(state, batch) {
    const crossUp = new Set<string>();
    const fresh = new Set<string>();
    for (const bar of batch.bars) {
      const s = push(bar);
      fresh.add(bar.symbol);
      if (s.gap === null || s.now === null || bar.v === '0') continue;
      if (s.now > 0 && s.gap <= 0) crossUp.add(bar.symbol);
      if (s.now < 0 && s.gap >= 0) s.down = true;
    }
    if (state.warmingUp) return [];
    const { caps, fees } = state.hello;
    const sells: SellInput[] = [];
    const entries: string[] = [];
    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol)) continue;
      const held = state.positions.get(symbol);
      if (held !== undefined) {
        if (exits(state, symbol, held, series.get(symbol)!.down)) {
          sells.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      } else if (crossUp.has(symbol)) {
        // Long-trend filter: only buy when the close is above EMA(50).
        // Before EMA(50) is seeded (first 50 bars) no entry fires.
        const s = series.get(symbol)!;
        if (s.filter.value !== null && Number(state.close(symbol)) > s.filter.value) entries.push(symbol);
      }
    }

    const orders: (SellInput | BuyInput)[] = sells.slice(0, caps.max_orders_per_bar);
    const slots = Math.min(state.hello.symbols.length, caps.max_open_positions);
    const stake = state.equity / BigInt(slots);
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    let room = slots - state.positions.size;
    let cash = state.cash;
    for (const symbol of entries) {
      if (room <= 0 || orders.length >= caps.max_orders_per_bar) break;
      let slice = stake < byWeight ? stake : byWeight;
      if (cash < slice) slice = cash;
      if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) break;
      orders.push({ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS });
      cash -= slice;
      room--;
    }
    return orders;
  },
});
