import axios from '/opt/inviha-backend/node_modules/axios/index.js';
import { requestReverseGeocode } from '/opt/inviha-backend/google-geocoding.mjs';

try {
  const result = await requestReverseGeocode(
    'nominatim',
    25.28913,
    51.53833,
    { nominatimApiUrl: 'https://nominatim.openstreetmap.org' },
    axios
  );
  const search = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: 'Al Bank Street, Doha, Qatar', format: 'jsonv2', limit: 3, countrycodes: 'qa', 'accept-language': 'en' },
    headers: { 'User-Agent': 'INVIHA-Track/1.0 (support@inviha.com)' },
    timeout: 10000
  });
  console.log(JSON.stringify({
    provider: result.provider,
    address: result.address,
    searchResults: Array.isArray(search.data) ? search.data.length : 0
  }));
} catch (error) {
  console.error(JSON.stringify({ error: String(error.message || error) }));
  process.exit(1);
}
