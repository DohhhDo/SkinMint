"use client";

import { useMemo } from "react";
import {
  STYLES,
  CHARACTERS,
  ACTIONS,
  ACCESSORIES,
  buildPrompt,
  type PromptSelection,
  type BuildResult,
} from "@skinmint/presets";

export function PromptBuilder({
  selection,
  setSelection,
  onUse,
  onGenerate,
  onClose,
}: {
  selection: PromptSelection;
  setSelection: (updater: (s: PromptSelection) => PromptSelection) => void;
  onUse: (r: BuildResult) => void;
  onGenerate: (r: BuildResult) => void;
  onClose: () => void;
}) {
  const result = useMemo(() => buildPrompt(selection), [selection]);
  const ips = useMemo(() => [...new Set(CHARACTERS.map((c) => c.ip))], []);

  const pick = (key: "styleId" | "characterId" | "actionId", id: string) =>
    setSelection((s) => ({ ...s, [key]: s[key] === id ? undefined : id }));

  const toggleAcc = (id: string) =>
    setSelection((s) => {
      const set = new Set(s.accessoryIds ?? []);
      set.has(id) ? set.delete(id) : set.add(id);
      return { ...s, accessoryIds: [...set] };
    });

  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} className={`chip ${on ? "on" : ""}`} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet right scroll">
        <div className="sheet-head">
          <h2>选项构建器</h2>
          <div className="grow" />
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="bsec">
          <span className="t">风格</span>
          <div className="chips">
            {STYLES.map((s) => chip(selection.styleId === s.id, s.label, () => pick("styleId", s.id)))}
          </div>
        </div>

        <div className="bsec">
          <span className="t">角色</span>
          {ips.map((ip) => (
            <div className="ip-grp" key={ip}>
              <span className="ip">{ip}</span>
              <div className="chips">
                {CHARACTERS.filter((c) => c.ip === ip).map((c) =>
                  chip(selection.characterId === c.id, c.label, () => pick("characterId", c.id)),
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bsec">
          <span className="t">动作</span>
          <div className="chips">
            {ACTIONS.map((a) => chip(selection.actionId === a.id, a.label, () => pick("actionId", a.id)))}
          </div>
        </div>

        <div className="bsec">
          <span className="t">配饰（可多选）</span>
          <div className="chips">
            {ACCESSORIES.map((a) =>
              chip((selection.accessoryIds ?? []).includes(a.id), a.label, () => toggleAcc(a.id)),
            )}
          </div>
        </div>

        <div className="bsec">
          <span className="t">主体（没选角色时用，可补充细节）</span>
          <input
            className="in"
            placeholder="例如：一只戴帽子的柴犬"
            value={selection.subject ?? ""}
            onChange={(e) => setSelection((s) => ({ ...s, subject: e.target.value }))}
          />
        </div>

        <div className="bsec">
          <span className="t">提示词预览（可在输入框再改）</span>
          <div className="preview-box">{result.prompt}</div>
        </div>

        <div className="builder-actions">
          <button className="btn-min" onClick={() => onUse(result)}>填入输入框</button>
          <button className="send" onClick={() => onGenerate(result)}>直接生成</button>
        </div>
      </div>
    </>
  );
}
