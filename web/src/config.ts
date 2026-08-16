// Local backend (`npm run dev` in server/), matching its PORT in server/.env.
const LOCAL_API_BASE_URL = 'http://localhost:4001';

// Deployed backend, reached through CloudFront.
const PRODUCTION_API_BASE_URL = 'https://d1fur91dw4of2i.cloudfront.net';

// VITE_API_BASE_URL, when explicitly set (e.g. the '' the Docker build passes
// so nginx proxies same-origin /api calls), always wins. Otherwise Vite's
// import.meta.env.DEV picks local vs. production automatically — true for
// `vite dev`, false for a real build — so nothing needs flipping by hand.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL);
