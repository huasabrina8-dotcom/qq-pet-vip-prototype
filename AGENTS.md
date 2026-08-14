# Agent instructions — 萌宠乐园

## First read (required)

1. [`docs/宠物VIP庄园-需求关键词手账.md`](./docs/宠物VIP庄园-需求关键词手账.md) — product decisions & hard locks  
2. [`docs/VIP管家宠-冲档版-需求说明.md`](./docs/VIP管家宠-冲档版-需求说明.md) — full rules  
3. Shared state: `c-end/js/state.js` (`localStorage` → `vip_butler_pet_v3`)

Do **not** re-propose rejected ideas. This repo is **only** the **萌宠乐园** C-end prototype (no Admin 会员余额 backend). **抽奖需求** 是同网站的另一项目，不要做到本仓库。

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
4. Keep **VIP 冲档 + 宠物窝** in this prototype. **Project name: 萌宠乐园** (distinct from other same-site requirements such as 抽奖需求). In-product pet is still the VIP-bound 管家宠.
5. **No VIP庄园** — manor / farming / plots / orders cancelled. Do not re-add `manor.html` or manor entries/tasks.
6. **No pet sell / sell-unbind** — 出售宠物概念已取消；no sell tab, no unbind-via-sell, no re-adopt-after-sell. Pet stays VIP-bound.
7. **No real-world pets (cats/dogs/etc.)** — only Philippine mythic 神兽.
8. **Starter species pick required** — first enter of pet nest MUST choose a Philippine mythic 神兽. Catalog: `sarimanok` · `bakunawa` · `diwata` · `tigmamanukan` · `sirena` · `kapre`. After that, **switch species anytime**; the new 神兽 inherits the current form tier.
9. **Visual:** Juan365 light hall (white/light gray + orange 充值 + green 领取 + blue Banner). No dark neon casino look.
10. Old name「厅厅管家宠」is retired; pointer doc only.
11. **Retention loop = 24h nurture cadence** — purpose: raise login stickiness; means: come back every ~24h for a **deep nurture** session (daily intimacy quests: pat×3 + chat×1 + feed×2) to join pet growth. Rolling window from `lastInteractAt`, aligned with care protect + need satisfy. Do **not** lock to one click / 24h; surface protect + needs + deep-nurture progress as retention (not punishment-only).
12. **Six art styles in library** — `neutral` / `sacred` / `cute` / `inkgold` / `obsidian` / `duskgold`. VIP page switches among them anytime at the current wearing form (not paywalled). Final keep-set TBD.
13. **Form growth = nurture time + interactions** — each stage needs qualified 24h nurture-days and interaction count; higher stages take longer (1/2/3/5/7 days). Display form = `evoTier` only. VIP is a growth ceiling, not an instant morph.
14. **Display language** — C-end pages and pet voice are **Chinese-only** until the full scheme is locked; then add 菲语 + 英语. Keep `labelEn` in data. Intended later voice: Taglish lambing when nurture is due; Ingat / Bathala / suwerte comfort when not (positive, not ominous).

## GitHub

- Remote: `origin` → `https://github.com/huasabrina8-dotcom/qq-pet-vip-prototype.git`
- **Do not push** on ordinary edits. Push **only** when the user says **定稿**.
- Commit locally only if the user explicitly asks; still do not push unless the message includes **定稿**.

## Naming

- **项目名称**：**萌宠乐园**（同站其他需求如「抽奖需求」分开，不混进本仓库）
- **站内功能**：VIP 冲档 + 管家宠 + Light C（Daily Tasks）
- 曾用名「VIP管家宠 · 冲档版」「厅厅管家宠」仅作历史；不要用旧名开新需求
