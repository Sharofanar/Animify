export type SlideElementType = "text" | "shape" | "image" | "svg";

export type PresentationAssetType = "image" | "video" | "audio";

export type PresentationAsset = {
  id: string;
  type: PresentationAssetType;
  name: string;
  mimeType: string;
  size: number;
  source: string;
  createdAt: string;
};

export type SlideElementAnimation = {
  id: string;
  name: string;
  type: "enter" | "emphasis" | "exit";
  duration: number;
  delay: number;
  easing: string;
  keyframes: string;
};

export type SlideElementStyle = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  opacity: number;
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  borderRadius?: number;
};

export type SlideElement = {
  id: string;
  type: SlideElementType;
  name: string;
  content: string;
  assetId?: string;
  style: SlideElementStyle;
  animations: SlideElementAnimation[];
};

export type Slide = {
  id: string;
  title: string;
  backgroundColor: string;
  elements: SlideElement[];
};

export type PresentationProject = {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  slides: Slide[];
  assets: Record<string, PresentationAsset>;
  activeSlideId: string;
  updatedAt: string;
};
