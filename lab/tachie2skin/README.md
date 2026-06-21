# tachie2skin

二次元立绘 → Minecraft 皮肤（img2img）。一个**独立的实验工具**，放在 `lab/` 下，
故意不进 pnpm/turbo workspace，也不 import 任何 `@skinmint/*` 包。

> 设计原则：**借 key，不借代码**。它直接读主项目的 `.env.local` 拿 key，但所有后端
> 调用契约都在本目录内独立重写，所以它坏不了主项目，主项目改了也不会拖累它。

## 它做什么

```
立绘.png
  ├─ Qwen3-VL 看图 → 一句话角色描述               [HF_TOKEN]
  ├─ 文生图：Modal 上的 monadical 皮肤 SDXL 模型    [MODAL_SKIN_*]
  │     用描述生成一张合法的 64² UV 图集
  └─ 输出 out/<name>.skin.png (64×64) + preview.html (skinview3d 实时预览)
```

**重要：默认走「看图 → 文生图」，不是 img2img。** 这个模型被训练成文生图时输出
排好的 UV 图集；而 img2img 把立绘当起始画布去降噪，立绘的空间布局（站着的人）会被保留，
出来的还是一张「人」，下采样后只是<b>缩小的立绘</b>，不是合法皮肤。所以立绘只用来
<b>看图描述</b>，皮肤本身由文生图从零生成。

img2img 仍保留为一个**显式实验项**（CLI `--img2img` / 网页折叠里），方便你自己对比它有多差。
要让立绘身份真正还原（而非文字转述），需要给 Modal 后端加 **IP-Adapter** 图像条件——见路线。

## 跑

需要 Node ≥ 18（用原生 fetch，无 npm 依赖、无构建）。

```bash
cd lab/tachie2skin

# 先空跑，确认 key 读到、prompt 和请求都对，不花 GPU：
node src/cli.mjs path/to/立绘.png --dry-run

# 真跑：
node src/cli.mjs path/to/立绘.png
open out/立绘.skin.png        # 或 open out/preview.html 看 3D 预览
```

### 常用参数

| 参数 | 说明 |
|---|---|
| `--prompt "..."` | 手动指定描述（跳过看图） |
| `--no-caption` | 不调用视觉模型，用通用动漫 prompt |
| `--strength 0.7` | img2img 去噪强度，越高越自由、越低越贴原图（默认 0.7） |
| `--seed 0` | 固定种子复现 |
| `--steps 25` | 采样步数 |
| `--out out` | 输出目录 |
| `--dry-run` | 只构造请求不调后端 |

## 两种模式（网页里切换）

**① 区域投影（忠实·本地，默认）** — `web/projectcore.mjs`
把立绘抠图后，按导引线把**头/躯干/四肢的真实像素**裁切投影到对应的 64×64 UV 面，
每个面用满像素 + 镜像补背 + 头发铺顶。**正面就是立绘本人**，裙子/发色/性别天然对。
纯浏览器 canvas，**无 key、无 GPU、即时、隐私**。三条导引滑块（脖子线/胯线/躯干中心）
让头身腿对齐不同构图的立绘。核心是纯函数，已用 `scripts/test_project.mjs` 颜色断言验证。

**② AI 生成（云端）** — IP-Adapter 身份还原 / 文生图。见上文与 `modal/skin_ipa.py`。
保住"大致风格"，但 64px 生成不保证五官/版型精确，属生成式机制的上限。

> 经验：要"像这个角色"用 ①；要"AI 重新设计一个有那味儿的"用 ②。

## Key 从哪来

按优先级合并：`process.env` > `lab/tachie2skin/.env`（可选，自己建）> 主项目
`examples/next-demo/.env.local`。需要：

- `MODAL_SKIN_ENDPOINT` / `MODAL_SKIN_TOKEN` —— img2img 后端（必需）
- `HF_TOKEN` —— 启用看图描述（可选；没有就用通用 prompt）

## 和主项目的关系

| | tachie2skin (本工具) | 主项目 `@skinmint/skin` |
|---|---|---|
| 位置 | `lab/`（workspace 外） | `packages/`（workspace 内） |
| 依赖 | 零 npm 依赖、不 import @skinmint | turbo/pnpm 包 |
| 后端 | 重写的精简 Modal/HF 客户端 | 完整 Provider 体系 |
| 共享 | **只共享 .env 里的 key** | — |

## 路线（后续）
- [ ] 接 `anime-segmentation` 做立绘抠图预处理，提升 init image 质量
- [ ] 接 `Pixelization`/`PixelOE` 做输出后处理提质
- [ ] 加 Web UI（Vite + React + skinview3d），把 CLI 管线搬到浏览器，key 走薄代理
- [ ] 高保真档：`CharacterGen` → MC box 烘焙（后台 GPU）
