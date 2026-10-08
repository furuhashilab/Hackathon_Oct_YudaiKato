import type { MapboxOverlayProps } from "@deck.gl/mapbox";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { LoadingWidget } from "@deck.gl/widgets";
import { MultiCOGLayer } from "@developmentseed/deck.gl-geotiff";
import {
  createColormapTexture,
  decodeColormapSprite,
} from "@developmentseed/deck.gl-raster/gpu-modules";
import colormapsPngUrl from "@developmentseed/deck.gl-raster/gpu-modules/colormaps.png";
import type { Device, Texture } from "@luma.gl/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import {
  Layer,
  Map as MaplibreMap,
  Source,
  useControl,
} from "react-map-gl/maplibre";
import { ControlPanel } from "./control-panel.js";
import {
  buildRenderPipeline,
  DEFAULT_NDVI_RANGE,
  RENDER_MODES,
} from "./render-modes.js";
import {
  DEFAULT_SCENE_INDEX,
  SCENES,
  YOKOZE_BBOX_GEOJSON,
  yokozeFitBounds,
} from "./scenes.js";
import "maplibre-gl/dist/maplibre-gl.css";
import "@deck.gl/widgets/stylesheet.css";
import "./styles.css";

/**
 * deck.gl のレイヤーを MapLibre の上にインターリーブ描画するコントロール。
 *
 * React の StrictMode は開発時にマウントを二度走らせるため、`_reuseDevices`
 * を立てて同じ WebGL コンテキストへの二重アタッチを許す。
 */
function DeckGlOverlay(props: MapboxOverlayProps) {
  const withReusedDevice = (p: MapboxOverlayProps): MapboxOverlayProps => ({
    ...p,
    deviceProps: { _reuseDevices: true, ...p.deviceProps },
  });
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay(withReusedDevice(props)),
  );
  overlay.setProps(withReusedDevice(props));
  return null;
}

export default function App() {
  const mapRef = useRef<MapRef>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [colormapImage, setColormapImage] = useState<ImageData | null>(null);
  const [colormapTexture, setColormapTexture] = useState<Texture | null>(null);
  const [sceneIndex, setSceneIndex] = useState(DEFAULT_SCENE_INDEX);
  const [modeIndex, setModeIndex] = useState(0);
  const [ndviRange, setNdviRange] =
    useState<[number, number]>(DEFAULT_NDVI_RANGE);
  const [clipOutsideRange, setClipOutsideRange] = useState(false);
  const [rescaleMax, setRescaleMax] = useState(0.05);
  const [opacity, setOpacity] = useState(1);
  const [showExtent, setShowExtent] = useState(true);
  const [labelLayerId, setLabelLayerId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const scene = SCENES[sceneIndex];
  const mode = RENDER_MODES[modeIndex];

  // react-map-gl はマウント時にしか読まないが、毎レンダーで作り直す理由もない。
  const initialViewState = useMemo(() => yokozeFitBounds(), []);

  // カラーマップのスプライト PNG はマウント時に一度だけデコードする。
  // GPU デバイスを必要としないので、地図の初期化と並行して走らせられる。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bytes = await (await fetch(colormapsPngUrl)).arrayBuffer();
        const image = await decodeColormapSprite(bytes);
        if (!cancelled) {
          setColormapImage(image);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`カラーマップの読み込みに失敗しました: ${String(err)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // デバイスとデコード済み画像が揃った時点で GPU にアップロードする。
  useEffect(() => {
    if (!device || !colormapImage) {
      return;
    }
    setColormapTexture(createColormapTexture(device, colormapImage));
  }, [device, colormapImage]);

  // ベースマップの最初のシンボル（注記）レイヤーを探し、衛星画像をその
  // 直前に差し込む。こうしないと不透明なラスタが地名を全部隠してしまう。
  const handleMapLoad = useCallback(() => {
    const style = mapRef.current?.getMap().getStyle();
    const firstSymbol = style?.layers?.find((l) => l.type === "symbol");
    setLabelLayerId(firstSymbol?.id);
  }, []);

  const sources = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(mode.bands).map(([slot, band]) => [
          slot,
          { url: `${scene.baseUrl}/${band}.tif` },
        ]),
      ),
    [scene, mode],
  );

  const renderPipeline = useMemo(
    () =>
      buildRenderPipeline(mode, {
        colormapTexture,
        ndviRange,
        clipOutsideRange,
        rescaleMax,
      }),
    [mode, colormapTexture, ndviRange, clipOutsideRange, rescaleMax],
  );

  // NDVI はカラーマップが乗るまで描けないので、その間はレイヤーを出さない。
  const ready = mode.id !== "ndvi" || colormapTexture !== null;

  const layers = ready
    ? [
        new MultiCOGLayer({
          id: `sentinel2-${scene.id}-${mode.id}`,
          sources,
          composite: mode.composite,
          renderPipeline,
          opacity,
          // `beforeId` は @deck.gl/mapbox が interleaved 描画で読む指定だが、
          // レイヤー側の型には含まれないのでここで合流させる。
          ...({ beforeId: labelLayerId } as object),
          // シーン全体 (約110km四方) のうち横瀬町周辺だけを見るので、
          // タイルキャッシュは控えめで十分。
          maxCacheByteSize: 512 * 1024 * 1024,
          onGeoTIFFLoad: () => setError(null),
          onError: (err: Error) =>
            setError(`COG の読み込みに失敗しました: ${err.message}`),
        }),
      ]
    : [];

  return (
    <div className="app">
      <MaplibreMap
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        attributionControl={{ compact: true }}
        onLoad={handleMapLoad}
      >
        <DeckGlOverlay
          layers={layers}
          widgets={[new LoadingWidget({ placement: "top-right" })]}
          onDeviceInitialized={setDevice}
          interleaved
        />
        {showExtent && (
          <Source id="yokoze-extent" type="geojson" data={YOKOZE_BBOX_GEOJSON}>
            <Layer
              id="yokoze-extent-line"
              type="line"
              paint={{
                "line-color": "#ffffff",
                "line-width": 1.5,
                "line-dasharray": [3, 2],
                "line-opacity": 0.85,
              }}
            />
          </Source>
        )}
      </MaplibreMap>

      <ControlPanel
        scenes={SCENES}
        sceneIndex={sceneIndex}
        onSceneChange={setSceneIndex}
        modes={RENDER_MODES}
        modeIndex={modeIndex}
        onModeChange={setModeIndex}
        ndviRange={ndviRange}
        onNdviRangeChange={setNdviRange}
        clipOutsideRange={clipOutsideRange}
        onClipOutsideRangeChange={setClipOutsideRange}
        rescaleMax={rescaleMax}
        onRescaleMaxChange={setRescaleMax}
        opacity={opacity}
        onOpacityChange={setOpacity}
        showExtent={showExtent}
        onShowExtentChange={setShowExtent}
        colormapImage={colormapImage}
        error={error}
        onResetView={() => {
          const { bounds, fitBoundsOptions } = yokozeFitBounds();
          mapRef.current?.fitBounds(bounds, {
            ...fitBoundsOptions,
            duration: 900,
          });
        }}
      />
    </div>
  );
}
