<h1 align="center">SkinMint</h1>

<p align="center">
  <a href="README.md">English</a> · <b>简体中文</b> · <a href="README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <b>做一个 Minecraft 风格的角色，得到一个真正会动的模型。</b><br/>
  选一个角色（或上传你自己的立绘）→ 一个方块感十足、带动画的 GLB，可以拖着转、嵌到任何网页里。
</p>

<p align="center">
  <a href="https://skin.vindo.cn/">
    <img src="https://img.shields.io/badge/🎮%20在线试用%20·%20skin.vindo.cn-f0502e?style=for-the-badge&logoColor=white" alt="在线试用" height="70">
  </a>
</p>

<p align="center">
  <i>🚧 开发中 · alpha。形态在逐渐稳定，但 API 仍会变动，且尚未发布到 npm。</i>
</p>

<p align="center">
  📖 <a href="https://www.vindo.cn/blog/skinmint-anime-to-minecraft">介绍文章：SkinMint 如何把二次元立绘变成 Minecraft 角色 →</a>
</p>

---

SkinMint 最初是一个通用的「文本 → 3D 网格」工具包。这些基础能力还在，但真正有意思的地方变成了**体素角色**：AI 的 text-to-3D 生成的是平滑的低多边形团块，而不是大家从「Minecraft 风格」里真正想要的那种利落方块感。于是 SkinMint 专注于让这种风格成立的核心——一套固定的方块骨架 + 一张 64×64 皮肤——用**程序化构建**模型，而不是去生成几何体。

结果就是：你选一个角色，产出一个绑好骨骼的 GLB，它会**走路、奔跑、挥手**，可以直接作为 `<skinmint-model>` 元素丢进任何页面。

```html
<script src="https://your-host/skinmint-embed.global.js"></script>
<skinmint-model src="/hutao.glb" animation="walk" style="width:100%;height:480px"></skinmint-model>
```

## 工作原理

一切都汇聚成一个东西——**一张 64×64 皮肤**——然后变成模型：

```
 选一个精选角色 ─────────┐
 上传一张角色立绘 ───────┤
 输入一段提示词 ─────────┘
            │
            ▼   @skinmint/skin      精选 PNG，或 AI（Modal/HF），或 上传→图生图 / 看图说话→皮肤
       一张 64×64 皮肤
            │
            ▼   @skinmint/mcmodel   方块骨架 + 走/跑/挥手/待机 动画，无光照 + 最近邻采样
     一个绑骨的方块 GLB
            │
            ▼   @skinmint/embed     <skinmint-model> 播放动画、拖拽环绕、随处嵌入
```

