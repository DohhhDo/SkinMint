"use client";

import { useMemo, useState } from "react";

type Tab = "embed" | "npm" | "download";

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn-min copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? "已复制 ✓" : "复制"}
    </button>
  );
}

export function ExportPanel({
  modelUrl,
  background,
  animation,
  onClose,
}: {
  modelUrl: string;
  background: string;
  animation?: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("embed");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const absModel = modelUrl.startsWith("http") ? modelUrl : `${origin}${modelUrl}`;
  const embedScript = `${origin}/skinmint-embed.global.js`;
  const bgAttr = background ? `\n  background="${background}"` : "";
  const animAttr = animation ? `\n  animation="${animation}"` : "";

  const embedSnippet = useMemo(
    () =>
      `<script src="${embedScript}"></script>\n<skinmint-model\n  src="${absModel}"${animAttr}${bgAttr}\n  style="width:100%;height:480px"\n></skinmint-model>`,
    [embedScript, absModel, animAttr, bgAttr],
  );
  const npmInstall = `npm i @skinmint/embed`;
  const npmUsage = `import "@skinmint/embed";\n\n<skinmint-model src="${absModel}"${animation ? ` animation="${animation}"` : ""} style="height:480px"></skinmint-model>`;
  const dlSnippet = `<script src="${embedScript}"></script>\n<skinmint-model src="./model.glb"${animation ? ` animation="${animation}"` : ""} style="height:480px"></skinmint-model>`;

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet center">
        <div className="sheet-head" style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <h2>导出可嵌入模型</h2>
          <div className="grow" />
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="center-body scroll">
          <div className="tabs">
            <button className={`tab ${tab === "embed" ? "on" : ""}`} onClick={() => setTab("embed")}>Web 组件</button>
            <button className={`tab ${tab === "npm" ? "on" : ""}`} onClick={() => setTab("npm")}>npm</button>
            <button className={`tab ${tab === "download" ? "on" : ""}`} onClick={() => setTab("download")}>下载</button>
          </div>

          {tab === "embed" && (
            <>
              <p className="note" style={{ marginBottom: 12 }}>
                贴进任何你掌控的页面。<code>&lt;skinmint-model&gt;</code> 是自包含的自定义元素 —— 内置 <code>walk/run/wave/idle</code> 动画，拖动旋转，改 <code>animation</code> 即可切换动态。
              </p>
              <div className="snippet">
                <CopyBtn text={embedSnippet} />
                {embedSnippet}
              </div>
              <p className="note" style={{ marginTop: 12 }}>
                模型已开启 <code>CORS *</code>，可从任意域名加载。上线时把 <code>skinmint-embed.global.js</code> 放到你的 CDN（或待 <code>@skinmint/embed</code> 发布后用 jsDelivr）。
              </p>
            </>
          )}

          {tab === "npm" && (
            <>
              <p className="note" style={{ marginBottom: 12 }}>用于有打包器的项目（React / Vue / Svelte…）：</p>
              <div className="snippet"><CopyBtn text={npmInstall} />{npmInstall}</div>
              <div className="snippet" style={{ marginTop: 10 }}><CopyBtn text={npmUsage} />{npmUsage}</div>
              <p className="note" style={{ marginTop: 12 }}>
                导入即注册 <code>&lt;skinmint-model&gt;</code> 元素；three.js 作为 peer 依赖由你的应用去重。
              </p>
            </>
          )}

          {tab === "download" && (
            <>
              <p className="note" style={{ marginBottom: 12 }}>
                下载优化后的 GLB（Draco + WebP）自行托管 —— 同源即可，无需 CORS。
              </p>
              <a className="btn-min" href={absModel} download style={{ display: "inline-block", textDecoration: "none" }}>
                ↓ 下载 .glb
              </a>
              <div className="snippet" style={{ marginTop: 14 }}><CopyBtn text={dlSnippet} />{dlSnippet}</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
