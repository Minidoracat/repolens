import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: false,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
};

export default withNextIntl(config);