方块骨架是固定的，所以唯一真正的难题就是那张 2D 皮肤——而它要么用精选美术做得很好（便宜），要么用 AI 生成。模型本身用 `three.js` 几何体 + [glTF Transform](https://gltf-transform.dev/) 构建，每个肢体是独立节点，动画才能绕各自的关节摆动。

> 还有一条**遗留的「文本→网格」路线**（`@skinmint/core` + Meshy，由 `@skinmint/viewer` 渲染），来自项目的第一段生命。它仍然可用，并共用同一套服务端/存储管道——见 [docs/architecture](docs/architecture.md)。

## 现在能做什么

- **精选角色 → 即时动画模型。** 无需 AI、无需等待。25 个原神角色（手工皮肤）；其他 IP 已占位（即将）。
- **真正的方块骨架带动画**——`待机 / 走 / 跑 / 挥手`，烘焙进每个 GLB；查看器实时交叉淡入切换。
- **上传你自己的立绘。** 两条 AI 路线：图生图（效果最好，需要 Modal GPU 部署），或无 GPU 的降级方案（视觉模型描述美术 → 文本→皮肤）。
- **随处导出**——自包含的 `<skinmint-model>` 代码片段、npm 引入，或者直接拿优化过的 `.glb`。
- **创作工作室（Studio）**——一个引导式的「Warm Craft Studio」创作应用（角色 → 造型 → 动作 → 生成），角色像收藏品一样立在打光的展台上。

尚显粗糙 / 实验性的部分：AI 皮肤质量「还行，但不算好」；公开的 HF Space 不稳定（配额）；目前只精选了原神；尚未发布到 npm。见 [roadmap](ROADMAP.md)。

## 快速开始

```bash
pnpm install
pnpm build
pnpm --filter next-demo dev      # → http://localhost:3000
```

工作室**零密钥即可运行**——精选角色即时生成。要启用 AI / 上传路线，把密钥放进 `examples/next-demo/.env.local`（已 gitignore）：

```bash
HF_TOKEN=hf_xxx                  # 免费；启用 AI 皮肤 + 无 GPU 上传降级方案
MODAL_SKIN_ENDPOINT=https://...  # 可选；你自己的 GPU 部署，用于最佳上传效果（图生图）
MODAL_SKIN_TOKEN=...
MESHY_API_KEY=msy_xxx            # 可选；仅用于遗留的 文本→网格 路线
```

各项分别解锁什么，见 [docs/skin-providers](docs/skin-providers.md)。

## 包

一个 pnpm + Turborepo 的 monorepo，由小而专注的包组成——按需取用。

| 包 | 作用 | 路线 |
| --- | --- | --- |
| [`@skinmint/mcmodel`](packages/mcmodel) | 64×64 皮肤 → 绑骨、带动画的方块 GLB | Minecraft |
| [`@skinmint/skin`](packages/skin) | `SkinProvider` 接口 + mock / HF / Modal / 看图说话 等提供方 | Minecraft |
| [`@skinmint/embed`](packages/embed) | `<skinmint-model>` web 组件——播放动画、随处嵌入 | 两者 |
| [`@skinmint/presets`](packages/presets) | 精选 风格 / 角色 / 动作 预设 + 提示词构建器 | 两者 |
| [`@skinmint/viewer`](packages/viewer) | R3F `<GeneratedModelViewer />` 组件 | 文本→网格 |
| [`@skinmint/core`](packages/core) | 文本→3D `Provider`（Meshy/Mock）+ `optimizeGlb()` | 文本→网格 |
| [`@skinmint/server`](packages/server) | 自带密钥的生成处理器 + 修复 CORS 的优化代理 | 两者 |
| [`@skinmint/react`](packages/react) | `useTextTo3D()` hook | 文本→网格 |
| [`@skinmint/store`](packages/store) | 可插拔的 blob 存储 + 历史记录（内存 / 文件系统 / S3-R2） | 两者 |
| [`examples/next-demo`](examples/next-demo) | **工作室**——引导式创作应用 | — |

## 随处嵌入

`<skinmint-model>` 是一个自包含的自定义元素（three.js 跑在 Shadow DOM 里）——不需要 React、不需要构建步骤。它播放烘焙进 GLB 的动画：

```html
<skinmint-model src="/model.glb" animation="run" auto-rotate style="height:480px"></skinmint-model>
```

完整属性列表见 [docs/embedding](docs/embedding.md)。

## 技术

- **Monorepo：** pnpm workspaces + Turborepo；包用 `tsup` 构建（ESM + CJS + 类型）
- **3D：** three.js · @react-three/fiber · @react-three/drei（peer 依赖）· [glTF Transform](https://gltf-transform.dev/)
- **应用：** Next.js 14（App Router）
- **AI 皮肤：** 通过 Modal 或公开 HF Space 跑的 SDXL `minecraft-skin-generator`；通过 HF router 做视觉模型看图说话
- **验证：** 无头 Playwright 截图——我们真的去*看*渲染出来的模型，而不只是 diff JSON

## 文档

| | |
| --- | --- |
| [架构](docs/architecture.md) | 各部分如何拼合、各条管线、关键决策 |
| [Minecraft 管线](docs/minecraft-pipeline.md) | 皮肤 → 绑骨动画 GLB 的详细过程 |
| [皮肤提供方](docs/skin-providers.md) | 各 AI 通道、环境变量、部署 |
| [嵌入](docs/embedding.md) | `<skinmint-model>` 的用法与属性 |
| [路线图](ROADMAP.md) | 已完成、进行中、计划中 |
| [贡献指南](CONTRIBUTING.md) | 搭建、构建、测试、约定 |

## 许可证

[MIT](LICENSE)

---

<p align="center">
  <a href="https://www.vindo.cn"><img src="https://www.vindo.cn/Facvion.svg?v=2" width="56" alt="Vindo" /></a>
</p>
<p align="center">
  本项目由 <b><a href="https://www.vindo.cn">Vindo · 间窗</a></b> 制作 · <a href="https://www.vindo.cn">www.vindo.cn</a>
</p>
