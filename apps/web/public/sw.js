// Existe só para satisfazer o critério de instalabilidade do Chrome/Android
// (PWA precisa de um service worker com fetch handler registrado). Sem
// cache nenhum de propósito: cada requisição sempre vai pra rede, pra não
// arriscar servir um chunk/JS antigo depois de um deploy (ver
// chunk-reload-guard.tsx, que já lida com isso no nível da página).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
