import type { RasterModule } from "@developmentseed/deck.gl-raster";
import {
  Colormap,
  COLORMAP_INDEX,
  FilterNoDataVal,
  LinearRescale,
} from "@developmentseed/deck.gl-raster/gpu-modules";
import type { Texture } from "@luma.gl/core";
import { NdviFilter, NormalizedDifference, SetAlpha1 } from "./shaders.js";

export type RenderModeId = "ndvi" | "trueColor" | "falseColor";

export type RenderMode = {
  id: RenderModeId;
  title: string;
  description: string;
  /** `MultiCOGLayer` の `sources` に渡すバンド名 → Sentinel-2 バンド ID */
  bands: Record<string, string>;
  /** バンドを RGB(A) のどのチャンネルに載せるか */
  composite: { r: string; g?: string; b?: string };
};

export const RENDER_MODES: RenderMode[] = [
  {
    id: "ndvi",
    title: "NDVI (植生指数)",
    description:
      "NIR (B08) と Red (B04) から (NIR - Red) / (NIR + Red) を GPU 上で計算し、赤→黄→緑のカラーマップで着色します。",
    bands: { nir: "B08", red: "B04" },
    composite: { r: "nir", g: "red" },
  },
  {
    id: "trueColor",
    title: "トゥルーカラー (B04/B03/B02)",
    description: "肉眼に近い自然色の合成。NDVI と見比べる地形の参照用です。",
    bands: { red: "B04", green: "B03", blue: "B02" },
    composite: { r: "red", g: "green", b: "blue" },
  },
  {
    id: "falseColor",
    title: "フォールスカラー (B08/B04/B03)",
    description:
      "NIR を赤チャンネルに割り当てた近赤外合成。植生が鮮やかな赤で浮かび上がります。",
    bands: { nir: "B08", red: "B04", green: "B03" },
    composite: { r: "nir", g: "red", b: "green" },
  },
];

/** NDVI のカラーマップ: ColorBrewer RdYlGn (赤 → 黄 → 緑)。 */
export const NDVI_COLORMAP_INDEX = COLORMAP_INDEX.rdylgn;

/**
 * カラーマップを割り当てる既定の NDVI レンジ。
 *
 * 理論上の NDVI は `[-1, 1]` だが、陸域で実際に出てくるのはおおむね
 * `[-0.1, 0.9]`。全域に色を配ると緑側に張り付いて濃淡が潰れるので、
 * 現実的な幅に絞って階調を稼ぐ。
 */
export const DEFAULT_NDVI_RANGE: [number, number] = [-0.1, 0.9];

export type PipelineOptions = {
  /** 全カラーマップを収めたスプライトテクスチャ (NDVI でのみ必要)。 */
  colormapTexture: Texture | null;
  /** カラーマップを割り当てる NDVI の範囲。 */
  ndviRange: [number, number];
  /** true ならレンジ外の画素を描画しない (false ならレンジ端の色に丸める)。 */
  clipOutsideRange: boolean;
  /** トゥルー/フォールスカラー合成の明るさ (反射率の上限)。 */
  rescaleMax: number;
};

/**
 * 表示モードごとの後段パイプラインを組み立てる。
 *
 * `MultiCOGLayer` が `CompositeBands` でバンドを合成したあとに、ここで返す
 * モジュール列が順番に適用される。
 */
export function buildRenderPipeline(
  mode: RenderMode,
  { colormapTexture, ndviRange, clipOutsideRange, rescaleMax }: PipelineOptions,
): RasterModule[] {
  if (mode.id === "ndvi") {
    if (!colormapTexture) {
      return [];
    }
    const pipeline: RasterModule[] = [
      // color.r = NDVI ([-1, 1])。NoData (NIR + Red = 0) はここで破棄する。
      { module: NormalizedDifference },
    ];

    // 生の NDVI 値のまま間引く。LinearRescale より前に置かないと、
    // 比較する数値の単位が変わってしまう。
    if (clipOutsideRange) {
      pipeline.push({
        module: NdviFilter,
        props: { ndviMin: ndviRange[0], ndviMax: ndviRange[1] },
      });
    }

    pipeline.push(
      // カラーマップ参照のため選択レンジを [0, 1] に引き伸ばす (範囲外は clamp)
      {
        module: LinearRescale,
        props: { rescaleMin: ndviRange[0], rescaleMax: ndviRange[1] },
      },
      {
        module: Colormap,
        props: {
          colormapTexture,
          colormapIndex: NDVI_COLORMAP_INDEX,
          reversed: false,
        },
      },
      { module: SetAlpha1 },
    );
    return pipeline;
  }

  return [
    { module: FilterNoDataVal, props: { value: 0 } },
    { module: LinearRescale, props: { rescaleMin: 0, rescaleMax } },
    { module: SetAlpha1 },
  ];
}
