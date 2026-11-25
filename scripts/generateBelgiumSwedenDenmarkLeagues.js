/**
 * Historical League & European Cup Generator for Belgium, Sweden, and Denmark (1989-2026)
 * Generates:
 *  - src/data/leagues/bel/bel89.json ... bel26.json
 *  - src/data/leagues/swe/swe89.json ... swe26.json
 *  - src/data/leagues/den/den89.json ... den26.json
 *  - qualifiers data exported for updateBelgiumSwedenDenmarkData.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BEL_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'bel');
const SWE_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'swe');
const DEN_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'den');

fs.mkdirSync(BEL_DIR, { recursive: true });
fs.mkdirSync(SWE_DIR, { recursive: true });
fs.mkdirSync(DEN_DIR, { recursive: true });

// ============================================================================
// 1. BELGIAN TEAMS METADATA
// ============================================================================
const BEL_CLUBS = {
  "Anderlecht":           { primary: "#5F259F", secondary: "#FFFFFF", kit: "swe92/4.png", att: 4, mid: 4, def: 4 },
  "Club Brugge":          { primary: "#0055A4", secondary: "#000000", kit: "swe92/0.png", att: 4, mid: 4, def: 4 },
  "Standard Liege":       { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 4, mid: 4, def: 3 },
  "Genk":                 { primary: "#0052A5", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 4, def: 3 },
  "Gent":                 { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 3, def: 3 },
  "Antwerp":              { primary: "#D2122E", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Union Saint-Gilloise": { primary: "#FFD100", secondary: "#0038A8", kit: "mex86/3.png", att: 4, mid: 4, def: 3 },
  "KV Mechelen":          { primary: "#FFD700", secondary: "#CC0000", kit: "ger88/4.png", att: 3, mid: 3, def: 3 },
  "Charleroi":            { primary: "#111111", secondary: "#FFFFFF", kit: "swe92/3.png", att: 3, mid: 3, def: 3 },
  "Cercle Brugge":        { primary: "#007A3D", secondary: "#111111", kit: "swe92/1.png", att: 3, mid: 3, def: 3 },
  "Sint-Truiden":         { primary: "#FFDD00", secondary: "#003399", kit: "mex86/3.png", att: 3, mid: 3, def: 2 },
  "Westerlo":             { primary: "#FFCC00", secondary: "#0033A0", kit: "mex86/3.png", att: 3, mid: 2, def: 2 },
  "Kortrijk":             { primary: "#CC0000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 3, def: 2 },
  "OH Leuven":            { primary: "#FFFFFF", secondary: "#111111", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Zulte Waregem":        { primary: "#800020", secondary: "#008000", kit: "swe92/4.png", att: 3, mid: 3, def: 2 },
  "Waregem":              { primary: "#800020", secondary: "#FFFFFF", kit: "swe92/4.png", att: 2, mid: 3, def: 2 },
  "Lierse":               { primary: "#FFD700", secondary: "#111111", kit: "mex86/3.png", att: 3, mid: 3, def: 3 },
  "Lokeren":              { primary: "#FFFFFF", secondary: "#111111", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Beveren":              { primary: "#FFD700", secondary: "#0047AB", kit: "mex86/3.png", att: 3, mid: 2, def: 2 },
  "Waasland-Beveren":     { primary: "#FFD700", secondary: "#0047AB", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "KV Oostende":          { primary: "#DD0000", secondary: "#FFD700", kit: "ger88/4.png", att: 3, mid: 2, def: 2 },
  "Mouscron":             { primary: "#CC0000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 2, def: 2 },
  "Eupen":                { primary: "#111111", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "Germinal Ekeren":      { primary: "#5F259F", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 3, def: 2 },
  "Germinal Beerschot":   { primary: "#5F259F", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 3, def: 3 },
  "Beerschot":            { primary: "#5F259F", secondary: "#FFFFFF", kit: "swe92/4.png", att: 2, mid: 2, def: 2 },
  "RWDM":                 { primary: "#CC0000", secondary: "#111111", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "FC Brussels":          { primary: "#CC0000", secondary: "#111111", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "RFC Liege":            { primary: "#0038A8", secondary: "#D90429", kit: "swe92/2.png", att: 3, mid: 3, def: 3 },
  "Aalst":                { primary: "#111111", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "Lommel":               { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Harelbeke":            { primary: "#5F259F", secondary: "#FFFFFF", kit: "swe92/4.png", att: 2, mid: 2, def: 2 },
  "Roeselare":            { primary: "#FFFFFF", secondary: "#111111", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Mons":                 { primary: "#DD0000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "La Louviere":          { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Seraing":              { primary: "#CC0000", secondary: "#111111", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Dender":               { primary: "#003399", secondary: "#111111", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Boom":                 { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Geel":                 { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Tubize":               { primary: "#FFD700", secondary: "#CC0000", kit: "ger88/4.png", att: 2, mid: 2, def: 2 },
  "Heusden-Zolder":       { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 }
};

// ============================================================================
// 2. SWEDISH TEAMS METADATA
// ============================================================================
const SWE_CLUBS = {
  "Malmo FF":             { primary: "#5BC2E7", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 4, def: 3 },
  "IFK Goteborg":         { primary: "#0055A4", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 4, def: 4 },
  "AIK":                  { primary: "#111111", secondary: "#FFD700", kit: "swe92/3.png", att: 3, mid: 3, def: 3 },
  "Djurgarden":           { primary: "#0038A8", secondary: "#5BC2E7", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Hammarby":             { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 3, mid: 3, def: 3 },
  "Elfsborg":             { primary: "#FFD700", secondary: "#111111", kit: "mex86/3.png", att: 3, mid: 3, def: 3 },
  "IFK Norrkoping":       { primary: "#FFFFFF", secondary: "#0047AB", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "BK Hacken":            { primary: "#FFD700", secondary: "#111111", kit: "mex86/3.png", att: 3, mid: 3, def: 3 },
  "Helsingborg":          { primary: "#D90429", secondary: "#0047AB", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Kalmar FF":            { primary: "#CC0000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 2 },
  "Halmstads BK":         { primary: "#0047AB", secondary: "#111111", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Orebro SK":            { primary: "#111111", secondary: "#FFFFFF", kit: "swe92/3.png", att: 3, mid: 3, def: 2 },
  "GAIS":                 { primary: "#007A3D", secondary: "#111111", kit: "swe92/1.png", att: 2, mid: 3, def: 2 },
  "Mjallby AIF":          { primary: "#FFD700", secondary: "#111111", kit: "mex86/3.png", att: 3, mid: 3, def: 3 },
  "IK Sirius":            { primary: "#0038A8", secondary: "#111111", kit: "swe92/0.png", att: 2, mid: 3, def: 2 },
  "IF Brommapojkarna":    { primary: "#D90429", secondary: "#111111", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "GIF Sundsvall":        { primary: "#0047AB", secondary: "#FFD700", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Trelleborgs FF":       { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Orgryte IS":           { primary: "#CC0000", secondary: "#0047AB", kit: "ger88/1.png", att: 2, mid: 3, def: 2 },
  "Osters IF":            { primary: "#CC0000", secondary: "#0047AB", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Degerfors IF":         { primary: "#CC0000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Gefle IF":             { primary: "#5BC2E7", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Atvidabergs FF":       { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Landskrona BoIS":      { primary: "#111111", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "IFK Varnamo":          { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Varbergs BoIS":        { primary: "#008000", secondary: "#111111", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Vasteras SK":          { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Falkenbergs FF":       { primary: "#FFD700", secondary: "#FFFFFF", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Jonkopings Sodra":     { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Ostersunds FK":        { primary: "#111111", secondary: "#D90429", kit: "swe92/3.png", att: 2, mid: 3, def: 2 },
  "AFC Eskilstuna":       { primary: "#FF6600", secondary: "#003399", kit: "ecu93/1.png", att: 2, mid: 2, def: 2 },
  "Ljungskile SK":        { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Syrianska FC":         { primary: "#FFD700", secondary: "#D90429", kit: "ger88/4.png", att: 2, mid: 2, def: 2 },
  "Assyriska FF":         { primary: "#FFFFFF", secondary: "#CC0000", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Enkopings SK":         { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Vastra Frolunda":      { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "IK Brage":             { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Umea FC":              { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "IK Oddevold":          { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Dalkurd FF":           { primary: "#008000", secondary: "#D90429", kit: "swe92/1.png", att: 2, mid: 2, def: 2 }
};

// ============================================================================
// 3. DANISH TEAMS METADATA
// ============================================================================
const DEN_CLUBS = {
  "FC Copenhagen":        { primary: "#FFFFFF", secondary: "#0038A8", kit: "swe92/0.png", att: 4, mid: 4, def: 4 },
  "Brondby":              { primary: "#FFD700", secondary: "#0038A8", kit: "mex86/3.png", att: 4, mid: 4, def: 3 },
  "Midtjylland":          { primary: "#111111", secondary: "#D90429", kit: "swe92/3.png", att: 4, mid: 4, def: 3 },
  "Nordsjaelland":        { primary: "#D90429", secondary: "#FFD700", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "AGF Aarhus":           { primary: "#FFFFFF", secondary: "#0038A8", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "AaB":                  { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Odense BK":            { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Silkeborg":            { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Randers":              { primary: "#5BC2E7", secondary: "#111111", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Viborg":               { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 3, mid: 3, def: 2 },
  "Lyngby":               { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Vejle":                { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Esbjerg":              { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "SonderjyskE":          { primary: "#5BC2E7", secondary: "#111111", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "AC Horsens":           { primary: "#FFD700", secondary: "#111111", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Herfolge":             { primary: "#FFD700", secondary: "#0047AB", kit: "mex86/3.png", att: 2, mid: 3, def: 2 },
  "AB":                   { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 3, def: 2 },
  "Ikast FS":             { primary: "#FFD700", secondary: "#0047AB", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Naestved":             { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "BK Frem":              { primary: "#D90429", secondary: "#0038A8", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "B 1903":               { primary: "#111111", secondary: "#FFFFFF", kit: "swe92/3.png", att: 3, mid: 3, def: 3 },
  "KB":                   { primary: "#FFFFFF", secondary: "#0047AB", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Hobro":                { primary: "#FFD700", secondary: "#0038A8", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "HB Koge":              { primary: "#0047AB", secondary: "#111111", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Koge":                 { primary: "#111111", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "Hvidovre":             { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "FC Helsingor":         { primary: "#5BC2E7", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Vendsyssel":           { primary: "#FFFFFF", secondary: "#111111", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "FC Vestsjaelland":     { primary: "#D90429", secondary: "#0047AB", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Aarhus Fremad":        { primary: "#FFD700", secondary: "#111111", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "B 93":                 { primary: "#FFFFFF", secondary: "#0047AB", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Bronshoj":             { primary: "#FFD700", secondary: "#111111", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "B 1913":               { primary: "#0047AB", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Fredericia":           { primary: "#D90429", secondary: "#111111", kit: "ger88/1.png", att: 2, mid: 2, def: 2 }
};

// ============================================================================
// 4. SEASON-BY-SEASON PARTICIPANTS: BELGIUM (1989-2026)
// ============================================================================
const BEL_SEASONS = {
  "1989": ["Club Brugge", "Anderlecht", "KV Mechelen", "Antwerp", "Standard Liege", "Gent", "Kortrijk", "Germinal Ekeren", "Cercle Brugge", "Lierse", "Lokeren", "RFC Liege", "Beerschot", "Charleroi", "Sint-Truiden", "Waregem", "Beveren", "Racing Mechelen"].map(n => n === "Racing Mechelen" ? "Aalst" : n),
  "1990": ["Anderlecht", "KV Mechelen", "Gent", "Club Brugge", "Germinal Ekeren", "Standard Liege", "Antwerp", "Charleroi", "Lokeren", "RFC Liege", "Lierse", "RWDM", "Waregem", "Gent", "Kortrijk", "Cercle Brugge", "Sint-Truiden", "Beerschot"].map((n, i) => i === 13 ? "Genk" : n),
  "1991": ["Club Brugge", "Anderlecht", "Standard Liege", "KV Mechelen", "Antwerp", "Gent", "Lierse", "Germinal Ekeren", "Cercle Brugge", "Waregem", "RWDM", "Beveren", "Charleroi", "Lokeren", "RFC Liege", "Genk", "Aalst", "Kortrijk"],
  "1992": ["Anderlecht", "Standard Liege", "KV Mechelen", "Waregem", "Antwerp", "Club Brugge", "Charleroi", "Beveren", "Gent", "Lierse", "RWDM", "RFC Liege", "Cercle Brugge", "Germinal Ekeren", "Genk", "Lommel", "Lokeren", "Boom"],
  "1993": ["Anderlecht", "Club Brugge", "Seraing", "Charleroi", "Antwerp", "Standard Liege", "KV Oostende", "KV Mechelen", "Beveren", "Germinal Ekeren", "Lommel", "Cercle Brugge", "RFC Liege", "Lierse", "Gent", "RWDM", "Waregem", "Genk"],
  "1994": ["Anderlecht", "Standard Liege", "Club Brugge", "Aalst", "Lierse", "Germinal Ekeren", "Lommel", "Sint-Truiden", "Seraing", "Beveren", "KV Mechelen", "RWDM", "Charleroi", "Antwerp", "Cercle Brugge", "Gent", "KV Oostende", "RFC Liege"],
  "1995": ["Club Brugge", "Anderlecht", "Germinal Ekeren", "RWDM", "Lierse", "Standard Liege", "Charleroi", "Cercle Brugge", "Lommel", "KV Mechelen", "Harelbeke", "Aalst", "Antwerp", "Gent", "Sint-Truiden", "Seraing", "Beveren", "Waregem"],
  "1996": ["Lierse", "Club Brugge", "Anderlecht", "RWDM", "Standard Liege", "Mouscron", "Lokeren", "Genk", "Lommel", "Germinal Ekeren", "Sint-Truiden", "Harelbeke", "Antwerp", "Gent", "Aalst", "Charleroi", "KV Mechelen", "Cercle Brugge"],
  "1997": ["Club Brugge", "Genk", "Germinal Ekeren", "Anderlecht", "Harelbeke", "Lokeren", "Lierse", "Gent", "Standard Liege", "Mouscron", "Lommel", "Westerlo", "Charleroi", "Sint-Truiden", "Aalst", "Beveren", "RWDM", "Antwerp"],
  "1998": ["Genk", "Club Brugge", "Anderlecht", "Mouscron", "Lokeren", "Standard Liege", "Lierse", "Gent", "Sint-Truiden", "Germinal Ekeren", "Harelbeke", "Westerlo", "Aalst", "Charleroi", "Beveren", "Lommel", "Kortrijk", "KV Oostende"],
  "1999": ["Anderlecht", "Club Brugge", "Gent", "Mouscron", "Standard Liege", "Westerlo", "Germinal Beerschot", "Genk", "Lierse", "Lokeren", "KV Mechelen", "Aalst", "Sint-Truiden", "Harelbeke", "Beveren", "Charleroi", "Geel", "Lommel"],
  "2000": ["Anderlecht", "Club Brugge", "Standard Liege", "Lokeren", "Gent", "Germinal Beerschot", "Mouscron", "Westerlo", "Charleroi", "Lierse", "Genk", "Antwerp", "Sint-Truiden", "Beveren", "Harelbeke", "Aalst", "La Louviere", "KV Mechelen"],
  "2001": ["Genk", "Club Brugge", "Anderlecht", "Gent", "Standard Liege", "Mouscron", "Lokeren", "Sint-Truiden", "Germinal Beerschot", "RWDM", "La Louviere", "Charleroi", "Lommel", "Westerlo", "Lierse", "Antwerp", "Aalst", "Beveren"],
  "2002": ["Club Brugge", "Anderlecht", "Lokeren", "Sint-Truiden", "Lierse", "Genk", "Standard Liege", "Gent", "Mons", "Westerlo", "Beveren", "Antwerp", "Mouscron", "Germinal Beerschot", "La Louviere", "Charleroi", "KV Mechelen", "Lommel"],
  "2003": ["Anderlecht", "Club Brugge", "Standard Liege", "Genk", "Mouscron", "Westerlo", "Germinal Beerschot", "La Louviere", "Gent", "Lokeren", "Lierse", "Beveren", "Sint-Truiden", "Cercle Brugge", "Charleroi", "Mons", "Heusden-Zolder", "Antwerp"],
  "2004": ["Club Brugge", "Anderlecht", "Genk", "Standard Liege", "Charleroi", "Gent", "La Louviere", "Lokeren", "Germinal Beerschot", "Lierse", "Cercle Brugge", "Westerlo", "Mouscron", "Sint-Truiden", "FC Brussels", "Beveren", "KV Oostende", "Mons"],
  "2005": ["Anderlecht", "Standard Liege", "Club Brugge", "Gent", "Genk", "Zulte Waregem", "Westerlo", "Lokeren", "Roeselare", "FC Brussels", "Charleroi", "Germinal Beerschot", "Mouscron", "Cercle Brugge", "Sint-Truiden", "Beveren", "Lierse", "La Louviere"],
  "2006": ["Anderlecht", "Genk", "Standard Liege", "Gent", "Charleroi", "Club Brugge", "Germinal Beerschot", "Westerlo", "Mons", "Mouscron", "Roeselare", "Cercle Brugge", "FC Brussels", "Zulte Waregem", "Sint-Truiden", "Lokeren", "Lierse", "Beveren"],
  "2007": ["Standard Liege", "Anderlecht", "Club Brugge", "Cercle Brugge", "Germinal Beerschot", "Gent", "Zulte Waregem", "Charleroi", "Westerlo", "Genk", "Mouscron", "Lokeren", "KV Mechelen", "Roeselare", "Dender", "Mons", "Sint-Truiden", "FC Brussels"],
  "2008": ["Standard Liege", "Anderlecht", "Club Brugge", "Gent", "Zulte Waregem", "Westerlo", "Lokeren", "Genk", "Cercle Brugge", "KV Mechelen", "Mouscron", "Charleroi", "Germinal Beerschot", "Kortrijk", "Dender", "Roeselare", "Tubize", "Mons"],
  "2009": ["Anderlecht", "Gent", "Club Brugge", "Sint-Truiden", "Kortrijk", "Zulte Waregem", "KV Mechelen", "Standard Liege", "Cercle Brugge", "Germinal Beerschot", "Genk", "Westerlo", "Charleroi", "Lokeren", "Roeselare", "Mouscron"],
  "2010": ["Genk", "Standard Liege", "Anderlecht", "Club Brugge", "Gent", "Lokeren", "KV Mechelen", "Westerlo", "Cercle Brugge", "Kortrijk", "Zulte Waregem", "Sint-Truiden", "Germinal Beerschot", "Lierse", "Eupen", "Charleroi"],
  "2011": ["Anderlecht", "Club Brugge", "Genk", "Gent", "Standard Liege", "Kortrijk", "Cercle Brugge", "Lokeren", "KV Mechelen", "Mons", "Beerschot", "Lierse", "Zulte Waregem", "OH Leuven", "Westerlo", "Sint-Truiden"],
  "2012": ["Anderlecht", "Zulte Waregem", "Club Brugge", "Genk", "Standard Liege", "Lokeren", "Mons", "KV Mechelen", "Kortrijk", "OH Leuven", "Charleroi", "Gent", "Waasland-Beveren", "Lierse", "Beerschot", "Cercle Brugge"],
  "2013": ["Anderlecht", "Standard Liege", "Club Brugge", "Zulte Waregem", "Lokeren", "Genk", "Gent", "Kortrijk", "KV Oostende", "Charleroi", "Cercle Brugge", "Lierse", "KV Mechelen", "Waasland-Beveren", "OH Leuven", "Mons"],
  "2014": ["Gent", "Club Brugge", "Anderlecht", "Standard Liege", "Charleroi", "Kortrijk", "Genk", "Lokeren", "KV Mechelen", "KV Oostende", "Westerlo", "Zulte Waregem", "Mouscron", "Waasland-Beveren", "Cercle Brugge", "Lierse"],
  "2015": ["Club Brugge", "Anderlecht", "Gent", "Genk", "KV Oostende", "Zulte Waregem", "Standard Liege", "Charleroi", "Kortrijk", "KV Mechelen", "Lokeren", "Waasland-Beveren", "Sint-Truiden", "Mouscron", "Westerlo", "OH Leuven"],
  "2016": ["Anderlecht", "Club Brugge", "Gent", "KV Oostende", "Charleroi", "Zulte Waregem", "KV Mechelen", "Genk", "Standard Liege", "Kortrijk", "Lokeren", "Sint-Truiden", "Eupen", "Waasland-Beveren", "Mouscron", "Westerlo"],
  "2017": ["Club Brugge", "Standard Liege", "Anderlecht", "Gent", "Genk", "Charleroi", "Kortrijk", "Antwerp", "Zulte Waregem", "Sint-Truiden", "KV Oostende", "Waasland-Beveren", "Lokeren", "Mouscron", "Eupen", "KV Mechelen"],
  "2018": ["Genk", "Club Brugge", "Standard Liege", "Antwerp", "Gent", "Anderlecht", "Sint-Truiden", "Kortrijk", "Charleroi", "Mouscron", "Zulte Waregem", "Eupen", "Cercle Brugge", "KV Oostende", "Waasland-Beveren", "Lokeren"],
  "2019": ["Club Brugge", "Gent", "Charleroi", "Antwerp", "Standard Liege", "KV Mechelen", "Genk", "Anderlecht", "Zulte Waregem", "Mouscron", "Kortrijk", "Sint-Truiden", "Eupen", "Cercle Brugge", "KV Oostende", "Waasland-Beveren"],
  "2020": ["Club Brugge", "Genk", "Antwerp", "Anderlecht", "KV Oostende", "Standard Liege", "Gent", "KV Mechelen", "Beerschot", "Zulte Waregem", "OH Leuven", "Eupen", "Charleroi", "Kortrijk", "Sint-Truiden", "Cercle Brugge", "Waasland-Beveren", "Mouscron"],
  "2021": ["Club Brugge", "Union Saint-Gilloise", "Anderlecht", "Antwerp", "Gent", "KV Mechelen", "Charleroi", "Genk", "Sint-Truiden", "Cercle Brugge", "OH Leuven", "KV Oostende", "Kortrijk", "Standard Liege", "Eupen", "Zulte Waregem", "Seraing", "Beerschot"],
  "2022": ["Antwerp", "Genk", "Union Saint-Gilloise", "Club Brugge", "Gent", "Cercle Brugge", "Standard Liege", "Westerlo", "Charleroi", "OH Leuven", "Anderlecht", "Sint-Truiden", "KV Mechelen", "Kortrijk", "Eupen", "KV Oostende", "Zulte Waregem", "Seraing"],
  "2023": ["Club Brugge", "Union Saint-Gilloise", "Anderlecht", "Cercle Brugge", "Genk", "Antwerp", "Gent", "KV Mechelen", "Sint-Truiden", "OH Leuven", "Westerlo", "Charleroi", "Standard Liege", "Kortrijk", "RWDM", "Eupen"],
  "2024": ["Union Saint-Gilloise", "Club Brugge", "Genk", "Anderlecht", "Antwerp", "Gent", "Standard Liege", "KV Mechelen", "Charleroi", "Westerlo", "OH Leuven", "Dender", "Cercle Brugge", "Sint-Truiden", "Kortrijk", "Beerschot"],
  "2025": ["Club Brugge", "Union Saint-Gilloise", "Genk", "Anderlecht", "Gent", "Antwerp", "Standard Liege", "KV Mechelen", "Charleroi", "Westerlo", "OH Leuven", "Sint-Truiden", "Cercle Brugge", "Dender", "Zulte Waregem", "La Louviere"],
  "2026": ["Club Brugge", "Union Saint-Gilloise", "Genk", "Anderlecht", "Gent", "Antwerp", "Standard Liege", "KV Mechelen", "Charleroi", "Westerlo", "OH Leuven", "Sint-Truiden", "Cercle Brugge", "Zulte Waregem", "La Louviere", "Kortrijk", "Beveren", "Lommel"]
};

// ============================================================================
// 5. SEASON-BY-SEASON PARTICIPANTS: SWEDEN (1989-2026)
// ============================================================================
const SWE_SEASONS = {
  "1989": ["Malmo FF", "IFK Norrkoping", "GAIS", "Orebro SK", "Halmstads BK", "Djurgarden", "IFK Goteborg", "AIK", "Orgryte IS", "IK Brage", "GIF Sundsvall", "Vastra Frolunda"],
  "1990": ["IFK Goteborg", "IFK Norrkoping", "Orebro SK", "Osters IF", "Djurgarden", "Malmo FF", "GAIS", "AIK", "Halmstads BK", "IK Brage", "Orgryte IS", "Hammarby"],
  "1991": ["IFK Goteborg", "IFK Norrkoping", "Orebro SK", "Malmo FF", "Djurgarden", "AIK", "Osters IF", "Halmstads BK", "GAIS", "GIF Sundsvall"],
  "1992": ["AIK", "IFK Norrkoping", "Osters IF", "Trelleborgs FF", "Malmo FF", "IFK Goteborg", "Djurgarden", "Orebro SK", "Vastra Frolunda", "GAIS"],
  "1993": ["IFK Goteborg", "IFK Norrkoping", "AIK", "Trelleborgs FF", "Halmstads BK", "BK Hacken", "Vastra Frolunda", "Osters IF", "Helsingborg", "Malmo FF", "Orebro SK", "Degerfors IF", "IK Brage", "Orgryte IS"],
  "1994": ["IFK Goteborg", "Orebro SK", "Malmo FF", "IFK Norrkoping", "Osters IF", "AIK", "Halmstads BK", "Degerfors IF", "Helsingborg", "Trelleborgs FF", "Vastra Frolunda", "Hammarby", "Landskrona BoIS", "BK Hacken"],
  "1995": ["IFK Goteborg", "Helsingborg", "Halmstads BK", "Malmo FF", "Orebro SK", "Djurgarden", "Orgryte IS", "AIK", "Degerfors IF", "Trelleborgs FF", "Osters IF", "IFK Norrkoping", "Hammarby", "Vastra Frolunda"],
  "1996": ["IFK Goteborg", "Malmo FF", "Helsingborg", "AIK", "Orebro SK", "Osters IF", "Halmstads BK", "IFK Norrkoping", "Degerfors IF", "Orgryte IS", "Umea FC", "Trelleborgs FF", "Djurgarden", "IK Oddevold"],
  "1997": ["Halmstads BK", "IFK Goteborg", "Malmo FF", "Orebro SK", "Orgryte IS", "Helsingborg", "Elfsborg", "AIK", "IFK Norrkoping", "Trelleborgs FF", "Osters IF", "Vasteras SK", "Degerfors IF", "Ljungskile SK"],
  "1998": ["AIK", "Helsingborg", "Hammarby", "Halmstads BK", "Vastra Frolunda", "Orebro SK", "IFK Norrkoping", "IFK Goteborg", "Malmo FF", "Elfsborg", "Trelleborgs FF", "Orgryte IS", "BK Hacken", "Osters IF"],
  "1999": ["Helsingborg", "AIK", "Halmstads BK", "Orgryte IS", "IFK Norrkoping", "IFK Goteborg", "Vastra Frolunda", "Trelleborgs FF", "Elfsborg", "Hammarby", "Kalmar FF", "Orebro SK", "Malmo FF", "Djurgarden"],
  "2000": ["Halmstads BK", "Helsingborg", "AIK", "IFK Goteborg", "Elfsborg", "Trelleborgs FF", "Orgryte IS", "Hammarby", "IFK Norrkoping", "Orebro SK", "GIF Sundsvall", "BK Hacken", "GAIS", "Vastra Frolunda"],
  "2001": ["Hammarby", "Djurgarden", "AIK", "IFK Goteborg", "Helsingborg", "Orebro SK", "Halmstads BK", "Orgryte IS", "Malmo FF", "Elfsborg", "GIF Sundsvall", "IFK Norrkoping", "BK Hacken", "Trelleborgs FF"],
  "2002": ["Djurgarden", "Malmo FF", "Orgryte IS", "AIK", "Helsingborg", "Halmstads BK", "Orebro SK", "GIF Sundsvall", "Hammarby", "Elfsborg", "Landskrona BoIS", "IFK Goteborg", "IFK Norrkoping", "Kalmar FF"],
  "2003": ["Djurgarden", "Hammarby", "Malmo FF", "Orgryte IS", "AIK", "Helsingborg", "IFK Goteborg", "Orebro SK", "Halmstads BK", "Elfsborg", "Landskrona BoIS", "GIF Sundsvall", "Osters IF", "Enkopings SK"],
  "2004": ["Malmo FF", "Halmstads BK", "IFK Goteborg", "Djurgarden", "Kalmar FF", "Hammarby", "GIF Sundsvall", "Orebro SK", "Elfsborg", "Helsingborg", "AIK", "Landskrona BoIS", "Orgryte IS", "Trelleborgs FF"],
  "2005": ["Djurgarden", "IFK Goteborg", "Kalmar FF", "Hammarby", "Malmo FF", "Helsingborg", "Elfsborg", "BK Hacken", "Orgryte IS", "Halmstads BK", "Gefle IF", "Landskrona BoIS", "GIF Sundsvall", "Assyriska FF"],
  "2006": ["Elfsborg", "AIK", "Hammarby", "Helsingborg", "Kalmar FF", "Djurgarden", "Malmo FF", "IFK Goteborg", "Gefle IF", "GAIS", "Halmstads BK", "BK Hacken", "Osters IF", "Orgryte IS"],
  "2007": ["IFK Goteborg", "Kalmar FF", "Djurgarden", "Elfsborg", "AIK", "Hammarby", "Halmstads BK", "Helsingborg", "Malmo FF", "Gefle IF", "GAIS", "Orebro SK", "Trelleborgs FF", "IF Brommapojkarna"],
  "2008": ["Kalmar FF", "Elfsborg", "IFK Goteborg", "Helsingborg", "AIK", "Malmo FF", "Orebro SK", "Hammarby", "Halmstads BK", "Trelleborgs FF", "GAIS", "Djurgarden", "Gefle IF", "Ljungskile SK", "IFK Norrkoping", "GIF Sundsvall"],
  "2009": ["AIK", "IFK Goteborg", "Elfsborg", "Kalmar FF", "BK Hacken", "Orebro SK", "Malmo FF", "Helsingborg", "Trelleborgs FF", "Gefle IF", "GAIS", "Halmstads BK", "IF Brommapojkarna", "Djurgarden", "Orgryte IS", "Hammarby"],
  "2010": ["Malmo FF", "Helsingborg", "Orebro SK", "Elfsborg", "Trelleborgs FF", "IFK Goteborg", "BK Hacken", "Kalmar FF", "GAIS", "Djurgarden", "Mjallby AIF", "Halmstads BK", "AIK", "Gefle IF", "Atvidabergs FF", "IF Brommapojkarna"],
  "2011": ["Helsingborg", "AIK", "Elfsborg", "Malmo FF", "GAIS", "BK Hacken", "IFK Goteborg", "Kalmar FF", "Gefle IF", "Mjallby AIF", "Djurgarden", "Orebro SK", "IFK Norrkoping", "Syrianska FC", "Trelleborgs FF", "Halmstads BK"],
  "2012": ["Elfsborg", "BK Hacken", "Malmo FF", "AIK", "IFK Norrkoping", "Helsingborg", "IFK Goteborg", "Atvidabergs FF", "Djurgarden", "Kalmar FF", "Gefle IF", "Mjallby AIF", "Syrianska FC", "GIF Sundsvall", "Orebro SK", "GAIS"],
  "2013": ["Malmo FF", "AIK", "IFK Goteborg", "Kalmar FF", "IFK Norrkoping", "Elfsborg", "Helsingborg", "Mjallby AIF", "Djurgarden", "BK Hacken", "Halmstads BK", "Atvidabergs FF", "Gefle IF", "IF Brommapojkarna", "Osters IF", "Syrianska FC"],
  "2014": ["Malmo FF", "IFK Goteborg", "AIK", "Elfsborg", "BK Hacken", "Orebro SK", "Djurgarden", "Atvidabergs FF", "Helsingborg", "Halmstads BK", "Kalmar FF", "IFK Norrkoping", "Falkenbergs FF", "Gefle IF", "Mjallby AIF", "IF Brommapojkarna"],
  "2015": ["IFK Norrkoping", "IFK Goteborg", "AIK", "Elfsborg", "Malmo FF", "Djurgarden", "BK Hacken", "Helsingborg", "Orebro SK", "Gefle IF", "Hammarby", "GIF Sundsvall", "Kalmar FF", "Falkenbergs FF", "Halmstads BK", "Atvidabergs FF"],
  "2016": ["Malmo FF", "AIK", "IFK Norrkoping", "IFK Goteborg", "Elfsborg", "Kalmar FF", "Djurgarden", "Ostersunds FK", "Orebro SK", "BK Hacken", "Hammarby", "Jonkopings Sodra", "GIF Sundsvall", "Helsingborg", "Gefle IF", "Falkenbergs FF"],
  "2017": ["Malmo FF", "AIK", "Djurgarden", "BK Hacken", "Ostersunds FK", "IFK Norrkoping", "IK Sirius", "Elfsborg", "Hammarby", "IFK Goteborg", "Orebro SK", "Kalmar FF", "GIF Sundsvall", "Jonkopings Sodra", "Halmstads BK", "AFC Eskilstuna"],
  "2018": ["AIK", "IFK Norrkoping", "Malmo FF", "Hammarby", "BK Hacken", "Ostersunds FK", "Djurgarden", "GIF Sundsvall", "Orebro SK", "Kalmar FF", "IFK Goteborg", "Elfsborg", "IK Sirius", "IF Brommapojkarna", "Dalkurd FF", "Trelleborgs FF"],
  "2019": ["Djurgarden", "Malmo FF", "Hammarby", "AIK", "IFK Norrkoping", "BK Hacken", "IFK Goteborg", "Elfsborg", "Orebro SK", "Helsingborg", "IK Sirius", "Ostersunds FK", "Falkenbergs FF", "Kalmar FF", "GIF Sundsvall", "AFC Eskilstuna"],
  "2020": ["Malmo FF", "Elfsborg", "BK Hacken", "Djurgarden", "Mjallby AIF", "IFK Norrkoping", "Orebro SK", "Hammarby", "AIK", "IK Sirius", "Varbergs BoIS", "IFK Goteborg", "Ostersunds FK", "Kalmar FF", "Helsingborg", "Falkenbergs FF"],
  "2021": ["Malmo FF", "AIK", "Djurgarden", "Elfsborg", "Hammarby", "Kalmar FF", "IFK Norrkoping", "IFK Goteborg", "Mjallby AIF", "Varbergs BoIS", "IK Sirius", "BK Hacken", "Degerfors IF", "Halmstads BK", "Orebro SK", "Ostersunds FK"],
  "2022": ["BK Hacken", "Djurgarden", "Hammarby", "Kalmar FF", "AIK", "Elfsborg", "Malmo FF", "IFK Goteborg", "Mjallby AIF", "IFK Varnamo", "IK Sirius", "IFK Norrkoping", "Degerfors IF", "Varbergs BoIS", "Helsingborg", "GIF Sundsvall"],
  "2023": ["Malmo FF", "Elfsborg", "BK Hacken", "Djurgarden", "IFK Varnamo", "Kalmar FF", "Hammarby", "IK Sirius", "IFK Norrkoping", "Mjallby AIF", "AIK", "Halmstads BK", "IFK Goteborg", "IF Brommapojkarna", "Degerfors IF", "Varbergs BoIS"],
  "2024": ["Malmo FF", "Hammarby", "AIK", "Djurgarden", "Mjallby AIF", "GAIS", "Elfsborg", "BK Hacken", "IK Sirius", "IF Brommapojkarna", "IFK Norrkoping", "Halmstads BK", "IFK Goteborg", "IFK Varnamo", "Kalmar FF", "Vasteras SK"],
  "2025": ["Malmo FF", "Hammarby", "AIK", "Djurgarden", "Elfsborg", "BK Hacken", "Mjallby AIF", "GAIS", "IK Sirius", "IFK Norrkoping", "IFK Goteborg", "Halmstads BK", "IF Brommapojkarna", "IFK Varnamo", "Degerfors IF", "Osters IF"],
  "2026": ["Malmo FF", "Mjallby AIF", "Hammarby", "AIK", "Djurgarden", "GAIS", "Elfsborg", "BK Hacken", "IK Sirius", "IFK Goteborg", "Halmstads BK", "IF Brommapojkarna", "Degerfors IF", "Kalmar FF", "Vasteras SK", "Orgryte IS"]
};

// ============================================================================
// 6. SEASON-BY-SEASON PARTICIPANTS: DENMARK (1989-2026)
// ============================================================================
const DEN_SEASONS = {
  "1989": ["Odense BK", "Brondby", "Lyngby", "Vejle", "AGF Aarhus", "B 1903", "Silkeborg", "BK Frem", "Naestved", "Ikast FS", "AaB", "Herfolge", "B 1913", "Bronshoj"],
  "1990": ["Brondby", "B 1903", "Ikast FS", "Silkeborg", "BK Frem", "Lyngby", "AGF Aarhus", "Odense BK", "Vejle", "AaB", "Naestved", "Herfolge", "KB", "Viborg"],
  "1991": ["Lyngby", "B 1903", "BK Frem", "AGF Aarhus", "AaB", "Silkeborg", "Brondby", "Naestved", "Odense BK", "Vejle"],
  "1992": ["FC Copenhagen", "Odense BK", "Brondby", "AaB", "Silkeborg", "AGF Aarhus", "Lyngby", "Naestved", "BK Frem", "B 1903"].map((n, i) => i === 9 ? "Viborg" : n),
  "1993": ["Silkeborg", "FC Copenhagen", "Brondby", "Odense BK", "AaB", "Lyngby", "IKast FS", "AGF Aarhus", "Naestved", "Viborg"].map(n => n === "IKast FS" ? "Ikast FS" : n),
  "1994": ["AaB", "Brondby", "Silkeborg", "AGF Aarhus", "Naestved", "FC Copenhagen", "Lyngby", "Odense BK", "Ikast FS", "BK Frem"],
  "1995": ["Brondby", "AGF Aarhus", "Odense BK", "Lyngby", "AaB", "Silkeborg", "FC Copenhagen", "Viborg", "Vejle", "Herfolge", "Ikast FS", "Naestved"],
  "1996": ["Brondby", "Vejle", "AGF Aarhus", "Herfolge", "AaB", "Silkeborg", "Odense BK", "FC Copenhagen", "Lyngby", "AB", "Viborg", "Hvidovre"],
  "1997": ["Brondby", "Silkeborg", "FC Copenhagen", "Vejle", "AB", "Lyngby", "AaB", "AGF Aarhus", "Aarhus Fremad", "Brondby", "Ikast FS", "Odense BK"].map((n, i) => i === 9 ? "Herfolge" : n),
  "1998": ["AaB", "Brondby", "AB", "Lyngby", "Herfolge", "Vejle", "FC Copenhagen", "Viborg", "Silkeborg", "AGF Aarhus", "Aarhus Fremad", "B 93"],
  "1999": ["Herfolge", "Brondby", "AB", "Viborg", "AaB", "Silkeborg", "Lyngby", "FC Copenhagen", "Odense BK", "AGF Aarhus", "Vejle", "Esbjerg"],
  "2000": ["FC Copenhagen", "Brondby", "Silkeborg", "Midtjylland", "AaB", "Viborg", "Odense BK", "AGF Aarhus", "Lyngby", "AB", "Herfolge", "SonderjyskE"],
  "2001": ["Brondby", "FC Copenhagen", "Midtjylland", "AaB", "AB", "Odense BK", "Esbjerg", "Viborg", "Silkeborg", "AGF Aarhus", "Vejle", "Lyngby"],
  "2002": ["FC Copenhagen", "Brondby", "Farum BK", "Odense BK", "Esbjerg", "AaB", "Midtjylland", "Viborg", "AB", "AGF Aarhus", "Koge", "Silkeborg"].map(n => n === "Farum BK" ? "Nordsjaelland" : n),
  "2003": ["FC Copenhagen", "Brondby", "Esbjerg", "Odense BK", "AaB", "Midtjylland", "Viborg", "AGF Aarhus", "Nordsjaelland", "Herfolge", "BK Frem", "AB"],
  "2004": ["Brondby", "FC Copenhagen", "Midtjylland", "AaB", "Esbjerg", "Odense BK", "Viborg", "Silkeborg", "AGF Aarhus", "Nordsjaelland", "Herfolge", "Randers"],
  "2005": ["FC Copenhagen", "Brondby", "Odense BK", "Viborg", "AaB", "Esbjerg", "Midtjylland", "Silkeborg", "Nordsjaelland", "AC Horsens", "SonderjyskE", "AGF Aarhus"],
  "2006": ["FC Copenhagen", "Midtjylland", "AaB", "Odense BK", "Nordsjaelland", "Brondby", "Esbjerg", "Randers", "Viborg", "AC Horsens", "Vejle", "Silkeborg"],
  "2007": ["AaB", "Midtjylland", "FC Copenhagen", "Odense BK", "AC Horsens", "Randers", "Esbjerg", "Brondby", "Nordsjaelland", "AGF Aarhus", "Viborg", "Lyngby"],
  "2008": ["FC Copenhagen", "Odense BK", "Brondby", "Midtjylland", "Randers", "AGF Aarhus", "AaB", "Nordsjaelland", "Esbjerg", "SonderjyskE", "Vejle", "AC Horsens"],
  "2009": ["FC Copenhagen", "Odense BK", "Brondby", "Esbjerg", "AaB", "Midtjylland", "Nordsjaelland", "Silkeborg", "SonderjyskE", "Randers", "AGF Aarhus", "HB Koge"],
  "2010": ["FC Copenhagen", "Odense BK", "Brondby", "Midtjylland", "Silkeborg", "Nordsjaelland", "SonderjyskE", "Lyngby", "AC Horsens", "AaB", "Randers", "Esbjerg"],
  "2011": ["Nordsjaelland", "FC Copenhagen", "Midtjylland", "AC Horsens", "AGF Aarhus", "SonderjyskE", "AaB", "Silkeborg", "Brondby", "Odense BK", "Lyngby", "HB Koge"],
  "2012": ["FC Copenhagen", "Nordsjaelland", "Randers", "Esbjerg", "AaB", "Midtjylland", "AGF Aarhus", "SonderjyskE", "Brondby", "Odense BK", "AC Horsens", "Silkeborg"],
  "2013": ["AaB", "FC Copenhagen", "Midtjylland", "Esbjerg", "Brondby", "Nordsjaelland", "Randers", "Odense BK", "FC Vestsjaelland", "SonderjyskE", "AGF Aarhus", "Viborg"],
  "2014": ["Midtjylland", "FC Copenhagen", "Brondby", "Randers", "AaB", "Nordsjaelland", "Hobro", "Esbjerg", "Odense BK", "SonderjyskE", "FC Vestsjaelland", "Silkeborg"],
  "2015": ["FC Copenhagen", "SonderjyskE", "Midtjylland", "Brondby", "AaB", "Randers", "Odense BK", "Viborg", "Nordsjaelland", "AGF Aarhus", "Esbjerg", "Hobro"],
  "2016": ["FC Copenhagen", "Brondby", "Lyngby", "Midtjylland", "Nordsjaelland", "SonderjyskE", "Randers", "Odense BK", "Silkeborg", "AaB", "AGF Aarhus", "AC Horsens", "Viborg", "Esbjerg"],
  "2017": ["Midtjylland", "Brondby", "Nordsjaelland", "FC Copenhagen", "AaB", "AC Horsens", "AGF Aarhus", "Hobro", "SonderjyskE", "Odense BK", "Randers", "Lyngby", "Silkeborg", "FC Helsingor"],
  "2018": ["FC Copenhagen", "Midtjylland", "Esbjerg", "Brondby", "Odense BK", "Nordsjaelland", "AaB", "Randers", "AGF Aarhus", "SonderjyskE", "AC Horsens", "Vendsyssel", "Hobro", "Vejle"],
  "2019": ["Midtjylland", "FC Copenhagen", "AGF Aarhus", "Brondby", "AaB", "Nordsjaelland", "Randers", "AC Horsens", "Odense BK", "Lyngby", "SonderjyskE", "Hobro", "Silkeborg", "Esbjerg"],
  "2020": ["Brondby", "Midtjylland", "FC Copenhagen", "AGF Aarhus", "Nordsjaelland", "Randers", "AaB", "SonderjyskE", "Odense BK", "Vejle", "Lyngby", "AC Horsens"],
  "2021": ["FC Copenhagen", "Midtjylland", "Silkeborg", "Brondby", "AaB", "Randers", "Viborg", "Odense BK", "Nordsjaelland", "AGF Aarhus", "Vejle", "SonderjyskE"],
  "2022": ["FC Copenhagen", "Nordsjaelland", "AGF Aarhus", "Viborg", "Brondby", "Randers", "Midtjylland", "Odense BK", "Silkeborg", "Lyngby", "AC Horsens", "AaB"],
  "2023": ["Midtjylland", "Brondby", "FC Copenhagen", "Nordsjaelland", "AGF Aarhus", "Silkeborg", "Viborg", "Randers", "Vejle", "Lyngby", "Odense BK", "Hvidovre"],
  "2024": ["FC Copenhagen", "Midtjylland", "Brondby", "Randers", "Nordsjaelland", "AGF Aarhus", "Silkeborg", "Viborg", "SonderjyskE", "Vejle", "AaB", "Lyngby"],
  "2025": ["FC Copenhagen", "Midtjylland", "Brondby", "AGF Aarhus", "Nordsjaelland", "Randers", "Silkeborg", "Viborg", "SonderjyskE", "Vejle", "Odense BK", "Fredericia"],
  "2026": ["FC Copenhagen", "Midtjylland", "Brondby", "AGF Aarhus", "Nordsjaelland", "Randers", "Silkeborg", "Viborg", "SonderjyskE", "Odense BK", "Lyngby", "AC Horsens"]
};

// ============================================================================
// 7. HISTORICAL EUROPEAN QUALIFIERS (1989 - 2026)
// ============================================================================
const BEL_QUALIFIERS = {
  "1989": { cl: ["KV Mechelen"], uefa: ["Club Brugge", "Antwerp", "RFC Liege"] },
  "1990": { cl: ["Club Brugge"], uefa: ["Anderlecht", "Antwerp", "KV Mechelen"] },
  "1991": { cl: ["Anderlecht"], uefa: ["Gent", "KV Mechelen", "Germinal Ekeren"] },
  "1992": { cl: ["Club Brugge"], uefa: ["Anderlecht", "KV Mechelen", "Standard Liege"] },
  "1993": { cl: ["Anderlecht"], uefa: ["KV Mechelen", "Antwerp", "Waregem"] },
  "1994": { cl: ["Anderlecht"], uefa: ["Club Brugge", "RFC Seraing", "Charleroi"].map(n => n === "RFC Seraing" ? "Seraing" : n) },
  "1995": { cl: ["Anderlecht"], uefa: ["Standard Liege", "Lierse", "Aalst"] },
  "1996": { cl: ["Club Brugge"], uefa: ["Anderlecht", "Germinal Ekeren", "RWDM"] },
  "1997": { cl: ["Lierse"], uefa: ["Club Brugge", "Anderlecht", "Mouscron"] },
  "1998": { cl: ["Club Brugge"], uefa: ["Genk", "Germinal Ekeren", "Anderlecht"] },
  "1999": { cl: ["Genk"], uefa: ["Club Brugge", "Anderlecht", "Lierse"] },
  "2000": { cl: ["Anderlecht"], uefa: ["Club Brugge", "Gent", "Genk"] },
  "2001": { cl: ["Anderlecht"], uefa: ["Club Brugge", "Standard Liege", "Westerlo"] },
  "2002": { cl: ["Genk", "Club Brugge"], uefa: ["Anderlecht", "Mouscron"] },
  "2003": { cl: ["Club Brugge", "Anderlecht"], uefa: ["Lokeren", "La Louviere"] },
  "2004": { cl: ["Anderlecht", "Club Brugge"], uefa: ["Standard Liege", "Beveren"] },
  "2005": { cl: ["Club Brugge", "Anderlecht"], uefa: ["Genk", "Germinal Beerschot"] },
  "2006": { cl: ["Anderlecht", "Standard Liege"], uefa: ["Club Brugge", "Zulte Waregem"] },
  "2007": { cl: ["Anderlecht", "Genk"], uefa: ["Standard Liege", "Club Brugge"] },
  "2008": { cl: ["Standard Liege", "Anderlecht"], uefa: ["Club Brugge", "Gent"] },
  "2009": { cl: ["Standard Liege", "Anderlecht"], uefa: ["Club Brugge", "Genk", "Gent"] },
  "2010": { cl: ["Anderlecht", "Gent"], uefa: ["Club Brugge", "Genk", "Cercle Brugge"] },
  "2011": { cl: ["Genk", "Standard Liege"], uefa: ["Anderlecht", "Club Brugge", "Westerlo"] },
  "2012": { cl: ["Anderlecht", "Club Brugge"], uefa: ["Genk", "Lokeren", "Gent"] },
  "2013": { cl: ["Anderlecht", "Zulte Waregem"], uefa: ["Genk", "Standard Liege", "Club Brugge"] },
  "2014": { cl: ["Anderlecht", "Standard Liege"], uefa: ["Club Brugge", "Lokeren", "Zulte Waregem"] },
  "2015": { cl: ["Gent", "Club Brugge"], uefa: ["Anderlecht", "Standard Liege", "Charleroi"] },
  "2016": { cl: ["Club Brugge", "Anderlecht"], uefa: ["Gent", "Genk", "Standard Liege"] },
  "2017": { cl: ["Anderlecht", "Club Brugge"], uefa: ["Zulte Waregem", "Gent", "KV Oostende"] },
  "2018": { cl: ["Club Brugge", "Standard Liege"], uefa: ["Anderlecht", "Genk", "Gent"] },
  "2019": { cl: ["Genk", "Club Brugge"], uefa: ["Standard Liege", "Antwerp", "Gent"] },
  "2020": { cl: ["Club Brugge", "Gent"], uefa: ["Standard Liege", "Antwerp", "Charleroi"] },
  "2021": { cl: ["Club Brugge", "Genk"], uefa: ["Antwerp"], uecl: ["Anderlecht", "Gent"] },
  "2022": { cl: ["Club Brugge", "Union Saint-Gilloise"], uefa: ["Gent"], uecl: ["Anderlecht", "Antwerp"] },
  "2023": { cl: ["Antwerp", "Genk"], uefa: ["Union Saint-Gilloise"], uecl: ["Club Brugge", "Gent"] },
  "2024": { cl: ["Club Brugge", "Union Saint-Gilloise"], uefa: ["Anderlecht"], uecl: ["Cercle Brugge", "Gent"] },
  "2025": { cl: ["Union Saint-Gilloise", "Club Brugge"], uefa: ["Genk"], uecl: ["Anderlecht", "Charleroi"] },
  "2026": { cl: ["Club Brugge", "Union Saint-Gilloise"], uefa: ["Genk", "Anderlecht"], uecl: ["Gent", "Antwerp"] }
};

const SWE_QUALIFIERS = {
  "1989": { cl: ["Malmo FF"], uefa: ["IFK Goteborg", "Orgryte IS"] },
  "1990": { cl: ["Malmo FF"], uefa: ["IFK Norrkoping", "GAIS"] },
  "1991": { cl: ["IFK Goteborg"], uefa: ["Orebro SK", "Osters IF"] },
  "1992": { cl: ["IFK Goteborg"], uefa: ["IFK Norrkoping", "Orebro SK"] },
  "1993": { cl: ["AIK"], uefa: ["IFK Norrkoping", "Osters IF"] },
  "1994": { cl: ["IFK Goteborg"], uefa: ["AIK", "Trelleborgs FF"] },
  "1995": { cl: ["IFK Goteborg"], uefa: ["Orebro SK", "Malmo FF", "Halmstads BK"] },
  "1996": { cl: ["IFK Goteborg"], uefa: ["Malmo FF", "Helsingborg", "Halmstads BK"] },
  "1997": { cl: ["IFK Goteborg"], uefa: ["Malmo FF", "Helsingborg", "Orebro SK"] },
  "1998": { cl: ["Halmstads BK"], uefa: ["IFK Goteborg", "Malmo FF"] },
  "1999": { cl: ["AIK"], uefa: ["Helsingborg", "Halmstads BK", "IFK Goteborg"] },
  "2000": { cl: ["Helsingborg"], uefa: ["AIK", "Halmstads BK", "IFK Norrkoping"] },
  "2001": { cl: ["Halmstads BK"], uefa: ["Helsingborg", "AIK"] },
  "2002": { cl: ["Hammarby"], uefa: ["Djurgarden", "AIK", "IFK Goteborg"] },
  "2003": { cl: ["Djurgarden"], uefa: ["Malmo FF", "AIK"] },
  "2004": { cl: ["Djurgarden"], uefa: ["Hammarby", "Elfsborg", "Osters IF"] },
  "2005": { cl: ["Malmo FF"], uefa: ["Halmstads BK", "Djurgarden"] },
  "2006": { cl: ["Djurgarden"], uefa: ["IFK Goteborg", "Kalmar FF", "Gefle IF"] },
  "2007": { cl: ["Elfsborg"], uefa: ["AIK", "Hammarby", "BK Hacken"] },
  "2008": { cl: ["IFK Goteborg"], uefa: ["Kalmar FF", "Djurgarden"] },
  "2009": { cl: ["Kalmar FF"], uefa: ["Elfsborg", "IFK Goteborg", "Helsingborg"] },
  "2010": { cl: ["AIK"], uefa: ["IFK Goteborg", "Elfsborg", "Kalmar FF"] },
  "2011": { cl: ["Malmo FF"], uefa: ["Helsingborg", "Orebro SK", "Elfsborg", "BK Hacken"] },
  "2012": { cl: ["Helsingborg"], uefa: ["AIK", "Elfsborg", "Kalmar FF"] },
  "2013": { cl: ["Elfsborg"], uefa: ["BK Hacken", "Malmo FF", "IFK Goteborg"] },
  "2014": { cl: ["Malmo FF"], uefa: ["AIK", "IFK Goteborg", "Elfsborg"] },
  "2015": { cl: ["Malmo FF"], uefa: ["IFK Goteborg", "AIK", "Elfsborg"] },
  "2016": { cl: ["IFK Norrkoping"], uefa: ["IFK Goteborg", "AIK", "BK Hacken"] },
  "2017": { cl: ["Malmo FF"], uefa: ["AIK", "IFK Norrkoping", "Ostersunds FK"] },
  "2018": { cl: ["Malmo FF"], uefa: ["AIK", "Djurgarden", "BK Hacken"] },
  "2019": { cl: ["AIK"], uefa: ["IFK Norrkoping", "Malmo FF", "BK Hacken"] },
  "2020": { cl: ["Djurgarden"], uefa: ["Malmo FF", "Hammarby", "IFK Goteborg"] },
  "2021": { cl: ["Malmo FF"], uefa: [], uecl: ["Elfsborg", "BK Hacken", "Hammarby"] },
  "2022": { cl: ["Malmo FF"], uefa: [], uecl: ["AIK", "Djurgarden", "Elfsborg"] },
  "2023": { cl: ["BK Hacken"], uefa: ["BK Hacken"], uecl: ["Djurgarden", "Hammarby", "Kalmar FF"] },
  "2024": { cl: ["Malmo FF"], uefa: ["Elfsborg", "Malmo FF"], uecl: ["BK Hacken", "Djurgarden"] },
  "2025": { cl: ["Malmo FF"], uefa: ["BK Hacken"], uecl: ["Hammarby", "AIK"] },
  "2026": { cl: ["Malmo FF"], uefa: ["Hammarby"], uecl: ["AIK", "Djurgarden"] }
};

const DEN_QUALIFIERS = {
  "1989": { cl: ["Brondby"], uefa: ["Naestved", "Ikast FS"] },
  "1990": { cl: ["Odense BK"], uefa: ["Brondby", "Vejle"] },
  "1991": { cl: ["Brondby"], uefa: ["B 1903", "Ikast FS"] },
  "1992": { cl: ["Lyngby"], uefa: ["FC Copenhagen", "BK Frem", "AGF Aarhus"] },
  "1993": { cl: ["FC Copenhagen"], uefa: ["Brondby", "AaB"] },
  "1994": { cl: ["Silkeborg"], uefa: ["FC Copenhagen", "Odense BK", "Brondby"] },
  "1995": { cl: ["AaB"], uefa: ["Brondby", "Silkeborg", "FC Copenhagen"] },
  "1996": { cl: ["Brondby"], uefa: ["Silkeborg", "AaB", "Lyngby"] },
  "1997": { cl: ["Brondby"], uefa: ["Vejle", "AGF Aarhus"] },
  "1998": { cl: ["Brondby"], uefa: ["Silkeborg", "Vejle", "FC Copenhagen"] },
  "1999": { cl: ["AaB"], uefa: ["Brondby", "AB", "Lyngby"] },
  "2000": { cl: ["Herfolge", "Brondby"], uefa: ["AB", "Viborg"] },
  "2001": { cl: ["FC Copenhagen"], uefa: ["Brondby", "Silkeborg", "Midtjylland"] },
  "2002": { cl: ["Brondby"], uefa: ["FC Copenhagen", "Midtjylland", "Odense BK"] },
  "2003": { cl: ["FC Copenhagen"], uefa: ["Brondby", "Nordsjaelland", "Esbjerg", "Odense BK"] },
  "2004": { cl: ["FC Copenhagen"], uefa: ["Brondby", "Esbjerg", "AaB"] },
  "2005": { cl: ["Brondby"], uefa: ["FC Copenhagen", "Midtjylland", "Esbjerg"] },
  "2006": { cl: ["FC Copenhagen"], uefa: ["Brondby", "Odense BK", "Randers"] },
  "2007": { cl: ["FC Copenhagen"], uefa: ["Midtjylland", "AaB", "Odense BK"] },
  "2008": { cl: ["AaB"], uefa: ["Midtjylland", "FC Copenhagen", "Brondby", "Nordsjaelland"] },
  "2009": { cl: ["FC Copenhagen"], uefa: ["Odense BK", "Brondby", "AaB", "Randers"] },
  "2010": { cl: ["FC Copenhagen"], uefa: ["Odense BK", "Brondby", "Nordsjaelland", "Randers"] },
  "2011": { cl: ["FC Copenhagen", "Odense BK"], uefa: ["Brondby", "Midtjylland", "Nordsjaelland"] },
  "2012": { cl: ["Nordsjaelland", "FC Copenhagen"], uefa: ["Midtjylland", "AC Horsens"] },
  "2013": { cl: ["FC Copenhagen", "Nordsjaelland"], uefa: ["Randers", "Esbjerg", "AaB"] },
  "2014": { cl: ["AaB", "FC Copenhagen"], uefa: ["Midtjylland", "Esbjerg", "Brondby"] },
  "2015": { cl: ["Midtjylland"], uefa: ["FC Copenhagen", "Brondby", "Randers"] },
  "2016": { cl: ["FC Copenhagen"], uefa: ["SonderjyskE", "Midtjylland", "Brondby"] },
  "2017": { cl: ["FC Copenhagen"], uefa: ["Brondby", "Lyngby", "Midtjylland"] },
  "2018": { cl: ["Midtjylland"], uefa: ["Brondby", "Nordsjaelland", "FC Copenhagen"] },
  "2019": { cl: ["FC Copenhagen"], uefa: ["Midtjylland", "Esbjerg", "Brondby"] },
  "2020": { cl: ["Midtjylland"], uefa: ["FC Copenhagen", "AGF Aarhus", "SonderjyskE"] },
  "2021": { cl: ["Brondby", "Midtjylland"], uefa: ["Randers"], uecl: ["FC Copenhagen", "AGF Aarhus"] },
  "2022": { cl: ["FC Copenhagen", "Midtjylland"], uefa: [], uecl: ["Silkeborg", "Brondby", "Viborg"] },
  "2023": { cl: ["FC Copenhagen"], uefa: [], uecl: ["Nordsjaelland", "AGF Aarhus", "Midtjylland"] },
  "2024": { cl: ["Midtjylland"], uefa: [], uecl: ["FC Copenhagen", "Brondby", "Silkeborg"] },
  "2025": { cl: ["FC Copenhagen"], uefa: ["Midtjylland"], uecl: ["Brondby", "Silkeborg"] },
  "2026": { cl: ["FC Copenhagen"], uefa: ["Midtjylland"], uecl: ["Brondby", "AGF Aarhus"] }
};

// ============================================================================
// 8. BUILDER FUNCTIONS
// ============================================================================
function generateLeagueFiles(countryCode, seasonsMap, clubsMeta, outputDir) {
  let count = 0;
  for (const [seasonYear, teamNames] of Object.entries(seasonsMap)) {
    const shortYr = seasonYear.slice(-2);
    const filename = `${countryCode}${shortYr}.json`;
    const fullPath = path.join(outputDir, filename);

    const teamsData = teamNames.map((teamName, index) => {
      const meta = clubsMeta[teamName] || {
        primary: "#FFFFFF",
        secondary: "#000000",
        kit: "swe92/0.png",
        att: 2,
        mid: 2,
        def: 2
      };

      let att = meta.att;
      let mid = meta.mid;
      let def = meta.def;

      if (index === 0) {
        att = Math.max(att, 4);
        mid = Math.max(mid, 4);
      } else if (index >= teamNames.length - 2) {
        att = Math.min(att, 3);
        def = Math.min(def, 2);
      }

      return {
        idnum: index,
        id: `${countryCode}${shortYr}`,
        name: teamName,
        attack: att,
        midfield: mid,
        defense: def,
        kit: meta.kit,
        primaryColor: meta.primary,
        secondaryColor: meta.secondary
      };
    });

    fs.writeFileSync(fullPath, JSON.stringify(teamsData, null, 2), 'utf8');
    count++;
  }
  return count;
}

if (require.main === module) {
  console.log("⚽ Generating Belgian League files (1989-2026)...");
  const belCount = generateLeagueFiles('bel', BEL_SEASONS, BEL_CLUBS, BEL_DIR);
  console.log(`✅ Created ${belCount} Belgian league files in ${BEL_DIR}`);

  console.log("⚽ Generating Swedish League files (1989-2026)...");
  const sweCount = generateLeagueFiles('swe', SWE_SEASONS, SWE_CLUBS, SWE_DIR);
  console.log(`✅ Created ${sweCount} Swedish league files in ${SWE_DIR}`);

  console.log("⚽ Generating Danish League files (1989-2026)...");
  const denCount = generateLeagueFiles('den', DEN_SEASONS, DEN_CLUBS, DEN_DIR);
  console.log(`✅ Created ${denCount} Danish league files in ${DEN_DIR}`);
}

module.exports = {
  BEL_QUALIFIERS,
  SWE_QUALIFIERS,
  DEN_QUALIFIERS,
  BEL_SEASONS,
  SWE_SEASONS,
  DEN_SEASONS
};
