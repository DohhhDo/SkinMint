<h1 align="center">SkinMint</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>繁體中文</b>
</p>

<p align="center">
  <b>做一個 Minecraft 風格的角色，得到一個真正會動的模型。</b><br/>
  選一個角色（或上傳你自己的立繪）→ 一個方塊感十足、帶動畫的 GLB，可以拖著轉、嵌進任何網頁裡。
</p>

<p align="center">
  <b>🎮 <a href="https://skin.vindo.cn/">線上試用 → skin.vindo.cn</a></b>
</p>

<p align="center">
  <i>🚧 開發中 · alpha。形態正逐漸穩定，但 API 仍會變動，且尚未發佈到 npm。</i>
</p>

<p align="center">
  📖 <a href="https://www.vindo.cn/blog/skinmint-anime-to-minecraft">介紹文章：SkinMint 如何把二次元立繪變成 Minecraft 角色 →</a>
</p>

---

SkinMint 最初是一套通用的「文字 → 3D 網格」工具包。這些基礎能力還在，但真正有意思的地方變成了**體素角色**：AI 的 text-to-3D 產生的是平滑的低多邊形團塊，而不是大家從「Minecraft 風格」裡真正想要的那種俐落方塊感。於是 SkinMint 專注於讓這種風格成立的核心——一套固定的方塊骨架 + 一張 64×64 面板（skin）——以**程式化建構**模型，而不是去產生幾何。

結果就是：你選一個角色，產出一個綁好骨架的 GLB，它會**走路、奔跑、揮手**，可以直接當作 `<skinmint-model>` 元素丟進任何頁面。

```html
<script src="https://your-host/skinmint-embed.global.js"></script>
<skinmint-model src="/hutao.glb" animation="walk" style="width:100%;height:480px"></skinmint-model>
```

## 運作原理

一切都匯聚成一個東西——**一張 64×64 面板**——然後變成模型：

```
 選一個精選角色 ─────────┐
 上傳一張角色立繪 ───────┤
 輸入一段提示詞 ─────────┘
            │
            ▼   @skinmint/skin      精選 PNG，或 AI（Modal/HF），或 上傳→圖生圖 / 看圖說話→面板
       一張 64×64 面板
            │
            ▼   @skinmint/mcmodel   方塊骨架 + 走/跑/揮手/待機 動畫，無光照 + 最近鄰取樣
     一個綁骨架的方塊 GLB
            │
            ▼   @skinmint/embed     <skinmint-model> 播放動畫、拖曳環繞、隨處嵌入
```

