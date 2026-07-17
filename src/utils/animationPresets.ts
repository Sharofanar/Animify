export type AnimationPresetDefinition = {
  value: string;
  label: string;
  name: string;
  keyframes: string;
};

/**
 * Shared legacy-compatible animation presets.
 *
 * The quick property panel and floating batch editor must read the same preset
 * definitions so selecting a preset produces identical V2 synchronization.
 */
export const animationPresets: AnimationPresetDefinition[] = [
  {
    value: "fade-in",
    label: "淡入",
    name: "淡入动画",
    keyframes: "fade-in",
  },
  {
    value: "slide-up",
    label: "上滑进入",
    name: "上滑进入动画",
    keyframes: "slide-up",
  },
  {
    value: "zoom-in",
    label: "放大进入",
    name: "放大进入动画",
    keyframes: "zoom-in",
  },
];
