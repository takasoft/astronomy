const IMAGE_CACHE = 'taka-astronomy:images:v1'
const MAX_IMAGES = 40
const pendingImages = new Map()
let writes = Promise.resolve()

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

async function loadImage(request) {
  let cache
  try {
    cache = await caches.open(IMAGE_CACHE)
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
  } catch (error) {
    console.warn('Picture cache could not be read.', error)
  }

  const response = await fetch(request)
  if (cache && (response.ok || response.type === 'opaque')) {
    const copy = response.clone()
    // Serialize writes so simultaneous image downloads cannot exceed the limit.
    writes = writes.then(async () => {
      const keys = await cache.keys()
      if (!keys.some((key) => key.url === request.url)) {
        for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES + 1))) {
          await cache.delete(key)
        }
      }
      await cache.put(request, copy)
    }).catch((error) => {
      console.warn('Picture cache could not be saved.', error)
    })
    await writes
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.destination !== 'image' ||
      !request.url.startsWith('https://')) {
    return
  }
  let pending = pendingImages.get(request.url)
  if (!pending) {
    pending = loadImage(request).finally(() => pendingImages.delete(request.url))
    pendingImages.set(request.url, pending)
  }
  event.respondWith(pending.then((response) => response.clone()))
})
