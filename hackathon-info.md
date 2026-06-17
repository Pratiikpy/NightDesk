# Bitget AI Base Camp — Hackathon S1 (Complete Info)

> World's first dedicated competition for AI × Crypto Builders. Build autonomous trading Agents on the Bitget AI ecosystem.
> **Total Prize Pool: 50,000 USDT** | May 27 – June 30, 2026 | Global, Online

---

## 1. Event Overview

| Item | Details |
|---|---|
| Duration | May 27 – June 30, 2026 |
| Format | Global, online |
| Total Prize Pool | **50,000 USDT** |
| Organizer | Bitget |
| Strategic Sponsor | Alibaba Qwen |
| Media & Ecosystem | Foresight Ventures / Foresight News |

## 2. Prizes

| Prize | Amount | Track |
|---|---|---|
| 1st Place | 6,600 USDT | All tracks, judged together |
| 2nd Place | 1,500 USDT × 3 | 1 per track |
| 3rd Place | 800 USDT × 3 | 1 per track |
| Community Impact Award | 500 USDT × 3 | 1 per track |
| Participation Award | +50 USDT / team | Submit Demo + qualifying post |

**Beyond cash:** official channel exposure, ecosystem media coverage, potential incubation and investor introductions, early access to Bitget AI products, membership in Bitget AI Builders long-term community.

## 3. Timeline (UTC+8)

| Date | Milestone |
|---|---|
| May 27, 00:00 | Registration opens, development starts |
| **Jun 14, 24:00** | **Registration closes** (first 500 teams get Qwen token credits) |
| Jun 15, 00:00 | Submission window opens |
| **Jun 25, 24:00** | **Submission deadline** |
| Jun 25–29 | Judging |
| Jun 30 | Awards — winners notified by email |

## 4. How to Participate (Steps)

