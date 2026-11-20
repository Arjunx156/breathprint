import { redirectLogs } from "../log";

// Preloaded by `bun test` (see bunfig.toml): the API tests make hundreds of
// requests, and their access lines would bury the results. Tests that care
// about a line catch it with redirectLogs themselves.
redirectLogs(() => undefined);
