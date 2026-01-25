import { describe, expect, it } from "vitest";

import {
  createThreadEventMapper,
  parseThreadEventLike,
} from "../../packages/codex/src/exec-events.js";

describe("exec-events", () => {
  it("normalizes SDK file change kinds add|update|delete", () => {
    const mapper = createThreadEventMapper("sdk");

    const events = [
      {
        type: "item.completed",
        thread_id: "t-1",
        turn_id: "u-1",
        item: {
          id: "i-1",
          type: "file_change",
          changes: [{ path: "a.txt", kind: "add" }],
        },
      },
      {
        type: "item.completed",
        thread_id: "t-1",
        turn_id: "u-1",
        item: {
          id: "i-2",
          type: "file_change",
          changes: [{ path: "b.txt", kind: "update" }],
        },
      },
      {
        type: "item.completed",
        thread_id: "t-1",
        turn_id: "u-1",
        item: {
          id: "i-3",
          type: "file_change",
          changes: [{ path: "c.txt", kind: "delete" }],
        },
      },
    ] as const;

    const mapped = events.flatMap((raw) => {
      const parsed = parseThreadEventLike(raw);
      if (!parsed) {
        throw new Error(
          "parseThreadEventLike returned null for a valid test event",
        );
      }
      return mapper(parsed);
    });

    expect(mapped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "codex.file.changed",
          path: "a.txt",
          kind: "added",
        }),
        expect.objectContaining({
          type: "codex.file.changed",
          path: "b.txt",
          kind: "modified",
        }),
        expect.objectContaining({
          type: "codex.file.changed",
          path: "c.txt",
          kind: "deleted",
        }),
      ]),
    );
  });
});
