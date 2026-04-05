/**
 * Gyerek Játék Platform — Közös segédeszközök
 */

const GameUtils = (() => {

  /** Egyszerű hang lejátszása Web Audio API-val (nem kell hangfájl) */
  function playTone(frequency = 440, duration = 0.15, type = 'sine') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) { /* hang nem elérhető */ }
  }

  /** Sikeres hangeffekt */
  function playSuccess() {
    playTone(523, 0.12);
    setTimeout(() => playTone(659, 0.12), 120);
    setTimeout(() => playTone(784, 0.25), 240);
  }

  /** Hibás válasz hangeffekt */
  function playError() {
    playTone(300, 0.2, 'sawtooth');
  }

  /**
   * Teljes képernyős ünneplés overlay megjelenítése.
   * @param {string} message  pl. "Szuper! 🎉"
   * @param {number} delay    ms elteltével eltűnik
   * @param {Function} onDone visszahívás eltűnés után
   */
  function celebrate(message = 'Szuper! 🎉', delay = 2000, onDone = null) {
    playSuccess();
    const el = document.createElement('div');
    el.className = 'celebrate';
    el.innerHTML = `<span>${message}</span>
      <button class="btn btn-primary" onclick="this.closest('.celebrate').remove()${onDone ? '; onDone()' : ''}">
        Újra!
      </button>`;
    document.body.appendChild(el);
    if (delay) setTimeout(() => el.remove(), delay + 1500);
  }

  /** Fisher-Yates keverés (új tömböt ad vissza) */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Véletlenszám min és max között (mindkét végpont beleértve) */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** Véletlenszerű elem kiválasztása tömbből */
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  return { playTone, playSuccess, playError, celebrate, shuffle, randInt, pick };
})();
