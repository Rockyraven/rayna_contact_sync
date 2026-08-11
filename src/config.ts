import { Platform } from 'react-native';

// Which backend to talk to. Switch this one line as needed.
const ENV: 'local' | 'ngrok' | 'production' = 'local';

// Local backend (`npm run dev` in server/) — reached differently per platform:
// - Android emulator is its own device: `localhost` there means "inside the
//   emulator," where nothing is listening. `10.0.2.2` is the emulator's
//   special alias for the host machine's localhost.
// - iOS Simulator shares the Mac's network stack, so plain `localhost` works.
// - A physical device (either OS) needs the host machine's real LAN IP
//   instead of either — e.g. 'http://192.168.1.42:4000'.
const LOCAL_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

// ngrok tunnel to the local backend — reachable from any device/emulator,
// including physical devices, so no per-platform localhost mapping needed.
const NGROK_URL = 'https://25b3-2409-4090-8073-c80e-82b-6fd8-e683-da3b.ngrok-free.app';

// TODO: point this at the deployed backend once it exists.
const PRODUCTION_URL = 'https://api.raynatours.com';


const URLS = { local: LOCAL_URL, ngrok: NGROK_URL, production: PRODUCTION_URL };

export const API_BASE_URL = URLS[ENV];


// Web application OAuth client ID from Google Cloud Console.
// Used as webClientId on both Android and iOS so the ID token's
// audience matches what the backend verifies against.
export const GOOGLE_WEB_CLIENT_ID =
  '425674498204-m82k36csatg4pu7t5ctr25esteopjo95.apps.googleusercontent.com';
