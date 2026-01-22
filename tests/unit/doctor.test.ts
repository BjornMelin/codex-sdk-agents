import type { SpawnSyncReturns } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";

const doctorCmdPath = "../../apps/cli/src/commands/doctor.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

function okResult(stdout: string): SpawnSyncReturns<string> {
  return {
    pid: 0,
    output: [null, stdout, ""],
    stdout,
    stderr: "",
    status: 0,
    signal: null,
  };
}

function missingResult(message: string): SpawnSyncReturns<string> {
  return {
    pid: 0,
    output: [null, "", ""],
    stdout: "",
    stderr: "",
    status: null,
    signal: null,
    error: new Error(message),
  };
}

describe("runDoctor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 0 when all required binaries are present", async () => {
    const { spawnSync } = await import("node:child_process");
    const spawnSyncMock = vi.mocked(spawnSync);

    spawnSyncMock.mockImplementation((command) => {
      if (command === "node") {
        return okResult("v24.0.0");
      }
      return okResult(`${command} 1.0.0`);
    });

    const { runDoctor } = await import(doctorCmdPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(runDoctor()).toBe(0);
    expect(spawnSyncMock).toHaveBeenCalledTimes(3);

    log.mockRestore();
  });

  it("returns 1 when codex is missing", async () => {
    const { spawnSync } = await import("node:child_process");
    const spawnSyncMock = vi.mocked(spawnSync);

    spawnSyncMock.mockImplementation((command) => {
      if (command === "codex") {
        return missingResult("ENOENT");
      }
      if (command === "node") {
        return okResult("v24.0.0");
      }
      return okResult(`${command} 1.0.0`);
    });

    const { runDoctor } = await import(doctorCmdPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(runDoctor()).toBe(1);

    log.mockRestore();
  });
});
