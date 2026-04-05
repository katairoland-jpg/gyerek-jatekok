# Gyerek Játékok — Claude útmutató

## Projekt célja
Kisgyerekeknek szóló böngészős játékok, helyi HTML fájlokban tárolva,
GitHub Pages-en publikálva.

## GitHub
- **Repo:** https://github.com/katairoland-jpg/gyerek-jatekok
- **Élő oldal:** https://katairoland-jpg.github.io/gyerek-jatekok/
- **Branch:** main
- **Deploy:** automatikus GitHub Actions push után (~1 perc)

## Git szabályok
- Minden fejlesztés után azonnal commit + push a `main` ágra.
- Commit üzenetek magyarul.
- Mindig add hozzá: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

## Fájlstruktúra
```
index.html                  ← Főoldal (játéklista)
games.json                  ← Játékok nyilvántartása
IDEAS.md                    ← Játékötletek backlogja
shared/css/base.css         ← Közös stílusok, design tokenek
shared/js/utils.js          ← GameUtils (hang, ünneplés, véletlenszám)
games/<game-id>/
  index.html                ← Játék oldala
  style.css                 ← Játékspecifikus stílusok
  game.js                   ← Játéklogika
```

## Új játék hozzáadásának folyamata
1. Másold a `games/game-template/` mappát → `games/<game-id>/`
2. Fejleszd ki a játékot
3. Add hozzá a bejegyzést a `games.json`-hoz
4. Commit + push → automatikusan megjelenik a főoldalon

## Design elvek
- Gyerekbarát, vidám színek (`shared/css/base.css` tokenek)
- Nagy kattintható felületek
- Hangeffektek `GameUtils.playSuccess()` / `GameUtils.playError()`
- Ünneplés `GameUtils.celebrate()` siker esetén
- Magyar szöveg mindenhol

## Physics & Game Libraries (`shared/libs/`)

Ezek a könyvtárak helyben elérhetők, CDN nélkül használhatók:

| Fájl | Leírás | Mikor használd? |
|------|--------|-----------------|
| `shared/libs/matter.min.js` | **Matter.js 0.19** — 2D rigid body fizika | Alapértelmezett fizikás játékoknál: platformer, fizika puzzle, jármű |
| `shared/libs/planck.min.js` | **Planck.js 1.0** — Box2D JS portja, pontosabb fizika | Ha precíz kerék/joint/motorkerék szimuláció kell (pl. Elasto Mania) |
| `shared/libs/simple-physics/` | **simple-physics** referencia implementáció | Elasto Mania-szerű kerék+felfüggesztés fizika tanulmányozásához |

### Beillesztés játékba
```html
<!-- Matter.js -->
<script src="../../shared/libs/matter.min.js"></script>

<!-- Planck.js -->
<script src="../../shared/libs/planck.min.js"></script>
```

### simple-physics fájlok (referencia)
```
shared/libs/simple-physics/scripts/
  physics.js   ← fizika motor (rugók, testek)
  bike.js      ← kerék + váz + felfüggesztés logika
  vector.js    ← 2D vektor műveletek
  render.js    ← Canvas renderer
  main.js      ← belépési pont
```

### Elasto Mania-szerű játék stack
```
Planck.js (fizika) + vanilla Canvas (renderer)
```
Kerék = `RevoluteJoint`, felfüggesztés = `PrismaticJoint` + `spring force`, pálya = `ChainShape` poligonok.

---

## Meglévő játékok
| ID | Cím | Leírás |
|----|-----|--------|
| kislanyka | Kislány kalandjai | Canvas platformer, nyilakkal irányítható kislány; Világ 1: rét + akadályok (1 perc), Világ 2: erdő, szigetek, víz |
