/**
 * Historical League & Continental Cup Generator for Mexico (1989-2026),
 * USA MLS (1996-2026), and CONCACAF Champions Cup (1989-2026).
 *
 * Generates:
 *  - src/data/leagues/mex/mex89.json ... mex26.json
 *  - src/data/leagues/usa/usa96.json ... usa26.json
 *  - src/data/concacaf/concacaf89.json ... concacaf26.json
 *  - src/data/concacaf/concacafRules.js
 *  - src/data/leagueDataNA.js
 *  - src/data/qualifiersBySeasonNA.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MEX_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'mex');
const USA_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'usa');
const CONCACAF_DIR = path.join(ROOT_DIR, 'src', 'data', 'concacaf');

fs.mkdirSync(MEX_DIR, { recursive: true });
fs.mkdirSync(USA_DIR, { recursive: true });
fs.mkdirSync(CONCACAF_DIR, { recursive: true });

// ============================================================================
// 1. MEXICAN LIGA MX CLUB METADATA
// ============================================================================
const MEX_CLUBS = {
  "Club America":        { primary: "#FFDC00", secondary: "#002F6C", kit: "mex86/3.png", att: 4, mid: 4, def: 4 },
  "Chivas Guadalajara":  { primary: "#E31B23", secondary: "#FFFFFF", kit: "swe92/4.png", att: 4, mid: 4, def: 3 },
  "Cruz Azul":           { primary: "#005BAC", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 4, def: 4 },
  "Pumas UNAM":          { primary: "#002B5C", secondary: "#C8A415", kit: "swe92/0.png", att: 4, mid: 3, def: 3 },
  "Toluca":              { primary: "#D50032", secondary: "#FFFFFF", kit: "ger88/1.png", att: 4, mid: 4, def: 3 },
  "Tigres UANL":         { primary: "#FDB913", secondary: "#003B71", kit: "mex86/3.png", att: 4, mid: 4, def: 4 },
  "Monterrey":           { primary: "#0A2240", secondary: "#FFFFFF", kit: "swe92/4.png", att: 4, mid: 4, def: 4 },
  "Pachuca":             { primary: "#0033A0", secondary: "#FFFFFF", kit: "swe92/4.png", att: 4, mid: 3, def: 3 },
  "Santos Laguna":       { primary: "#008542", secondary: "#FFFFFF", kit: "swe92/1.png", att: 4, mid: 3, def: 3 },
  "Atlas":               { primary: "#D21034", secondary: "#000000", kit: "fra84/1.png", att: 3, mid: 3, def: 3 },
  "Necaxa":              { primary: "#E31B23", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 3, def: 3 },
  "Puebla":              { primary: "#FFFFFF", secondary: "#0055A4", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Morelia":             { primary: "#FFDC00", secondary: "#CC0000", kit: "ger88/4.png", att: 3, mid: 3, def: 3 },
  "Atlante":             { primary: "#002B5C", secondary: "#C8102E", kit: "swe92/2.png", att: 3, mid: 3, def: 3 },
  "Tecos UAG":           { primary: "#800000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Leon":                { primary: "#00843D", secondary: "#FFFFFF", kit: "swe92/1.png", att: 4, mid: 3, def: 3 },
  "Veracruz":            { primary: "#E31B23", secondary: "#003087", kit: "ger88/3.png", att: 3, mid: 3, def: 2 },
  "Tijuana":             { primary: "#CC0000", secondary: "#000000", kit: "fra84/1.png", att: 3, mid: 3, def: 3 },
  "Queretaro":           { primary: "#003DA5", secondary: "#000000", kit: "ecu93/1.png", att: 3, mid: 3, def: 2 },
  "Atletico San Luis":   { primary: "#D50032", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 3, def: 3 },
  "San Luis":            { primary: "#0033A0", secondary: "#FFD100", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Mazatlan":            { primary: "#5D2973", secondary: "#000000", kit: "swe92/3.png", att: 3, mid: 2, def: 2 },
  "FC Juarez":           { primary: "#00A651", secondary: "#000000", kit: "swe92/1.png", att: 3, mid: 2, def: 2 },
  "Jaguares Chiapas":    { primary: "#FF6600", secondary: "#000000", kit: "ecu93/1.png", att: 3, mid: 3, def: 3 },
  "Dorados de Sinaloa":  { primary: "#FFD100", secondary: "#000000", kit: "mex86/3.png", att: 2, mid: 3, def: 2 },
  "Lobos BUAP":          { primary: "#FFFFFF", secondary: "#C8102E", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Celaya":              { primary: "#FFFFFF", secondary: "#003399", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Toros Neza":          { primary: "#E51E25", secondary: "#FFFFFF", kit: "fra84/1.png", att: 3, mid: 3, def: 2 },
  "Irapuato":            { primary: "#C8102E", secondary: "#003399", kit: "ger88/3.png", att: 2, mid: 2, def: 2 },
  "Tampico Madero":      { primary: "#00A1DE", secondary: "#FFFFFF", kit: "ger88/3.png", att: 2, mid: 2, def: 2 },
  "Correcaminos":        { primary: "#FF6B00", secondary: "#FFFFFF", kit: "ecu93/1.png", att: 2, mid: 2, def: 2 },
  "UdeG":                { primary: "#FFD100", secondary: "#000000", kit: "ger88/4.png", att: 3, mid: 3, def: 2 },
  "Cobras":              { primary: "#E31B23", secondary: "#006847", kit: "ger88/3.png", att: 2, mid: 2, def: 2 },
  "Indios":              { primary: "#C8102E", secondary: "#000000", kit: "fra84/1.png", att: 2, mid: 2, def: 2 }
};

// ============================================================================
// 2. USA MLS CLUB METADATA (1996-2026)
// ============================================================================
const USA_CLUBS = {
  "D.C. United":             { primary: "#000000", secondary: "#EF3E42", kit: "ger88/5.png", att: 4, mid: 3, def: 3 },
  "LA Galaxy":               { primary: "#00245D", secondary: "#FFD200", kit: "swe92/0.png", att: 4, mid: 4, def: 3 },
  "NY/NJ MetroStars":        { primary: "#000000", secondary: "#ED1C24", kit: "swe92/4.png", att: 3, mid: 3, def: 3 },
  "New York Red Bulls":      { primary: "#FFFFFF", secondary: "#ED1C24", kit: "swe92/0.png", att: 4, mid: 4, def: 3 },
  "Columbus Crew":           { primary: "#FEDD00", secondary: "#000000", kit: "mex86/3.png", att: 4, mid: 4, def: 3 },
  "New England Revolution":  { primary: "#0A2240", secondary: "#CE0E2D", kit: "swe92/2.png", att: 3, mid: 3, def: 3 },
  "Kansas City Wizards":     { primary: "#002F6C", secondary: "#93B1D7", kit: "ger88/3.png", att: 3, mid: 3, def: 3 },
  "Sporting Kansas City":    { primary: "#93B1D7", secondary: "#002F6C", kit: "ger88/3.png", att: 4, mid: 3, def: 3 },
  "Dallas Burn":             { primary: "#C8102E", secondary: "#000000", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "FC Dallas":               { primary: "#BF0D3E", secondary: "#00205B", kit: "swe92/2.png", att: 3, mid: 3, def: 3 },
  "Colorado Rapids":         { primary: "#862633", secondary: "#8BB8E8", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "San Jose Clash":          { primary: "#0051BA", secondary: "#000000", kit: "ecu93/1.png", att: 3, mid: 3, def: 2 },
  "San Jose Earthquakes":    { primary: "#0067B1", secondary: "#000000", kit: "ecu93/1.png", att: 3, mid: 3, def: 3 },
  "Tampa Bay Mutiny":        { primary: "#00778B", secondary: "#00205B", kit: "swe92/5.png", att: 3, mid: 3, def: 2 },
  "Chicago Fire":            { primary: "#AF272F", secondary: "#101820", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Miami Fusion":            { primary: "#002F6C", secondary: "#FFD100", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Chivas USA":              { primary: "#E31B23", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 2, def: 2 },
  "Real Salt Lake":          { primary: "#B30838", secondary: "#013A81", kit: "swe92/2.png", att: 3, mid: 3, def: 3 },
  "Houston Dynamo":          { primary: "#FF6B00", secondary: "#101820", kit: "ecu93/1.png", att: 3, mid: 3, def: 3 },
  "Toronto FC":              { primary: "#B81137", secondary: "#455560", kit: "ger88/1.png", att: 4, mid: 3, def: 3 },
  "Seattle Sounders":        { primary: "#5D9732", secondary: "#005595", kit: "swe92/1.png", att: 4, mid: 4, def: 4 },
  "Philadelphia Union":      { primary: "#071B2C", secondary: "#B19B69", kit: "swe92/0.png", att: 4, mid: 4, def: 3 },
  "Portland Timbers":        { primary: "#00482B", secondary: "#EAE827", kit: "swe92/1.png", att: 3, mid: 3, def: 3 },
  "Vancouver Whitecaps":     { primary: "#FFFFFF", secondary: "#00245E", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Montreal Impact":         { primary: "#003DA5", secondary: "#000000", kit: "ecu93/1.png", att: 3, mid: 3, def: 3 },
  "CF Montreal":             { primary: "#0033A0", secondary: "#000000", kit: "ecu93/1.png", att: 3, mid: 3, def: 3 },
  "New York City FC":        { primary: "#6CADDF", secondary: "#041E42", kit: "ger88/3.png", att: 4, mid: 4, def: 3 },
  "Orlando City":            { primary: "#633492", secondary: "#FDE192", kit: "swe92/3.png", att: 3, mid: 3, def: 3 },
  "Atlanta United":          { primary: "#80000A", secondary: "#221F1F", kit: "fra84/1.png", att: 4, mid: 3, def: 3 },
  "Minnesota United":        { primary: "#231F20", secondary: "#8CD2F4", kit: "ger88/5.png", att: 3, mid: 3, def: 3 },
  "LAFC":                    { primary: "#000000", secondary: "#C39E6D", kit: "ger88/5.png", att: 4, mid: 4, def: 3 },
  "FC Cincinnati":           { primary: "#003087", secondary: "#FE5000", kit: "swe92/2.png", att: 4, mid: 4, def: 3 },
  "Inter Miami":             { primary: "#F7B5CD", secondary: "#231F20", kit: "fra84/4.png", att: 5, mid: 4, def: 3 },
  "Nashville SC":            { primary: "#ECE83A", secondary: "#1F1646", kit: "mex86/3.png", att: 3, mid: 3, def: 3 },
  "Austin FC":               { primary: "#00B140", secondary: "#000000", kit: "swe92/1.png", att: 3, mid: 3, def: 3 },
  "Charlotte FC":            { primary: "#1A85C8", secondary: "#000000", kit: "ger88/3.png", att: 3, mid: 3, def: 3 },
  "St. Louis City SC":       { primary: "#DD004A", secondary: "#00153C", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "San Diego FC":            { primary: "#002B49", secondary: "#00B2A9", kit: "swe92/0.png", att: 3, mid: 3, def: 3 }
};

// ============================================================================
// 3. OTHER CONCACAF NATIONS' CLUB METADATA
// ============================================================================
const CONCACAF_GUEST_CLUBS = {
  "Saprissa":        { primary: "#7A003C", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Alajuelense":     { primary: "#E31B23", secondary: "#000000", kit: "fra84/1.png", att: 3, mid: 3, def: 3 },
  "Herediano":       { primary: "#FEDD00", secondary: "#E31B23", kit: "ger88/4.png", att: 3, mid: 3, def: 3 },
  "CD Olimpia":      { primary: "#FFFFFF", secondary: "#002F6C", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Motagua":         { primary: "#003B71", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 2, def: 2 },
  "Real Espana":     { primary: "#FEDD00", secondary: "#000000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Marathon":        { primary: "#008542", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Comunicaciones":  { primary: "#FFFFFF", secondary: "#0033A0", kit: "swe92/0.png", att: 3, mid: 2, def: 2 },
  "CSD Municipal":   { primary: "#C8102E", secondary: "#0033A0", kit: "ger88/3.png", att: 3, mid: 2, def: 2 },
  "Antigua GFC":     { primary: "#008542", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "CD FAS":          { primary: "#E31B23", secondary: "#0033A0", kit: "ger88/3.png", att: 2, mid: 2, def: 2 },
  "Alianza FC":      { primary: "#FFFFFF", secondary: "#002B5C", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Isidro Metapan":  { primary: "#FFFFFF", secondary: "#0033A0", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Tauro":           { primary: "#000000", secondary: "#FFFFFF", kit: "swe92/4.png", att: 2, mid: 2, def: 2 },
  "Arabe Unido":     { primary: "#005BAC", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Defence Force":   { primary: "#FFDC00", secondary: "#E31B23", kit: "ger88/4.png", att: 2, mid: 2, def: 2 },
  "W Connection":    { primary: "#008542", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Harbour View":    { primary: "#FFD100", secondary: "#0033A0", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Cavalier FC":     { primary: "#FFFFFF", secondary: "#000000", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Violette":        { primary: "#0033A0", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Cibao FC":        { primary: "#FF6B00", secondary: "#000000", kit: "ecu93/1.png", att: 2, mid: 2, def: 2 },
  "Forge FC":        { primary: "#FF6B00", secondary: "#4D4D4F", kit: "ecu93/1.png", att: 2, mid: 3, def: 2 },
  "Cavalry FC":      { primary: "#006847", secondary: "#C8102E", kit: "swe92/1.png", att: 2, mid: 2, def: 2 }
};

const ALL_NA_CLUBS = { ...MEX_CLUBS, ...USA_CLUBS, ...CONCACAF_GUEST_CLUBS };

// ============================================================================
// 4. MEXICO LIGA MX SEASONS (1989/90 - 2026/27)
// ============================================================================
const MEX_1989 = ["Puebla", "UdeG", "Pumas UNAM", "Club America", "Tigres UANL", "Morelia", "Necaxa", "Monterrey", "Cruz Azul", "Toluca", "Chivas Guadalajara", "Cobras", "Tecos UAG", "Santos Laguna", "Irapuato", "Veracruz", "Correcaminos", "Atlas", "Atlante", "Tampico Madero"];
const MEX_1990 = ["Pumas UNAM", "Club America", "Monterrey", "Cruz Azul", "Chivas Guadalajara", "Puebla", "UdeG", "Tigres UANL", "Correcaminos", "Necaxa", "Atlas", "Toluca", "Cobras", "Morelia", "Veracruz", "Santos Laguna", "Tecos UAG", "Queretaro", "Irapuato", "Leon"];
const MEX_1991 = ["Leon", "Puebla", "Cruz Azul", "Club America", "Pumas UNAM", "Chivas Guadalajara", "Atlante", "Necaxa", "Monterrey", "Correcaminos", "Atlas", "Tigres UANL", "Veracruz", "Tecos UAG", "Toluca", "Santos Laguna", "Morelia", "Queretaro", "UdeG", "Cobras"];
const MEX_1992 = ["Atlante", "Monterrey", "Leon", "Necaxa", "Pumas UNAM", "Club America", "Cruz Azul", "Tigres UANL", "Tecos UAG", "Morelia", "Chivas Guadalajara", "Toluca", "Puebla", "Veracruz", "Correcaminos", "UdeG", "Santos Laguna", "Atlas", "Queretaro", "Pachuca"];
const MEX_1993 = ["Tecos UAG", "Santos Laguna", "Club America", "Cruz Azul", "Toluca", "Necaxa", "Pumas UNAM", "Morelia", "Atlante", "Chivas Guadalajara", "Atlas", "Monterrey", "Puebla", "Leon", "Veracruz", "Toros Neza", "Tigres UANL", "UdeG", "Correcaminos", "Queretaro"];
const MEX_1994 = ["Necaxa", "Cruz Azul", "Club America", "Chivas Guadalajara", "Tecos UAG", "Puebla", "Santos Laguna", "Monterrey", "Pumas UNAM", "Atlas", "Veracruz", "Morelia", "Leon", "Atlante", "Toros Neza", "Toluca", "Tigres UANL", "Correcaminos", "Tampico Madero"];
const MEX_1995 = ["Necaxa", "Celaya", "Cruz Azul", "Club America", "Tigres UANL", "Veracruz", "Atlas", "Leon", "Monterrey", "Pumas UNAM", "Chivas Guadalajara", "Tecos UAG", "Morelia", "Atlante", "Toluca", "Puebla", "Toros Neza", "Santos Laguna"];
const MEX_1996 = ["Santos Laguna", "Necaxa", "Chivas Guadalajara", "Toros Neza", "Atlante", "Club America", "Cruz Azul", "Toluca", "Monterrey", "Pumas UNAM", "Atlas", "Puebla", "Morelia", "Tecos UAG", "Leon", "Celaya", "Veracruz", "Pachuca"];
const MEX_1997 = ["Cruz Azul", "Toluca", "Chivas Guadalajara", "Leon", "Club America", "Necaxa", "Atlante", "Atlas", "Morelia", "Monterrey", "Santos Laguna", "Pumas UNAM", "Tigres UANL", "Tecos UAG", "Toros Neza", "Celaya", "Puebla", "Veracruz"];
const MEX_1998 = ["Necaxa", "Toluca", "Atlas", "Cruz Azul", "Chivas Guadalajara", "Club America", "Pumas UNAM", "Santos Laguna", "Tigres UANL", "Tecos UAG", "Morelia", "Monterrey", "Atlante", "Leon", "Celaya", "Toros Neza", "Pachuca", "Puebla"];
const MEX_1999 = ["Toluca", "Pachuca", "Santos Laguna", "Cruz Azul", "Atlas", "Chivas Guadalajara", "Club America", "Necaxa", "Morelia", "Pumas UNAM", "Tigres UANL", "Tecos UAG", "Monterrey", "Atlante", "Leon", "Celaya", "Puebla", "Toros Neza"];
const MEX_2000 = ["Morelia", "Santos Laguna", "Toluca", "Pachuca", "Cruz Azul", "Club America", "Necaxa", "Tigres UANL", "Atlas", "Chivas Guadalajara", "Pumas UNAM", "Monterrey", "Tecos UAG", "Atlante", "Celaya", "Puebla", "Leon", "Irapuato"];
const MEX_2001 = ["Pachuca", "Club America", "Toluca", "Santos Laguna", "Necaxa", "Tigres UANL", "Cruz Azul", "Atlas", "Pumas UNAM", "Chivas Guadalajara", "Morelia", "Monterrey", "Tecos UAG", "Atlante", "Puebla", "Celaya", "Veracruz", "Leon"];
const MEX_2002 = ["Toluca", "Monterrey", "Morelia", "Club America", "Cruz Azul", "Pumas UNAM", "Chivas Guadalajara", "Tigres UANL", "Atlante", "Pachuca", "Santos Laguna", "Atlas", "Necaxa", "Tecos UAG", "Puebla", "Veracruz", "San Luis", "Jaguares Chiapas", "Queretaro"];
const MEX_2003 = ["Pachuca", "Pumas UNAM", "Chivas Guadalajara", "Toluca", "Club America", "Tigres UANL", "Cruz Azul", "Santos Laguna", "Morelia", "Atlante", "Atlas", "Necaxa", "Monterrey", "Tecos UAG", "Jaguares Chiapas", "Veracruz", "Puebla", "San Luis", "Queretaro", "Irapuato"];
const MEX_2004 = ["Pumas UNAM", "Club America", "Cruz Azul", "Pachuca", "Monterrey", "Morelia", "Chivas Guadalajara", "Toluca", "Santos Laguna", "Tigres UANL", "Atlante", "Necaxa", "Atlas", "Tecos UAG", "Jaguares Chiapas", "Veracruz", "Puebla", "Dorados de Sinaloa"];
const MEX_2005 = ["Toluca", "Pachuca", "Monterrey", "Club America", "Cruz Azul", "Chivas Guadalajara", "Pumas UNAM", "San Luis", "Atlante", "Necaxa", "Morelia", "Tigres UANL", "Jaguares Chiapas", "Santos Laguna", "Atlas", "Tecos UAG", "Veracruz", "Dorados de Sinaloa"];
const MEX_2006 = ["Chivas Guadalajara", "Pachuca", "Club America", "Cruz Azul", "Toluca", "Monterrey", "Pumas UNAM", "Tigres UANL", "Santos Laguna", "Atlas", "Morelia", "Jaguares Chiapas", "Atlante", "San Luis", "Necaxa", "Tecos UAG", "Veracruz", "Queretaro"];
const MEX_2007 = ["Atlante", "Santos Laguna", "Pumas UNAM", "Cruz Azul", "Club America", "Chivas Guadalajara", "Toluca", "Pachuca", "Monterrey", "Morelia", "San Luis", "Tigres UANL", "Atlas", "Necaxa", "Jaguares Chiapas", "Tecos UAG", "Puebla", "Veracruz"];
const MEX_2008 = ["Toluca", "Pumas UNAM", "Cruz Azul", "Pachuca", "Monterrey", "Chivas Guadalajara", "Club America", "Santos Laguna", "Morelia", "San Luis", "Atlante", "Atlas", "Tigres UANL", "Puebla", "Jaguares Chiapas", "Tecos UAG", "Necaxa", "Indios"];
const MEX_2009 = ["Monterrey", "Toluca", "Cruz Azul", "Santos Laguna", "Club America", "Chivas Guadalajara", "Pumas UNAM", "Morelia", "Pachuca", "Atlante", "Tigres UANL", "San Luis", "Puebla", "Atlas", "Jaguares Chiapas", "Tecos UAG", "Queretaro", "Indios"];
const MEX_2010 = ["Monterrey", "Pumas UNAM", "Cruz Azul", "Tigres UANL", "Santos Laguna", "Morelia", "Club America", "Chivas Guadalajara", "Toluca", "Pachuca", "San Luis", "Atlante", "Jaguares Chiapas", "Atlas", "Puebla", "Queretaro", "Tecos UAG", "Necaxa"];
const MEX_2011 = ["Tigres UANL", "Santos Laguna", "Monterrey", "Cruz Azul", "Morelia", "Club America", "Chivas Guadalajara", "Pumas UNAM", "Pachuca", "Toluca", "Tijuana", "Queretaro", "Atlante", "Puebla", "Jaguares Chiapas", "Atlas", "San Luis", "Tecos UAG"];
const MEX_2012 = ["Tijuana", "Club America", "Cruz Azul", "Toluca", "Monterrey", "Tigres UANL", "Santos Laguna", "Morelia", "Leon", "Chivas Guadalajara", "Pumas UNAM", "Pachuca", "Atlas", "Atlante", "Jaguares Chiapas", "Puebla", "Queretaro", "San Luis"];
const MEX_2013 = ["Leon", "Club America", "Cruz Azul", "Toluca", "Santos Laguna", "Pachuca", "Pumas UNAM", "Monterrey", "Tigres UANL", "Morelia", "Tijuana", "Chivas Guadalajara", "Queretaro", "Atlas", "Puebla", "Jaguares Chiapas", "Veracruz", "Atlante"];
const MEX_2014 = ["Club America", "Santos Laguna", "Tigres UANL", "Monterrey", "Toluca", "Cruz Azul", "Queretaro", "Atlas", "Pachuca", "Chivas Guadalajara", "Veracruz", "Tijuana", "Leon", "Pumas UNAM", "Morelia", "Puebla", "Jaguares Chiapas", "UdeG"];
const MEX_2015 = ["Tigres UANL", "Pachuca", "Monterrey", "Club America", "Pumas UNAM", "Leon", "Toluca", "Chivas Guadalajara", "Santos Laguna", "Morelia", "Cruz Azul", "Puebla", "Jaguares Chiapas", "Queretaro", "Tijuana", "Veracruz", "Atlas", "Dorados de Sinaloa"];
const MEX_2016 = ["Tigres UANL", "Chivas Guadalajara", "Monterrey", "Club America", "Tijuana", "Toluca", "Pachuca", "Necaxa", "Santos Laguna", "Leon", "Morelia", "Atlas", "Pumas UNAM", "Cruz Azul", "Queretaro", "Puebla", "Veracruz", "Jaguares Chiapas"];
const MEX_2017 = ["Tigres UANL", "Santos Laguna", "Monterrey", "Toluca", "Club America", "Tijuana", "Morelia", "Cruz Azul", "Pachuca", "Pumas UNAM", "Chivas Guadalajara", "Leon", "Necaxa", "Atlas", "Puebla", "Queretaro", "Veracruz", "Lobos BUAP"];
const MEX_2018 = ["Club America", "Tigres UANL", "Monterrey", "Cruz Azul", "Leon", "Santos Laguna", "Pachuca", "Toluca", "Tijuana", "Pumas UNAM", "Chivas Guadalajara", "Necaxa", "Puebla", "Morelia", "Queretaro", "Atlas", "Veracruz", "Lobos BUAP"];
const MEX_2019 = ["Monterrey", "Club America", "Cruz Azul", "Leon", "Santos Laguna", "Tigres UANL", "Pumas UNAM", "Chivas Guadalajara", "Morelia", "Necaxa", "Pachuca", "Toluca", "Queretaro", "Tijuana", "Puebla", "Atlas", "Atletico San Luis", "FC Juarez", "Veracruz"];
const MEX_2020 = ["Leon", "Cruz Azul", "Club America", "Pumas UNAM", "Monterrey", "Tigres UANL", "Santos Laguna", "Pachuca", "Chivas Guadalajara", "Toluca", "Atlas", "Puebla", "Necaxa", "Tijuana", "Queretaro", "Mazatlan", "Atletico San Luis", "FC Juarez"];
const MEX_2021 = ["Atlas", "Pachuca", "Tigres UANL", "Club America", "Cruz Azul", "Monterrey", "Puebla", "Chivas Guadalajara", "Toluca", "Santos Laguna", "Leon", "Pumas UNAM", "Atletico San Luis", "Necaxa", "Mazatlan", "Tijuana", "Queretaro", "FC Juarez"];
const MEX_2022 = ["Pachuca", "Tigres UANL", "Monterrey", "Club America", "Toluca", "Chivas Guadalajara", "Cruz Azul", "Leon", "Santos Laguna", "Atlas", "Puebla", "Atletico San Luis", "Pumas UNAM", "Necaxa", "Tijuana", "FC Juarez", "Queretaro", "Mazatlan"];
const MEX_2023 = ["Club America", "Cruz Azul", "Monterrey", "Tigres UANL", "Toluca", "Chivas Guadalajara", "Pachuca", "Pumas UNAM", "Atletico San Luis", "Leon", "Necaxa", "Puebla", "Santos Laguna", "Queretaro", "Atlas", "FC Juarez", "Mazatlan", "Tijuana"];
const MEX_2024 = ["Club America", "Toluca", "Cruz Azul", "Monterrey", "Tigres UANL", "Pumas UNAM", "Atletico San Luis", "Tijuana", "Chivas Guadalajara", "Atlas", "Leon", "Necaxa", "Pachuca", "FC Juarez", "Puebla", "Mazatlan", "Queretaro", "Santos Laguna"];
const MEX_2025 = ["Toluca", "Club America", "Cruz Azul", "Tigres UANL", "Monterrey", "Leon", "Pachuca", "Necaxa", "Chivas Guadalajara", "Pumas UNAM", "Atletico San Luis", "FC Juarez", "Tijuana", "Atlas", "Puebla", "Mazatlan", "Queretaro", "Santos Laguna"];

const MEX_SEASONS = {
  "1989": MEX_1989, "1990": MEX_1990, "1991": MEX_1991, "1992": MEX_1992,
  "1993": MEX_1993, "1994": MEX_1994, "1995": MEX_1995, "1996": MEX_1996,
  "1997": MEX_1997, "1998": MEX_1998, "1999": MEX_1999, "2000": MEX_2000,
  "2001": MEX_2001, "2002": MEX_2002, "2003": MEX_2003, "2004": MEX_2004,
  "2005": MEX_2005, "2006": MEX_2006, "2007": MEX_2007, "2008": MEX_2008,
  "2009": MEX_2009, "2010": MEX_2010, "2011": MEX_2011, "2012": MEX_2012,
  "2013": MEX_2013, "2014": MEX_2014, "2015": MEX_2015, "2016": MEX_2016,
  "2017": MEX_2017, "2018": MEX_2018, "2019": MEX_2019, "2020": MEX_2020,
  "2021": MEX_2021, "2022": MEX_2022, "2023": MEX_2023, "2024": MEX_2024,
  "2025": MEX_2025, "2026": MEX_2025
};

// ============================================================================
// 5. USA MLS SEASONS (1996-2026) - Authentic Expansion Timeline
// ============================================================================
const USA_1996 = ["D.C. United", "LA Galaxy", "Tampa Bay Mutiny", "Dallas Burn", "Kansas City Wizards", "NY/NJ MetroStars", "Columbus Crew", "New England Revolution", "San Jose Clash", "Colorado Rapids"];
const USA_1998 = ["Chicago Fire", "D.C. United", "LA Galaxy", "Columbus Crew", "Colorado Rapids", "Dallas Burn", "Kansas City Wizards", "NY/NJ MetroStars", "Miami Fusion", "San Jose Clash", "Tampa Bay Mutiny", "New England Revolution"];
const USA_2002 = ["LA Galaxy", "New England Revolution", "San Jose Earthquakes", "Dallas Burn", "Columbus Crew", "Colorado Rapids", "Chicago Fire", "Kansas City Wizards", "NY/NJ MetroStars", "D.C. United"];
const USA_2005 = ["LA Galaxy", "New England Revolution", "San Jose Earthquakes", "Chicago Fire", "FC Dallas", "Colorado Rapids", "D.C. United", "NY/NJ MetroStars", "Kansas City Wizards", "Columbus Crew", "Chivas USA", "Real Salt Lake"];
const USA_2006 = ["Houston Dynamo", "New England Revolution", "D.C. United", "FC Dallas", "Chicago Fire", "Colorado Rapids", "Chivas USA", "Kansas City Wizards", "LA Galaxy", "New York Red Bulls", "Columbus Crew", "Real Salt Lake"];
const USA_2007 = ["Houston Dynamo", "D.C. United", "New England Revolution", "Chivas USA", "FC Dallas", "Chicago Fire", "New York Red Bulls", "Kansas City Wizards", "LA Galaxy", "Columbus Crew", "Colorado Rapids", "Real Salt Lake", "Toronto FC"];
const USA_2008 = ["Columbus Crew", "Houston Dynamo", "Chicago Fire", "New York Red Bulls", "Real Salt Lake", "New England Revolution", "Chivas USA", "D.C. United", "Kansas City Wizards", "FC Dallas", "Colorado Rapids", "LA Galaxy", "Toronto FC", "San Jose Earthquakes"];
const USA_2009 = ["Columbus Crew", "LA Galaxy", "Real Salt Lake", "Houston Dynamo", "Chicago Fire", "Seattle Sounders", "Chivas USA", "New England Revolution", "D.C. United", "FC Dallas", "Colorado Rapids", "Toronto FC", "Kansas City Wizards", "San Jose Earthquakes", "New York Red Bulls"];
const USA_2010 = ["LA Galaxy", "Colorado Rapids", "FC Dallas", "Real Salt Lake", "New York Red Bulls", "Columbus Crew", "Seattle Sounders", "San Jose Earthquakes", "Kansas City Wizards", "Chicago Fire", "Toronto FC", "Houston Dynamo", "New England Revolution", "Philadelphia Union", "Chivas USA", "D.C. United"];
const USA_2011 = ["LA Galaxy", "Seattle Sounders", "Real Salt Lake", "FC Dallas", "Sporting Kansas City", "Houston Dynamo", "Colorado Rapids", "Columbus Crew", "Philadelphia Union", "New York Red Bulls", "Chicago Fire", "Portland Timbers", "Chivas USA", "D.C. United", "San Jose Earthquakes", "Toronto FC", "New England Revolution", "Vancouver Whitecaps"];
const USA_2012 = ["San Jose Earthquakes", "LA Galaxy", "Sporting Kansas City", "D.C. United", "Seattle Sounders", "New York Red Bulls", "Real Salt Lake", "Chicago Fire", "Houston Dynamo", "Columbus Crew", "Vancouver Whitecaps", "Montreal Impact", "Colorado Rapids", "FC Dallas", "New England Revolution", "Philadelphia Union", "Portland Timbers", "Chivas USA", "Toronto FC"];
const USA_2015 = ["New York Red Bulls", "Portland Timbers", "FC Dallas", "Columbus Crew", "Vancouver Whitecaps", "LA Galaxy", "Seattle Sounders", "D.C. United", "Sporting Kansas City", "Montreal Impact", "Toronto FC", "New England Revolution", "San Jose Earthquakes", "Orlando City", "Houston Dynamo", "New York City FC", "Real Salt Lake", "Philadelphia Union", "Colorado Rapids", "Chicago Fire"];
const USA_2017 = ["Toronto FC", "Seattle Sounders", "New York City FC", "Atlanta United", "Chicago Fire", "Columbus Crew", "Portland Timbers", "Sporting Kansas City", "New York Red Bulls", "Houston Dynamo", "Vancouver Whitecaps", "San Jose Earthquakes", "FC Dallas", "Real Salt Lake", "New England Revolution", "Montreal Impact", "Philadelphia Union", "Orlando City", "Minnesota United", "Colorado Rapids", "D.C. United", "LA Galaxy"];
const USA_2018 = ["Atlanta United", "New York Red Bulls", "LAFC", "Seattle Sounders", "Sporting Kansas City", "Portland Timbers", "Columbus Crew", "FC Dallas", "New York City FC", "D.C. United", "Philadelphia Union", "Real Salt Lake", "LA Galaxy", "Montreal Impact", "Vancouver Whitecaps", "New England Revolution", "Houston Dynamo", "Minnesota United", "Toronto FC", "Chicago Fire", "Colorado Rapids", "Orlando City", "San Jose Earthquakes"];
const USA_2019 = ["LAFC", "Seattle Sounders", "Toronto FC", "Atlanta United", "New York City FC", "Philadelphia Union", "Minnesota United", "New York Red Bulls", "D.C. United", "Real Salt Lake", "LA Galaxy", "Portland Timbers", "FC Dallas", "San Jose Earthquakes", "New England Revolution", "Colorado Rapids", "Chicago Fire", "Montreal Impact", "Columbus Crew", "Houston Dynamo", "Sporting Kansas City", "Orlando City", "Vancouver Whitecaps", "FC Cincinnati"];
const USA_2020 = ["Columbus Crew", "Seattle Sounders", "Philadelphia Union", "Toronto FC", "Sporting Kansas City", "Portland Timbers", "Minnesota United", "Orlando City", "New York City FC", "New England Revolution", "FC Dallas", "New York Red Bulls", "LAFC", "Nashville SC", "Colorado Rapids", "San Jose Earthquakes", "Montreal Impact", "Inter Miami", "LA Galaxy", "Real Salt Lake", "Atlanta United", "Chicago Fire", "D.C. United", "Houston Dynamo", "Vancouver Whitecaps", "FC Cincinnati"];
const USA_2021 = ["New England Revolution", "New York City FC", "Colorado Rapids", "Seattle Sounders", "Sporting Kansas City", "Philadelphia Union", "Portland Timbers", "Nashville SC", "Atlanta United", "Orlando City", "Minnesota United", "Vancouver Whitecaps", "Real Salt Lake", "New York Red Bulls", "LA Galaxy", "D.C. United", "Columbus Crew", "CF Montreal", "LAFC", "Inter Miami", "San Jose Earthquakes", "Chicago Fire", "FC Dallas", "Austin FC", "Houston Dynamo", "Toronto FC", "FC Cincinnati"];
const USA_2022 = ["LAFC", "Philadelphia Union", "CF Montreal", "Austin FC", "New York City FC", "New York Red Bulls", "FC Dallas", "FC Cincinnati", "LA Galaxy", "Nashville SC", "Minnesota United", "Inter Miami", "Orlando City", "Real Salt Lake", "Portland Timbers", "Columbus Crew", "Vancouver Whitecaps", "Colorado Rapids", "Charlotte FC", "New England Revolution", "Seattle Sounders", "Sporting Kansas City", "Atlanta United", "Chicago Fire", "Houston Dynamo", "San Jose Earthquakes", "Toronto FC", "D.C. United"];
const USA_2023 = ["Columbus Crew", "FC Cincinnati", "Orlando City", "LAFC", "St. Louis City SC", "Seattle Sounders", "Philadelphia Union", "New England Revolution", "Houston Dynamo", "Atlanta United", "Nashville SC", "Real Salt Lake", "Vancouver Whitecaps", "New York Red Bulls", "FC Dallas", "Sporting Kansas City", "San Jose Earthquakes", "Charlotte FC", "Portland Timbers", "CF Montreal", "D.C. United", "New York City FC", "Minnesota United", "Chicago Fire", "Austin FC", "LA Galaxy", "Inter Miami", "Colorado Rapids", "Toronto FC"];
const USA_2024 = ["LA Galaxy", "Inter Miami", "Columbus Crew", "LAFC", "FC Cincinnati", "Seattle Sounders", "Orlando City", "New York Red Bulls", "Real Salt Lake", "New York City FC", "Houston Dynamo", "Minnesota United", "Charlotte FC", "Colorado Rapids", "Vancouver Whitecaps", "Portland Timbers", "Atlanta United", "CF Montreal", "Austin FC", "FC Dallas", "D.C. United", "Toronto FC", "St. Louis City SC", "Philadelphia Union", "Nashville SC", "New England Revolution", "Sporting Kansas City", "Chicago Fire", "San Jose Earthquakes"];
const USA_2025 = ["Inter Miami", "LAFC", "Columbus Crew", "Seattle Sounders", "FC Cincinnati", "LA Galaxy", "Orlando City", "Minnesota United", "Vancouver Whitecaps", "Charlotte FC", "New York City FC", "New York Red Bulls", "Real Salt Lake", "Houston Dynamo", "Colorado Rapids", "Portland Timbers", "Philadelphia Union", "San Diego FC", "Austin FC", "FC Dallas", "Atlanta United", "Chicago Fire", "CF Montreal", "D.C. United", "Nashville SC", "New England Revolution", "Sporting Kansas City", "St. Louis City SC", "Toronto FC", "San Jose Earthquakes"];

const USA_SEASONS = {
  "1996": USA_1996, "1997": USA_1996,
  "1998": USA_1998, "1999": USA_1998, "2000": USA_1998, "2001": USA_1998,
  "2002": USA_2002, "2003": USA_2002, "2004": USA_2002,
  "2005": USA_2005, "2006": USA_2006, "2007": USA_2007, "2008": USA_2008,
  "2009": USA_2009, "2010": USA_2010, "2011": USA_2011,
  "2012": USA_2012, "2013": USA_2012, "2014": USA_2012,
  "2015": USA_2015, "2016": USA_2015,
  "2017": USA_2017, "2018": USA_2018, "2019": USA_2019,
  "2020": USA_2020, "2021": USA_2021, "2022": USA_2022,
  "2023": USA_2023, "2024": USA_2024, "2025": USA_2025, "2026": USA_2025
};

// ============================================================================
// 6. HELPERS & SEASON FILE GENERATION
// ============================================================================
function getPowerRating(name) {
  const m = ALL_NA_CLUBS[name] || { att: 3, mid: 3, def: 3 };
  return (m.att + m.mid + m.def) / 3;
}

function buildTeamObj(name, idnum, compId) {
  const m = ALL_NA_CLUBS[name] || { primary: "#0033A0", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 };
  return {
    idnum,
    id: compId,
    name,
    attack: m.att,
    midfield: m.mid,
    defense: m.def,
    kit: m.kit,
    primaryColor: m.primary,
    secondaryColor: m.secondary
  };
}

// Generate Mexico Liga MX (mex89 - mex26)
for (let yr = 1989; yr <= 2026; yr++) {
  const yy = String(yr).slice(-2);
  const compId = `mex${yy}`;
  const teams = MEX_SEASONS[String(yr)].map((name, idx) => buildTeamObj(name, idx, compId));
  fs.writeFileSync(path.join(MEX_DIR, `${compId}.json`), JSON.stringify(teams, null, 2), 'utf8');
}

// Generate USA MLS (usa96 - usa26)
for (let yr = 1996; yr <= 2026; yr++) {
  const yy = String(yr).slice(-2);
  const compId = `usa${yy}`;
  const teams = USA_SEASONS[String(yr)].map((name, idx) => buildTeamObj(name, idx, compId));
  fs.writeFileSync(path.join(USA_DIR, `${compId}.json`), JSON.stringify(teams, null, 2), 'utf8');
}

// ============================================================================
// 7. CONCACAF CHAMPIONS CUP (1989-2026) & QUALIFIERS
// - 1989-2007: 16-team pure_knockout
// - 2008-2017: 16-team group_then_knockout (4 groups of 4 -> QF -> SF -> Final)
// - 2018-2026: 16-team pure_knockout
// ============================================================================
const CENTRAL_AMERICAN_ROTATION = [
  "Saprissa", "CD Olimpia", "Alajuelense", "Comunicaciones", "CSD Municipal",
  "Herediano", "Motagua", "CD FAS", "Tauro", "Real Espana", "Alianza FC",
  "Arabe Unido", "Isidro Metapan", "Marathon", "Antigua GFC"
];
const CARIBBEAN_CANADIAN_ROTATION = [
  "Defence Force", "W Connection", "Harbour View", "Violette", "Cibao FC", "Cavalier FC", "Forge FC", "Cavalry FC"
];

function getHistoricalConcacafParticipants(yr) {
  const mexTeams = MEX_SEASONS[String(yr)] || MEX_1998;
  const usaTeams = yr >= 1996 ? (USA_SEASONS[String(yr)] || USA_2005) : [];

  let mexCount = 2;
  let usaCount = 0;
  if (yr >= 1996 && yr <= 2007) {
    mexCount = 3;
    usaCount = 2;
  } else if (yr >= 2008 && yr <= 2017) {
    mexCount = 4;
    usaCount = 4;
  } else if (yr >= 2018) {
    mexCount = 4;
    usaCount = 4;
  }

  const mexSpots = mexTeams.slice(0, mexCount);
  const usaSpots = usaTeams.slice(0, usaCount);

  const chosen = [...mexSpots, ...usaSpots];
  const chosenSet = new Set(chosen);

  // Fill remaining spots to 16 with authentic Central American, Caribbean, and Canadian clubs
  let idxCA = (yr - 1989) % CENTRAL_AMERICAN_ROTATION.length;
  let idxCar = (yr - 1989) % CARIBBEAN_CANADIAN_ROTATION.length;
  let takeCar = false;
  while (chosen.length < 16) {
    const pool = takeCar ? CARIBBEAN_CANADIAN_ROTATION : CENTRAL_AMERICAN_ROTATION;
    const candidate = takeCar
      ? pool[idxCar++ % pool.length]
      : pool[idxCA++ % pool.length];
    if (!chosenSet.has(candidate)) {
      chosen.push(candidate);
      chosenSet.add(candidate);
    }
    takeCar = chosen.length >= 13; // ~3 Caribbean/Canadian spots, rest Central America
  }

  return { mexSpots, usaSpots, all16: chosen };
}

const qualifiersNA = {};
const concacafRulesLines = [];
const concacafImports = [];

for (let yr = 1989; yr <= 2026; yr++) {
  const yy = String(yr).slice(-2);
  const compId = `concacaf${yy}`;
  const isGroupEra = yr >= 2008 && yr <= 2017;
  const { mexSpots, usaSpots, all16 } = getHistoricalConcacafParticipants(yr);

  qualifiersNA[String(yr)] = {
    cl: {
      mexico: mexSpots,
      ...(yr >= 1996 ? { usa: usaSpots } : {})
    },
    uefa: {
      mexico: [],
      ...(yr >= 1996 ? { usa: [] } : {})
    }
  };

  let cupTeams;
  if (isGroupEra) {
    // Distribute 4 groups of 4 balanced by strength across pots A-D
    const sorted = [...all16].sort((a, b) => getPowerRating(b) - getPowerRating(a));
    const groups = ["A", "B", "C", "D"];
    cupTeams = [];
    for (let pot = 0; pot < 4; pot++) {
      for (let gIdx = 0; gIdx < 4; gIdx++) {
        const orderIdx = pot % 2 === 0 ? (pot * 4 + gIdx) : (pot * 4 + (3 - gIdx));
        const name = sorted[orderIdx];
        const base = buildTeamObj(name, cupTeams.length, compId);
        cupTeams.push({ ...base, group: groups[gIdx] });
      }
    }
  } else {
    cupTeams = all16.map((name, idx) => buildTeamObj(name, idx, compId));
  }

  fs.writeFileSync(path.join(CONCACAF_DIR, `${compId}.json`), JSON.stringify(cupTeams, null, 2), 'utf8');
  concacafImports.push(`import ${compId}Data from './${compId}.json';`);

  if (isGroupEra) {
    concacafRulesLines.push(`  "${yr}": {
    teamsData: ${compId}Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  }`);
  } else {
    concacafRulesLines.push(`  "${yr}": {
    teamsData: ${compId}Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  }`);
  }
}

// Write src/data/concacaf/concacafRules.js
const concacafRulesSource = `${concacafImports.join('\n')}

const pureKnockoutSchedule = [
  { offset: 4,  stage: "round_of_16",    matchday: 1 },
  { offset: 7,  stage: "round_of_16",    matchday: 2 },
  { offset: 12, stage: "quarter_finals", matchday: 1 },
  { offset: 15, stage: "quarter_finals", matchday: 2 },
  { offset: 20, stage: "semi_finals",    matchday: 1 },
  { offset: 23, stage: "semi_finals",    matchday: 2 },
  { offset: 27, stage: "final",          matchday: 1 }
];

const groupThenKnockoutSchedule = [
  { offset: 2,  stage: "group_stage",    matchday: 1 },
  { offset: 5,  stage: "group_stage",    matchday: 2 },
  { offset: 8,  stage: "group_stage",    matchday: 3 },
  { offset: 11, stage: "group_stage",    matchday: 4 },
  { offset: 14, stage: "group_stage",    matchday: 5 },
  { offset: 17, stage: "group_stage",    matchday: 6 },
  { offset: 21, stage: "quarter_finals", matchday: 1 },
  { offset: 24, stage: "quarter_finals", matchday: 2 },
  { offset: 27, stage: "semi_finals",    matchday: 1 },
  { offset: 30, stage: "semi_finals",    matchday: 2 },
  { offset: 33, stage: "final",          matchday: 1 }
];

export const concacafRules = {
${concacafRulesLines.join(',\n')}
};
`;
fs.writeFileSync(path.join(CONCACAF_DIR, 'concacafRules.js'), concacafRulesSource, 'utf8');

// Write src/data/qualifiersBySeasonNA.js
const qualNAFile = `// North American continental qualifiers by season (1989-2026)
// Defines domestic spots for CONCACAF Champions Cup / Champions League (cl)
export const qualifiersBySeasonNA = ${JSON.stringify(qualifiersNA, null, 2)};
`;
fs.writeFileSync(path.join(ROOT_DIR, 'src', 'data', 'qualifiersBySeasonNA.js'), qualNAFile, 'utf8');

// Write src/data/leagueDataNA.js
const mexImports = [];
const usaImports = [];
const naMapLines = [];
for (let yr = 1989; yr <= 2026; yr++) {
  const yy = String(yr).slice(-2);
  mexImports.push(`import mex${yy}Data from './leagues/mex/mex${yy}.json';`);
  if (yr >= 1996) {
    usaImports.push(`import usa${yy}Data from './leagues/usa/usa${yy}.json';`);
    naMapLines.push(`  "${yr}": { mexico: mex${yy}Data, usa: usa${yy}Data }`);
  } else {
    naMapLines.push(`  "${yr}": { mexico: mex${yy}Data }`);
  }
}

const leagueDataNASource = `// North American league data imports (Mexico 1989-2026, USA MLS 1996-2026)
${mexImports.join('\n')}

${usaImports.join('\n')}

export const leagueDataMapNA = {
${naMapLines.join(',\n')}
};
`;
fs.writeFileSync(path.join(ROOT_DIR, 'src', 'data', 'leagueDataNA.js'), leagueDataNASource, 'utf8');

console.log('✅ Generated Mexico (1989-2026), USA MLS (1996-2026), CONCACAF Champions Cup (1989-2026), leagueDataNA.js, concacafRules.js, qualifiersBySeasonNA.js');
