module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      // Required by `react-native-reanimated@^4` on native. Without this
      // plugin, every `useSharedValue` / `useAnimatedStyle` / `withTiming`
      // call throws at runtime on iOS and Android (web has a JS shim, so
      // it silently works there — which is exactly the failure mode we
      // saw: "works on web, fails on Apple/Android"). MUST be last.
      "react-native-worklets/plugin",
    ],
  };
};
