/**
 * Historical League & European Cup Generator for Scotland and Ukraine (1990-2026)
 * Generates:
 *  - src/data/leagues/sco/sco90.json ... sco26.json
 *  - src/data/leagues/ukr/ukr91.json ... ukr26.json
 *  - qualifiers data to inject into src/data/qualifiersBySeason.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCO_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'sco');
const UKR_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'ukr');

fs.mkdirSync(SCO_DIR, { recursive: true });
fs.mkdirSync(UKR_DIR, { recursive: true });

// ============================================================================
// 1. SCOTTISH TEAMS METADATA (Colors, Kit templates, Default Base Stats)
// ============================================================================
const SCO_CLUBS = {
  "Rangers":                  { primary: "#0000FF", secondary: "#FFFFFF", kit: "swe92/0.png", att: 5, mid: 4, def: 4 },
  "Celtic":                   { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 5, mid: 4, def: 4 },
  "Aberdeen":                 { primary: "#DD0000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 4, mid: 3, def: 3 },
  "Heart of Midlothian":      { primary: "#800000", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 3, def: 3 },
  "Hearts":                   { primary: "#800000", secondary: "#FFFFFF", kit: "swe92/4.png", att: 3, mid: 3, def: 3 },
  "Hibernian":                { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 3, mid: 3, def: 3 },
  "Dundee United":            { primary: "#FF8C00", secondary: "#000000", kit: "ecu93/1.png", att: 3, mid: 3, def: 3 },
  "Motherwell":               { primary: "#800020", secondary: "#FFD700", kit: "ger88/4.png", att: 3, mid: 3, def: 3 },
  "Kilmarnock":               { primary: "#0000FF", secondary: "#FFFFFF", kit: "swe92/5.png", att: 3, mid: 3, def: 2 },
  "St Johnstone":             { primary: "#003DA5", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Dundee":                   { primary: "#001B44", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 3, def: 2 },
  "St Mirren":                { primary: "#000000", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "Dunfermline Athletic":     { primary: "#000000", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 3, def: 2 },
  "Partick Thistle":          { primary: "#E51E25", secondary: "#FFD700", kit: "ger88/4.png", att: 2, mid: 2, def: 2 },
  "Falkirk":                  { primary: "#00205B", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Livingston":               { primary: "#FFD700", secondary: "#000000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Inverness Caledonian Thistle": { primary: "#00205B", secondary: "#E51E25", kit: "swe92/2.png", att: 2, mid: 3, def: 2 },
  "Ross County":              { primary: "#001F3F", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Hamilton Academical":      { primary: "#CC0000", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "Raith Rovers":             { primary: "#00205B", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Airdrieonians":            { primary: "#CC0000", secondary: "#FFFFFF", kit: "fra84/1.png", att: 2, mid: 2, def: 2 },
  "Gretna":                   { primary: "#000000", secondary: "#FFFFFF", kit: "ger88/5.png", att: 1, mid: 2, def: 1 }
};

// ============================================================================
// 2. UKRAINIAN TEAMS METADATA (Colors, Kit templates, Default Base Stats)
// ============================================================================
const UKR_CLUBS = {
  "Dynamo Kyiv":              { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 5, mid: 5, def: 4 },
  "Shakhtar Donetsk":         { primary: "#FF8C00", secondary: "#000000", kit: "ecu93/1.png", att: 5, mid: 5, def: 4 },
  "Dnipro":                   { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 4, def: 3 },
  "Dnipro-1":                 { primary: "#003366", secondary: "#FFCC00", kit: "swe92/0.png", att: 4, mid: 3, def: 3 },
  "Chornomorets Odesa":       { primary: "#000080", secondary: "#000000", kit: "swe92/5.png", att: 3, mid: 3, def: 3 },
  "Metalist Kharkiv":         { primary: "#FFD700", secondary: "#003399", kit: "mex86/3.png", att: 4, mid: 4, def: 3 },
  "Metalist 1925 Kharkiv":    { primary: "#FFD700", secondary: "#003399", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Zorya Luhansk":            { primary: "#FFFFFF", secondary: "#000000", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Vorskla Poltava":          { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 3, mid: 3, def: 3 },
  "Tavriya Simferopol":       { primary: "#005BAA", secondary: "#FF0000", kit: "ger88/3.png", att: 3, mid: 3, def: 2 },
  "Karpaty Lviv":             { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 3, mid: 3, def: 2 },
  "Kryvbas Kryvyi Rih":       { primary: "#CC0000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 3, mid: 3, def: 2 },
  "Metalurh Zaporizhzhia":    { primary: "#CC0000", secondary: "#FFFF00", kit: "ger88/4.png", att: 3, mid: 3, def: 2 },
  "Metalurh Donetsk":         { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Mariupol":                 { primary: "#FF8C00", secondary: "#005BAA", kit: "ecu93/1.png", att: 2, mid: 3, def: 2 },
  "Arsenal Kyiv":             { primary: "#CC0000", secondary: "#005BAA", kit: "swe92/2.png", att: 3, mid: 3, def: 2 },
  "CSKA Kyiv":                { primary: "#CC0000", secondary: "#005BAA", kit: "swe92/2.png", att: 3, mid: 3, def: 2 },
  "FC Oleksandriya":          { primary: "#FFD700", secondary: "#008000", kit: "mex86/3.png", att: 3, mid: 3, def: 3 },
  "Kolos Kovalivka":          { primary: "#000000", secondary: "#FFFFFF", kit: "ger88/5.png", att: 2, mid: 3, def: 2 },
  "Rukh Lviv":                { primary: "#FFD700", secondary: "#000000", kit: "mex86/3.png", att: 3, mid: 3, def: 2 },
  "Polissya Zhytomyr":        { primary: "#008000", secondary: "#FFFF00", kit: "swe92/1.png", att: 3, mid: 3, def: 3 },
  "LNZ Cherkasy":             { primary: "#800080", secondary: "#FFFFFF", kit: "swe92/4.png", att: 2, mid: 2, def: 2 },
  "Obolon Kyiv":              { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Veres Rivne":              { primary: "#CC0000", secondary: "#000000", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Inhulets Petrove":         { primary: "#FFD700", secondary: "#CC0000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "FC Mynai":                 { primary: "#003366", secondary: "#00CCFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "FC Lviv":                  { primary: "#003399", secondary: "#FFCC00", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Olimpik Donetsk":          { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Desna Chernihiv":          { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Volyn Lutsk":              { primary: "#CC0000", secondary: "#FFFFFF", kit: "ger88/1.png", att: 2, mid: 2, def: 2 },
  "Nyva Ternopil":            { primary: "#FFFF00", secondary: "#008000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Nyva Vinnytsia":           { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Torpedo Zaporizhzhia":     { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Kremin Kremenchuk":        { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Prykarpattya Ivano-Frankivsk": { primary: "#008000", secondary: "#FFFF00", kit: "swe92/1.png", att: 2, mid: 2, def: 2 },
  "Bukovyna Chernivtsi":      { primary: "#FFFF00", secondary: "#000000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Stal Alchevsk":            { primary: "#CC0000", secondary: "#005BAA", kit: "ger88/3.png", att: 2, mid: 2, def: 2 },
  "Stal Kamianske":           { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Hoverla Uzhhorod":         { primary: "#005BAA", secondary: "#FFFF00", kit: "ger88/4.png", att: 2, mid: 2, def: 2 },
  "Zirka Kropyvnytskyi":      { primary: "#CC0000", secondary: "#FFFF00", kit: "ger88/4.png", att: 2, mid: 2, def: 2 },
  "PFC Sevastopol":           { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 2, mid: 2, def: 2 },
  "Livyi Bereh Kyiv":         { primary: "#008000", secondary: "#000000", kit: "swe92/1.png", att: 2, mid: 2, def: 2 }
};

// ============================================================================
// 3. SEASON-BY-SEASON HISTORICAL STANDINGS / PARTICIPANTS: SCOTLAND
// ============================================================================
const SCO_SEASONS = {
  "1990": ["Rangers", "Aberdeen", "Celtic", "Dundee United", "Hearts", "Motherwell", "St Johnstone", "Dunfermline Athletic", "Hibernian", "St Mirren"],
  "1991": ["Rangers", "Hearts", "Celtic", "Dundee United", "Hibernian", "Aberdeen", "Airdrieonians", "St Johnstone", "Falkirk", "Motherwell", "St Mirren", "Dunfermline Athletic"],
  "1992": ["Rangers", "Aberdeen", "Celtic", "Dundee United", "Hearts", "St Johnstone", "Hibernian", "Motherwell", "Partick Thistle", "Dundee", "Falkirk", "Airdrieonians"],
  "1993": ["Rangers", "Aberdeen", "Motherwell", "Celtic", "Hibernian", "Dundee United", "Hearts", "Kilmarnock", "Partick Thistle", "St Johnstone", "Raith Rovers", "Dundee"],
  "1994": ["Rangers", "Motherwell", "Hibernian", "Celtic", "Falkirk", "Hearts", "Partick Thistle", "Kilmarnock", "Aberdeen", "Dundee United"],
  "1995": ["Rangers", "Celtic", "Aberdeen", "Hearts", "Hibernian", "Raith Rovers", "Kilmarnock", "Motherwell", "Partick Thistle", "Falkirk"],
  "1996": ["Rangers", "Celtic", "Dundee United", "Hearts", "Dunfermline Athletic", "Aberdeen", "Kilmarnock", "Motherwell", "Hibernian", "Raith Rovers"],
  "1997": ["Celtic", "Rangers", "Hearts", "Dunfermline Athletic", "St Johnstone", "Aberdeen", "Kilmarnock", "Motherwell", "Dundee United", "Hibernian"],
  "1998": ["Rangers", "Celtic", "St Johnstone", "Kilmarnock", "Dundee", "Hearts", "Motherwell", "Aberdeen", "Dundee United", "Dunfermline Athletic"],
  "1999": ["Rangers", "Celtic", "Hearts", "Motherwell", "St Johnstone", "Hibernian", "Dundee", "Dundee United", "Aberdeen", "Kilmarnock"],
  "2000": ["Celtic", "Rangers", "Hibernian", "Kilmarnock", "Hearts", "Dundee", "Dunfermline Athletic", "Motherwell", "Aberdeen", "St Johnstone", "Dundee United", "St Mirren"],
  "2001": ["Celtic", "Rangers", "Livingston", "Aberdeen", "Hearts", "Dunfermline Athletic", "Kilmarnock", "Dundee United", "Dundee", "Hibernian", "Motherwell", "St Johnstone"],
  "2002": ["Rangers", "Celtic", "Hearts", "Kilmarnock", "Dunfermline Athletic", "Dundee", "Hibernian", "Aberdeen", "Livingston", "Partick Thistle", "Dundee United", "Motherwell"],
  "2003": ["Celtic", "Rangers", "Hearts", "Dunfermline Athletic", "Dundee United", "Motherwell", "Livingston", "Hibernian", "Aberdeen", "Dundee", "Partick Thistle", "Kilmarnock"],
  "2004": ["Rangers", "Celtic", "Hibernian", "Aberdeen", "Hearts", "Motherwell", "Inverness Caledonian Thistle", "Kilmarnock", "Dundee United", "Livingston", "Dundee", "Dunfermline Athletic"],
  "2005": ["Celtic", "Hearts", "Rangers", "Hibernian", "Kilmarnock", "Aberdeen", "Motherwell", "Inverness Caledonian Thistle", "Dundee United", "Falkirk", "Dunfermline Athletic", "Livingston"],
  "2006": ["Celtic", "Rangers", "Aberdeen", "Hearts", "Kilmarnock", "Hibernian", "Falkirk", "Inverness Caledonian Thistle", "Dundee United", "Motherwell", "St Mirren", "Dunfermline Athletic"],
  "2007": ["Celtic", "Rangers", "Motherwell", "Aberdeen", "Dundee United", "Hibernian", "Falkirk", "Hearts", "Inverness Caledonian Thistle", "St Mirren", "Kilmarnock", "Gretna"],
  "2008": ["Rangers", "Celtic", "Hearts", "Aberdeen", "Dundee United", "Hibernian", "Motherwell", "Kilmarnock", "Hamilton Academical", "Falkirk", "St Mirren", "Inverness Caledonian Thistle"],
  "2009": ["Rangers", "Celtic", "Dundee United", "Hibernian", "Motherwell", "Hearts", "Hamilton Academical", "St Johnstone", "Aberdeen", "St Mirren", "Kilmarnock", "Falkirk"],
  "2010": ["Rangers", "Celtic", "Hearts", "Dundee United", "Kilmarnock", "Motherwell", "Inverness Caledonian Thistle", "St Johnstone", "Aberdeen", "Hibernian", "St Mirren", "Hamilton Academical"],
  "2011": ["Celtic", "Rangers", "Motherwell", "Dundee United", "Hearts", "St Johnstone", "Aberdeen", "Kilmarnock", "Hibernian", "St Mirren", "Inverness Caledonian Thistle", "Dunfermline Athletic"],
  "2012": ["Celtic", "Motherwell", "St Johnstone", "Inverness Caledonian Thistle", "Ross County", "Dundee United", "Hibernian", "Aberdeen", "Kilmarnock", "Hearts", "St Mirren", "Dundee"],
  "2013": ["Celtic", "Motherwell", "Aberdeen", "Dundee United", "St Johnstone", "Inverness Caledonian Thistle", "Ross County", "St Mirren", "Kilmarnock", "Partick Thistle", "Hibernian", "Hearts"],
  "2014": ["Celtic", "Aberdeen", "Inverness Caledonian Thistle", "St Johnstone", "Dundee United", "Dundee", "Hamilton Academical", "Partick Thistle", "Ross County", "Kilmarnock", "Motherwell", "St Mirren"],
  "2015": ["Celtic", "Aberdeen", "Hearts", "St Johnstone", "Motherwell", "Ross County", "Dundee", "Partick Thistle", "Hamilton Academical", "Kilmarnock", "Inverness Caledonian Thistle", "Dundee United"],
  "2016": ["Celtic", "Aberdeen", "Rangers", "St Johnstone", "Hearts", "Partick Thistle", "Ross County", "Kilmarnock", "Motherwell", "Dundee", "Hamilton Academical", "Inverness Caledonian Thistle"],
  "2017": ["Celtic", "Aberdeen", "Rangers", "Hibernian", "Kilmarnock", "Hearts", "Motherwell", "St Johnstone", "Dundee", "Hamilton Academical", "Partick Thistle", "Ross County"],
  "2018": ["Celtic", "Rangers", "Kilmarnock", "Aberdeen", "Hibernian", "Hearts", "St Johnstone", "Motherwell", "Livingston", "Hamilton Academical", "St Mirren", "Dundee"],
  "2019": ["Celtic", "Rangers", "Motherwell", "Aberdeen", "Livingston", "Hibernian", "St Johnstone", "Kilmarnock", "St Mirren", "Ross County", "Hamilton Academical", "Hearts"],
  "2020": ["Rangers", "Celtic", "Hibernian", "Aberdeen", "St Johnstone", "Livingston", "Motherwell", "St Mirren", "Dundee United", "Ross County", "Kilmarnock", "Hamilton Academical"],
  "2021": ["Celtic", "Rangers", "Hearts", "Dundee United", "Motherwell", "Ross County", "Livingston", "Hibernian", "St Mirren", "Aberdeen", "St Johnstone", "Dundee"],
  "2022": ["Celtic", "Rangers", "Aberdeen", "Hearts", "Hibernian", "St Mirren", "Motherwell", "Livingston", "St Johnstone", "Kilmarnock", "Ross County", "Dundee United"],
  "2023": ["Celtic", "Rangers", "Hearts", "Kilmarnock", "St Mirren", "Dundee", "Aberdeen", "Hibernian", "Motherwell", "St Johnstone", "Ross County", "Livingston"],
  "2024": ["Celtic", "Rangers", "Hearts", "Kilmarnock", "St Mirren", "Dundee", "Aberdeen", "Hibernian", "Motherwell", "St Johnstone", "Ross County", "Dundee United"],
  "2025": ["Celtic", "Rangers", "Aberdeen", "Hearts", "Hibernian", "Kilmarnock", "St Mirren", "Dundee", "Dundee United", "Motherwell", "Ross County", "St Johnstone"],
  "2026": ["Celtic", "Rangers", "Aberdeen", "Hearts", "Hibernian", "Kilmarnock", "St Mirren", "Dundee", "Dundee United", "Motherwell", "Ross County", "St Johnstone"]
};

// ============================================================================
// 4. SEASON-BY-SEASON HISTORICAL STANDINGS / PARTICIPANTS: UKRAINE
// ============================================================================
const UKR_SEASONS = {
  "1991": ["Tavriya Simferopol", "Dynamo Kyiv", "Dnipro", "Shakhtar Donetsk", "Chornomorets Odesa", "Metalist Kharkiv", "Karpaty Lviv", "Metalurh Zaporizhzhia", "Nyva Ternopil", "Bukovyna Chernivtsi", "Zorya Luhansk", "Kremin Kremenchuk", "Nyva Vinnytsia", "Torpedo Zaporizhzhia", "Volyn Lutsk", "Prykarpattya Ivano-Frankivsk"],
  "1992": ["Dynamo Kyiv", "Dnipro", "Chornomorets Odesa", "Shakhtar Donetsk", "Metalist Kharkiv", "Karpaty Lviv", "Metalurh Zaporizhzhia", "Kryvbas Kryvyi Rih", "Kremin Kremenchuk", "Tavriya Simferopol", "Volyn Lutsk", "Bukovyna Chernivtsi", "Torpedo Zaporizhzhia", "Nyva Ternopil", "Zorya Luhansk", "Veres Rivne"],
  "1993": ["Dynamo Kyiv", "Shakhtar Donetsk", "Chornomorets Odesa", "Dnipro", "Karpaty Lviv", "Kryvbas Kryvyi Rih", "Nyva Ternopil", "Tavriya Simferopol", "Nyva Vinnytsia", "Volyn Lutsk", "Veres Rivne", "Torpedo Zaporizhzhia", "Zorya Luhansk", "Kremin Kremenchuk", "Metalurh Zaporizhzhia", "Bukovyna Chernivtsi"],
  "1994": ["Dynamo Kyiv", "Chornomorets Odesa", "Dnipro", "Shakhtar Donetsk", "Tavriya Simferopol", "Kryvbas Kryvyi Rih", "Torpedo Zaporizhzhia", "Karpaty Lviv", "Metalurh Zaporizhzhia", "CSKA Kyiv", "Kremin Kremenchuk", "Nyva Ternopil", "Nyva Vinnytsia", "Prykarpattya Ivano-Frankivsk", "Volyn Lutsk", "Zorya Luhansk"],
  "1995": ["Dynamo Kyiv", "Chornomorets Odesa", "Dnipro", "CSKA Kyiv", "Metalurh Zaporizhzhia", "Torpedo Zaporizhzhia", "Karpaty Lviv", "Tavriya Simferopol", "Kremin Kremenchuk", "Shakhtar Donetsk", "Prykarpattya Ivano-Frankivsk", "Nyva Ternopil", "Kryvbas Kryvyi Rih", "Nyva Vinnytsia", "Zirka Kropyvnytskyi", "Zorya Luhansk"],
  "1996": ["Dynamo Kyiv", "Shakhtar Donetsk", "Vorskla Poltava", "Dnipro", "Karpaty Lviv", "Tavriya Simferopol", "Chornomorets Odesa", "Metalurh Zaporizhzhia", "Nyva Ternopil", "Zirka Kropyvnytskyi", "CSKA Kyiv", "Kryvbas Kryvyi Rih", "Prykarpattya Ivano-Frankivsk", "Torpedo Zaporizhzhia", "Kremin Kremenchuk", "Nyva Vinnytsia"],
  "1997": ["Dynamo Kyiv", "Shakhtar Donetsk", "Karpaty Lviv", "Dnipro", "Vorskla Poltava", "Metalurh Donetsk", "Nyva Ternopil", "Kryvbas Kryvyi Rih", "Metalurh Zaporizhzhia", "Prykarpattya Ivano-Frankivsk", "Zirka Kropyvnytskyi", "Metalist Kharkiv", "CSKA Kyiv", "Tavriya Simferopol", "Chornomorets Odesa", "Torpedo Zaporizhzhia"],
  "1998": ["Dynamo Kyiv", "Shakhtar Donetsk", "Kryvbas Kryvyi Rih", "Karpaty Lviv", "Metalist Kharkiv", "CSKA Kyiv", "Vorskla Poltava", "Tavriya Simferopol", "Prykarpattya Ivano-Frankivsk", "Dnipro", "Nyva Ternopil", "Metalurh Zaporizhzhia", "Zirka Kropyvnytskyi", "Metalurh Donetsk", "Mariupol", "Chornomorets Odesa"],
  "1999": ["Dynamo Kyiv", "Shakhtar Donetsk", "Kryvbas Kryvyi Rih", "Vorskla Poltava", "Metalist Kharkiv", "Metalurh Zaporizhzhia", "Metalurh Donetsk", "Karpaty Lviv", "CSKA Kyiv", "Dnipro", "Nyva Ternopil", "Tavriya Simferopol", "Prykarpattya Ivano-Frankivsk", "Chornomorets Odesa", "Zirka Kropyvnytskyi", "Mariupol"],
  "2000": ["Dynamo Kyiv", "Shakhtar Donetsk", "Dnipro", "Metalurh Donetsk", "CSKA Kyiv", "Tavriya Simferopol", "Metalurh Zaporizhzhia", "Metalist Kharkiv", "Karpaty Lviv", "Kryvbas Kryvyi Rih", "Vorskla Poltava", "Nyva Ternopil", "Stal Alchevsk", "Mariupol"],
  "2001": ["Shakhtar Donetsk", "Dynamo Kyiv", "Metalurh Donetsk", "Metalurh Zaporizhzhia", "Metalist Kharkiv", "Dnipro", "Tavriya Simferopol", "Karpaty Lviv", "Kryvbas Kryvyi Rih", "Mariupol", "Vorskla Poltava", "Arsenal Kyiv", "FC Oleksandriya", "Stal Alchevsk"],
  "2002": ["Dynamo Kyiv", "Shakhtar Donetsk", "Metalurh Donetsk", "Dnipro", "Arsenal Kyiv", "Volyn Lutsk", "Karpaty Lviv", "Chornomorets Odesa", "Tavriya Simferopol", "Mariupol", "Kryvbas Kryvyi Rih", "Vorskla Poltava", "Obolon Kyiv", "Metalurh Zaporizhzhia", "FC Oleksandriya", "Metalist Kharkiv"],
  "2003": ["Dynamo Kyiv", "Shakhtar Donetsk", "Dnipro", "Metalurh Donetsk", "Chornomorets Odesa", "Obolon Kyiv", "Mariupol", "Arsenal Kyiv", "Kryvbas Kryvyi Rih", "Metalurh Zaporizhzhia", "Tavriya Simferopol", "Volyn Lutsk", "Vorskla Poltava", "Karpaty Lviv", "Zirka Kropyvnytskyi", "Metalist Kharkiv"],
  "2004": ["Shakhtar Donetsk", "Dynamo Kyiv", "Metalurh Donetsk", "Dnipro", "Mariupol", "Chornomorets Odesa", "Tavriya Simferopol", "Volyn Lutsk", "Arsenal Kyiv", "Metalurh Zaporizhzhia", "Metalist Kharkiv", "Kryvbas Kryvyi Rih", "Stal Alchevsk", "Vorskla Poltava", "Obolon Kyiv", "Karpaty Lviv"],
  "2005": ["Shakhtar Donetsk", "Dynamo Kyiv", "Chornomorets Odesa", "Metalist Kharkiv", "Mariupol", "Metalurh Zaporizhzhia", "Dnipro", "Tavriya Simferopol", "Metalurh Donetsk", "Vorskla Poltava", "Stal Alchevsk", "Arsenal Kyiv", "Kryvbas Kryvyi Rih", "Volyn Lutsk", "Karpaty Lviv", "Zorya Luhansk"],
  "2006": ["Dynamo Kyiv", "Shakhtar Donetsk", "Metalist Kharkiv", "Dnipro", "Chornomorets Odesa", "Tavriya Simferopol", "Metalurh Zaporizhzhia", "Kryvbas Kryvyi Rih", "Metalurh Donetsk", "Vorskla Poltava", "Karpaty Lviv", "Zorya Luhansk", "Arsenal Kyiv", "Mariupol", "Stal Alchevsk", "Volyn Lutsk"],
  "2007": ["Shakhtar Donetsk", "Dynamo Kyiv", "Metalist Kharkiv", "Dnipro", "Tavriya Simferopol", "Arsenal Kyiv", "Chornomorets Odesa", "Vorskla Poltava", "Metalurh Zaporizhzhia", "Karpaty Lviv", "Zorya Luhansk", "Metalurh Donetsk", "Kryvbas Kryvyi Rih", "Mariupol", "Stal Alchevsk", "Volyn Lutsk"],
  "2008": ["Dynamo Kyiv", "Shakhtar Donetsk", "Metalist Kharkiv", "Metalurh Donetsk", "Vorskla Poltava", "Dnipro", "Metalurh Zaporizhzhia", "Tavriya Simferopol", "Karpaty Lviv", "Chornomorets Odesa", "Arsenal Kyiv", "Kryvbas Kryvyi Rih", "Zorya Luhansk", "Mariupol", "FC Lviv", "Obolon Kyiv"],
  "2009": ["Shakhtar Donetsk", "Dynamo Kyiv", "Metalist Kharkiv", "Dnipro", "Karpaty Lviv", "Tavriya Simferopol", "Arsenal Kyiv", "Metalurh Donetsk", "Metalurh Zaporizhzhia", "Obolon Kyiv", "Vorskla Poltava", "Mariupol", "Zorya Luhansk", "Kryvbas Kryvyi Rih", "Chornomorets Odesa", "Volyn Lutsk"],
  "2010": ["Shakhtar Donetsk", "Dynamo Kyiv", "Metalist Kharkiv", "Dnipro", "Karpaty Lviv", "Vorskla Poltava", "Tavriya Simferopol", "Metalurh Donetsk", "Arsenal Kyiv", "Obolon Kyiv", "Volyn Lutsk", "Zorya Luhansk", "Kryvbas Kryvyi Rih", "Mariupol", "PFC Sevastopol", "Metalurh Zaporizhzhia"],
  "2011": ["Shakhtar Donetsk", "Dynamo Kyiv", "Metalist Kharkiv", "Dnipro", "Arsenal Kyiv", "Tavriya Simferopol", "Metalurh Donetsk", "Vorskla Poltava", "Chornomorets Odesa", "Kryvbas Kryvyi Rih", "Mariupol", "Volyn Lutsk", "Zorya Luhansk", "Karpaty Lviv", "Obolon Kyiv", "FC Oleksandriya"],
  "2012": ["Shakhtar Donetsk", "Metalist Kharkiv", "Dynamo Kyiv", "Dnipro", "Metalurh Donetsk", "Chornomorets Odesa", "Kryvbas Kryvyi Rih", "Arsenal Kyiv", "Mariupol", "Zorya Luhansk", "Tavriya Simferopol", "Vorskla Poltava", "Volyn Lutsk", "Karpaty Lviv", "Hoverla Uzhhorod", "Metalurh Zaporizhzhia"],
  "2013": ["Shakhtar Donetsk", "Dnipro", "Metalist Kharkiv", "Dynamo Kyiv", "Chornomorets Odesa", "Metalurh Donetsk", "Zorya Luhansk", "Vorskla Poltava", "Mariupol", "Karpaty Lviv", "PFC Sevastopol", "Volyn Lutsk", "Hoverla Uzhhorod", "Metalurh Zaporizhzhia", "Tavriya Simferopol", "Arsenal Kyiv"],
  "2014": ["Dynamo Kyiv", "Shakhtar Donetsk", "Dnipro", "Zorya Luhansk", "Vorskla Poltava", "Metalist Kharkiv", "Metalurh Zaporizhzhia", "Olimpik Donetsk", "Volyn Lutsk", "Metalurh Donetsk", "Chornomorets Odesa", "Hoverla Uzhhorod", "Karpaty Lviv", "Mariupol"],
  "2015": ["Dynamo Kyiv", "Shakhtar Donetsk", "Dnipro", "Zorya Luhansk", "Vorskla Poltava", "FC Oleksandriya", "Karpaty Lviv", "Stal Kamianske", "Olimpik Donetsk", "Metalist Kharkiv", "Chornomorets Odesa", "Volyn Lutsk", "Hoverla Uzhhorod", "Metalurh Zaporizhzhia"],
  "2016": ["Shakhtar Donetsk", "Dynamo Kyiv", "Zorya Luhansk", "Olimpik Donetsk", "FC Oleksandriya", "Chornomorets Odesa", "Vorskla Poltava", "Stal Kamianske", "Karpaty Lviv", "Dnipro", "Volyn Lutsk", "Zirka Kropyvnytskyi"],
  "2017": ["Shakhtar Donetsk", "Dynamo Kyiv", "Vorskla Poltava", "Zorya Luhansk", "Mariupol", "FC Oleksandriya", "Karpaty Lviv", "Olimpik Donetsk", "Veres Rivne", "Zirka Kropyvnytskyi", "Chornomorets Odesa", "Stal Kamianske"],
  "2018": ["Shakhtar Donetsk", "Dynamo Kyiv", "FC Oleksandriya", "Mariupol", "Zorya Luhansk", "FC Lviv", "Vorskla Poltava", "Desna Chernihiv", "Olimpik Donetsk", "Karpaty Lviv", "Chornomorets Odesa", "Arsenal Kyiv"],
  "2019": ["Shakhtar Donetsk", "Dynamo Kyiv", "Zorya Luhansk", "Desna Chernihiv", "FC Oleksandriya", "Kolos Kovalivka", "Dnipro-1", "Mariupol", "Vorskla Poltava", "Olimpik Donetsk", "FC Lviv", "Karpaty Lviv"],
  "2020": ["Dynamo Kyiv", "Shakhtar Donetsk", "Zorya Luhansk", "Kolos Kovalivka", "Vorskla Poltava", "Desna Chernihiv", "Dnipro-1", "FC Lviv", "FC Oleksandriya", "Inhulets Petrove", "Mariupol", "Rukh Lviv", "Olimpik Donetsk", "FC Mynai"],
  "2021": ["Shakhtar Donetsk", "Dynamo Kyiv", "Dnipro-1", "Zorya Luhansk", "Vorskla Poltava", "FC Oleksandriya", "Desna Chernihiv", "Kolos Kovalivka", "Veres Rivne", "Metalist 1925 Kharkiv", "Rukh Lviv", "FC Lviv", "Chornomorets Odesa", "Inhulets Petrove", "Mariupol", "FC Mynai"],
  "2022": ["Shakhtar Donetsk", "Dnipro-1", "Zorya Luhansk", "Dynamo Kyiv", "Vorskla Poltava", "FC Oleksandriya", "Kryvbas Kryvyi Rih", "Kolos Kovalivka", "Chornomorets Odesa", "FC Mynai", "Inhulets Petrove", "Metalist 1925 Kharkiv", "Veres Rivne", "Rukh Lviv", "Metalist Kharkiv", "FC Lviv"],
  "2023": ["Shakhtar Donetsk", "Dynamo Kyiv", "Kryvbas Kryvyi Rih", "Dnipro-1", "Polissya Zhytomyr", "Rukh Lviv", "LNZ Cherkasy", "FC Oleksandriya", "Vorskla Poltava", "Kolos Kovalivka", "Chornomorets Odesa", "Zorya Luhansk", "Obolon Kyiv", "Veres Rivne", "FC Mynai", "Metalist 1925 Kharkiv"],
  "2024": ["Shakhtar Donetsk", "Dynamo Kyiv", "Kryvbas Kryvyi Rih", "Polissya Zhytomyr", "Rukh Lviv", "LNZ Cherkasy", "FC Oleksandriya", "Vorskla Poltava", "Kolos Kovalivka", "Chornomorets Odesa", "Zorya Luhansk", "Obolon Kyiv", "Veres Rivne", "Karpaty Lviv", "Inhulets Petrove", "Livyi Bereh Kyiv"],
  "2025": ["Shakhtar Donetsk", "Dynamo Kyiv", "Kryvbas Kryvyi Rih", "Polissya Zhytomyr", "FC Oleksandriya", "Karpaty Lviv", "Rukh Lviv", "LNZ Cherkasy", "Zorya Luhansk", "Vorskla Poltava", "Kolos Kovalivka", "Chornomorets Odesa", "Veres Rivne", "Obolon Kyiv", "Inhulets Petrove", "Metalist 1925 Kharkiv"],
  "2026": ["Shakhtar Donetsk", "Dynamo Kyiv", "Kryvbas Kryvyi Rih", "Polissya Zhytomyr", "FC Oleksandriya", "Karpaty Lviv", "Rukh Lviv", "LNZ Cherkasy", "Zorya Luhansk", "Vorskla Poltava", "Kolos Kovalivka", "Chornomorets Odesa", "Veres Rivne", "Obolon Kyiv", "Inhulets Petrove", "Metalist 1925 Kharkiv"]
};

// ============================================================================
// 5. HISTORICAL EUROPEAN QUALIFIERS BY SEASON (1990 - 2026)
// ============================================================================
const SCO_QUALIFIERS = {
  "1990": { cl: ["Rangers"], uefa: ["Aberdeen", "Hearts", "Dundee United"] },
  "1991": { cl: ["Rangers"], uefa: ["Aberdeen", "Celtic"] },
  "1992": { cl: ["Rangers"], uefa: ["Hearts", "Celtic", "Hibernian"] },
  "1993": { cl: ["Rangers"], uefa: ["Aberdeen", "Hearts", "Celtic"] },
  "1994": { cl: ["Rangers"], uefa: ["Aberdeen", "Motherwell"] },
  "1995": { cl: ["Rangers"], uefa: ["Motherwell", "Hibernian", "Celtic"] },
  "1996": { cl: ["Rangers"], uefa: ["Celtic", "Aberdeen"] },
  "1997": { cl: ["Rangers"], uefa: ["Celtic", "Dundee United"] },
  "1998": { cl: ["Celtic"], uefa: ["Rangers", "Kilmarnock", "Hearts"] },
  "1999": { cl: ["Rangers"], uefa: ["Celtic", "St Johnstone", "Kilmarnock"] },
  "2000": { cl: ["Rangers", "Celtic"], uefa: ["Hearts", "Aberdeen"] },
  "2001": { cl: ["Celtic", "Rangers"], uefa: ["Hibernian", "Kilmarnock"] },
  "2002": { cl: ["Celtic", "Rangers"], uefa: ["Aberdeen", "Livingston"] },
  "2003": { cl: ["Rangers", "Celtic"], uefa: ["Hearts", "Dundee"] },
  "2004": { cl: ["Celtic", "Rangers"], uefa: ["Hearts", "Dunfermline Athletic"] },
  "2005": { cl: ["Rangers", "Celtic"], uefa: ["Hibernian", "Dundee United"] },
  "2006": { cl: ["Celtic", "Hearts"], uefa: ["Rangers", "Gretna"] },
  "2007": { cl: ["Celtic", "Rangers"], uefa: ["Aberdeen", "Dunfermline Athletic"] },
  "2008": { cl: ["Celtic", "Rangers"], uefa: ["Motherwell", "Hibernian"] },
  "2009": { cl: ["Rangers", "Celtic"], uefa: ["Hearts", "Aberdeen", "Falkirk", "Motherwell"] },
  "2010": { cl: ["Rangers", "Celtic"], uefa: ["Dundee United", "Hibernian", "Motherwell"] },
  "2011": { cl: ["Rangers", "Celtic"], uefa: ["Hearts", "Dundee United"] },
  "2012": { cl: ["Celtic", "Motherwell"], uefa: ["Dundee United", "St Johnstone", "Hearts"] },
  "2013": { cl: ["Celtic"], uefa: ["Motherwell", "St Johnstone", "Hibernian"] },
  "2014": { cl: ["Celtic"], uefa: ["Motherwell", "Aberdeen", "St Johnstone"] },
  "2015": { cl: ["Celtic"], uefa: ["Aberdeen", "Inverness Caledonian Thistle", "St Johnstone"] },
  "2016": { cl: ["Celtic"], uefa: ["Aberdeen", "Hearts", "Hibernian"] },
  "2017": { cl: ["Celtic"], uefa: ["Aberdeen", "Rangers", "St Johnstone"] },
  "2018": { cl: ["Celtic"], uefa: ["Aberdeen", "Rangers", "Hibernian"] },
  "2019": { cl: ["Celtic"], uefa: ["Rangers", "Aberdeen", "Kilmarnock"] },
  "2020": { cl: ["Celtic"], uefa: ["Rangers", "Motherwell", "Aberdeen"] },
  "2021": { cl: ["Rangers", "Celtic"], uefa: ["St Johnstone"], uecl: ["Hibernian", "Aberdeen"] },
  "2022": { cl: ["Celtic", "Rangers"], uefa: ["Hearts"], uecl: ["Dundee United", "Motherwell"] },
  "2023": { cl: ["Celtic", "Rangers"], uefa: ["Aberdeen"], uecl: ["Hearts", "Hibernian"] },
  "2024": { cl: ["Celtic", "Rangers"], uefa: ["Hearts"], uecl: ["Kilmarnock", "St Mirren"] },
  "2025": { cl: ["Celtic", "Rangers"], uefa: ["Hearts", "Aberdeen"], uecl: ["Kilmarnock", "St Mirren"] },
  "2026": { cl: ["Celtic", "Rangers"], uefa: ["Hearts", "Aberdeen"], uecl: ["Kilmarnock", "St Mirren"] }
};

const UKR_QUALIFIERS = {
  "1990": { cl: [], uefa: [] },
  "1991": { cl: ["Dynamo Kyiv"], uefa: [] },
  "1992": { cl: ["Tavriya Simferopol"], uefa: ["Dynamo Kyiv", "Chornomorets Odesa"] },
  "1993": { cl: ["Dynamo Kyiv"], uefa: ["Dnipro"] },
  "1994": { cl: ["Dynamo Kyiv"], uefa: ["Shakhtar Donetsk", "Chornomorets Odesa"] },
  "1995": { cl: ["Dynamo Kyiv"], uefa: ["Dnipro", "Chornomorets Odesa"] },
  "1996": { cl: ["Dynamo Kyiv"], uefa: ["Chornomorets Odesa", "Shakhtar Donetsk"] },
  "1997": { cl: ["Dynamo Kyiv"], uefa: ["Shakhtar Donetsk", "Vorskla Poltava", "Dnipro"] },
  "1998": { cl: ["Dynamo Kyiv"], uefa: ["Shakhtar Donetsk"] },
  "1999": { cl: ["Dynamo Kyiv"], uefa: ["Shakhtar Donetsk", "Kryvbas Kryvyi Rih"] },
  "2000": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Kryvbas Kryvyi Rih", "Vorskla Poltava"] },
  "2001": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Dnipro", "CSKA Kyiv"] },
  "2002": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Metalurh Donetsk", "Metalurh Zaporizhzhia"] },
  "2003": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Metalurh Donetsk", "Dnipro"] },
  "2004": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Dnipro", "Metalurh Donetsk"] },
  "2005": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Dnipro", "Metalurh Donetsk"] },
  "2006": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Chornomorets Odesa", "Metalurh Zaporizhzhia"] },
  "2007": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Metalist Kharkiv", "Dnipro"] },
  "2008": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Metalist Kharkiv", "Dnipro"] },
  "2009": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Metalist Kharkiv", "Vorskla Poltava", "Metalurh Donetsk"] },
  "2010": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Metalist Kharkiv", "Dnipro", "Karpaty Lviv", "Tavriya Simferopol"] },
  "2011": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Metalist Kharkiv", "Dnipro", "Karpaty Lviv", "Vorskla Poltava"] },
  "2012": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Metalist Kharkiv", "Dnipro", "Metalurh Donetsk", "Arsenal Kyiv"] },
  "2013": { cl: ["Shakhtar Donetsk", "Metalist Kharkiv"], uefa: ["Dynamo Kyiv", "Dnipro", "Chornomorets Odesa", "Metalurh Donetsk"] },
  "2014": { cl: ["Shakhtar Donetsk", "Dnipro"], uefa: ["Metalist Kharkiv", "Dynamo Kyiv", "Chornomorets Odesa", "Zorya Luhansk"] },
  "2015": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Dnipro", "Zorya Luhansk", "Vorskla Poltava"] },
  "2016": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Zorya Luhansk", "Vorskla Poltava", "FC Oleksandriya"] },
  "2017": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Zorya Luhansk", "FC Oleksandriya", "Olimpik Donetsk"] },
  "2018": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Vorskla Poltava", "Zorya Luhansk", "Mariupol"] },
  "2019": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["FC Oleksandriya", "Mariupol", "Zorya Luhansk"] },
  "2020": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Zorya Luhansk", "Desna Chernihiv", "Kolos Kovalivka"] },
  "2021": { cl: ["Dynamo Kyiv", "Shakhtar Donetsk"], uefa: ["Zorya Luhansk"], uecl: ["Kolos Kovalivka", "Vorskla Poltava"] },
  "2022": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Dnipro-1"], uecl: ["Zorya Luhansk", "Vorskla Poltava"] },
  "2023": { cl: ["Shakhtar Donetsk", "Dnipro-1"], uefa: ["Zorya Luhansk"], uecl: ["Dynamo Kyiv", "Vorskla Poltava"] },
  "2024": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Kryvbas Kryvyi Rih"], uecl: ["Dnipro-1", "Polissya Zhytomyr"] },
  "2025": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Kryvbas Kryvyi Rih", "Polissya Zhytomyr"], uecl: ["FC Oleksandriya", "Rukh Lviv"] },
  "2026": { cl: ["Shakhtar Donetsk", "Dynamo Kyiv"], uefa: ["Kryvbas Kryvyi Rih", "Polissya Zhytomyr"], uecl: ["FC Oleksandriya", "Rukh Lviv"] }
};

// ============================================================================
// 6. BUILDER FUNCTIONS
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

      // Slight calibration based on finish in that season
      let att = meta.att;
      let mid = meta.mid;
      let def = meta.def;

      if (index === 0) {
        // Champion bump
        att = Math.max(att, 4);
        mid = Math.max(mid, 4);
      } else if (index >= teamNames.length - 2) {
        // Relegation zone downgrade
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

// Generate all Scotland & Ukraine files
console.log("⚽ Generating Scottish League files (1990-2026)...");
const scoCount = generateLeagueFiles('sco', SCO_SEASONS, SCO_CLUBS, SCO_DIR);
console.log(`✅ Created ${scoCount} Scottish league files in ${SCO_DIR}`);

console.log("⚽ Generating Ukrainian League files (1991-2026)...");
const ukrCount = generateLeagueFiles('ukr', UKR_SEASONS, UKR_CLUBS, UKR_DIR);
console.log(`✅ Created ${ukrCount} Ukrainian league files in ${UKR_DIR}`);

module.exports = {
  SCO_QUALIFIERS,
  UKR_QUALIFIERS
};
