/**
 * Historical League & European Cup Generator for Ex-Yugoslavia (1988-2026)
 * Generates:
 *  - src/data/leagues/yug/yug88.json ... yug91.json (SFR Yugoslavia First League, 1988-1991)
 *  - src/data/leagues/cro/cro91.json ... cro26.json (Prva HNL / HNL Croatia, 1991-2026)
 *  - src/data/leagues/fry/fry92.json ... fry05.json (First League of FR Yugoslavia / SCG, 1992-2005)
 *  - src/data/leagues/srb/srb06.json ... srb26.json (Serbian SuperLiga, 2006-2026)
 * Also exports historical qualifiers to merge into src/data/qualifiersBySeason.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const YUG_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'yug');
const CRO_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'cro');
const FRY_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'fry');
const SRB_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'srb');

[YUG_DIR, CRO_DIR, FRY_DIR, SRB_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

// ============================================================================
// 1. CLUB METADATA (Colors, Verified Kit Templates, Baseline Strength 1-5)
// ============================================================================
const CLUBS_META = {
  // Serbian / FR Yugoslav Giants & Regulars
  "Red Star Belgrade":       { primary: "#E30613", secondary: "#FFFFFF", kit: "cl90/5.png",  att: 5, mid: 5, def: 4 },
  "Partizan":                { primary: "#000000", secondary: "#FFFFFF", kit: "swe92/3.png", att: 5, mid: 4, def: 4 },
  "FK Vojvodina":            { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 4, mid: 4, def: 3 },
  "OFK Beograd":             { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/5.png", att: 3, mid: 3, def: 3 },
  "Rad":                     { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Radnicki Nis":            { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Spartak Subotica":        { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Napredak Krusevac":       { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 3, def: 2 },
  "Zemun":                   { primary: "#005EB8", secondary: "#00A651", kit: "swe92/5.png", att: 3, mid: 2, def: 2 },
  "Proleter Zrenjanin":      { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 2, def: 2 },
  "Obilic":                  { primary: "#FFD700", secondary: "#000080", kit: "mex86/3.png", att: 4, mid: 3, def: 3 },
  "Cukaricki":               { primary: "#000000", secondary: "#FFFFFF", kit: "swe92/3.png", att: 3, mid: 3, def: 3 },
  "Hajduk Kula":             { primary: "#FFFFFF", secondary: "#005EB8", kit: "swe92/0.png", att: 2, mid: 3, def: 2 },
  "Zeleznik":                { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 2 },
  "Sartid Smederevo":        { primary: "#003399", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Smederevo":               { primary: "#003399", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Vozdovac":                { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 2, def: 2 },
  "Borac Cacak":             { primary: "#D90429", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "Mladost Lucani":          { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 3, def: 2 },
  "Javor Ivanjica":          { primary: "#FFFFFF", secondary: "#005EB8", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Jagodina":                { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Sloboda Uzice":           { primary: "#D90429", secondary: "#000000", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Radnicki Kragujevac":     { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 2 },
  "Radnicki 1923":           { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 2 },
  "Novi Pazar":              { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 2, def: 2 },
  "TSC Backa Topola":        { primary: "#003399", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 3, def: 3 },
  "Radnik Surdulica":        { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Becej":                   { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 2, def: 2 },
  "OFK Kikinda":             { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Radnicki Beograd":        { primary: "#D90429", secondary: "#FFD700", kit: "ger88/4.png", att: 2, mid: 2, def: 2 },
  "Milicionar":              { primary: "#003399", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Pristina":                { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Loznica":                 { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Mladost Backi Jarak":     { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 1 },
  "Mladost Apatin":          { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Zvezdara":                { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 1 },
  "Radnicki Obrenovac":      { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Buducnost Banatski Dvor": { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Banat Zrenjanin":         { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Hajduk Beograd":          { primary: "#FFFFFF", secondary: "#005EB8", kit: "swe92/0.png", att: 2, mid: 2, def: 1 },
  "Buducnost Valjevo":       { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 1 },
  "Jastrebac Nis":           { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 1, mid: 2, def: 1 },
  "Bezanija":                { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "BSK Borca":               { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Mladi Radnik":            { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 1 },
  "Indjija":                 { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Metalac Gornji Milanovac":{ primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Donji Srem":              { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Backa Backa Palanka":     { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Macva Sabac":             { primary: "#D90429", secondary: "#000000", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Dinamo Vranje":           { primary: "#FFD700", secondary: "#000000", kit: "mex86/3.png", att: 2, mid: 2, def: 1 },
  "Proleter Novi Sad":       { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Zlatibor Cajetina":       { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 1 },
  "Kolubara":                { primary: "#008000", secondary: "#000000", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Mladost GAT":             { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "IMT Novi Beograd":        { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Zeleznicar Pancevo":      { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Jedinstvo Ub":            { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Tekstilac Odzaci":        { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },

  // Montenegrin / Bosnian / Macedonian / Slovenian (in SFRY / FRY)
  "Buducnost Podgorica":     { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Sutjeska Niksic":         { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Mogren":                  { primary: "#FFD700", secondary: "#005EB8", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Rudar Pljevlja":          { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Zeta":                    { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Kom":                     { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Sarajevo":                { primary: "#800020", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 3, def: 3 },
  "Zeljeznicar":             { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Velez Mostar":            { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 3 },
  "Sloboda Tuzla":           { primary: "#D90429", secondary: "#000000", kit: "ger88/1.png", att: 3, mid: 2, def: 2 },
  "Borac Banja Luka":        { primary: "#D90429", secondary: "#003399", kit: "swe92/2.png", att: 3, mid: 3, def: 3 },
  "Celik Zenica":            { primary: "#D90429", secondary: "#000000", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Vardar":                  { primary: "#D90429", secondary: "#000000", kit: "cl90/5.png",  att: 3, mid: 3, def: 2 },
  "Pelister Bitola":         { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Olimpija Ljubljana":      { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 3, mid: 3, def: 2 },

  // Croatian Clubs (Prva HNL / HNL)
  "Dinamo Zagreb":           { primary: "#0033A0", secondary: "#FFFFFF", kit: "swe92/0.png", att: 5, mid: 5, def: 4 },
  "Croatia Zagreb":          { primary: "#0033A0", secondary: "#FFFFFF", kit: "swe92/0.png", att: 5, mid: 4, def: 4 },
  "HASK Gradjanski":         { primary: "#0033A0", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 4, def: 4 },
  "Hajduk Split":            { primary: "#FFFFFF", secondary: "#0033A0", kit: "swe92/0.png", att: 4, mid: 4, def: 4 },
  "Rijeka":                  { primary: "#FFFFFF", secondary: "#005EB8", kit: "swe92/0.png", att: 4, mid: 4, def: 3 },
  "NK Osijek":               { primary: "#FFFFFF", secondary: "#0033A0", kit: "swe92/5.png", att: 3, mid: 3, def: 3 },
  "NK Zagreb":               { primary: "#FFFFFF", secondary: "#D90429", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Varteks":                 { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Varazdin":                { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Slaven Belupo":           { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Cibalia":                 { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 3, def: 2 },
  "Sibenik":                 { primary: "#FF6600", secondary: "#000000", kit: "ecu93/1.png", att: 2, mid: 2, def: 2 },
  "Zadar":                   { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Istra":                   { primary: "#FFD700", secondary: "#008000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Pula 1856":               { primary: "#FFD700", secondary: "#008000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Istra 1961":              { primary: "#FFD700", secondary: "#008000", kit: "mex86/3.png", att: 2, mid: 3, def: 2 },
  "Inker Zapresic":          { primary: "#FFD700", secondary: "#0033A0", kit: "mex86/3.png", att: 3, mid: 2, def: 2 },
  "Inter Zapresic":          { primary: "#FFD700", secondary: "#0033A0", kit: "mex86/3.png", att: 3, mid: 2, def: 2 },
  "Hrvatski Dragovoljac":    { primary: "#000000", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "Lokomotiva":              { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/5.png", att: 3, mid: 3, def: 3 },
  "Gorica":                  { primary: "#D90429", secondary: "#000000", kit: "ger88/1.png", att: 3, mid: 3, def: 2 },
  "RNK Split":               { primary: "#D90429", secondary: "#000000", kit: "ger88/1.png", att: 3, mid: 3, def: 2 },
  "Kamen Ingrad":            { primary: "#800080", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 2, def: 2 },
  "Segesta":                 { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Marsonia":                { primary: "#FFFFFF", secondary: "#000000", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Dubrovnik":               { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Belisce":                 { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 1 },
  "Pazinka":                 { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 1, mid: 2, def: 1 },
  "Radnik Velika Gorica":    { primary: "#D90429", secondary: "#000000", kit: "ger88/1.png", att: 1, mid: 2, def: 1 },
  "Dubrava":                 { primary: "#800080", secondary: "#FFFFFF", kit: "swe92/4.png", att: 1, mid: 2, def: 1 },
  "Primorac Stobrec":        { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 1, mid: 2, def: 1 },
  "Neretva":                 { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 1, mid: 2, def: 1 },
  "Mladost 127":             { primary: "#FFD700", secondary: "#008000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Orijent":                 { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Samobor":                 { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 1 },
  "Vukovar 91":              { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 1 },
  "Vukovar 1991":            { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Cakovec":                 { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Pomorac Kostrena":        { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "TSK Topolovac":           { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 1, mid: 2, def: 1 },
  "Medjimurje":              { primary: "#D90429", secondary: "#000000", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Croatia Sesvete":         { primary: "#D90429", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 1 },
  "Karlovac":                { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 3, def: 2 },
  "Lucko":                   { primary: "#005EB8", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 1 },
  "Rudes":                   { primary: "#003399", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 }
};

// ============================================================================
// 2. SEASON-BY-SEASON TABLES (CHAMPION FIRST)
// ============================================================================

// SFR Yugoslavia First League (1988-1991)
const YUG_SEASONS = {
  "1988": [
    "FK Vojvodina", "Red Star Belgrade", "Hajduk Split", "Rad", "Dinamo Zagreb", "Partizan",
    "Radnicki Nis", "NK Osijek", "Vardar", "Rijeka", "Velez Mostar", "Sloboda Tuzla",
    "Sarajevo", "Buducnost Podgorica", "Spartak Subotica", "Zeljeznicar", "Napredak Krusevac", "Celik Zenica"
  ],
  "1989": [
    "Red Star Belgrade", "Dinamo Zagreb", "Hajduk Split", "Partizan", "Rad", "Rijeka",
    "Zeljeznicar", "Olimpija Ljubljana", "Sloboda Tuzla", "Buducnost Podgorica", "FK Vojvodina", "Spartak Subotica",
    "Sarajevo", "Borac Banja Luka", "Radnicki Nis", "NK Osijek", "Velez Mostar", "Vardar"
  ],
  "1990": [
    "Red Star Belgrade", "Dinamo Zagreb", "Partizan", "Borac Banja Luka", "Proleter Zrenjanin", "Rad",
    "FK Vojvodina", "NK Osijek", "Radnicki Nis", "Hajduk Split", "Sarajevo", "Velez Mostar",
    "Zemun", "Olimpija Ljubljana", "Rijeka", "Zeljeznicar", "Buducnost Podgorica", "Sloboda Tuzla", "Spartak Subotica"
  ],
  "1991": [
    "Red Star Belgrade", "Partizan", "FK Vojvodina", "OFK Beograd", "Proleter Zrenjanin", "Vardar",
    "Rad", "Borac Banja Luka", "Sarajevo", "Zemun", "Radnicki Nis", "Buducnost Podgorica",
    "Sutjeska Niksic", "Velez Mostar", "Pelister Bitola", "Spartak Subotica", "Sloboda Tuzla", "Zeljeznicar"
  ]
};

// Prva HNL / HNL Croatia (1991-2026)
const CRO_SEASONS = {
  "1991": ["Hajduk Split", "NK Zagreb", "NK Osijek", "Inker Zapresic", "HASK Gradjanski", "Rijeka", "Istra", "Varteks", "Cibalia", "Zadar", "Dubrovnik", "Sibenik"],
  "1992": ["Croatia Zagreb", "Hajduk Split", "NK Zagreb", "Rijeka", "Cibalia", "NK Osijek", "Varteks", "Istra", "Inker Zapresic", "Segesta", "Pazinka", "Zadar", "Radnik Velika Gorica", "Belisce", "Dubrovnik", "Sibenik"],
  "1993": ["Croatia Zagreb", "Hajduk Split", "NK Zagreb", "Inker Zapresic", "Varteks", "Rijeka", "Cibalia", "NK Osijek", "Segesta", "Istra", "Zadar", "Belisce", "Sibenik", "Primorac Stobrec", "Pazinka", "Dubrovnik", "Dubrava", "Radnik Velika Gorica"],
  "1994": ["Hajduk Split", "Croatia Zagreb", "NK Osijek", "NK Zagreb", "Marsonia", "Varteks", "Inker Zapresic", "Segesta", "Sibenik", "Cibalia", "Rijeka", "Istra", "Zadar", "Primorac Stobrec", "Neretva", "Belisce"],
  "1995": ["Croatia Zagreb", "Hajduk Split", "Varteks", "NK Osijek", "Hrvatski Dragovoljac", "NK Zagreb", "Marsonia", "Cibalia", "Sibenik", "Segesta", "Rijeka", "Inker Zapresic", "Istra", "Mladost 127", "Zadar", "Orijent"],
  "1996": ["Croatia Zagreb", "Hajduk Split", "Hrvatski Dragovoljac", "Rijeka", "NK Zagreb", "Varteks", "NK Osijek", "Mladost 127", "Sibenik", "Segesta", "Cibalia", "Zadar", "Istra", "Orijent", "Marsonia", "Inker Zapresic"],
  "1997": ["Croatia Zagreb", "Hajduk Split", "NK Osijek", "Varteks", "NK Zagreb", "Zadar", "Hrvatski Dragovoljac", "Rijeka", "Mladost 127", "Slaven Belupo", "Sibenik", "Samobor"],
  "1998": ["Croatia Zagreb", "Rijeka", "Hajduk Split", "NK Osijek", "Varteks", "Hrvatski Dragovoljac", "Slaven Belupo", "Sibenik", "Cibalia", "NK Zagreb", "Zadar", "Mladost 127"],
  "1999": ["Dinamo Zagreb", "Hajduk Split", "NK Osijek", "Rijeka", "Slaven Belupo", "Cibalia", "Varteks", "NK Zagreb", "Sibenik", "Hrvatski Dragovoljac", "Istra", "Vukovar 91"],
  "2000": ["Hajduk Split", "Dinamo Zagreb", "NK Osijek", "Varteks", "Slaven Belupo", "NK Zagreb", "Sibenik", "Cakovec", "Cibalia", "Rijeka", "Hrvatski Dragovoljac", "Marsonia"],
  "2001": ["NK Zagreb", "Hajduk Split", "Dinamo Zagreb", "Varteks", "Rijeka", "Slaven Belupo", "Kamen Ingrad", "NK Osijek", "Zadar", "Cibalia", "Pomorac Kostrena", "Sibenik", "Hrvatski Dragovoljac", "Cakovec", "Marsonia", "TSK Topolovac"],
  "2002": ["Dinamo Zagreb", "Hajduk Split", "Varteks", "Kamen Ingrad", "Cibalia", "NK Zagreb", "Slaven Belupo", "NK Osijek", "Rijeka", "Zadar", "Pomorac Kostrena", "Sibenik"],
  "2003": ["Hajduk Split", "Dinamo Zagreb", "Rijeka", "NK Osijek", "Varteks", "Zadar", "Kamen Ingrad", "Inter Zapresic", "Slaven Belupo", "NK Zagreb", "Cibalia", "Marsonia"],
  "2004": ["Hajduk Split", "Inter Zapresic", "NK Zagreb", "Rijeka", "Varteks", "Slaven Belupo", "Dinamo Zagreb", "NK Osijek", "Kamen Ingrad", "Pula 1856", "Medjimurje", "Zadar"],
  "2005": ["Dinamo Zagreb", "Rijeka", "Varteks", "NK Osijek", "Hajduk Split", "Kamen Ingrad", "Pula 1856", "Slaven Belupo", "Cibalia", "NK Zagreb", "Medjimurje", "Inter Zapresic"],
  "2006": ["Dinamo Zagreb", "Hajduk Split", "NK Zagreb", "Sibenik", "Slaven Belupo", "NK Osijek", "Rijeka", "Varteks", "Medjimurje", "Cibalia", "Pula 1856", "Kamen Ingrad"],
  "2007": ["Dinamo Zagreb", "Slaven Belupo", "NK Osijek", "Rijeka", "Hajduk Split", "NK Zagreb", "Varteks", "Cibalia", "Zadar", "Sibenik", "Inter Zapresic", "Medjimurje"],
  "2008": ["Dinamo Zagreb", "Hajduk Split", "Rijeka", "Slaven Belupo", "NK Zagreb", "Sibenik", "NK Osijek", "Cibalia", "Inter Zapresic", "Varteks", "Zadar", "Croatia Sesvete"],
  "2009": ["Dinamo Zagreb", "Hajduk Split", "Cibalia", "Sibenik", "NK Osijek", "Karlovac", "Slaven Belupo", "Lokomotiva", "Rijeka", "Varteks", "Istra 1961", "Zadar", "Inter Zapresic", "NK Zagreb", "Medjimurje", "Croatia Sesvete"],
  "2010": ["Dinamo Zagreb", "Hajduk Split", "RNK Split", "Cibalia", "Inter Zapresic", "Karlovac", "Slaven Belupo", "NK Osijek", "Rijeka", "Zadar", "Varazdin", "Sibenik", "NK Zagreb", "Lokomotiva", "Istra 1961", "Hrvatski Dragovoljac"],
  "2011": ["Dinamo Zagreb", "Hajduk Split", "Slaven Belupo", "RNK Split", "Cibalia", "NK Zagreb", "Lokomotiva", "NK Osijek", "Istra 1961", "Zadar", "Inter Zapresic", "Rijeka", "Lucko", "Sibenik", "Karlovac", "Varazdin"],
  "2012": ["Dinamo Zagreb", "Hajduk Split", "Slaven Belupo", "RNK Split", "Istra 1961", "NK Osijek", "Rijeka", "Lokomotiva", "Cibalia", "Inter Zapresic"],
  "2013": ["Dinamo Zagreb", "Hajduk Split", "Rijeka", "RNK Split", "Lokomotiva", "Istra 1961", "Zadar", "NK Osijek", "Slaven Belupo", "Hrvatski Dragovoljac"],
  "2014": ["Dinamo Zagreb", "Rijeka", "Hajduk Split", "Lokomotiva", "NK Zagreb", "Slaven Belupo", "RNK Split", "NK Osijek", "Istra 1961", "Zadar"],
  "2015": ["Dinamo Zagreb", "Rijeka", "Hajduk Split", "Lokomotiva", "Inter Zapresic", "RNK Split", "Slaven Belupo", "NK Osijek", "Istra 1961", "NK Zagreb"],
  "2016": ["Rijeka", "Dinamo Zagreb", "Hajduk Split", "NK Osijek", "Lokomotiva", "Istra 1961", "Slaven Belupo", "Inter Zapresic", "Cibalia", "RNK Split"],
  "2017": ["Dinamo Zagreb", "Rijeka", "Hajduk Split", "NK Osijek", "Lokomotiva", "Slaven Belupo", "Inter Zapresic", "Rudes", "Istra 1961", "Cibalia"],
  "2018": ["Dinamo Zagreb", "Rijeka", "NK Osijek", "Hajduk Split", "Gorica", "Lokomotiva", "Slaven Belupo", "Inter Zapresic", "Istra 1961", "Rudes"],
  "2019": ["Dinamo Zagreb", "Lokomotiva", "Rijeka", "NK Osijek", "Hajduk Split", "Gorica", "Slaven Belupo", "Varazdin", "Istra 1961", "Inter Zapresic"],
  "2020": ["Dinamo Zagreb", "NK Osijek", "Rijeka", "Hajduk Split", "Gorica", "Sibenik", "Slaven Belupo", "Lokomotiva", "Istra 1961", "Varazdin"],
  "2021": ["Dinamo Zagreb", "Hajduk Split", "NK Osijek", "Rijeka", "Lokomotiva", "Gorica", "Slaven Belupo", "Sibenik", "Istra 1961", "Hrvatski Dragovoljac"],
  "2022": ["Dinamo Zagreb", "Hajduk Split", "NK Osijek", "Rijeka", "Istra 1961", "Varazdin", "Lokomotiva", "Slaven Belupo", "Gorica", "Sibenik"],
  "2023": ["Dinamo Zagreb", "Rijeka", "Hajduk Split", "NK Osijek", "Lokomotiva", "Varazdin", "Gorica", "Istra 1961", "Slaven Belupo", "Rudes"],
  "2024": ["Rijeka", "Dinamo Zagreb", "Hajduk Split", "Varazdin", "Slaven Belupo", "Istra 1961", "NK Osijek", "Lokomotiva", "Gorica", "Sibenik"],
  "2025": ["Dinamo Zagreb", "Rijeka", "Hajduk Split", "Varazdin", "Slaven Belupo", "Istra 1961", "NK Osijek", "Lokomotiva", "Gorica", "Vukovar 1991"],
  "2026": ["Dinamo Zagreb", "Rijeka", "Hajduk Split", "Varazdin", "Slaven Belupo", "Istra 1961", "NK Osijek", "Lokomotiva", "Gorica", "Vukovar 1991"]
};

// First League of FR Yugoslavia / Serbia and Montenegro (1992-2005)
const FRY_SEASONS = {
  "1992": [
    "Partizan", "Red Star Belgrade", "FK Vojvodina", "Zemun", "Rad", "Napredak Krusevac",
    "Radnicki Nis", "Hajduk Kula", "Proleter Zrenjanin", "Buducnost Podgorica", "OFK Beograd",
    "Becej", "Mogren", "OFK Kikinda", "Radnicki Beograd", "Sutjeska Niksic", "Spartak Subotica", "Pristina", "Borac Banja Luka"
  ],
  "1993": [
    "Partizan", "Red Star Belgrade", "FK Vojvodina", "OFK Beograd", "Spartak Subotica", "Zemun",
    "Buducnost Podgorica", "Radnicki Nis", "Proleter Zrenjanin", "Rad", "Becej", "Radnicki Beograd",
    "Hajduk Kula", "Napredak Krusevac", "Rudar Pljevlja", "Sloboda Uzice", "Mogren", "Sutjeska Niksic", "OFK Kikinda", "Jastrebac Nis"
  ],
  "1994": [
    "Red Star Belgrade", "Partizan", "FK Vojvodina", "Becej", "Zemun", "Rad",
    "Radnicki Nis", "Borac Cacak", "Hajduk Kula", "Buducnost Podgorica", "Proleter Zrenjanin", "Napredak Krusevac",
    "OFK Beograd", "Sloboda Uzice", "Spartak Subotica", "Radnicki Beograd", "Obilic", "Loznica", "Sutjeska Niksic", "Rudar Pljevlja"
  ],
  "1995": [
    "Partizan", "Red Star Belgrade", "FK Vojvodina", "Becej", "Mladost Lucani", "Cukaricki",
    "Sloboda Uzice", "Rad", "Radnicki Nis", "Zemun", "Proleter Zrenjanin", "Borac Cacak",
    "Hajduk Kula", "Buducnost Podgorica", "Obilic", "OFK Beograd", "Loznica", "Mladost Backi Jarak", "Napredak Krusevac", "Radnicki Beograd"
  ],
  "1996": [
    "Partizan", "Red Star Belgrade", "FK Vojvodina", "Hajduk Kula", "Proleter Zrenjanin", "Cukaricki",
    "Zemun", "Mladost Lucani", "Rad", "Becej", "Obilic", "Zeleznik",
    "Buducnost Podgorica", "Sutjeska Niksic", "Rudar Pljevlja", "Borac Cacak", "Spartak Subotica", "Buducnost Valjevo", "Loznica", "OFK Kikinda"
  ],
  "1997": [
    "Obilic", "Red Star Belgrade", "Partizan", "FK Vojvodina", "Rad", "Zemun",
    "Hajduk Kula", "Buducnost Podgorica", "Proleter Zrenjanin", "Zeleznik", "Cukaricki", "Mladost Lucani",
    "OFK Beograd", "Sartid Smederevo", "Spartak Subotica", "Pristina", "Radnicki Nis", "Loznica", "Sutjeska Niksic", "Rudar Pljevlja"
  ],
  "1998": [
    "Partizan", "Obilic", "Red Star Belgrade", "FK Vojvodina", "Rad", "Proleter Zrenjanin",
    "Hajduk Kula", "Zeleznik", "Sartid Smederevo", "OFK Beograd", "Milicionar", "Spartak Subotica",
    "Radnicki Kragujevac", "Buducnost Podgorica", "Zemun", "Radnicki Nis", "Pristina", "Mogren"
  ],
  "1999": [
    "Red Star Belgrade", "Partizan", "Obilic", "Rad", "Sutjeska Niksic", "Cukaricki",
    "OFK Beograd", "Zeleznik", "Zemun", "FK Vojvodina", "Radnicki Nis", "Buducnost Podgorica",
    "Radnicki Kragujevac", "Hajduk Kula", "Milicionar", "Sartid Smederevo", "Proleter Zrenjanin", "Hajduk Beograd", "Mogren", "Spartak Subotica", "Borac Cacak"
  ],
  "2000": [
    "Red Star Belgrade", "Partizan", "Obilic", "Sartid Smederevo", "OFK Beograd", "FK Vojvodina",
    "Sutjeska Niksic", "Zeleznik", "Radnicki Kragujevac", "Zemun", "Hajduk Kula", "Cukaricki",
    "Zeta", "Rad", "Buducnost Podgorica", "Napredak Krusevac", "Radnicki Nis", "Milicionar"
  ],
  "2001": [
    "Partizan", "Red Star Belgrade", "Sartid Smederevo", "Obilic", "Zeta", "Zeleznik",
    "OFK Beograd", "Sutjeska Niksic", "FK Vojvodina", "Rad", "Zemun", "Hajduk Kula",
    "Cukaricki", "Rudar Pljevlja", "Mladost Apatin", "Zvezdara", "Mladost Lucani", "Radnicki Kragujevac"
  ],
  "2002": [
    "Partizan", "Red Star Belgrade", "OFK Beograd", "Sartid Smederevo", "Zeta", "FK Vojvodina",
    "Zeleznik", "Obilic", "Hajduk Kula", "Zemun", "Radnicki Obrenovac", "Rad",
    "Cukaricki", "Javor Ivanjica", "Rudar Pljevlja", "Mogren", "Radnicki Nis", "Sutjeska Niksic"
  ],
  "2003": [
    "Red Star Belgrade", "Partizan", "Zeleznik", "OFK Beograd", "Sartid Smederevo", "Obilic",
    "Zemun", "Sutjeska Niksic", "FK Vojvodina", "Hajduk Kula", "Zeta", "Borac Cacak",
    "Buducnost Banatski Dvor", "Napredak Krusevac", "Radnicki Obrenovac", "Kom"
  ],
  "2004": [
    "Partizan", "Red Star Belgrade", "Zeta", "OFK Beograd", "Zemun", "Buducnost Podgorica",
    "Hajduk Kula", "FK Vojvodina", "Zeleznik", "Smederevo", "Obilic", "Radnicki Beograd",
    "Borac Cacak", "Cukaricki", "Sutjeska Niksic", "Hajduk Beograd"
  ],
  "2005": [
    "Red Star Belgrade", "Partizan", "Vozdovac", "Hajduk Kula", "Zeta", "OFK Beograd",
    "Zemun", "Buducnost Banatski Dvor", "FK Vojvodina", "Borac Cacak", "Smederevo", "Javor Ivanjica",
    "Rad", "Buducnost Podgorica", "Obilic", "Jedinstvo Bijelo Polje"
  ]
};

// Serbian SuperLiga (2006-2026)
const SRB_SEASONS = {
  "2006": ["Red Star Belgrade", "Partizan", "FK Vojvodina", "Bezanija", "Hajduk Kula", "OFK Beograd", "Banat Zrenjanin", "Mladost Apatin", "Smederevo", "Borac Cacak", "Vozdovac", "Zemun"],
  "2007": ["Partizan", "Red Star Belgrade", "FK Vojvodina", "Borac Cacak", "Napredak Krusevac", "Cukaricki", "Mladost Lucani", "Hajduk Kula", "OFK Beograd", "Smederevo", "Banat Zrenjanin", "Bezanija"],
  "2008": ["Partizan", "FK Vojvodina", "Red Star Belgrade", "Javor Ivanjica", "Borac Cacak", "Napredak Krusevac", "Hajduk Kula", "Rad", "Cukaricki", "Jagodina", "OFK Beograd", "Banat Zrenjanin"],
  "2009": ["Partizan", "Red Star Belgrade", "OFK Beograd", "Spartak Subotica", "FK Vojvodina", "Jagodina", "Javor Ivanjica", "Rad", "Metalac Gornji Milanovac", "Smederevo", "BSK Borca", "Borac Cacak", "Cukaricki", "Hajduk Kula", "Napredak Krusevac", "Mladi Radnik"],
  "2010": ["Partizan", "Red Star Belgrade", "FK Vojvodina", "Rad", "Spartak Subotica", "Sloboda Uzice", "OFK Beograd", "Javor Ivanjica", "Borac Cacak", "Smederevo", "BSK Borca", "Jagodina", "Hajduk Kula", "Metalac Gornji Milanovac", "Indjija", "Cukaricki"],
  "2011": ["Partizan", "Red Star Belgrade", "FK Vojvodina", "Jagodina", "Sloboda Uzice", "Radnicki 1923", "Spartak Subotica", "OFK Beograd", "Javor Ivanjica", "Rad", "Hajduk Kula", "BSK Borca", "Smederevo", "Novi Pazar", "Borac Cacak", "Metalac Gornji Milanovac"],
  "2012": ["Partizan", "Red Star Belgrade", "FK Vojvodina", "Jagodina", "Sloboda Uzice", "OFK Beograd", "Rad", "Hajduk Kula", "Spartak Subotica", "Javor Ivanjica", "Donji Srem", "Radnicki Nis", "Radnicki 1923", "Novi Pazar", "BSK Borca", "Smederevo"],
  "2013": ["Red Star Belgrade", "Partizan", "Jagodina", "FK Vojvodina", "Cukaricki", "Radnicki Nis", "Vozdovac", "Novi Pazar", "Napredak Krusevac", "Spartak Subotica", "OFK Beograd", "Donji Srem", "Radnicki 1923", "Rad", "Javor Ivanjica", "Sloboda Uzice"],
  "2014": ["Partizan", "Red Star Belgrade", "Cukaricki", "FK Vojvodina", "Novi Pazar", "Rad", "Mladost Lucani", "OFK Beograd", "Radnicki Nis", "Jagodina", "Vozdovac", "Spartak Subotica", "Borac Cacak", "Napredak Krusevac", "Donji Srem", "Radnicki 1923"],
  "2015": ["Red Star Belgrade", "Partizan", "Cukaricki", "FK Vojvodina", "Radnicki Nis", "Borac Cacak", "Vozdovac", "Radnik Surdulica", "Mladost Lucani", "Spartak Subotica", "Metalac Gornji Milanovac", "Rad", "Javor Ivanjica", "Novi Pazar", "OFK Beograd", "Jagodina"],
  "2016": ["Partizan", "Red Star Belgrade", "FK Vojvodina", "Mladost Lucani", "Radnicki Nis", "Napredak Krusevac", "Vozdovac", "Javor Ivanjica", "Cukaricki", "Spartak Subotica", "Rad", "Radnik Surdulica", "Backa Backa Palanka", "Borac Cacak", "Metalac Gornji Milanovac", "Novi Pazar"],
  "2017": ["Red Star Belgrade", "Partizan", "Radnicki Nis", "Spartak Subotica", "Vozdovac", "Cukaricki", "Napredak Krusevac", "FK Vojvodina", "Radnik Surdulica", "Mladost Lucani", "Zemun", "Macva Sabac", "Rad", "Backa Backa Palanka", "Javor Ivanjica", "Borac Cacak"],
  "2018": ["Red Star Belgrade", "Radnicki Nis", "Partizan", "Cukaricki", "Mladost Lucani", "Napredak Krusevac", "FK Vojvodina", "Proleter Novi Sad", "Radnik Surdulica", "Spartak Subotica", "Vozdovac", "Macva Sabac", "Rad", "Dinamo Vranje", "Zemun", "Backa Backa Palanka"],
  "2019": ["Red Star Belgrade", "Partizan", "FK Vojvodina", "TSC Backa Topola", "Radnicki Nis", "Cukaricki", "Spartak Subotica", "Vozdovac", "Mladost Lucani", "Napredak Krusevac", "Radnik Surdulica", "Proleter Novi Sad", "Javor Ivanjica", "Indjija", "Rad", "Macva Sabac"],
  "2020": ["Red Star Belgrade", "Partizan", "Cukaricki", "FK Vojvodina", "TSC Backa Topola", "Radnik Surdulica", "Mladost Lucani", "Proleter Novi Sad", "Spartak Subotica", "Metalac Gornji Milanovac", "Napredak Krusevac", "Novi Pazar", "Radnicki Nis", "Vozdovac", "Rad", "Javor Ivanjica", "Indjija", "Zlatibor Cajetina", "Macva Sabac", "Backa Backa Palanka"],
  "2021": ["Red Star Belgrade", "Partizan", "Cukaricki", "Radnicki Nis", "Vozdovac", "TSC Backa Topola", "FK Vojvodina", "Napredak Krusevac", "Kolubara", "Spartak Subotica", "Mladost Lucani", "Radnik Surdulica", "Novi Pazar", "Radnicki 1923", "Metalac Gornji Milanovac", "Proleter Novi Sad"],
  "2022": ["Red Star Belgrade", "TSC Backa Topola", "Cukaricki", "Partizan", "FK Vojvodina", "Novi Pazar", "Vozdovac", "Radnicki 1923", "Napredak Krusevac", "Spartak Subotica", "Mladost Lucani", "Javor Ivanjica", "Kolubara", "Radnicki Nis", "Radnik Surdulica", "Mladost GAT"],
  "2023": ["Red Star Belgrade", "Partizan", "TSC Backa Topola", "FK Vojvodina", "Radnicki 1923", "Cukaricki", "Mladost Lucani", "Napredak Krusevac", "Novi Pazar", "Spartak Subotica", "IMT Novi Beograd", "Radnicki Nis", "Javor Ivanjica", "Zeleznicar Pancevo", "Vozdovac", "Radnik Surdulica"],
  "2024": ["Red Star Belgrade", "Partizan", "Novi Pazar", "OFK Beograd", "Radnicki 1923", "FK Vojvodina", "TSC Backa Topola", "Mladost Lucani", "Cukaricki", "Zeleznicar Pancevo", "IMT Novi Beograd", "Spartak Subotica", "Radnicki Nis", "Napredak Krusevac", "Tekstilac Odzaci", "Jedinstvo Ub"],
  "2025": ["Red Star Belgrade", "FK Vojvodina", "Partizan", "OFK Beograd", "Novi Pazar", "Radnicki 1923", "TSC Backa Topola", "Cukaricki", "Mladost Lucani", "Zeleznicar Pancevo", "IMT Novi Beograd", "Spartak Subotica", "Radnicki Nis", "Napredak Krusevac", "Javor Ivanjica", "Radnik Surdulica"],
  "2026": ["Red Star Belgrade", "FK Vojvodina", "Partizan", "OFK Beograd", "Novi Pazar", "Radnicki 1923", "TSC Backa Topola", "Cukaricki", "Mladost Lucani", "Zeleznicar Pancevo", "IMT Novi Beograd", "Spartak Subotica", "Radnicki Nis", "Napredak Krusevac", "Javor Ivanjica", "Radnik Surdulica"]
};

// Keep fallback metadata for minor FRY 2005 club
CLUBS_META["Jedinstvo Bijelo Polje"] = { primary: "#FFFFFF", secondary: "#005EB8", kit: "swe92/0.png", att: 2, mid: 2, def: 1 };

// ============================================================================
// 3. HISTORICAL EUROPEAN QUALIFIERS (1988-2026)
// ============================================================================
const YUG_QUALIFIERS = {
  "1988": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "Dinamo Zagreb", "Velez Mostar"] },
  "1989": { cl: ["FK Vojvodina"], uefa: ["Red Star Belgrade", "Rad"] },
  "1990": { cl: ["Red Star Belgrade"], uefa: ["Dinamo Zagreb", "Partizan"] },
  "1991": { cl: ["Red Star Belgrade"], uefa: ["Partizan"] }
};

const FRY_QUALIFIERS = {
  "1992": { cl: [], uefa: [] },
  "1993": { cl: [], uefa: [] },
  "1994": { cl: [], uefa: [] },
  "1995": { cl: [], uefa: ["Red Star Belgrade", "Partizan"] },
  "1996": { cl: [], uefa: ["Partizan", "FK Vojvodina"] },
  "1997": { cl: ["Partizan"], uefa: ["FK Vojvodina"] },
  "1998": { cl: ["Obilic"], uefa: ["Red Star Belgrade", "Partizan"] },
  "1999": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "FK Vojvodina"] },
  "2000": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "Napredak Krusevac"] },
  "2001": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "Obilic"] },
  "2002": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "Sartid Smederevo"] },
  "2003": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "Sartid Smederevo"] },
  "2004": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "Zeleznik"] },
  "2005": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "OFK Beograd", "Zeta"] }
};

const SRB_QUALIFIERS = {
  "2006": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "OFK Beograd", "Hajduk Kula"] },
  "2007": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "FK Vojvodina", "Bezanija"] },
  "2008": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "FK Vojvodina", "Borac Cacak"] },
  "2009": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "FK Vojvodina"] },
  "2010": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "OFK Beograd", "Spartak Subotica"] },
  "2011": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "FK Vojvodina", "Rad"] },
  "2012": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "FK Vojvodina", "Jagodina"] },
  "2013": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "FK Vojvodina", "Jagodina"] },
  "2014": { cl: ["Partizan"], uefa: ["FK Vojvodina", "Jagodina", "Cukaricki"] },
  "2015": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "Cukaricki", "FK Vojvodina"] },
  "2016": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "Cukaricki", "FK Vojvodina"] },
  "2017": { cl: ["Partizan"], uefa: ["Red Star Belgrade", "FK Vojvodina", "Mladost Lucani"] },
  "2018": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "Radnicki Nis", "Spartak Subotica"] },
  "2019": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "Radnicki Nis", "Cukaricki"] },
  "2020": { cl: ["Red Star Belgrade"], uefa: ["Partizan", "FK Vojvodina", "TSC Backa Topola"] },
  "2021": { cl: ["Red Star Belgrade"], uefa: [], uecl: ["Partizan", "Cukaricki", "FK Vojvodina"] },
  "2022": { cl: ["Red Star Belgrade"], uefa: ["Partizan"], uecl: ["Cukaricki", "Radnicki Nis"] },
  "2023": { cl: ["Red Star Belgrade", "TSC Backa Topola"], uefa: [], uecl: ["Cukaricki", "Partizan", "FK Vojvodina"] },
  "2024": { cl: ["Red Star Belgrade", "Partizan"], uefa: ["FK Vojvodina"], uecl: ["TSC Backa Topola", "Radnicki 1923"] },
  "2025": { cl: ["Red Star Belgrade"], uefa: ["Partizan"], uecl: ["Novi Pazar", "Radnicki 1923"] },
  "2026": { cl: ["Red Star Belgrade"], uefa: ["Partizan"], uecl: ["Novi Pazar", "Radnicki 1923"] }
};

const CRO_QUALIFIERS = {
  "1991": { cl: [], uefa: [] },
  "1992": { cl: [], uefa: [] },
  "1993": { cl: ["Croatia Zagreb"], uefa: ["Hajduk Split", "Rijeka"] },
  "1994": { cl: ["Hajduk Split"], uefa: [] },
  "1995": { cl: ["Hajduk Split"], uefa: ["NK Osijek"] },
  "1996": { cl: [], uefa: ["Croatia Zagreb", "Hajduk Split", "Varteks"] },
  "1997": { cl: ["Croatia Zagreb"], uefa: ["Hajduk Split"] },
  "1998": { cl: ["Croatia Zagreb"], uefa: ["Hajduk Split", "NK Osijek"] },
  "1999": { cl: ["Dinamo Zagreb", "Rijeka"], uefa: ["Hajduk Split", "NK Osijek"] },
  "2000": { cl: ["Dinamo Zagreb", "Hajduk Split"], uefa: ["NK Osijek", "Rijeka"] },
  "2001": { cl: ["Hajduk Split"], uefa: ["Dinamo Zagreb", "NK Osijek", "Varteks"] },
  "2002": { cl: ["NK Zagreb"], uefa: ["Hajduk Split", "Dinamo Zagreb", "Varteks"] },
  "2003": { cl: ["Dinamo Zagreb"], uefa: ["Hajduk Split", "Varteks", "Kamen Ingrad"] },
  "2004": { cl: ["Hajduk Split"], uefa: ["Dinamo Zagreb", "Rijeka"] },
  "2005": { cl: ["Hajduk Split"], uefa: ["Rijeka", "Inter Zapresic"] },
  "2006": { cl: ["Dinamo Zagreb"], uefa: ["Rijeka", "Varteks"] },
  "2007": { cl: ["Dinamo Zagreb"], uefa: ["Hajduk Split", "Slaven Belupo"] },
  "2008": { cl: ["Dinamo Zagreb"], uefa: ["Hajduk Split", "Slaven Belupo"] },
  "2009": { cl: ["Dinamo Zagreb"], uefa: ["Hajduk Split", "Rijeka", "Slaven Belupo"] },
  "2010": { cl: ["Dinamo Zagreb"], uefa: ["Hajduk Split", "Cibalia", "Sibenik"] },
  "2011": { cl: ["Dinamo Zagreb"], uefa: ["Hajduk Split", "RNK Split", "Varazdin"] },
  "2012": { cl: ["Dinamo Zagreb"], uefa: ["Hajduk Split", "Slaven Belupo", "NK Osijek"] },
  "2013": { cl: ["Dinamo Zagreb"], uefa: ["Hajduk Split", "Rijeka", "Lokomotiva"] },
  "2014": { cl: ["Dinamo Zagreb"], uefa: ["Rijeka", "Hajduk Split", "RNK Split"] },
  "2015": { cl: ["Dinamo Zagreb"], uefa: ["Rijeka", "Hajduk Split", "Lokomotiva"] },
  "2016": { cl: ["Dinamo Zagreb"], uefa: ["Rijeka", "Hajduk Split", "Lokomotiva"] },
  "2017": { cl: ["Rijeka"], uefa: ["Dinamo Zagreb", "Hajduk Split", "NK Osijek"] },
  "2018": { cl: ["Dinamo Zagreb"], uefa: ["Rijeka", "Hajduk Split", "NK Osijek"] },
  "2019": { cl: ["Dinamo Zagreb"], uefa: ["Rijeka", "NK Osijek", "Hajduk Split"] },
  "2020": { cl: ["Dinamo Zagreb", "Lokomotiva"], uefa: ["Rijeka", "NK Osijek", "Hajduk Split"] },
  "2021": { cl: ["Dinamo Zagreb"], uefa: [], uecl: ["NK Osijek", "Rijeka", "Hajduk Split"] },
  "2022": { cl: ["Dinamo Zagreb"], uefa: [], uecl: ["Hajduk Split", "NK Osijek", "Rijeka"] },
  "2023": { cl: ["Dinamo Zagreb"], uefa: [], uecl: ["Hajduk Split", "NK Osijek", "Rijeka"] },
  "2024": { cl: ["Dinamo Zagreb"], uefa: ["Rijeka"], uecl: ["Hajduk Split", "NK Osijek"] },
  "2025": { cl: ["Rijeka"], uefa: ["Dinamo Zagreb"], uecl: ["Hajduk Split", "Varazdin"] },
  "2026": { cl: ["Rijeka"], uefa: ["Dinamo Zagreb"], uecl: ["Hajduk Split", "Varazdin"] }
};

function generateLeagueFiles(countryCode, seasonsMap, outputDir) {
  let count = 0;
  for (const [seasonYear, teamNames] of Object.entries(seasonsMap)) {
    const shortYr = seasonYear.slice(-2);
    const filename = `${countryCode}${shortYr}.json`;
    const fullPath = path.join(outputDir, filename);

    const teamsData = teamNames.map((teamName, index) => {
      const meta = CLUBS_META[teamName] || {
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
  console.log(`Generated ${generateLeagueFiles('yug', YUG_SEASONS, YUG_DIR)} Yugoslav (1988-1991) files in ${YUG_DIR}`);
  console.log(`Generated ${generateLeagueFiles('cro', CRO_SEASONS, CRO_DIR)} Croatian (1991-2026) files in ${CRO_DIR}`);
  console.log(`Generated ${generateLeagueFiles('fry', FRY_SEASONS, FRY_DIR)} FR Yugoslavia (1992-2005) files in ${FRY_DIR}`);
  console.log(`Generated ${generateLeagueFiles('srb', SRB_SEASONS, SRB_DIR)} Serbian (2006-2026) files in ${SRB_DIR}`);
}

module.exports = {
  YUG_QUALIFIERS,
  FRY_QUALIFIERS,
  SRB_QUALIFIERS,
  CRO_QUALIFIERS
};
