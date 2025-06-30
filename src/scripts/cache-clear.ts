import { getCacheProvider } from "../lib/cache.js";

export async function cacheClear(): Promise<void> {
  const cache = getCacheProvider();
  await cache.clear?.();
}

const currentFileUrl = new URL(import.meta.url);
if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === currentFileUrl.href
) {
  cacheClear();
}
