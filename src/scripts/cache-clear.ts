import { getCacheProvider } from "../lib/cache.js";
import { clearObjectsCache } from "../lib/planfixObjects.js";

export async function cacheClear(): Promise<void> {
  const cache = getCacheProvider();
  await cache.clear?.();
  await clearObjectsCache();
}

const currentFileUrl = new URL(import.meta.url);
if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === currentFileUrl.href
) {
  cacheClear();
}
