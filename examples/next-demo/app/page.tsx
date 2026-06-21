"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { IPS, CHARACTERS } from "./_data/characters";
import { useSettings } from "./_components/useSettings";
import { SettingsDrawer } from "./_components/SettingsDrawer";
import { ExportPanel } from "./_components/ExportPanel";
import { sampleColors } from "./_lib/sampleColors";

type Clip = "idle" | "walk" | "run" | "wave";

const STEPS = [
  { key: "who", n: "01", kicker: "第一步 · 选角", q: "你想创造谁？", hint: "挑一个角色作为蓝本，或上传你自己的立绘。" },
  { key: "look", n: "02", kicker: "第二步 · 造型", q: "想要什么造型？", hint: "调整身形比例，加一个收藏展台。" },
  { key: "act", n: "03", kicker: "第三步 · 动态", q: "让它怎么动？", hint: "生成后角色会真的动起来——随时切换。" },
] as const;

const ACTIONS: { v: Clip; label: string; sub: string }[] = [
  { v: "idle", label: "待机", sub: "轻微呼吸" },
  { v: "walk", label: "行走", sub: "迈步前进" },
  { v: "run", label: "奔跑", sub: "大幅摆动" },
  { v: "wave", label: "挥手", sub: "举手致意" },
];

const EASE = [0.22, 1, 0.36, 1] as const;
const deck = {
  enter: { opacity: 0, x: 22 },
  show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: EASE, when: "beforeChildren", staggerChildren: 0.045 } },
  exit: { opacity: 0, x: -22, transition: { duration: 0.18, ease: EASE } },
};
const item = { enter: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } };

