import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...coreWebVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
