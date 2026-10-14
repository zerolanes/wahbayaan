import OgImage from "./opengraph-image";

// The X / Twitter card uses the same image as Open Graph.
export const alt = "Wahbayaan — Pakistani heritage craft and brands";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return OgImage();
}
