// Canonical list of countries & FIFA/footballing nations backed by `flag-icons` (lipis/flag-icons)

export const NATIONALITIES = [
  { code: 'ar', name: 'Argentina' },
  { code: 'au', name: 'Australia' },
  { code: 'at', name: 'Austria' },
  { code: 'be', name: 'Belgium' },
  { code: 'ba', name: 'Bosnia and Herzegovina' },
  { code: 'br', name: 'Brazil' },
  { code: 'bg', name: 'Bulgaria' },
  { code: 'cm', name: 'Cameroon' },
  { code: 'ca', name: 'Canada' },
  { code: 'cl', name: 'Chile' },
  { code: 'cn', name: 'China' },
  { code: 'co', name: 'Colombia' },
  { code: 'cr', name: 'Costa Rica' },
  { code: 'hr', name: 'Croatia' },
  { code: 'cy', name: 'Cyprus' },
  { code: 'cz', name: 'Czech Republic' },
  { code: 'dk', name: 'Denmark' },
  { code: 'ec', name: 'Ecuador' },
  { code: 'eg', name: 'Egypt' },
  { code: 'gb-eng', name: 'England' },
  { code: 'ee', name: 'Estonia' },
  { code: 'fi', name: 'Finland' },
  { code: 'fr', name: 'France' },
  { code: 'ge', name: 'Georgia' },
  { code: 'de', name: 'Germany' },
  { code: 'gh', name: 'Ghana' },
  { code: 'gr', name: 'Greece' },
  { code: 'hu', name: 'Hungary' },
  { code: 'is', name: 'Iceland' },
  { code: 'ir', name: 'Iran' },
  { code: 'ie', name: 'Ireland' },
  { code: 'il', name: 'Israel' },
  { code: 'it', name: 'Italy' },
  { code: 'ci', name: 'Ivory Coast' },
  { code: 'jm', name: 'Jamaica' },
  { code: 'jp', name: 'Japan' },
  { code: 'lv', name: 'Latvia' },
  { code: 'lt', name: 'Lithuania' },
  { code: 'lu', name: 'Luxembourg' },
  { code: 'mx', name: 'Mexico' },
  { code: 'me', name: 'Montenegro' },
  { code: 'ma', name: 'Morocco' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'mk', name: 'North Macedonia' },
  { code: 'gb-nir', name: 'Northern Ireland' },
  { code: 'no', name: 'Norway' },
  { code: 'py', name: 'Paraguay' },
  { code: 'pe', name: 'Peru' },
  { code: 'pl', name: 'Poland' },
  { code: 'pt', name: 'Portugal' },
  { code: 'qa', name: 'Qatar' },
  { code: 'ro', name: 'Romania' },
  { code: 'ru', name: 'Russia' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'gb-sct', name: 'Scotland' },
  { code: 'sn', name: 'Senegal' },
  { code: 'rs', name: 'Serbia' },
  { code: 'sk', name: 'Slovakia' },
  { code: 'si', name: 'Slovenia' },
  { code: 'za', name: 'South Africa' },
  { code: 'kr', name: 'South Korea' },
  { code: 'es', name: 'Spain' },
  { code: 'se', name: 'Sweden' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'tn', name: 'Tunisia' },
  { code: 'tr', name: 'Turkey' },
  { code: 'ua', name: 'Ukraine' },
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'us', name: 'United States' },
  { code: 'uy', name: 'Uruguay' },
  { code: 'uz', name: 'Uzbekistan' },
  { code: 've', name: 'Venezuela' },
  { code: 'gb-wls', name: 'Wales' }
];

const BY_CODE = new Map(NATIONALITIES.map((n) => [n.code.toLowerCase(), n]));
const BY_NAME = new Map(NATIONALITIES.map((n) => [n.name.toLowerCase(), n]));

const ALIASES = {
  england: 'gb-eng',
  scotland: 'gb-sct',
  wales: 'gb-wls',
  'northern ireland': 'gb-nir',
  usa: 'us',
  'united states of america': 'us',
  uk: 'gb',
  'great britain': 'gb',
  britain: 'gb',
  holland: 'nl',
  'the netherlands': 'nl',
  czechia: 'cz',
  'republic of ireland': 'ie',
  eire: 'ie',
  "cote d'ivoire": 'ci',
  "côte d'ivoire": 'ci',
  'korea republic': 'kr',
  'south korea': 'kr',
  yugoslavia: 'rs',
  fr_yugoslavia: 'rs',
  'fr yugoslavia': 'rs',
  'serbia and montenegro': 'rs',
  ussr: 'ru',
  'soviet union': 'ru',
  fyrom: 'mk',
  macedonia: 'mk',
  turkiye: 'tr',
  türkiye: 'tr',
  uae: 'ae'
};

/**
 * Resolves a stored country/ISO code or full nationality string into `{ code, name }`.
 */
export function resolveNationality(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  if (BY_CODE.has(lower)) return BY_CODE.get(lower);
  if (BY_NAME.has(lower)) return BY_NAME.get(lower);
  if (ALIASES[lower] && BY_CODE.has(ALIASES[lower])) {
    return BY_CODE.get(ALIASES[lower]);
  }
  return { code: /^[a-z]{2}(-[a-z]{2,3})?$/.test(lower) ? lower : null, name: trimmed };
}
