# Technical Debt

- [ ] **iOS `withFmtFix` plugin** — Workaround for fmt consteval + Xcode 26.4+ build issue. Remove `plugins/ios/withFmtFix.js` once React Native ships an official fix. See: https://github.com/expo/expo/issues/44229
- [ ] **Jest `expo-modules-core` workaround** — `moduleNameMapper` in `package.json` jest config remaps `expo-modules-core` to `expo/node_modules/expo-modules-core` due to hoisting mismatch. Remove once resolved. See: https://github.com/expo/expo/issues/44647
