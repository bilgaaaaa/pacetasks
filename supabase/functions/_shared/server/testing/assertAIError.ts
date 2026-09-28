import assert from "node:assert/strict";
import { AIError } from "../ai/errors.ts";
import type { AIErrorKind } from "../ai/errors.ts";

// Asserts that `run` rejects with an AIError of the given kind.
export async function assertRejectsWithAIError(run: () => Promise<unknown>, kind: AIErrorKind): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof AIError, `expected AIError, got ${error}`);
    assert.equal(error.kind, kind);
    return true;
  });
}

// Asserts that `run` throws an AIError of the given kind.
export function assertThrowsAIError(run: () => unknown, kind: AIErrorKind): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof AIError, `expected AIError, got ${error}`);
    assert.equal(error.kind, kind);
    return true;
  });
}