export default function Studio() {
  const { settings, update } = useSettings();
  const [phase, setPhase] = useState<"select" | "result">("select");
  const [step, setStep] = useState(0);

  const [mode, setMode] = useState<"curated" | "upload" | "text">("curated");
  const [ip, setIp] = useState("genshin");
  const [selected, setSelected] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; dataUrl: string } | null>(null);
  const [textPrompt, setTextPrompt] = useState("");
  const [portrait, setPortrait] = useState<{ prompt: string; dataUrl: string } | null>(null);
  const [drawing, setDrawing] = useState(false); // AI drawing the 立绘

  const [chibi, setChibi] = useState(false);
  const [base, setBase] = useState(false);
  const [action, setAction] = useState<Clip>("walk");

  const [built, setBuilt] = useState<{ url: string; key: string } | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const token = useRef(0);

  useEffect(() => {
    void import("@skinmint/embed");
  }, []);

  const selectedChar = CHARACTERS.find((c) => c.id === selected);
  const chars = CHARACTERS.filter((c) => c.ip === ip);
  const hasSubject = mode === "curated" ? !!selected : mode === "upload" ? !!upload : !!portrait;
  const subjectName = mode === "curated" ? selectedChar?.name : mode === "upload" ? upload?.name : portrait?.prompt;
  const subjectImg = mode === "curated" ? selectedChar?.icon : mode === "upload" ? upload?.dataUrl : portrait?.dataUrl;

  const subjectKey = mode === "curated" ? selected : mode === "upload" ? upload?.name : portrait?.dataUrl?.slice(-24);
  const buildKey = `${mode}:${subjectKey}:${chibi ? 1 : 0}:${base ? 1 : 0}`;
  const stale = !!built && built.key !== buildKey;

  // Normalize any upload to a standard square: centered (no squish), padded on a
  // plain background, fixed size. This is stage ① of the upload pipeline — it
  // gives the skin model a consistent shape regardless of what was uploaded.
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

  const onPickFile = async (f: File | null) => {
    if (!f) return;
    try {
      const dataUrl = await normalizeToSquare(f);
      setUpload({ name: f.name.replace(/\.[^.]+$/, "").slice(0, 24) || "自定义", dataUrl });
      setMode("upload");
      setSelected(null);
    } catch {
      setError("这张图片读不出来，换一张试试");
    }
  };

  // text → AI 立绘 (the AI-necessary entry). Anime style is locked server-side.
  const drawPortrait = async () => {
    const p = textPrompt.trim();
    if (!p || drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/mc-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMode("text");
      setSelected(null);
      setUpload(null);
      setPortrait({ prompt: p, dataUrl: data.image });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDrawing(false);
    }
  };

  const generate = async () => {
    if (!hasSubject || building) return;
    setBuilding(true);
    setError(null);
    const key = buildKey;
    const my = ++token.current;
    try {
      const minMoment = new Promise((r) => setTimeout(r, 900));
      let req: Promise<Response>;
      if (mode === "curated") {
        req = fetch("/api/mc-char", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected, name: selectedChar?.name, chibi, base }) });
      } else {
        // upload / text → sample region colors from the 立绘 (client canvas), send with it
        const subjImg = mode === "upload" ? upload?.dataUrl : portrait?.dataUrl;
        const colors = subjImg ? await sampleColors(subjImg) : {};
        req = fetch("/api/mc-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: subjImg, name: mode === "upload" ? upload?.name : portrait?.prompt, colors, chibi, base }),
        });
      }
      const [res] = await Promise.all([req, minMoment]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (my !== token.current) return;
      setBuilt({ url: data.modelUrl, key });
      setPhase("result");
    } catch (e) {
      if (my === token.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (my === token.current) setBuilding(false);
    }
  };

  const cur = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const canForward = step === 0 ? hasSubject : true;
  const goto = (s: number) => {
    if (s < 0 || s >= STEPS.length) return;
    if (s > 0 && !hasSubject) return;
    setStep(s);
  };

  const showModel = phase === "result" && built && !stale;

  return (
    <div className="studio">
      {/* ===================== STAGE ===================== */}
      <div className="stage">
        <div className="stage-brand">
          <span className="cube" />
          <span className="wm">skinmint</span>
          <span className="tag">工坊</span>
        </div>

        {showModel ? (
          <div className="stage-figure">
            <skinmint-model
              src={built!.url}
              animation={action}
              auto-rotate={autoRotate ? "true" : undefined}
              rotate-speed="0.55"
              background="transparent"
            />
          </div>
        ) : building || drawing ? null : subjectImg ? (
          <motion.div className="preview2d" key={subjectImg} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
            <div className="card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={subjectImg} alt={subjectName} />
            </div>
            <span className="nm">{subjectName}</span>
          </motion.div>
        ) : (
          <div className="stage-empty">
            <motion.div className="mk" initial={{ opacity: 0, rotate: -20 }} animate={{ opacity: 1, rotate: -8 }} transition={{ duration: 0.6, ease: EASE }} />
            <p>选一个角色，开始打造你的方块收藏品</p>
          </div>
        )}

        {/* pedestal sits behind the figure / preview */}
        {(showModel || (!building && subjectImg)) && (
          <div className="pedestal">
            <div className="disc" />
            <div className="shade" />
          </div>
        )}

        <AnimatePresence>
          {(building || drawing) && (
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

        <AnimatePresence>
          {error && (
            <motion.div className="stage-err" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {showModel && (
          <div className="stage-tools">
            <button className={`tool ${autoRotate ? "on" : ""}`} onClick={() => setAutoRotate((v) => !v)}>⟳ 自转</button>
            <button className="tool" onClick={() => built && setExportUrl(built.url)}>↗ 导出</button>
          </div>
        )}
      </div>

      {/* ===================== PANEL ===================== */}
      <aside className="panel">
        <div className="panel-top">
          {phase === "select" ? (
            <Stepper step={step} reachable={hasSubject} onJump={goto} />
          ) : (
            <div className="result-flag"><span className="ok">✓</span> {subjectName} · 已生成</div>
          )}
          <button className="gear" title="设置" onClick={() => setShowSettings(true)}><GearIcon /></button>
        </div>

        {phase === "select" ? (
          <>
            <div className="panel-body scroll">
              <LayoutGroup>
                <AnimatePresence mode="wait">
                  <motion.div key={step} variants={deck} initial="enter" animate="show" exit="exit">
                    <motion.div className="ask" variants={item}>
                      <div className="kicker">{cur.kicker}</div>
                      <h2>{cur.q}</h2>
                      <p className="hint">{cur.hint}</p>
                    </motion.div>

                    {step === 0 && (
                      <>
                        <motion.div className="ips" variants={item}>
                          <button className={`ip text ${mode === "text" ? "on" : ""}`} onClick={() => { setMode("text"); setSelected(null); setUpload(null); }}>✦ 文字创造</button>
                          {IPS.map((x) => (
                            <button key={x.id} className={`ip ${mode === "curated" && ip === x.id ? "on" : ""}`} disabled={!x.available} onClick={() => { setMode("curated"); setIp(x.id); setSelected(null); }}>
                              {x.name}{!x.available && <i>即将</i>}
                            </button>
                          ))}
                          <button className={`ip upload ${mode === "upload" ? "on" : ""}`} onClick={() => fileRef.current?.click()}>↑ 上传立绘</button>
                          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
                        </motion.div>

                        {mode === "text" ? (
                          <motion.div className="textgen" variants={item}>
                            <textarea
                              className="prompt-in"
                              rows={3}
                              maxLength={300}
                              placeholder="描述一个角色，AI 会画成二次元立绘——例如：红发女剑士，黑色铠甲，红色眼睛"
                              value={textPrompt}
                              onChange={(e) => setTextPrompt(e.target.value)}
                              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") drawPortrait(); }}
                            />
                            <button className="cta gen-portrait" disabled={!textPrompt.trim() || drawing} onClick={drawPortrait}>
                              {drawing ? "AI 绘制中…" : portrait ? "重抽立绘 ↻" : "生成立绘 ✦"}
                            </button>
                            {portrait && <p className="textgen-hint">✓ 立绘已生成 —— 下一步调整造型与动作</p>}
                          </motion.div>
                        ) : (
                          <motion.div className="roster" variants={item}>
                            {mode === "upload" && upload && (
                              <button className="face on">
                                <motion.span layoutId="subj-ring" className="ring" transition={{ duration: 0.25, ease: EASE }} />
                                <span className="pic">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={upload.dataUrl} alt={upload.name} /></span>
                                <span className="nm">{upload.name}</span>
                              </button>
                            )}
                            {chars.map((c) => (
                              <button key={c.id} className={`face ${mode === "curated" && selected === c.id ? "on" : ""}`} onClick={() => { setMode("curated"); setSelected(c.id); }}>
                                {mode === "curated" && selected === c.id && <motion.span layoutId="subj-ring" className="ring" transition={{ duration: 0.25, ease: EASE }} />}
                                <span className="pic">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={c.icon} alt={c.name} /></span>
                                <span className="nm">{c.name}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </>
                    )}

                    {step === 1 && (
                      <motion.div className="opts" variants={item}>
                        <Opt name="标准身形" sub="经典 MC 比例" on={!chibi} onClick={() => setChibi(false)} icon={<ScaleIcon big={false} />} ring="scale" />
                        <Opt name="Q 版" sub="大头 · 更可爱" on={chibi} onClick={() => setChibi(true)} icon={<ScaleIcon big />} ring="scale" />
                        <Opt name="无展台" sub="纯角色" on={!base} onClick={() => setBase(false)} icon={<BaseIcon on={false} />} ring="base" />
                        <Opt name="带展台" sub="方块底座" on={base} onClick={() => setBase(true)} icon={<BaseIcon on />} ring="base" />
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div className="opts" variants={item}>
                        {ACTIONS.map((a) => (
                          <Opt key={a.v} name={a.label} sub={a.sub} on={action === a.v} onClick={() => setAction(a.v)} icon={<ActIcon act={a.v} />} ring="act" />
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </LayoutGroup>
            </div>

            <div className="panel-foot">
              <button className="back" disabled={step === 0} onClick={() => goto(step - 1)}>← 上一步</button>
              <span className="foot-note">{subjectName ? <>已选 <b>{subjectName}</b></> : "未选择"}</span>
              {isLast ? (
                <button className="cta" disabled={!hasSubject || building} onClick={generate}>{building ? "生成中…" : "生成模型 ✦"}</button>
              ) : (
                <button className="cta next" disabled={!canForward} onClick={() => goto(step + 1)}>下一步 →</button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="panel-body scroll">
              <div className="ask">
                <div className="kicker">已完成 · 动态预览</div>
                <h2>它动起来了</h2>
                <p className="hint">{stale ? "造型已修改，重新生成可应用更新。" : "实时切换动态，无需重新生成。"}</p>
              </div>
              <div className="opts">
                {ACTIONS.map((a) => (
                  <Opt key={a.v} name={a.label} sub={a.sub} on={action === a.v} onClick={() => setAction(a.v)} icon={<ActIcon act={a.v} />} ring="act2" />
                ))}
              </div>
            </div>
            <div className="panel-foot">
              <button className="back" onClick={() => setPhase("select")}>← 返回修改</button>
              <span className="foot-note">正在播放 <b>{ACTIONS.find((a) => a.v === action)?.label}</b></span>
              <button className="cta" onClick={() => built && setExportUrl(built.url)}>导出 ↗</button>
            </div>
          </>
        )}
      </aside>

      {showSettings && <SettingsDrawer settings={settings} update={update} onClose={() => setShowSettings(false)} />}
      {exportUrl && <ExportPanel modelUrl={exportUrl} background={settings.background} animation={action} onClose={() => setExportUrl(null)} />}
    </div>
  );
}

function Stepper({ step, reachable, onJump }: { step: number; reachable: boolean; onJump: (s: number) => void }) {
  return (
    <div className="stepper">
      {STEPS.map((s, i) => {
        const state = i === step ? "on" : i < step ? "done" : "todo";
        const clickable = i === 0 || reachable;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <span className={`bar ${i <= step ? "fill" : ""}`} />}
            <button className={`dot ${state} ${clickable ? "" : "lock"}`} onClick={() => clickable && onJump(i)}>
              <span className="num">{state === "done" ? "✓" : s.n}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Opt({ name, sub, on, onClick, icon, ring }: { name: string; sub?: string; on: boolean; onClick: () => void; icon: React.ReactNode; ring: string }) {
  return (
    <motion.button className={`opt ${on ? "on" : ""}`} onClick={onClick} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.16, ease: EASE }}>
      {on && <motion.span layoutId={`ring-${ring}`} className="ring" transition={{ duration: 0.26, ease: EASE }} />}
      <span className="ic">{icon}</span>
      <span className="name">{name}</span>
      {sub && <span className="sub">{sub}</span>}
    </motion.button>
  );
}

function ScaleIcon({ big }: { big: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <rect x={big ? 7 : 8.5} y="3" width={big ? 10 : 7} height={big ? 9 : 7} rx="1.5" />
      <rect x="9" y={big ? 13 : 11} width="6" height={big ? 8 : 10} rx="1.5" />
    </svg>
  );
}
function BaseIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="13" rx="1.5" />
      {on && <ellipse cx="12" cy="20" rx="9" ry="2.6" fill="currentColor" opacity="0.16" stroke="none" />}
      {on && <rect x="4.5" y="18.4" width="15" height="3.2" rx="1.5" />}
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
