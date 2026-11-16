import type { ValidationTargets } from "hono";
import { validator } from "hono/validator";
import { type $ZodType, type output, parse } from "zod/v4/core";

/**
 * zod at the edge: a failed parse throws a ZodError, which the error handler
 * turns into a 400 with the field names. Types flow on to the RPC client.
 * Takes classic and zod/mini schemas alike.
 */
export const valid = <Target extends keyof ValidationTargets, Schema extends $ZodType>(
  target: Target,
  schema: Schema,
) => validator(target, (value): output<Schema> => parse(schema, value));
