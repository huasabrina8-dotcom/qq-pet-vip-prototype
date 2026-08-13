# VIP管家宠 · 冲档版（C 端原型）

Juan365 风格可点击静态原型：**Lobby + 宠物窝 + VIP Level**。  
不修改仓库根目录的 Admin 余额原型（`index.html`）。  
**游戏厅 / 平台划转不在本原型范围。VIP庄园已砍掉（不做）。**

## 打开方式

在项目根目录启动静态服务（同时可开 H5：`/h5/`）：

```bash
cd /Users/Admin/Projects/qq-pet-vip-prototype
python3 -m http.server 8765
```

然后访问：

| 页面 | URL |
|------|-----|
| 入口 | http://localhost:8765/c-end/ |
| Lobby | http://localhost:8765/c-end/lobby.html |
| VIP Level | http://localhost:8765/c-end/vip.html |
| 宠物窝 | http://localhost:8765/c-end/pet.html |
| **H5 全套** | http://localhost:8765/h5/ （见 [`../h5/README.md`](../h5/README.md)） |

也可直接用浏览器打开 `c-end/lobby.html`（部分浏览器对 `localStorage` 的 `file://` 限制可能影响状态持久化，推荐用 http.server）。

> 若本机已在 `c-end/` 目录起服务（端口 8765），则路径去掉 `/c-end` 前缀即可；此时 H5 需改从根目录起服务。

## 团队分享（公网 · PC）

当前 Cloudflare Quick Tunnel（**临时 / ephemeral**，本机根目录 `8765` + cloudflared 有效；关掉即失效）：

**PC 入口（优先分享）:** https://pts-insider-diesel-consolidation.trycloudflare.com/c-end/

| 页面 | URL |
|------|-----|
| **PC 入口** | https://pts-insider-diesel-consolidation.trycloudflare.com/c-end/ |
| Lobby | https://pts-insider-diesel-consolidation.trycloudflare.com/c-end/lobby.html |
| VIP Level | https://pts-insider-diesel-consolidation.trycloudflare.com/c-end/vip.html |
| 宠物窝 | https://pts-insider-diesel-consolidation.trycloudflare.com/c-end/pet.html |

H5 同 Base：`/h5/`（见 [`../h5/README.md`](../h5/README.md)）。

需要长期固定域名时，请改用 GitHub Pages / Netlify / Vercel 等静态托管。

## 短演示路径

### VIP + 宠
1. Lobby → 宠 HUD「去照看」→ 宠物窝（首次新手引导可跳过）→ 喂食/玩耍/清洁  
2. Lobby Claim 返水 + Daily Tasks  
3. VIP Level 看权益 → Demo +XP 冲档  

## 演示要点

1. Lobby：P/G、宠 HUD、侧栏 Claim、Daily Tasks（无厅网格）  
2. 宠物窝：新手引导、状态条、照料、小背包  
3. VIP：状态卡、轮播、Benefits、Demo +XP  

需求说明：[`docs/VIP管家宠-冲档版-需求说明.md`](../docs/VIP管家宠-冲档版-需求说明.md)

## 重置

页面上的 **Reset Demo** 会清空 `localStorage`（key `vip_butler_pet_v3`）并恢复 VIP3 / P≈2710 的初始态（含宠新手引导态）。  
仅重看宠引导：同上 Reset，或控制台 `localStorage.removeItem('vip_butler_pet_v3')` 后刷新。
