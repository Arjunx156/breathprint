import { getRequestListener } from "@hono/node-server";
import { loadEnv } from "./env";
import { productionApp } from "./main";
import { fromHeader } from "./middleware/rateLimit";

/**
 * The Vercel function entry: the same app, adapted to Node's request listener.
 * Vercel's edge overwrites x-real-ip with the visitor's address, so it can be trusted here.
 */
export default getRequestListener(productionApp(loadEnv(), fromHeader("x-real-ip")).fetch);
