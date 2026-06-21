"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CHARACTERS, type Character } from "./_data/characters";
import { useSettings } from "./_components/useSettings";
import { SettingsDrawer } from "./_components/SettingsDrawer";
import { ExportPanel } from "./_components/ExportPanel";
import { sampleColors } from "./_lib/sampleColors";

type Clip = "idle" | "walk" | "run" | "wave";

const ACTIONS: { v: Clip; label: string }[] = [
  { v: "idle", label: "待机" },
  { v: "walk", label: "行走" },
  { v: "run", label: "奔跑" },
  { v: "wave", label: "挥手" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Studio() {
  const { settings, update } = useSettings();
  const [phase, setPhase] = useState<"select" | "result">("select");

  const [mode, setMode] = useState<"curated" | "upload" | "text">("text");
  const [selected, setSelected] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; dataUrl: string } | null>(null);
  const [textPrompt, setTextPrompt] = useState("");
  const [portrait, setPortrait] = useState<{ prompt: string; dataUrl: string } | null>(null);
  const [drawing, setDrawing] = useState(false);

  const [chibi, setChibi] = useState(false);
  const [base, setBase] = useState(false);
  const [action, setAction] = useState<Clip>("walk");

  const [built, setBuilt] = useState<{ url: string; from: "curated" | "upload" | "text"; name?: string; chibi: boolean; base: boolean } | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const token = useRef(0);

  useEffect(() => { void import("@skinmint/embed"); }, []);

  const stale = !!built && (built.chibi !== chibi || built.base !== base);
  const showModel = phase === "result" && !!built && !stale && !building;
  const isCurated = built?.from === "curated";

  const normalizeToSquare = (file: File, size = 640): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });

  // ----- core builds (every entry lands DIRECTLY on the result) -----
  const buildFromImage = async (dataUrl: string, name: string | undefined, from: "upload" | "text", my: number) => {
    const colors = await sampleColors(dataUrl);
    const res = await fetch("/api/mc-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl, name, colors, chibi, base }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (my !== token.current) return;
    setBuilt({ url: data.modelUrl, from, name, chibi, base });
    setPhase("result");
  };

  // text → AI 立绘 → model → result (one shot)
  const runText = async () => {
    const p = textPrompt.trim();
    if (!p || building) return;
    setBuilding(true); setDrawing(true); setError(null);
    const my = ++token.current;
    try {
      const res = await fetch("/api/mc-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (my !== token.current) return;
      setMode("text"); setSelected(null); setUpload(null); setPortrait({ prompt: p, dataUrl: data.image });
      setDrawing(false);
      await buildFromImage(data.image, p, "text", my);
    } catch (e) {
      if (my === token.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (my === token.current) { setDrawing(false); setBuilding(false); }
    }
  };

  // upload image → model → result
  const runUpload = async (f: File | null) => {
    if (!f || building) return;
    setError(null);
    let dataUrl: string;
    try { dataUrl = await normalizeToSquare(f); } catch { setError("这张图片读不出来，换一张试试"); return; }
    const name = f.name.replace(/\.[^.]+$/, "").slice(0, 24) || "自定义";
    setMode("upload"); setSelected(null); setPortrait(null); setUpload({ name, dataUrl });
    setBuilding(true);
    const my = ++token.current;
    try { await buildFromImage(dataUrl, name, "upload", my); }
    catch (e) { if (my === token.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (my === token.current) setBuilding(false); }
  };

  // preset → ready model → result (download, no generation)
  const buildPreset = async (c: Character, cb = chibi, bs = base) => {
    if (building) return;
    setMode("curated"); setSelected(c.id); setUpload(null); setPortrait(null); setShowLibrary(false);
    setBuilding(true); setError(null);
    const my = ++token.current;
    try {
      const minMoment = new Promise((r) => setTimeout(r, 600));
      const req = fetch("/api/mc-char", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, name: c.name, chibi: cb, base: bs }) });
      const [res] = await Promise.all([req, minMoment]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (my !== token.current) return;
      setBuilt({ url: data.modelUrl, from: "curated", name: c.name, chibi: cb, base: bs });
      setPhase("result");
    } catch (e) { if (my === token.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (my === token.current) setBuilding(false); }
  };

  // 造型 changed in the result → rebuild from the same subject
  const rebuild = async () => {
    if (building) return;
    if (mode === "curated") { const c = CHARACTERS.find((x) => x.id === selected); if (c) await buildPreset(c, chibi, base); return; }
    setBuilding(true); setError(null);
    const my = ++token.current;
    try {
      if (mode === "upload" && upload) await buildFromImage(upload.dataUrl, upload.name, "upload", my);
      else if (portrait) await buildFromImage(portrait.dataUrl, portrait.prompt, "text", my);
    } catch (e) { if (my === token.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (my === token.current) setBuilding(false); }
  };

  const newOne = () => { setPhase("select"); setBuilt(null); setSelected(null); setUpload(null); setPortrait(null); setTextPrompt(""); setMode("text"); setError(null); };

  const loading = building || drawing;
  const landing = phase === "select" && !loading;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="cube" />
          <span className="wm">skinmint</span>
          <span className="tag">工坊</span>
        </div>
        <button className="gear" title="设置" onClick={() => setShowSettings(true)}><GearIcon /></button>
      </header>

      {landing ? (
        /* ===================== LANDING — centered terminal console ===================== */
        <main className="landing">
          <motion.div className="hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
            <h1 className="hero-q"><span className="caret">›</span> MC 形象生成器</h1>
            <textarea
              className="console-in"
              rows={3}
              maxLength={300}
              autoFocus
              placeholder="描述一个角色，AI 会画成二次元立绘 —— 例如：银发红瞳的少女剑士，黑色铠甲"
              value={textPrompt}
              onChange={(e) => { setTextPrompt(e.target.value); setMode("text"); }}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runText(); }}
            />
            <div className="hero-row">
              <button className="chip" onClick={() => fileRef.current?.click()}>↑ 上传图片</button>
              <button className="chip guy" onClick={() => setShowLibrary(true)}><GuyIcon /> 角色库</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => runUpload(e.target.files?.[0] ?? null)} />
              <button className="cta hero-gen" disabled={!textPrompt.trim()} onClick={runText}>生成模型 ✦</button>
            </div>
            <p className="hero-foot">角色库的预设 <b>可直接下载引用</b> · 描述 / 上传则由 <b>AI 生成</b></p>
            {error && <p className="hero-err">{error}</p>}
          </motion.div>
        </main>
      ) : (
        /* ===================== STAGE — full-screen figure + bottom dock ===================== */
        <main className="stage">
          {showModel ? (
            <div className="stage-figure">
              <skinmint-model src={built!.url} animation={action} auto-rotate={autoRotate ? "true" : undefined} rotate-speed="0.55" background="transparent" />
            </div>
          ) : null}

          {(showModel || stale) && <div className="pedestal"><div className="disc" /><div className="shade" /></div>}

          <AnimatePresence>
            {loading && (
              <motion.div className="forge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="bricks">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span key={i} className="brick" animate={{ y: [0, -12, 0], opacity: [0.35, 1, 0.35] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.13, ease: "easeInOut" }} />
                  ))}
                </div>
                <span className="lbl">{drawing ? "AI 正在绘制立绘…" : "正在搭建方块模型…"}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {stale && !loading && (
            <div className="restale">
              <p>造型已修改</p>
              <button className="cta" onClick={rebuild}>重新生成 ↻</button>
            </div>
          )}

          <AnimatePresence>
            {error && <motion.div className="stage-err" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{error}</motion.div>}
          </AnimatePresence>

          {/* bottom dock — controls live here, not in a side column */}
          {showModel && (
            <motion.div className="dock" initial={{ opacity: 0, y: 16, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} transition={{ duration: 0.3, ease: EASE }}>
              <div className="dock-l">
                <button className="dbtn" onClick={newOne}>＋ 新建</button>
                <span className={`dflag ${isCurated ? "dl" : "gen"}`}>{isCurated ? "预设 · 可下载" : "AI 生成"}</span>
              </div>

              <div className="dock-c">
                <div className="dseg">
                  {ACTIONS.map((a) => (
                    <button key={a.v} className={`di ${action === a.v ? "on" : ""}`} onClick={() => setAction(a.v)} title={a.label}><ActIcon act={a.v} /></button>
                  ))}
                </div>
                <div className="dseg">
                  <button className={`dt ${chibi ? "on" : ""}`} onClick={() => setChibi((v) => !v)}>Q 版</button>
                  <button className={`dt ${base ? "on" : ""}`} onClick={() => setBase((v) => !v)}>展台</button>
                  <button className={`dt ${autoRotate ? "on" : ""}`} onClick={() => setAutoRotate((v) => !v)}>自转</button>
                </div>
              </div>

              <div className="dock-r">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a className="dbtn dl" href={built!.url} download={`${built?.name || "skinmint"}.glb`}>下载 GLB ↓</a>
                <button className="cta" onClick={() => built && setExportUrl(built.url)}>导出 ↗</button>
              </div>
            </motion.div>
          )}
        </main>
      )}

      <footer className="credit">
        由 <a href="https://www.vindo.cn" target="_blank" rel="noreferrer"><b>Vindo · 间窗</b></a> 制作 · <a href="https://www.vindo.cn" target="_blank" rel="noreferrer">www.vindo.cn</a>
      </footer>

      {/* ===================== LIBRARY (presets — direct download) ===================== */}
      <AnimatePresence>
        {showLibrary && (
          <motion.div className="lib-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLibrary(false)}>
            <motion.div className="library" initial={{ opacity: 0, y: 16, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.26, ease: EASE }} onClick={(e) => e.stopPropagation()}>
              <div className="lib-top">
                <div>
                  <h3>角色库</h3>
                  <p>预设角色 · 手作皮肤 · 选中即直接下载引用，无需生成</p>
                </div>
                <button className="lib-x" onClick={() => setShowLibrary(false)}>✕</button>
              </div>
              <div className="lib-grid">
                {CHARACTERS.map((c) => (
                  <button key={c.id} className="face" onClick={() => buildPreset(c)} title={c.name}>
                    <span className="pic">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={c.icon} alt={c.name} loading="lazy" /></span>
                    <span className="nm">{c.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSettings && <SettingsDrawer settings={settings} update={update} onClose={() => setShowSettings(false)} />}
      {exportUrl && <ExportPanel modelUrl={exportUrl} background={settings.background} animation={action} onClose={() => setExportUrl(null)} />}
    </div>
  );
}

function GuyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="14" height="14" aria-hidden>
      <rect x="8" y="3" width="8" height="7" rx="1" />
      <rect x="7" y="11" width="10" height="7" rx="1" />
      <rect x="8.5" y="18.5" width="2.6" height="3" rx="0.6" />
      <rect x="12.9" y="18.5" width="2.6" height="3" rx="0.6" />
    </svg>
  );
}
function ActIcon({ act }: { act: Clip }) {
  const ln = (d: string) => <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />;
  const head = <circle cx="12" cy="5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />;
  switch (act) {
    case "wave": return <svg viewBox="0 0 24 24">{head}{ln("M12 7.4V15 M12 9.5 L8 12 M12 9.5 L16.5 5.5 M12 15 L9 21 M12 15 L15 21")}</svg>;
    case "run": return <svg viewBox="0 0 24 24">{head}{ln("M12 7.4V14 M12 9.5 L8.5 8 M12 9.5 L15.5 11.5 M12 14 L8.5 18 M12 14 L16 19.5")}</svg>;
    case "walk": return <svg viewBox="0 0 24 24">{head}{ln("M12 7.4V14.5 M12 9.5 L9.5 11.5 M12 9.5 L14.5 8 M12 14.5 L9.5 20 M12 14.5 L14.5 19")}</svg>;
    default: return <svg viewBox="0 0 24 24">{head}{ln("M12 7.4V15 M12 9.5 L9 12.5 M12 9.5 L15 12.5 M12 15 L10.5 21 M12 15 L13.5 21")}</svg>;
  }
}
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
