/**
 * Játék sablon — cseréld le valódi játéklogikára
 *
 * GameUtils elérhető a ../../shared/js/utils.js fájlból:
 *   GameUtils.playSuccess()   — sikeres hangeffekt
 *   GameUtils.playError()     — hibás válasz hangja
 *   GameUtils.celebrate(msg)  — teljes képernyős ünneplés
 *   GameUtils.shuffle(arr)    — tömb megkeverése
 *   GameUtils.randInt(a, b)   — véletlenszám a..b között
 *   GameUtils.pick(arr)       — véletlenszerű elem tömbből
 */

let pontszam = 0;

function frissitPontszam(delta = 1) {
  pontszam += delta;
  document.getElementById('score').textContent = pontszam;
}

function ujrakezdes() {
  pontszam = 0;
  frissitPontszam(0);
  // TODO: tábla visszaállítása
}

document.getElementById('start-btn').addEventListener('click', () => {
  ujrakezdes();
  // TODO: játéklogika indítása
  GameUtils.playSuccess();
});
