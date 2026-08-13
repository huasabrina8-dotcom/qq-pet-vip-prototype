# VIP管家宠 · H5 移动端

Juan365 亮色风格的 **手机 H5 全套**（375–430px 手感）：底栏三 Tab、安全区、大触摸区。  
与 `c-end/` 桌面页并行，**不破坏**桌面原型。  
逻辑复用 `/c-end/js/state.js`（站点根绝对路径），进度 key：`vip_butler_pet_v3`（同域下桌面/H5 可共享）。

**不含游戏厅 / 平台划转。VIP庄园已砍掉（不做）。**

## 打开方式

在**项目根目录**起静态服务（同时服务 `/c-end/` 与 `/h5/`）：

```bash
cd /Users/Admin/Projects/qq-pet-vip-prototype
python3 -m http.server 8765
```

| 页面 | URL |
|------|-----|
| 入口 | http://localhost:8765/h5/ |
| 大厅 | http://localhost:8765/h5/lobby.html |
| VIP | http://localhost:8765/h5/vip.html |
| 宠物 | http://localhost:8765/h5/pet.html |

Chrome 设备模式或真机打开；推荐视口宽度 390px 左右。

## 团队分享（公网）

当前 Cloudflare Quick Tunnel（**临时**，本机 `http.server` + `cloudflared` 进程有效）：

**Base:** https://pts-insider-diesel-consolidation.trycloudflare.com

| 页面 | URL |
|------|-----|
| H5 入口 | https://pts-insider-diesel-consolidation.trycloudflare.com/h5/ |
| 大厅 | https://pts-insider-diesel-consolidation.trycloudflare.com/h5/lobby.html |
| VIP | https://pts-insider-diesel-consolidation.trycloudflare.com/h5/vip.html |
| 宠物 | https://pts-insider-diesel-consolidation.trycloudflare.com/h5/pet.html |
| 桌面 Lobby | https://pts-insider-diesel-consolidation.trycloudflare.com/c-end/lobby.html |

隧道指向本机 **8765**（项目根目录起服）。旧隧道已失效。

## 底栏

`大厅 | VIP | 宠物` — 三页 sticky 底栏，含 `env(safe-area-inset-*)`。

## 演示路径（手机）

1. 大厅 → Claim 返水 / Daily Tasks / 宠 HUD  
2. VIP → Benefits 弹窗 · Demo +500 XP  
3. 宠物 → 新手引导 → 喂食 / 玩耍 / 清洁  

Reset Demo 清空 `vip_butler_pet_v3`。

## 文件

| 路径 | 说明 |
|------|------|
| `h5/index.html` | 入口 |
| `h5/lobby.html` 等 | 三 Tab 页 |
| `h5/css/h5.css` | 壳：Header / 底栏 / Toast / Modal / Guide |
| `h5/css/pages.css` | 各页布局与动效 |
| `h5/js/*` | 页逻辑（镜像 c-end，轮播等已适配窄屏） |
| `/c-end/js/state.js` | 共享状态（绝对路径） |

需求：[`docs/VIP管家宠-冲档版-需求说明.md`](../docs/VIP管家宠-冲档版-需求说明.md)「H5端」节。
