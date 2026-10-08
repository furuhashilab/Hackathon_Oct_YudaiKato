/**
 * Sentinel-2 L2A scenes covering 横瀬町 (Yokoze, Saitama).
 *
 * Discovered with the Earth Search STAC API:
 *
 *   POST https://earth-search.aws.element84.com/v1/search
 *   {
 *     "collections": ["sentinel-2-l2a"],
 *     "bbox": [139.05, 35.97, 139.20, 36.07],
 *     "query": { "eo:cloud_cover": { "lt": 10 } },
 *     "sortby": [{ "field": "properties.eo:cloud_cover", "direction": "asc" }]
 *   }
 *
 * Every hit lands in MGRS tile 54SUE, whose footprint
 * (138.778, 35.135) – (140.010, 36.141) fully contains the town. The
 * neighbouring tile 54SUF starts at 36.036°N and would clip all but the
 * northern sliver, so it is deliberately excluded.
 *
 * Band COGs live next to each other in the scene folder and are fetched
 * individually as `${baseUrl}/${band}.tif`:
 * - B02 (Blue), B03 (Green), B04 (Red), B08 (NIR) — 10 m
 */

/** 横瀬町を覆う範囲 (STAC 検索に使った bbox と同じ) */
export const YOKOZE_BBOX: [number, number, number, number] = [
  139.05, 35.97, 139.2, 36.07,
];

/** 上の bbox を地図に重ねるための GeoJSON (矩形の輪郭)。 */
export const YOKOZE_BBOX_GEOJSON = {
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [YOKOZE_BBOX[0], YOKOZE_BBOX[1]],
        [YOKOZE_BBOX[2], YOKOZE_BBOX[1]],
        [YOKOZE_BBOX[2], YOKOZE_BBOX[3]],
        [YOKOZE_BBOX[0], YOKOZE_BBOX[3]],
        [YOKOZE_BBOX[0], YOKOZE_BBOX[1]],
      ],
    ],
  },
};

/**
 * 起動時のビュー。bbox 全体が入るように合わせる。
 *
 * 左側のコントロールパネルに隠れないよう、画面幅に応じて padding を変える。
 * 狭い画面ではパネルが上部に重なるので、代わりに上に余白を取る。
 */
export function yokozeFitBounds(): {
  bounds: [[number, number], [number, number]];
  fitBoundsOptions: {
    padding: { top: number; bottom: number; left: number; right: number };
  };
} {
  const narrow = typeof window !== "undefined" && window.innerWidth <= 640;
  return {
    bounds: [
      [YOKOZE_BBOX[0], YOKOZE_BBOX[1]],
      [YOKOZE_BBOX[2], YOKOZE_BBOX[3]],
    ],
    fitBoundsOptions: {
      padding: narrow
        ? { top: 260, bottom: 24, left: 24, right: 24 }
        : { top: 32, bottom: 32, left: 380, right: 48 },
    },
  };
}

export type Scene = {
  /** STAC item id */
  id: string;
  /** セレクタに出す表示名 */
  title: string;
  /** 観測日 (YYYY-MM-DD) */
  date: string;
  /** シーン全体の雲量 (%) */
  cloudCover: number;
  /** バンド COG が並ぶフォルダの URL */
  baseUrl: string;
};

const BUCKET =
  "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/54/S/UE";

export const SCENES: Scene[] = [
  {
    id: "S2B_54SUE_20260725_0_L2A",
    title: "2026-07-25 盛夏",
    date: "2026-07-25",
    cloudCover: 7.95,
    baseUrl: `${BUCKET}/2026/7/S2B_54SUE_20260725_0_L2A`,
  },
  {
    id: "S2B_54SUE_20260516_0_L2A",
    title: "2026-05-16 新緑",
    date: "2026-05-16",
    cloudCover: 2.57,
    baseUrl: `${BUCKET}/2026/5/S2B_54SUE_20260516_0_L2A`,
  },
  {
    id: "S2C_54SUE_20260411_0_L2A",
    title: "2026-04-11 春",
    date: "2026-04-11",
    cloudCover: 1.58,
    baseUrl: `${BUCKET}/2026/4/S2C_54SUE_20260411_0_L2A`,
  },
  {
    id: "S2A_54SUE_20260215_0_L2A",
    title: "2026-02-15 冬",
    date: "2026-02-15",
    cloudCover: 0.65,
    baseUrl: `${BUCKET}/2026/2/S2A_54SUE_20260215_0_L2A`,
  },
  {
    id: "S2B_54SUE_20260116_0_L2A",
    title: "2026-01-16 厳冬 (雲量最少)",
    date: "2026-01-16",
    cloudCover: 0.08,
    baseUrl: `${BUCKET}/2026/1/S2B_54SUE_20260116_0_L2A`,
  },
  {
    id: "S2B_54SUE_20250908_0_L2A",
    title: "2025-09-08 初秋",
    date: "2025-09-08",
    cloudCover: 4.18,
    baseUrl: `${BUCKET}/2025/9/S2B_54SUE_20250908_0_L2A`,
  },
  {
    id: "S2A_54SUE_20250617_0_L2A",
    title: "2025-06-17 梅雨",
    date: "2025-06-17",
    cloudCover: 2.38,
    baseUrl: `${BUCKET}/2025/6/S2A_54SUE_20250617_0_L2A`,
  },
];

/** 新緑のシーンを既定にする — NDVI のコントラストが最も分かりやすい。 */
export const DEFAULT_SCENE_INDEX = 1;
