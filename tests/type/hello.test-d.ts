import { expectTypeOf, test } from "vitest";

test("runs a type test", () => {
  expectTypeOf("hello").toBeString();
});
