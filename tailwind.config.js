/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./index.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./context/**/*.{js,ts,jsx,tsx}",
        "./lib/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#fbbf24",
                "background-dark": "#121212",
                "surface-dark": "#1e1e1e",
                "surface-light": "#2a2a2a",
                "pad-empty-bg": "#1e1e1e",
            },
            fontFamily: {
                sans: ["Inter", "sans-serif"],
            },
            boxShadow: {
                'pad-raised': 'inset 0 1px 1px rgba(255,255,255,0.15), 0 2px 3px rgba(0,0,0,0.4), 0 5px 10px rgba(0,0,0,0.6)',
                'pad-pressed': 'inset 0 4px 8px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.3)',
                'pad-empty': 'inset 0 2px 6px rgba(0,0,0,0.6)',
                'ui-element-raised': 'inset 0 1px 1px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.5)',
                'ui-element-pressed': 'inset 0 2px 4px rgba(0,0,0,0.5)',
                'ui-element-inset': 'inset 0 2px 5px rgba(0,0,0,0.5)',
            }
        },
    },
    plugins: [],
}
