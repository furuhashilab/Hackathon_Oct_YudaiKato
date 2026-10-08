import { useEffect, useRef, useState } from "react";
import { NDVI_COLORMAP_INDEX, type RenderMode } from "./render-modes.js";
import type { Scene } from "./scenes.js";

type Props = {
  scenes: Scene[];
  sceneIndex: number;
  onSceneChange: (index: number) => void;
  modes: RenderMode[];
  modeIndex: number;
  onModeChange: (index: number) => void;
  ndviRange: [number, number];
  onNdviRangeChange: (range: [number, number]) => void;
  clipOutsideRange: boolean;
  onClipOutsideRangeChange: (value: boolean) => void;
  rescaleMax: number;
  onRescaleMaxChange: (value: number) => void;
  opacity: number;
  onOpacityChange: (value: number) => void;
  showExtent: boolean;
  onShowExtentChange: (value: boolean) => void;
  colormapImage: ImageData | null;
  error: string | null;
  onResetView: () => void;
};

export function ControlPanel({
  scenes,
  sceneIndex,
  onSceneChange,
  modes,
  modeIndex,
  onModeChange,
  ndviRange,
  onNdviRangeChange,
  clipOutsideRange,
  onClipOutsideRangeChange,
  rescaleMax,
  onRescaleMaxChange,
  opacity,
  onOpacityChange,
  showExtent,
  onShowExtentChange,
  colormapImage,
  error,
  onResetView,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const scene = scenes[sceneIndex];
  const mode = modes[modeIndex];

  return (
    <aside className="panel">
      <header className="panel__header">
        <div>
          <h1>横瀬町 Sentinel-2 NDVI</h1>
          <p className="panel__subtitle">deck.gl-raster + MapLibre GL</p>
        </div>
        <button
          type="button"
          className="panel__toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "パネルを開く" : "パネルを閉じる"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </header>

      {!collapsed && (
        <div className="panel__body">
          <p className="panel__intro">
            埼玉県横瀬町の Sentinel-2 L2A を{" "}
            <a
              href="https://registry.opendata.aws/sentinel-2-l2a-cogs/"
              target="_blank"
              rel="noreferrer"
            >
              AWS Open Data
            </a>{" "}
            の Cloud-Optimized GeoTIFF から直接読み込み、ブラウザの GPU
            上でバンド演算しています。タイルサーバーは介していません。
          </p>

          <label className="field">
            <span className="field__label">シーン (観測日)</span>
            <select
              value={sceneIndex}
              onChange={(e) => onSceneChange(Number(e.target.value))}
            >
              {scenes.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.title} — 雲量 {s.cloudCover.toFixed(2)}%
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">表示モード</span>
            <select
              value={modeIndex}
              onChange={(e) => onModeChange(Number(e.target.value))}
            >
              {modes.map((m, i) => (
                <option key={m.id} value={i}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>

          <p className="panel__hint">{mode.description}</p>

          {mode.id === "ndvi" ? (
            <>
              <ColormapLegend
                image={colormapImage}
                index={NDVI_COLORMAP_INDEX}
                range={ndviRange}
              />
              <RangeField
                label="カラーマップ下限"
                value={ndviRange[0]}
                min={-1}
                max={ndviRange[1] - 0.05}
                step={0.05}
                onChange={(v) => onNdviRangeChange([v, ndviRange[1]])}
              />
              <RangeField
                label="カラーマップ上限"
                value={ndviRange[1]}
                min={ndviRange[0] + 0.05}
                max={1}
                step={0.05}
                onChange={(v) => onNdviRangeChange([ndviRange[0], v])}
              />
              <CheckField
                label="レンジ外を透過する"
                checked={clipOutsideRange}
                onChange={onClipOutsideRangeChange}
              />
              <p className="panel__hint">
                陸域の NDVI はおおむね -0.1 〜 0.9 に収まります。下限を 0.2
                まで上げてレンジ外を透過すると、市街地・裸地・水面が抜けて植生だけが残ります。
              </p>
            </>
          ) : (
            <RangeField
              label="明るさ (反射率の上限)"
              value={rescaleMax}
              min={0.01}
              max={0.2}
              step={0.005}
              format={(v) => v.toFixed(3)}
              onChange={onRescaleMaxChange}
            />
          )}

          <RangeField
            label="不透明度"
            value={opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={onOpacityChange}
          />

          <CheckField
            label="検索に使った bbox を表示"
            checked={showExtent}
            onChange={onShowExtentChange}
          />

          <button type="button" className="panel__reset" onClick={onResetView}>
            横瀬町に戻る
          </button>

          {error && <p className="panel__error">{error}</p>}

          <dl className="panel__meta">
            <div>
              <dt>STAC item</dt>
              <dd>
                <a
                  href={`https://radiantearth.github.io/stac-browser/#/external/earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/${scene.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {scene.id}
                </a>
              </dd>
            </div>
            <div>
              <dt>バンド</dt>
              <dd>
                {Object.entries(mode.bands)
                  .map(([slot, band]) => `${band} (${slot})`)
                  .join(" / ")}
              </dd>
            </div>
            <div>
              <dt>MGRS タイル</dt>
              <dd>54SUE — 10 m 分解能</dd>
            </div>
          </dl>

          <footer className="panel__footer">
            <a
              href="https://github.com/furuhashilab/Hackathon_Oct_YudaiKato"
              target="_blank"
              rel="noreferrer"
            >
              ソースコード
            </a>
            <span>·</span>
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
          </footer>
        </div>
      )}
    </aside>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v: number) => v.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        <span className="field__value">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * NDVI のカラーバー。
 *
 * GPU が実際にサンプルしているのと同じスプライト (256px 幅・1 カラーマップ
 * 1 行) の該当行をそのまま canvas に描くので、凡例と地図の色が必ず一致する。
 */
function ColormapLegend({
  image,
  index,
  range,
}: {
  image: ImageData | null;
  index: number;
  range: [number, number];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const row = new ImageData(256, 1);
    const offset = index * 256 * 4;
    row.data.set(image.data.subarray(offset, offset + 256 * 4));
    ctx.putImageData(row, 0, 0);
  }, [image, index]);

  const mid = (range[0] + range[1]) / 2;

  return (
    <div className="legend">
      <canvas ref={canvasRef} width={256} height={1} className="legend__bar" />
      <div className="legend__ticks">
        <span>{range[0].toFixed(2)}</span>
        <span>{mid.toFixed(2)}</span>
        <span>{range[1].toFixed(2)}</span>
      </div>
      <p className="legend__caption">
        RdYlGn — 赤: 植生なし (市街地・裸地・水面) / 緑: 植生が濃い。
      </p>
    </div>
  );
}
