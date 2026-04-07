import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: false,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",") ?? [],
};

export default withNextIntl(config);
