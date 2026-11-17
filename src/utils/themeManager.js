/**
 * Dynamic Team Theme Manager
 * Generates an atmospheric dark-mode ambient gradient from a club's primary & secondary colors.
 * Automatically adapts the entire app background to the player's active team.
 */

// Helper to convert hex to RGB
function hexToRgb(hex) {
  if (!hex) return null;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Calculate perceived luminance (0 = black, 1 = white)
function getLuminance({ r, g, b }) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const DEFAULT_THEME = {
  gradient: 'radial-gradient(circle at center, #1b3820 0%, #050c06 100%)',
  primary: '#00ff64',
  secondary: '#00e5ff',
  glow: 'rgba(0, 255, 100, 0.25)'
};

/**
 * Computes deep, stylish ambient gradient & glow for any team colors
 */
export function generateTeamTheme(primaryHex, secondaryHex) {
  const primaryRgb = hexToRgb(primaryHex);
  const secondaryRgb = hexToRgb(secondaryHex);

  if (!primaryRgb) return DEFAULT_THEME;

  let baseRgb = primaryRgb;
  const primLum = getLuminance(primaryRgb);

  // If primary color is white / off-white (> 0.85), use secondary color (e.g. Real Madrid royal blue / navy)
  if (primLum > 0.82) {
    if (secondaryRgb && getLuminance(secondaryRgb) < 0.82 && getLuminance(secondaryRgb) > 0.05) {
      baseRgb = secondaryRgb;
    } else {
      // Pure white/monochrome default to elegant deep navy slate
      return {
        gradient: 'radial-gradient(circle at center, #141c2c 0%, #050810 100%)',
        primary: primaryHex,
        secondary: secondaryHex || '#00e5ff',
        glow: 'rgba(255, 255, 255, 0.3)'
      };
    }
  } 
  // If primary is near-black, use carbon monochrome
  else if (primLum < 0.05) {
    return {
      gradient: 'radial-gradient(circle at center, #1e2026 0%, #06070a 100%)',
      primary: primaryHex,
      secondary: secondaryHex || '#ffffff',
      glow: 'rgba(255, 255, 255, 0.2)'
    };
  }

  // Calculate deep center color (~24% brightness) and outer vignette (~5% brightness)
  const centerR = Math.min(255, Math.max(12, Math.round(baseRgb.r * 0.24)));
  const centerG = Math.min(255, Math.max(12, Math.round(baseRgb.g * 0.24)));
  const centerB = Math.min(255, Math.max(16, Math.round(baseRgb.b * 0.24)));

  let outerR = Math.max(3, Math.round(baseRgb.r * 0.05));
  let outerG = Math.max(3, Math.round(baseRgb.g * 0.05));
  let outerB = Math.max(5, Math.round(baseRgb.b * 0.05));

  // If secondary color exists with a distinct hue, blend it into the outer vignette
  if (secondaryRgb && Math.abs(getLuminance(secondaryRgb) - primLum) > 0.1 && getLuminance(secondaryRgb) < 0.85) {
    outerR = Math.max(3, Math.round((outerR + secondaryRgb.r * 0.08) / 2));
    outerG = Math.max(3, Math.round((outerG + secondaryRgb.g * 0.08) / 2));
    outerB = Math.max(5, Math.round((outerB + secondaryRgb.b * 0.08) / 2));
  }

  const centerHex = `#${centerR.toString(16).padStart(2, '0')}${centerG.toString(16).padStart(2, '0')}${centerB.toString(16).padStart(2, '0')}`;
  const outerHex = `#${outerR.toString(16).padStart(2, '0')}${outerG.toString(16).padStart(2, '0')}${outerB.toString(16).padStart(2, '0')}`;

  return {
    gradient: `radial-gradient(circle at center, ${centerHex} 0%, ${outerHex} 100%)`,
    primary: primaryHex,
    secondary: secondaryHex || '#ffffff',
    glow: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.25)`
  };
}

/**
 * Finds the currently active career team from localStorage
 */
export function getActivePlayerTeam() {
  try {
    // 1. Check League Career
    const rawLeague = localStorage.getItem('retro_league_career');
    if (rawLeague) {
      const parsed = JSON.parse(rawLeague);
      if (parsed && parsed.teams && parsed.playerTeamId !== null && parsed.playerTeamId !== undefined) {
        const team = parsed.teams.find(t => t.idnum === parsed.playerTeamId);
        if (team && (team.primaryColor || team.secondaryColor)) {
          return team;
        }
      }
    }

    // 2. Check Tournament State
    const rawTournament = localStorage.getItem('retro_tournament_state');
    if (rawTournament) {
      const parsed = JSON.parse(rawTournament);
      if (parsed && parsed.teams && parsed.playerTeamId !== null && parsed.playerTeamId !== undefined) {
        const team = parsed.teams.find(t => t.idnum === parsed.playerTeamId);
        if (team && (team.primaryColor || team.secondaryColor)) {
          return team;
        }
      }
    }
  } catch (e) {
    console.warn('[themeManager] Error reading active player team:', e);
  }

  return null;
}

/**
 * Applies the given team's theme or active career theme to the DOM root
 */
export function applyTeamTheme(teamOrNull = null) {
  const team = teamOrNull || getActivePlayerTeam();
  const theme = team && team.primaryColor
    ? generateTeamTheme(team.primaryColor, team.secondaryColor)
    : DEFAULT_THEME;

  const root = document.documentElement;
  root.style.setProperty('--app-bg-gradient', theme.gradient);
  root.style.setProperty('--team-primary', theme.primary);
  root.style.setProperty('--team-secondary', theme.secondary);
  root.style.setProperty('--team-glow', theme.glow);

  // Also apply directly to body for instant CSS cascade
  if (document.body) {
    document.body.style.background = theme.gradient;
  }
}

/**
 * Resets the background to the default retro pitch green
 */
export function resetToDefaultTheme() {
  const root = document.documentElement;
  root.style.setProperty('--app-bg-gradient', DEFAULT_THEME.gradient);
  root.style.setProperty('--team-primary', DEFAULT_THEME.primary);
  root.style.setProperty('--team-secondary', DEFAULT_THEME.secondary);
  root.style.setProperty('--team-glow', DEFAULT_THEME.glow);

  if (document.body) {
    document.body.style.background = DEFAULT_THEME.gradient;
  }
}
