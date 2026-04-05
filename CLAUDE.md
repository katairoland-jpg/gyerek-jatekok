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

## Meglévő játékok
| ID | Cím | Leírás |
|----|-----|--------|
| kislanyka | Kislány kalandjai | Canvas platformer, nyilakkal irányítható kislány, akadályok |
