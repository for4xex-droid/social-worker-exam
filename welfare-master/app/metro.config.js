const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// SDK 52 + NativeWind v4 用の安定した設定
module.exports = withNativeWind(config, { input: "./app/global.css" });
