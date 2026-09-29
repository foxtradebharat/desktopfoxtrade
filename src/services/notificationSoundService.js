/**
 * notificationSoundService.js
 * 
 * Permanent Target Chord Notification Sound Engine for FoxTrade.
 * Uses Web Audio API to synthesize the ascending 4-note victory chord
 * across all notifications with zero latency and 100% offline reliability.
 */

class NotificationSoundEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;

    try {
      this.isMuted = localStorage.getItem('tradeontip_notif_muted') === 'true';
    } catch (_) {
      this.isMuted = false;
    }

    // Auto-unlock Web Audio on first user interaction
    this.handleFirstInteraction = this.handleFirstInteraction.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this.handleFirstInteraction, { once: true });
      window.addEventListener('keydown', this.handleFirstInteraction, { once: true });
    }
  }

  handleFirstInteraction() {
    this.ensureAudioContext();
  }

  ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    try {
      localStorage.setItem('tradeontip_notif_muted', String(this.isMuted));
    } catch (_) {}
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  /**
   * Permanent Notification Sound (Ascending Target 4-Note Chord)
   * Plays across ALL notifications: C5 ➔ E5 ➔ G5 ➔ C6
   */
  playPushChime() {
    if (this.isMuted) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5 (523.25 Hz), E5 (659.25 Hz), G5 (783.99 Hz), C6 (1046.50 Hz)
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const startTime = now + (i * 0.06);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.44);
    });
  }

  playUrgentAlert() {
    // Uses the permanent Target chord requested by user
    this.playPushChime();
  }

  playSuccessChime() {
    // Uses the permanent Target chord requested by user
    this.playPushChime();
  }

  /**
   * Subtle Bell Ping when notification gets absorbed into TopBar Bell
   */
  playBellAbsorbPing() {
    if (this.isMuted) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1174.66, now); // D6 tiny bell ding
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.23);
  }
}

export const notificationSound = new NotificationSoundEngine();
