/**
 * Historical League & European Cup Generator for Soviet Union (1988-1991)
 * Generates:
 *  - src/data/leagues/ussr/ussr88.json ... ussr91.json
 * Also exports historical qualifiers to merge into src/data/qualifiersBySeason.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const USSR_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues', 'ussr');

fs.mkdirSync(USSR_DIR, { recursive: true });

const USSR_CLUBS_META = {
  // Russian SFSR clubs (aligned with rus92.json)
  "Spartak Moscow":        { primary: "#CC0000", secondary: "#FFFFFF", kit: "swe92/0.png", att: 5, mid: 5, def: 4 },
  "CSKA Moscow":           { primary: "#D90429", secondary: "#003399", kit: "swe92/2.png", att: 5, mid: 4, def: 4 },
  "Dynamo Moscow":         { primary: "#005BAA", secondary: "#FFFFFF", kit: "ger88/2.png", att: 4, mid: 4, def: 3 },
  "Torpedo Moscow":        { primary: "#000000", secondary: "#FFFFFF", kit: "swe92/3.png", att: 4, mid: 4, def: 4 },
  "Lokomotiv Moscow":      { primary: "#008000", secondary: "#CC0000", kit: "swe92/1.png", att: 3, mid: 3, def: 3 },
  "Zenit Leningrad":       { primary: "#0077C8", secondary: "#FFFFFF", kit: "swe92/5.png", att: 3, mid: 3, def: 3 },
  "Rotor Volgograd":       { primary: "#003399", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 2 },
  "Spartak Vladikavkaz":   { primary: "#CC0000", secondary: "#FFFFFF", kit: "swe92/5.png", att: 3, mid: 3, def: 3 },

  // Ukrainian SSR clubs (aligned with ukr91.json / ukr92.json)
  "Dynamo Kyiv":           { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 5, mid: 5, def: 4 },
  "Dnipro":                { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 4, mid: 4, def: 4 },
  "Shakhtar Donetsk":      { primary: "#FF8C00", secondary: "#000000", kit: "ecu93/1.png", att: 4, mid: 3, def: 3 },
  "Chornomorets Odesa":    { primary: "#000080", secondary: "#000000", kit: "swe92/5.png", att: 4, mid: 3, def: 3 },
  "Metalist Kharkiv":      { primary: "#FFD700", secondary: "#003399", kit: "mex86/3.png", att: 3, mid: 3, def: 3 },
  "Metalurh Zaporizhzhia": { primary: "#CC0000", secondary: "#FFFF00", kit: "ger88/4.png", att: 3, mid: 3, def: 2 },

  // Other Soviet Republic clubs
  "Zalgiris Vilnius":      { primary: "#008000", secondary: "#FFFFFF", kit: "swe92/1.png", att: 4, mid: 3, def: 3 },
  "Dinamo Minsk":          { primary: "#003399", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Dinamo Tbilisi":        { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Ararat Yerevan":        { primary: "#FFFFFF", secondary: "#CC0000", kit: "swe92/0.png", att: 3, mid: 3, def: 3 },
  "Neftchi Baku":          { primary: "#000000", secondary: "#FFFFFF", kit: "swe92/3.png", att: 2, mid: 2, def: 2 },
  "Kairat Almaty":         { primary: "#FFD700", secondary: "#000000", kit: "mex86/3.png", att: 2, mid: 2, def: 2 },
  "Pamir Dushanbe":        { primary: "#CC0000", secondary: "#008000", kit: "ger88/1.png", att: 3, mid: 2, def: 2 },
  "Pakhtakor Tashkent":    { primary: "#005BAA", secondary: "#FFFFFF", kit: "swe92/0.png", att: 3, mid: 2, def: 2 }
};

// Soviet Top League Season Tables (1988-1991, Champion first)
const USSR_SEASONS = {
  "1988": [
    "Dnipro", "Dynamo Kyiv", "Torpedo Moscow", "Spartak Moscow",
    "Zalgiris Vilnius", "Zenit Leningrad", "Lokomotiv Moscow", "Shakhtar Donetsk",
    "Ararat Yerevan", "Dynamo Moscow", "Metalist Kharkiv", "Dinamo Minsk",
    "Chornomorets Odesa", "Dinamo Tbilisi", "Neftchi Baku", "Kairat Almaty"
  ],
  "1989": [
    "Spartak Moscow", "Dnipro", "Dynamo Kyiv", "Zalgiris Vilnius",
    "Torpedo Moscow", "Chornomorets Odesa", "Metalist Kharkiv", "Dynamo Moscow",
    "Dinamo Minsk", "Rotor Volgograd", "Dinamo Tbilisi", "Ararat Yerevan",
    "Pamir Dushanbe", "Shakhtar Donetsk", "Lokomotiv Moscow", "Zenit Leningrad"
  ],
  "1990": [
    "Dynamo Kyiv", "CSKA Moscow", "Dynamo Moscow", "Torpedo Moscow",
    "Spartak Moscow", "Dnipro", "Ararat Yerevan", "Shakhtar Donetsk",
    "Chornomorets Odesa", "Pamir Dushanbe", "Metalist Kharkiv", "Dinamo Minsk",
    "Rotor Volgograd"
  ],
  "1991": [
    "CSKA Moscow", "Spartak Moscow", "Torpedo Moscow", "Chornomorets Odesa",
    "Dynamo Kyiv", "Dynamo Moscow", "Dnipro", "Ararat Yerevan",
    "Shakhtar Donetsk", "Pamir Dushanbe", "Spartak Vladikavkaz", "Metalist Kharkiv",
    "Dinamo Minsk", "Lokomotiv Moscow", "Pakhtakor Tashkent", "Metalurh Zaporizhzhia"
  ]
};

const USSR_QUALIFIERS = {
  "1988": { cl: ["Spartak Moscow"], uefa: ["Dnipro", "Zalgiris Vilnius", "Torpedo Moscow", "Dinamo Minsk"] },
  "1989": { cl: ["Dnipro"], uefa: ["Dynamo Kyiv", "Spartak Moscow", "Zalgiris Vilnius", "Zenit Leningrad"] },
  "1990": { cl: ["Spartak Moscow"], uefa: ["Dnipro", "Torpedo Moscow", "Chornomorets Odesa"] },
  "1991": { cl: ["Dynamo Kyiv"], uefa: ["Spartak Moscow", "Torpedo Moscow", "Dynamo Moscow"] }
};

function generateUssrFiles() {
  let count = 0;
  for (const [seasonYear, teamNames] of Object.entries(USSR_SEASONS)) {
    const shortYr = seasonYear.slice(-2);
    const filename = `ussr${shortYr}.json`;
    const fullPath = path.join(USSR_DIR, filename);

    const teamsData = teamNames.map((teamName, index) => {
      const meta = USSR_CLUBS_META[teamName] || {
        primary: "#CC0000",
        secondary: "#FFFFFF",
        kit: "swe92/0.png",
        att: 3,
        mid: 3,
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
        id: `ussr${shortYr}`,
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
  const count = generateUssrFiles();
  console.log(`Generated ${count} Soviet Union (1988-1991) files in ${USSR_DIR}`);
}

module.exports = {
  USSR_QUALIFIERS
};
