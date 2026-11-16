import { getRequestListener } from "@hono/node-server";
import { productionApp } from "./main";

/** The Vercel function entry: the same app, adapted to Node's request listener. */
export default getRequestListener(productionApp().fetch);
