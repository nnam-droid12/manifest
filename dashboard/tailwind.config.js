/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1b4332",
        canvas: "#faf6ec",
        cream: "#faf6ec",
        moss: "#40916c",
      },
    },
  },
  plugins: [],
};
