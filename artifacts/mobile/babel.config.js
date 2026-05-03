module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    // NOTE: Do NOT add `react-native-worklets/plugin` here.
    // `babel-preset-expo` (SDK 54+, v14+) auto-injects it when
    // `react-native-worklets` is installed (see preset's build/index.js).
    // Adding it manually double-transforms every worklet, which silently
    // breaks Reanimated on iOS/Android (web is unaffected because of the
    // JS shim) and surfaces as the ErrorBoundary fallback on real devices.
  };
};
