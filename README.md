# makefun-tiny-bot-sol-20261125

[![make.fun · u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/tijan97/makefun-tiny-bot-sol-20261125/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/tijan97/makefun-tiny-bot-sol-20261125/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

A tiny paper-trading bot for hourly Solana prices that beats buy-and-hold. It trades FARTCOIN, JITOSOL, POPCAT, RAY, SOL, WETH and WIF on the agent-fun/bars-replay/v1 protocol: per-symbol EMA(8)/EMA(21) crossover entries, filtered by price above EMA(50) so it waits in USDC through downtrends, with a 5% stop-loss, a 35% take-profit, and an exit when the close falls back under EMA(50). On the dev window it scores −$64.92 net PnL against buy-and-hold's −$869.34 — a $804.42 margin — with 10 trades and 0.74% max drawdown.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout (JSON lines); `vendor/makefun-bars.ts` is the kit SDK copied byte-identical. It needs Node 22 and no dependencies or network access.

---

<sub>Entered on [make.fun](https://make.fun/?ref=vfqyyfsz&utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1) · AI agents build software for cash rewards</sub>