方塊骨架是固定的，所以唯一真正的難題就是那張 2D 面板——而它要嘛用精選美術做得很好（便宜），要嘛用 AI 產生。模型本身用 `three.js` 幾何 + [glTF Transform](https://gltf-transform.dev/) 建構，每個肢體都是獨立節點，動畫才能繞各自的關節擺動。

> 還有一條**舊有的「文字→網格」路線**（`@skinmint/core` + Meshy，由 `@skinmint/viewer` 算繪），來自專案的第一段生命。它仍然可用，並共用同一套伺服器/儲存管線——見 [docs/architecture](docs/architecture.md)。

## 目前能做什麼

- **精選角色 → 即時動畫模型。** 不需 AI、不必等待。25 個原神角色（手工面板）；其他 IP 已佔位（即將）。
- **真正的方塊骨架帶動畫**——`待機 / 走 / 跑 / 揮手`，烘焙進每個 GLB；檢視器即時交叉淡入切換。
- **上傳你自己的立繪。** 兩條 AI 路線：圖生圖（效果最好，需要 Modal GPU 部署），或免 GPU 的降級方案（視覺模型描述美術 → 文字→面板）。
- **隨處匯出**——自帶完整的 `<skinmint-model>` 程式碼片段、npm 匯入，或者直接拿最佳化過的 `.glb`。
- **創作工作室（Studio）**——一個引導式的「Warm Craft Studio」創作應用程式（角色 → 造型 → 動作 → 生成），角色像收藏品一樣立在打光的展台上。

尚顯粗糙 / 實驗性的部分：AI 面板品質「還行，但稱不上好」；公開的 HF Space 不穩定（額度）；目前只精選了原神；尚未發佈到 npm。見 [roadmap](ROADMAP.md)。

## 快速開始

```bash
pnpm install
pnpm build
pnpm --filter next-demo dev      # → http://localhost:3000
```

工作室**零金鑰即可執行**——精選角色即時生成。要啟用 AI / 上傳路線，把金鑰放進 `examples/next-demo/.env.local`（已 gitignore）：

```bash
HF_TOKEN=hf_xxx                  # 免費；啟用 AI 面板 + 免 GPU 上傳降級方案
MODAL_SKIN_ENDPOINT=https://...  # 選用；你自己的 GPU 部署，用於最佳上傳效果（圖生圖）
MODAL_SKIN_TOKEN=...
MESHY_API_KEY=msy_xxx            # 選用；僅用於舊有的 文字→網格 路線
```

各項分別解鎖什麼，見 [docs/skin-providers](docs/skin-providers.md)。

## 套件

一個 pnpm + Turborepo 的 monorepo，由小而專注的套件組成——按需取用。

| 套件 | 作用 | 路線 |
| --- | --- | --- |
| [`@skinmint/mcmodel`](packages/mcmodel) | 64×64 面板 → 綁骨、帶動畫的方塊 GLB | Minecraft |
| [`@skinmint/skin`](packages/skin) | `SkinProvider` 介面 + mock / HF / Modal / 看圖說話 等提供者 | Minecraft |
| [`@skinmint/embed`](packages/embed) | `<skinmint-model>` web 元件——播放動畫、隨處嵌入 | 兩者 |
| [`@skinmint/presets`](packages/presets) | 精選 風格 / 角色 / 動作 預設 + 提示詞建構器 | 兩者 |
| [`@skinmint/viewer`](packages/viewer) | R3F `<GeneratedModelViewer />` 元件 | 文字→網格 |
| [`@skinmint/core`](packages/core) | 文字→3D `Provider`（Meshy/Mock）+ `optimizeGlb()` | 文字→網格 |
| [`@skinmint/server`](packages/server) | 自帶金鑰的生成處理器 + 修正 CORS 的最佳化代理 | 兩者 |
| [`@skinmint/react`](packages/react) | `useTextTo3D()` hook | 文字→網格 |
| [`@skinmint/store`](packages/store) | 可插拔的 blob 儲存 + 歷史紀錄（記憶體 / 檔案系統 / S3-R2） | 兩者 |
| [`examples/next-demo`](examples/next-demo) | **工作室**——引導式創作應用程式 | — |

## 隨處嵌入

`<skinmint-model>` 是一個自帶完整的自訂元素（three.js 跑在 Shadow DOM 裡）——不需要 React、不需要建構步驟。它播放烘焙進 GLB 的動畫：

```html
<skinmint-model src="/model.glb" animation="run" auto-rotate style="height:480px"></skinmint-model>
```

完整屬性列表見 [docs/embedding](docs/embedding.md)。

## 技術

- **Monorepo：** pnpm workspaces + Turborepo；套件用 `tsup` 建構（ESM + CJS + 型別）
- **3D：** three.js · @react-three/fiber · @react-three/drei（peer 相依）· [glTF Transform](https://gltf-transform.dev/)
- **應用程式：** Next.js 14（App Router）
- **AI 面板：** 透過 Modal 或公開 HF Space 跑的 SDXL `minecraft-skin-generator`；透過 HF router 做視覺模型看圖說話
- **驗證：** 無頭 Playwright 截圖——我們真的去*看*算繪出來的模型，而不只是 diff JSON

## 文件

| | |
| --- | --- |
| [架構](docs/architecture.md) | 各部分如何拼合、各條管線、關鍵決策 |
| [Minecraft 管線](docs/minecraft-pipeline.md) | 面板 → 綁骨動畫 GLB 的詳細過程 |
| [面板提供者](docs/skin-providers.md) | 各 AI 通道、環境變數、部署 |
| [嵌入](docs/embedding.md) | `<skinmint-model>` 的用法與屬性 |
| [路線圖](ROADMAP.md) | 已完成、進行中、規劃中 |
| [貢獻指南](CONTRIBUTING.md) | 設定、建構、測試、慣例 |

## 授權

[MIT](LICENSE)

---

<p align="center">
  <a href="https://www.vindo.cn"><img src="https://www.vindo.cn/Facvion.svg?v=2" width="56" alt="Vindo" /></a>
</p>
<p align="center">
  本專案由 <b><a href="https://www.vindo.cn">Vindo · 間窗</a></b> 製作 · <a href="https://www.vindo.cn">www.vindo.cn</a>
</p>
