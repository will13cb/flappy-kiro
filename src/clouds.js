// Flappy Kiro clouds: parallax creation, movement and wrap.
// Cloud: { x, y, width, speed, alpha }   x = left edge, y = top edge.
// All functions are pure: they return new arrays and never mutate their input.
(function (root) {
  'use strict';

  const CLOUDS_PER_LAYER = 2;
  const SKY_FRACTION = 0.6; // clouds sit in the upper part of the sky

  function unit(rng) {
    let r = Number(rng());
    if (!Number.isFinite(r)) r = 0;
    return Math.min(1, Math.max(0, r));
  }

  // One or more clouds per LAYERS entry. Speed comes from LAYER_SPEEDS[i], alpha from the layer,
  // so larger (higher-depth) clouds are never slower than smaller ones.
  function createClouds(cfg, rng) {
    const layers = cfg.clouds.LAYERS;
    const speeds = cfg.clouds.LAYER_SPEEDS;
    const worldW = cfg.world.WIDTH;
    const skyH = cfg.world.GROUND_TOP * SKY_FRACTION;
    const out = [];
    layers.forEach((layer, i) => {
      for (let k = 0; k < CLOUDS_PER_LAYER; k++) {
        out.push({
          x: unit(rng) * worldW,
          y: unit(rng) * skyH,
          width: layer.WIDTH,
          speed: speeds[i],
          alpha: layer.ALPHA,
        });
      }
    });
    return out;
  }

  // x -= speed * dt; a cloud fully beyond the left edge wraps to just beyond the right edge.
  // y and every other field stay unchanged.
  function moveClouds(cfg, clouds, dt) {
    return clouds.map((c) => {
      const x = c.x - c.speed * dt;
      return Object.assign({}, c, { x: x + c.width < 0 ? cfg.world.WIDTH : x });
    });
  }

  const api = { createClouds, moveClouds };

  if (typeof window !== 'undefined') {
    window.FlappyKiro = window.FlappyKiro || {};
    Object.assign(window.FlappyKiro, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, api);
  }
})(typeof window !== 'undefined' ? (window.FlappyKiro = window.FlappyKiro || {}) : {});
