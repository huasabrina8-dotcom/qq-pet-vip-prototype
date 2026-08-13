# Agent instructions — VIP管家宠 · 冲档版

## First read (required)

1. [`docs/宠物VIP庄园-需求关键词手账.md`](./docs/宠物VIP庄园-需求关键词手账.md) — product decisions & hard locks  
2. [`docs/VIP管家宠-冲档版-需求说明.md`](./docs/VIP管家宠-冲档版-需求说明.md) — full rules  
3. Shared state: `c-end/js/state.js` (`localStorage` → `vip_butler_pet_v3`)

Do **not** re-propose rejected ideas. This repo is **only** C-end prototype (no Admin 会员余额 backend).

## Where to edit

| Surface | Path |
|---------|------|
| PC | `c-end/` |
| H5 | `h5/` (bottom nav: 大厅｜VIP｜宠物) |

Serve from **project root** (`python3 -m http.server 8765`) so H5 can use `/c-end/js/state.js`.

## Hard rules (locked)

1. **No halls / transfers / recall** — no game-hall grid, platform 转入/转出, or 一键回收. Do not bind XP to “feed hall / recall”.
2. **No pet paywalls** — no Deposit / IAP / paid items as pet-care gates; backpack = daily free supplies only. Lobby Deposit is VIP/wallet demo only.
3. **Ultimate-form reward = gift to user** (pick one of five), **not** a recharge/pay action.
4. Keep **VIP管家宠** (VIP Level + pet nest). Product name: **VIP管家宠 · 冲档版**.
5. **No VIP庄园** — manor / farming / plots / orders cancelled. Do not re-add `manor.html` or manor entries/tasks.
6. **No pet sell / sell-unbind** — 出售宠物概念已取消；no sell tab, no unbind-via-sell, no re-adopt-after-sell. Pet stays VIP-bound; species change only via first-visit pick or evolve.
7. **No real-world pets (cats/dogs/etc.)** — only Philippine mythic 神兽.
8. **Starter species pick required** — first enter of pet nest MUST choose a Philippine mythic 神兽. Catalog: `sarimanok` · `bakunawa` · `diwata` · `tigmamanukan` · `sirena` · `kapre`. Evolve can still switch among these six.
9. **Visual:** Juan365 light hall (white/light gray + orange Deposit + green Claim + blue Banner). No dark neon casino look.
10. Old name「厅厅管家宠」is retired; pointer doc only.
11. **Retention loop = 24h nurture cadence** — purpose: raise login stickiness; means: come back every ~24h for a **deep nurture** session (daily intimacy quests: pat×3 + chat×1 + feed×2) to join pet growth. Rolling window from `lastInteractAt`, aligned with care protect + need satisfy. Do **not** lock to one click / 24h; surface protect + needs + deep-nurture progress as retention (not punishment-only).

## Naming

- Formal: **VIP管家宠 · 冲档版**
- Skeleton: VIP 冲档 + 管家宠 + Light C (Daily Tasks)
