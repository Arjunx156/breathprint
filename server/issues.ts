/** What zod and zod/mini both report for each way a value breaks its schema. */
export type SchemaIssue = { readonly path: readonly PropertyKey[]; readonly message: string };

/** One readable line per issue, naming the field it is about, or `whole` for the value itself. */
export function issueLines(issues: readonly SchemaIssue[], whole: string): string[] {
  return issues.map((i) => `${i.path.map(String).join(".") || whole}: ${i.message}`);
}
