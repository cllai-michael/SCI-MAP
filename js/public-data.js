export function assetPrefix() {
  const depth = Number(document.body?.dataset.depth || 0);
  return "../".repeat(depth);
}

export async function loadPublicJson(path) {
  const response = await fetch(`${assetPrefix()}${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("讀取失敗");
  return response.json();
}
