export const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
