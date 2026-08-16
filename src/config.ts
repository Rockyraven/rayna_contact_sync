import { Platform } from 'react-native';

// Which backend to talk to. `__DEV__` is set automatically by React Native —
// true for a Metro/debug build, false for a release build — so a debug run
// reaches your local backend and a release build (the one CI/`assembleRelease`
// produces) reaches production, with nothing to remember to flip back.
// Override to 'ngrok' by hand only when testing on a physical device, where
// LOCAL_URL's per-platform localhost mapping doesn't apply.
const ENV: 'local' | 'ngrok' | 'production' = __DEV__ ? 'local' : 'production';

// Local backend (`npm run dev` in server/) — reached differently per platform:
// - Android emulator is its own device: `localhost` there means "inside the
//   emulator," where nothing is listening. `10.0.2.2` is the emulator's
//   special alias for the host machine's localhost.
// - iOS Simulator shares the Mac's network stack, so plain `localhost` works.
// - A physical device (either OS) needs the host machine's real LAN IP
//   instead of either — e.g. 'http://192.168.1.42:4001'.
const LOCAL_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4001' : 'http://localhost:4001';

// ngrok tunnel to the local backend — reachable from any device/emulator,
// including physical devices, so no per-platform localhost mapping needed.
const NGROK_URL = 'https://25b3-2409-4090-8073-c80e-82b-6fd8-e683-da3b.ngrok-free.app';

// Deployed backend, reached through CloudFront: it terminates TLS at the edge
// and forwards to nginx on the EC2 box, which serves the admin web app and
// proxies /auth and /api to the API container. Going through CloudFront rather
// than straight to the instance means the app keeps working if that instance's
// IP ever changes, and it's what makes Google Sign-In possible without a
// purchased domain.
const PRODUCTION_URL = 'https://d1fur91dw4of2i.cloudfront.net';


const URLS = { local: LOCAL_URL, ngrok: NGROK_URL, production: PRODUCTION_URL };

export const API_BASE_URL = URLS[ENV];


// Web application OAuth client ID from Google Cloud Console.
// Used as webClientId on both Android and iOS so the ID token's
// audience matches what the backend verifies against.
export const GOOGLE_WEB_CLIENT_ID =
  '425674498204-m82k36csatg4pu7t5ctr25esteopjo95.apps.googleusercontent.com';
