// Rollup unfortunately does not even consider this file, so the configuration happens in rollup.config.js.
// Note that for presets, Parcel sets @babel/preset-env by default (so no need to set it here).

const plugins = [];

if (process.env.NODE_ENV === 'production') {
  plugins.push('babel-plugin-unassert');
}

module.exports = { plugins };