1. **Register** — Fill out the form on the [official registration page](https://www.bitget.com/zh-CN/campaigns/d8a2a61fd63c4bc2a3c8198ec923da9a) with your Bitget account (linked email required). Solo or teams up to 5 members. Join the [official Telegram community](https://t.me/+o1tYqQ_lXxllYjgy) after registering.
2. **Pick a track & build** — Connect to Bitget Agent Hub or Bitget Playbook. Demo must be real and runnable — no concept-only presentations. No real capital required; sim trading and backtest records accepted.
3. **Post** — Repost the Bitget [official interaction post](https://x.com/Bitget_AI/status/2062506424085917944?s=20) and publish your own content tagged **#BitgetHackathon** + @ the Bitget AI official account.
4. **Submit (Jun 15 – Jun 25, UTC+8)** — Submission link shared via official social media, community, and registration email. Fill in track form, upload materials, include post links for Community Impact Award eligibility.
5. **Results (Jun 30)** — Winners notified by registration email; results published publicly.

## 5. Tracks

| Track | Come here if… | Example builds |
|---|---|---|
| 🟦 **Trading Agent** | You want to run strategies automatically or build tools for Vibe Trading | Natural language-driven contract trading Agent; BTC adaptive trend + mean-reversion strategy; Meme coin on-chain signal copy bot |
| 🟩 **Trading Infra** | You want to build better infrastructure or data products for Agents | Paper Trading sandbox; Agent monitoring dashboard + risk scoring; On-chain data dashboard; Natural language strategy compiler |
| 🟧 **Stock AI Trading** | You want to use AI to trade tokenized US stocks or solve a real US stock trading problem | Macro/sentiment Agent for tokenized US assets; backtest/deploy on US stock historical data; Agent that reads Fed signals and auto-rebalances |

## 6. Submission Requirements

### 🟦 Track 1 — Trading Agent
- **Demo link (required)** — publicly accessible, must actually run; include backtest or sim trading records; no real capital required
- **Project description (required)** — under 200 words: what problem it solves; strategy loop overview (perception → decision → execution → risk management); which Bitget AI modules used
- **Demo video (optional)** — max 3 minutes

### 🟩 Track 2 — Trading Infra
- **GitHub repo link (required)** — runnable code with complete README; low-friction integration for other devs
- **Demo video (required)** — max 3 minutes, showing core functionality and integration
- **Project description (required)** — what problem it solves, technical approach, extensibility notes

### 🟧 Track 3 — US Stock AI Trading
- **Demo link or GitHub repo (one required)**
- **Project description (required)** — under 200 words: does it solve a real problem in US stock tokenized trading
- **Demo video (optional)** — max 3 minutes

### Community Post (All Tracks)
- Repost the [official interaction post](https://x.com/Bitget_AI/status/2062506424085917944?s=20) + publish project intro tagged **#BitgetHackathon** and @ Bitget AI → include post links in submission → qualifies for Community Impact Award (500 USDT × 3)
- Runnable Demo + qualifying post (development diary) → Participation Award (+50 USDT per team)

## 7. Judging Criteria

**No fixed formula. Winning projects solve a real problem and actually run.**

- **Track 1** — Complete strategy loop (perception → decision → execution → risk management); validated through backtest or sim trading
- **Track 2** — Can other developers actually integrate it with low friction; genuinely solves a pain point rather than reproducing existing tools
- **Track 3** — Solves a real problem in US stock tokenized trading; verifiable backtest or sim trading records; uses Bitget's US stock data or tools

⚠️ **Baseline for all tracks:** Demo must be real and runnable; clear answer to what problem it solves; at least one form of verifiable usage evidence (real/sim trade logs, API call volume, or user count).

---

## 8. Toolkit

### Bitget Playbook (Crypto & Stock AI Quant Copilot)
AI-driven quant strategy platform: describe a trading idea in plain language → AI generates a runnable strategy → backtest on real historical data → review PnL / max drawdown / Sharpe / win rate → deploy live for 24/7 execution.

**Option 1 — Via Bitget website:**
1. Log in to the [Playbook page](https://www.bitget.com/zh-CN/activity/ai-get-agent/playbook?tab=explore) with your registered Bitget UID → "Create Agent" → set up sub-account → get Playbook API Key
2. In Claude Code (or any coding agent), send:

```
1. Install getagent using https://www.npmjs.com/package/@bitget-ai/getagent-skill
2. Use getagent to create a strategy playbook about [your idea], then upload, backtest, and publish it
3. Once backtest succeeds, show me the key metrics in a table

Strategy philosophy:
[Describe your core logic, e.g. adaptive market regime — trend-following when trending, mean reversion when ranging, stay flat when unclear]

playbook key: [your Playbook API Key]
```

3. Published strategy appears on the [Playbook explore page](https://www.bitget.com/zh-CN/activity/ai-get-agent/playbook?tab=explore)

**Option 2 — Via GetAgent Studio:**
1. Join the [Telegram community](https://t.me/+o1tYqQ_lXxllYjgy), DM admin with your UID for whitelist access
2. Once approved → [getagent.studio](https://getagent.studio/)

### Bitget Agent Hub (Trading Arsenal)

| Module | What it is | How it helps |
|---|---|---|
| **Tools** | 58 trading APIs (spot, futures, account, etc.) | Place orders, check positions, manage assets — no API wrappers needed |
| **Skill Hub** | 5 analyst-grade perception Skills | Market awareness in minutes — configure and go |
| **MCP Server** | One-line setup for Claude / Cursor / Codex | Call all Bitget trading capabilities from your AI tools |

**Quick install:**
```bash
npx bitget-hub upgrade-all --target claude
# or deploy to specific tools:
npx bitget-hub install --target codex
npx bitget-hub install --target claude,codex
```

**API Key:** bitget.com → Settings → API Management → create key with Read and/or Trade permissions:
```bash
export BITGET_API_KEY="your-api-key"
export BITGET_SECRET_KEY="your-secret-key"
export BITGET_PASSPHRASE="your-passphrase"
```

**MCP Server (Claude Code / Cursor):**
```bash
claude mcp add -s user \
  --env BITGET_API_KEY=your-api-key \
  --env BITGET_SECRET_KEY=your-secret-key \
  --env BITGET_PASSPHRASE=your-passphrase \
  bitget \
  -- npx -y bitget-mcp-server
```

**Skill Hub — 5 ready-to-use Skills:**

| Skill | Capability |
|---|---|
| `macro-analyst` | Macro & cross-asset: Fed policy, BTC vs DXY / Nasdaq / Gold |
| `market-intel` | On-chain & institutional: ETF flows, whale activity, DeFi TVL |
| `news-briefing` | News aggregation & narrative synthesis: briefings, keyword search |
| `sentiment-analyst` | Sentiment & positioning: Fear & Greed, long/short ratios, funding rates |
| `technical-analysis` | Technical analysis: 23 indicators across 6 categories |

> ⚠️ Note (FAQ): Agent Hub with your own API Key currently supports **read access only** — positions sync to a simulated account. Order execution not fully implemented; no real-account trades triggered automatically.

### Qwen Token Credits (first 500 teams)

| Item | Details |
|---|---|
| When | Within 24h of registration, sent to email linked to your Bitget UID |
| Works with | Cursor, Codex, other major coding agents (**Claude Code NOT supported**) |
| Didn't receive? | @ admin in [Telegram](https://t.me/+o1tYqQ_lXxllYjgy) with UID + registration time |

**Setup:**

| Setting | Value |
|---|---|
| Base URL | `https://hackathon.bitgetops.com/v1` |
| Model (recommended) | `qwen3.6-plus` |
| Optional | `qwen3.6-flash` (fast) |

⚠️ Model IDs use hyphens (`qwen3.6-plus`), never `qwen3.6 max` with a space. The key routes through a Bitget proxy — it **cannot** connect directly to the official Qwen API; you must use the Base URL above. Qwen tokens only work with Alibaba Cloud APIs (not Claude or non-Alibaba models).

**Codex setup:**
1. Settings → Config → Open config.toml, add at top:
```toml
model = "qwen3.6-plus"
model_provider = "bitget-qwen"

[model_providers.bitget-qwen]
name = "Bitget Qwen"
base_url = "https://hackathon.bitgetops.com/v1"
env_key = "BITGET_QWEN_API_KEY"
wire_api = "responses"
```
2. Set key via terminal (don't write into config.toml): `launchctl setenv BITGET_QWEN_API_KEY 'your real key'` (macOS)
3. Fully quit Codex (Cmd+Q) and reopen
4. Verify: bottom-right should show `Bitget Qwen`; or `codex doctor | grep model` → expect `qwen3.6-plus`

**Cursor setup:**
1. Cursor Settings (`Ctrl+Shift+J` on Windows) → Models
2. Paste key into OpenAI API Key field → Verify; turn on Override OpenAI Base URL → `https://hackathon.bitgetops.com/v1` (the `/v1` suffix is required)
3. `+ Add model` → `qwen3.6-plus` (and optionally `qwen3.6-flash`), ensure enabled
4. Select `qwen3.6-plus` in Chat/Agent dropdown, send a test message

### MuleRun Token Credits (2,000 Credits)

| Item | Details |
|---|---|
| How to claim | Join the [Telegram community](https://t.me/+o1tYqQ_lXxllYjgy) |
| Works with | MuleRun platform, covers major LLMs |
| Limit | One claim per email |

**Steps:** Join Telegram → sign up at [mulerun.com](https://mulerun.com/?utm_campaign=0526bitget) → go to [credits.mule.page](https://credits.mule.page/) → enter code `0526BITGET` → claim 2,000 Credits.
After building on MuleRun, you can submit your Agent link directly as your hackathon Demo.

## 9. Resources & Links

| Resource | Link |
|---|---|
| Agent Hub GitHub | https://github.com/BitgetLimited/agent_hub |
| Event Landing Page | https://bitget.com/zh-CN/activity-hub/hackathon |
| Registration | https://www.bitget.com/zh-CN/campaigns/d8a2a61fd63c4bc2a3c8198ec923da9a |
| Official Telegram | https://t.me/+o1tYqQ_lXxllYjgy |
| Official interaction post (repost to participate) | https://x.com/Bitget_AI/status/2062506424085917944?s=20 |
| getagent-skill (npm) | https://www.npmjs.com/package/@bitget-ai/getagent-skill |
| GetAgent Studio | https://getagent.studio/ |
| Playbook | https://www.bitget.com/zh-CN/activity/ai-get-agent/playbook?tab=explore |

## 10. FAQ (Summarized)

- **No trading experience?** Fine. Agent Hub repo provides a complete skeleton; Playbook runs strategies end-to-end without code. No real capital required — sim/backtest accepted.
- **Solo OK?** Yes, judged equally with teams. Register as individual; team details collected at submission. Max 5 members. Find teammates in Telegram.
- **Registration fails?** Contact admin in the Telegram community.
- **Community Impact Award?** Repost official post + publish your own tagged content (#BitgetHackathon + @Bitget_AI), submit post links with project. Demo + qualifying post also earns Participation Award (+50 USDT).
- **Auto-trades with own API key?** No — read-only currently; syncs positions to a simulated account. No real-account trades triggered.
- **Technical issues?** Telegram community — technical team online throughout.

## 11. After the Hackathon — Builder Status System

| Level | Status | Description |
|---|---|---|
| Lv.1 | Explorer | Entry level — join the community, follow promotions |
| Lv.2 | Certified Builder | Unlock privileges with first meaningful contribution |
| Lv.3 | Core Builder | Long-term key participant — premium resources & collab opportunities |
| Lv.4 | Captain | Outstanding influence — invitation only |

---

## ✅ Our Action Checklist

- [ ] Register before **Jun 14, 24:00 UTC+8** (first 500 teams get Qwen credits)
- [ ] Join official Telegram community
- [ ] Claim Qwen token credits (check registration email within 24h)
- [ ] Claim MuleRun credits (code `0526BITGET` at credits.mule.page)
- [ ] Pick track (see `win-strategy.md` / `nightdesk-prd.md`)
- [ ] Build runnable demo with backtest / sim trading records
- [ ] Repost official X post + publish dev diary posts (#BitgetHackathon + @Bitget_AI)
- [ ] Submit between **Jun 15 – Jun 25, 24:00 UTC+8** with all links (demo, repo, video, post links)
