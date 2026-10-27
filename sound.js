// Synthesized machine sounds (WebAudio, no audio files).
(function () {
  let ctx = null;
  let muted = (() => { try { return localStorage.getItem('vm.muted') === '1'; } catch { return false; } })();
  const ac = () => {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  function tone({ freq = 440, to, type = 'sine', dur = 0.1, gain = 0.15, delay = 0, attack = 0.004 }) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.1, gain = 0.1, delay = 0, filter = 1200, q = 1, type = 'bandpass' }) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = filter; f.Q.value = q;
    g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  const Sound = {
    get muted() { return muted; },
    set muted(v) { muted = v; try { localStorage.setItem('vm.muted', v ? '1' : '0'); } catch {} },
    key() { tone({ freq: 1320, type: 'square', dur: 0.05, gain: 0.04 }); },
    coin(delay = 0) {
      tone({ freq: 2600, dur: 0.18, gain: 0.07, delay });
      tone({ freq: 3900, dur: 0.12, gain: 0.04, delay: delay + 0.01 });
      noise({ dur: 0.05, gain: 0.05, filter: 5000, delay });
    },
    drop(delay = 0) { // coin falling down the chute
      tone({ freq: 2100, dur: 0.08, gain: 0.05, delay });
      tone({ freq: 1700, dur: 0.1, gain: 0.05, delay: delay + 0.09 });
      tone({ freq: 2300, dur: 0.14, gain: 0.04, delay: delay + 0.17 });
    },
    motor(dur = 1.1) {
      tone({ freq: 70, to: 90, type: 'sawtooth', dur, gain: 0.05, attack: 0.08 });
      noise({ dur, gain: 0.03, filter: 300, q: 0.7 });
    },
    thud(delay = 0) {
      tone({ freq: 160, to: 45, type: 'sine', dur: 0.25, gain: 0.35, delay });
      noise({ dur: 0.12, gain: 0.12, filter: 500, delay });
    },
    error() { tone({ freq: 160, type: 'square', dur: 0.12, gain: 0.05 }); tone({ freq: 120, type: 'square', dur: 0.18, gain: 0.05, delay: 0.13 }); },
    success() { [880, 1108, 1318, 1760].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.18, gain: 0.07, delay: i * 0.07 })); },
    flap() { noise({ dur: 0.18, gain: 0.08, filter: 900 }); tone({ freq: 300, to: 180, dur: 0.12, gain: 0.05 }); },
    crunch() { for (let i = 0; i < 4; i++) noise({ dur: 0.07, gain: 0.12, filter: 2500 + Math.random() * 2000, delay: i * 0.09 }); },
  };
  window.Sound = Sound;
})();
