# 萌宠乐园

Standalone clickable prototype: **PC (`c-end/`)** + **H5 (`h5/`)**.  
Juan365-style Lobby · VIP Level · 宠物窝. Shared progress: `localStorage` key `vip_butler_pet_v3`.

**项目名称：萌宠乐园**（与同网站其他需求如「抽奖需求」区分；抽奖不要做到本仓库）。

**Out of scope:** game halls, platform transfer in/out, one-click recall. Pet care has **no** Deposit/IAP paywalls. **VIP庄园 cancelled.**

## Open / run locally

From this project root (required so H5 can load `/c-end/js/state.js`):

```bash
cd /Users/Admin/Projects/qq-pet-vip-prototype
python3 -m http.server 8765
```

### H5 (mobile)

- Entry: http://localhost:8765/h5/
- Lobby: http://localhost:8765/h5/lobby.html
- VIP: http://localhost:8765/h5/vip.html
- Pet: http://localhost:8765/h5/pet.html

### PC (`c-end`)

- Lobby: http://localhost:8765/c-end/lobby.html
- VIP: http://localhost:8765/c-end/vip.html
- Pet: http://localhost:8765/c-end/pet.html

## Agent / product handoff

**给开发 / 测试宣讲：** [`docs/萌宠乐园-开发测试宣讲需求.md`](./docs/萌宠乐园-开发测试宣讲需求.md)  
**Read first (agents):** [`docs/宠物VIP庄园-需求关键词手账.md`](./docs/宠物VIP庄园-需求关键词手账.md)  
Full rules: [`docs/VIP管家宠-冲档版-需求说明.md`](./docs/VIP管家宠-冲档版-需求说明.md)  
New Cursor agents: see [`AGENTS.md`](./AGENTS.md).

## Layout

```
qq-pet-vip-prototype/
  c-end/          # desktop PC prototype
  h5/             # mobile H5 (loads /c-end/js/state.js)
  docs/           # product handoff + full VIP/pet requirements
  README.md
  AGENTS.md
```
