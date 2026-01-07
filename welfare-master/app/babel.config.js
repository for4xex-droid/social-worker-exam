module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ["babel-preset-expo", { jsxImportSource: "nativewind" }],
        ],
        plugins: [
            // Reanimated を一時的に無効化（Worklets バージョン不一致のため）
            // "react-native-reanimated/plugin",
        ],
    };
};
