"use client";

import type { Settings } from "./useSettings";

const BG_OPTIONS = [
  { v: "", name: "透明" },
  { v: "#0b1020", name: "深色" },
  { v: "#f1f5f9", name: "浅色" },
  { v: "#1e293b", name: "石板" },
];

export function SettingsDrawer({
  settings,
  update,
  onClose,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet right scroll">
        <div className="sheet-head">
          <h2>设置</h2>
          <div className="grow" />
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="field">
          <label>Meshy API 密钥</label>
          <input
            className="in"
            type="password"
            placeholder="msy_…（留空则用演示 Mock）"
            value={settings.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
          />
          <span className="hint">
            仅存于本地浏览器，随每次请求发送到你自己的后端。留空则使用无需密钥的 Mock 生成。
          </span>
        </div>

        <div className="field">
          <label>生成</label>
          <label className="row">
            <input
              type="checkbox"
              checked={settings.refine}
              onChange={(e) => update({ refine: e.target.checked })}
            />
            精修上色 —— 添加贴图与颜色（更耗 credits 与时间）
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={settings.lowpoly}
              onChange={(e) => update({ lowpoly: e.target.checked })}
            />
            低模 —— 更少面数、更轻的文件
          </label>
        </div>

        <div className="field">
          <label>预览背景</label>
          <div className="swatches">
            {BG_OPTIONS.map((b) => (
              <button
                key={b.name}
                title={b.name}
                className={`sw ${settings.background === b.v ? "on" : ""}`}
                style={{
                  background:
                    b.v || "repeating-conic-gradient(#2a2a30 0% 25%, #1a1a1f 0% 50%) 50% / 10px 10px",
                }}
                onClick={() => update({ background: b.v })}
              />
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }} />
        <span className="hint">
          SkinMint · 自带密钥的文本生成 3D。密钥只用于调用你自己的 <code style={{ color: "var(--accent)" }}>/api/generate</code>，不外发。
        </span>
      </div>
    </>
  );
}
