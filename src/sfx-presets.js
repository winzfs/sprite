(() => {
  window.SFXStudioPresets = {
    waveforms: [
      ['sine', 'Sine'], ['square', 'Square'], ['triangle', 'Triangle'], ['sawtooth', 'Sawtooth'], ['noise', 'Noise'],
      ['soft-square', 'Soft Square'], ['warm-saw', 'Warm Saw'], ['bell', 'Bell'], ['glass', 'Glass'], ['pluck', 'Pluck'],
      ['fm-bell', 'FM Bell'], ['metallic', 'Metallic'], ['organ', 'Organ'], ['bass-thump', 'Bass Thump'], ['air-noise', 'Air Noise'],
      ['sparkle', 'Sparkle'], ['digital-blip', 'Digital Blip'], ['chime', 'Chime'], ['wood', 'Wood'], ['zap', 'Zap'], ['sweep', 'Sweep'],
      ['water-drop', 'Water Drop'], ['crystal', 'Crystal'], ['soft-pad', 'Soft Pad'],
    ],
    waveformProfiles: {
      'soft-square': { engine: 'clean', texture: 'clean', depth: 0.6, body: 0.26, shine: 0.18, transient: 0.28, air: 0.08, noise: 0.02, filter: 5200 },
      'warm-saw': { engine: 'pro', texture: 'hybrid', depth: 0.72, body: 0.62, shine: 0.25, transient: 0.25, air: 0.12, noise: 0.04, filter: 4300 },
      bell: { engine: 'pro', texture: 'bell', depth: 0.84, body: 0.28, shine: 0.65, transient: 0.34, air: 0.16, noise: 0.012, filter: 9200 },
      glass: { engine: 'pro', texture: 'glass', depth: 0.92, body: 0.22, shine: 0.82, transient: 0.32, air: 0.26, noise: 0.015, filter: 11000 },
      pluck: { engine: 'clean', texture: 'clean', depth: 0.65, body: 0.3, shine: 0.42, transient: 0.76, air: 0.08, noise: 0.02, filter: 7600 },
      'fm-bell': { engine: 'pro', texture: 'glass', depth: 0.96, body: 0.27, shine: 0.74, transient: 0.4, air: 0.16, noise: 0.012, filter: 9800 },
      metallic: { engine: 'pro', texture: 'hybrid', depth: 0.92, body: 0.4, shine: 0.58, transient: 0.55, air: 0.14, noise: 0.07, filter: 8200 },
      organ: { engine: 'pro', texture: 'hybrid', depth: 0.5, body: 0.78, shine: 0.12, transient: 0.08, air: 0.03, noise: 0.004, filter: 5200 },
      'bass-thump': { engine: 'impact', texture: 'impact', depth: 0.62, body: 0.94, shine: 0.06, transient: 0.68, air: 0.02, noise: 0.18, filter: 1400 },
      'air-noise': { engine: 'air', texture: 'whoosh', depth: 0.7, body: 0.1, shine: 0.45, transient: 0.2, air: 0.95, noise: 0.55, filter: 8800 },
      sparkle: { engine: 'pro', texture: 'glass', depth: 0.9, body: 0.14, shine: 1, transient: 0.45, air: 0.32, noise: 0.035, filter: 11800 },
      'digital-blip': { engine: 'clean', texture: 'clean', depth: 0.46, body: 0.16, shine: 0.3, transient: 0.7, air: 0.03, noise: 0.018, filter: 6400 },
      chime: { engine: 'pro', texture: 'bell', depth: 0.88, body: 0.2, shine: 0.72, transient: 0.3, air: 0.22, noise: 0.014, filter: 10600 },
      wood: { engine: 'impact', texture: 'impact', depth: 0.48, body: 0.68, shine: 0.05, transient: 0.86, air: 0.05, noise: 0.24, filter: 2800 },
      zap: { engine: 'pro', texture: 'hybrid', depth: 0.72, body: 0.22, shine: 0.42, transient: 0.82, air: 0.18, noise: 0.12, filter: 7600 },
      sweep: { engine: 'air', texture: 'whoosh', depth: 0.82, body: 0.12, shine: 0.5, transient: 0.2, air: 0.82, noise: 0.42, filter: 9200 },
      'water-drop': { engine: 'pro', texture: 'glass', depth: 0.82, body: 0.18, shine: 0.66, transient: 0.58, air: 0.16, noise: 0.02, filter: 9600 },
      crystal: { engine: 'pro', texture: 'glass', depth: 1, body: 0.16, shine: 0.95, transient: 0.34, air: 0.28, noise: 0.01, filter: 12000 },
      'soft-pad': { engine: 'pro', texture: 'bell', depth: 0.68, body: 0.62, shine: 0.28, transient: 0.06, air: 0.22, noise: 0.018, filter: 5800 },
    },
    masterPresets: {
      'Premium UI': { engine: 'clean', texture: 'clean', wave: 'pluck', depth: 0.68, body: 0.24, shine: 0.42, comp: 0.42, reverb: 0.08, tail: 0.12 },
      'Glass Bell': { engine: 'pro', texture: 'glass', wave: 'glass', depth: 0.94, body: 0.28, shine: 0.82, comp: 0.5, reverb: 0.28, tail: 0.42 },
      'Cinematic Hit': { engine: 'impact', texture: 'impact', wave: 'bass-thump', depth: 0.76, body: 0.84, shine: 0.18, comp: 0.82, reverb: 0.18, tail: 0.26 },
      'Soft Whoosh': { engine: 'air', texture: 'whoosh', wave: 'sweep', depth: 0.84, body: 0.16, shine: 0.56, comp: 0.36, reverb: 0.24, tail: 0.38 },
    },
  };
})();