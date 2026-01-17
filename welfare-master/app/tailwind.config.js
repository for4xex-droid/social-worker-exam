module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: "#FF6B00",
                brand: {
                    light: "#FF8C37",
                    DEFAULT: "#FF6B00",
                    dark: "#E66000",
                },
                slate: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    // ... standard slate colors are usually handled by tailwind default, 
                    // but we ensure primary is explicitly there.
                }
            },
            borderRadius: {
                '33': '33px',
                '4xl': '40px',
            }
        },
    },
    plugins: [],
}
