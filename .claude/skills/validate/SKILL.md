---
name: validate
description: Run the full validation suite (Biome check + TypeScript + Knip) and fix any issues. Use at the end of a development session before committing.
user-invocable: true
allowed-tools: Bash, Read, Edit, Grep, Glob
---

# Validate

Run the full validation suite and fix any issues found.

## Steps

1. Run `pnpm validate` (this runs Biome check, TypeScript type checking, and Knip for dead code detection)
2. If there are errors, fix them:
   - **Biome errors**: Fix lint and formatting issues in the reported files
   - **Type errors**: Fix TypeScript type errors in the reported files
   - **Knip errors**: Remove unused exports, dependencies, or dead code
3. Re-run `pnpm validate` to confirm all issues are resolved
4. Repeat until the output is clean
5. Report a summary of what was found and fixed
