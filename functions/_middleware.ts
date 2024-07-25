export const onRequestGet: PagesFunction = async (context) => {
    const cacheKey = context.request.url.split("?")[0];
    const cache = caches.default;
    let response = await cache.match(cacheKey);
    if (!response) {
        response = await context.next();
        context.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
}