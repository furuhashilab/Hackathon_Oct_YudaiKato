import type { ShaderModule } from "@luma.gl/shadertools";

/**
 * NDVI = (NIR - Red) / (NIR + Red) を `color.r` に書き込むシェーダモジュール。
 *
 * `MultiCOGLayer` の `composite: { r: "nir", g: "red" }` を前提に、
 * 赤チャンネルへ B08、緑チャンネルへ B04 が入った状態で呼ばれる。
 * 結果は生の NDVI 値 (`[-1, 1]`) なので、後段の {@link NdviFilter} が
 * ユーザー向けのレンジとそのまま比較でき、`LinearRescale` で `[0, 1]` に
 * 畳んでからカラーマップを引く。
 *
 * 反射率は 16bit 整数から正規化された値だが、NDVI は比なのでスケールは
 * 打ち消し合う。両バンドとも 0 の画素（撮影範囲外・NoData）はここで捨てる。
 */
export const NormalizedDifference = {
  name: "normalizedDifference",
  inject: {
    "fs:DECKGL_FILTER_COLOR": /* glsl */ `
      float nir = color.r;
      float red = color.g;
      float denom = nir + red;
      if (denom <= 0.0) {
        discard;
      }
      color.r = (nir - red) / denom;
    `,
  },
} as const satisfies ShaderModule;

const NDVI_FILTER_MODULE_NAME = "ndviFilter";

/** NDVI 値が指定レンジの外にある画素を捨てるシェーダモジュール。 */
export const NdviFilter = {
  name: NDVI_FILTER_MODULE_NAME,
  fs: `\
uniform ${NDVI_FILTER_MODULE_NAME}Uniforms {
  float ndviMin;
  float ndviMax;
} ${NDVI_FILTER_MODULE_NAME};
`,
  inject: {
    "fs:DECKGL_FILTER_COLOR": /* glsl */ `
      if (color.r < ${NDVI_FILTER_MODULE_NAME}.ndviMin || color.r > ${NDVI_FILTER_MODULE_NAME}.ndviMax) {
        discard;
      }
    `,
  },
  uniformTypes: {
    ndviMin: "f32",
    ndviMax: "f32",
  },
  getUniforms: (props: Partial<{ ndviMin: number; ndviMax: number }>) => ({
    ndviMin: props.ndviMin ?? -1.0,
    ndviMax: props.ndviMax ?? 1.0,
  }),
} as const satisfies ShaderModule<{ ndviMin: number; ndviMax: number }>;

/**
 * アルファを 1.0 に固定するシェーダモジュール。
 *
 * カラーマップのテクスチャはアルファ付きで読み出されるため、パイプラインの
 * 最後で不透明に戻しておく。
 */
export const SetAlpha1 = {
  name: "setAlpha1",
  inject: {
    "fs:DECKGL_FILTER_COLOR": /* glsl */ `
      color = vec4(color.rgb, 1.0);
    `,
  },
} as const satisfies ShaderModule;
