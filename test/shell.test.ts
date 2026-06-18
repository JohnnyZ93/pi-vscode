import { describe, expect, it } from "vitest";
import {
  buildPiCommand,
  buildShellArgs,
  buildShellArgsNonInteractive,
  resolveShellForPi,
} from "../src/shell.ts";

function mockAccess(existing: Set<string>) {
  return (path: string, _mode: number) => {
    if (!existing.has(path)) throw new Error("ENOENT");
  };
}

describe("buildPiCommand", () => {
  it("uses exec + single quotes for bash", () => {
    expect(buildPiCommand("bash", "/usr/local/bin/pi", ["--extension", "/a b/x.js"])).toBe(
      "exec /usr/local/bin/pi --extension '/a b/x.js'",
    );
  });

  it("escapes single quotes for bash", () => {
    expect(buildPiCommand("bash", "/tmp/o'reilly/pi", [])).toBe("exec '/tmp/o'\\''reilly/pi'");
  });

  it("uses call operator + single quotes for powershell", () => {
    expect(
      buildPiCommand("powershell", "C:\\Users\\dev\\pi.cmd", ["--session", "C:\\a b\\s.json"]),
    ).toBe("& 'C:\\Users\\dev\\pi.cmd' --session 'C:\\a b\\s.json'");
  });

  it("doubles single quotes inside powershell args", () => {
    expect(buildPiCommand("powershell", "C:\\o'reilly\\pi.exe", [])).toBe(
      "& 'C:\\o''reilly\\pi.exe'",
    );
  });

  it("uses double quotes for cmd without exec keyword", () => {
    expect(buildPiCommand("cmd", "C:\\Users\\dev\\pi.cmd", ["--session", "C:\\a b\\s.json"])).toBe(
      'C:\\Users\\dev\\pi.cmd --session "C:\\a b\\s.json"',
    );
  });

  it("doubles double quotes inside cmd args", () => {
    expect(buildPiCommand("cmd", "C:\\path with spaces\\pi.cmd", ['arg"with"quote'])).toBe(
      '"C:\\path with spaces\\pi.cmd" "arg""with""quote"',
    );
  });
});

describe("buildShellArgs", () => {
  it("uses interactive login flags for bash", () => {
    expect(buildShellArgs("bash", "exec /bin/pi")).toEqual(["-i", "-l", "-c", "exec /bin/pi"]);
  });

  it("bypasses execution policy and profile for powershell", () => {
    expect(buildShellArgs("powershell", "& 'C:\\pi.cmd'")).toEqual([
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "& 'C:\\pi.cmd'",
    ]);
  });

  it("uses /d /c for cmd", () => {
    expect(buildShellArgs("cmd", "C:\\pi.cmd")).toEqual(["/d", "/c", "C:\\pi.cmd"]);
  });
});

describe("buildShellArgsNonInteractive", () => {
  it("drops interactive/login flags for bash", () => {
    expect(buildShellArgsNonInteractive("bash", "exec /bin/pi --version")).toEqual([
      "-c",
      "exec /bin/pi --version",
    ]);
  });

  it("matches interactive variant for powershell", () => {
    expect(buildShellArgsNonInteractive("powershell", "& 'C:\\pi.cmd' --version")).toEqual([
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "& 'C:\\pi.cmd' --version",
    ]);
  });

  it("matches interactive variant for cmd", () => {
    expect(buildShellArgsNonInteractive("cmd", "C:\\pi.cmd --version")).toEqual([
      "/d",
      "/c",
      "C:\\pi.cmd --version",
    ]);
  });
});

describe("resolveShellForPi", () => {
  it("uses powershell for .ps1 on windows", () => {
    const result = resolveShellForPi("C:\\Users\\dev\\pi.ps1", {
      platform: "win32",
      access: mockAccess(new Set()),
      pathEnv: "",
    });
    expect(result).toEqual({ path: "powershell", kind: "powershell" });
  });

  it("uses cmd for .cmd on windows", () => {
    const result = resolveShellForPi("C:\\Users\\dev\\pi.cmd", {
      platform: "win32",
      access: mockAccess(new Set()),
      pathEnv: "",
    });
    expect(result.kind).toBe("cmd");
  });

  it("uses cmd for .exe on windows", () => {
    const result = resolveShellForPi("C:\\Users\\dev\\pi.exe", {
      platform: "win32",
      access: mockAccess(new Set()),
      pathEnv: "",
    });
    expect(result.kind).toBe("cmd");
  });

  it("prefers Git for Windows install over PATH (PATH bash.exe may be the WSL launcher)", () => {
    const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
    const wslBash = "C:\\Windows\\system32\\bash.exe";
    const result = resolveShellForPi("C:\\nvm4w\\nodejs\\pi", {
      platform: "win32",
      pathEnv: "C:\\Windows\\system32;C:\\Program Files\\Git\\bin",
      programFiles: "C:\\Program Files",
      programFilesX86: "",
      localAppData: "",
      access: mockAccess(new Set([gitBash, wslBash])),
    });
    expect(result).toEqual({ path: gitBash, kind: "bash" });
  });

  it("skips System32/SysWOW64/Sysnative bash.exe (WSL launcher) when scanning PATH", () => {
    // Only WSL launchers exist; nothing else. Must NOT pick them up.
    const result = resolveShellForPi("C:\\nvm4w\\nodejs\\pi", {
      platform: "win32",
      pathEnv:
        "C:\\Windows\\system32;C:\\Windows\\SysWOW64;C:\\Windows\\Sysnative;C:\\Windows/System32/",
      programFiles: "",
      programFilesX86: "",
      localAppData: "",
      access: mockAccess(
        new Set([
          "C:\\Windows\\system32\\bash.exe",
          "C:\\Windows\\SysWOW64\\bash.exe",
          "C:\\Windows\\Sysnative\\bash.exe",
          "C:\\Windows\\System32\\bash.exe",
        ]),
      ),
    });
    expect(result).toEqual({ path: "bash", kind: "bash" });
  });

  it("falls back to PATH bash.exe outside system dirs when Git for Windows is absent", () => {
    const msys2Bash = "C:\\msys64\\usr\\bin\\bash.exe";
    const result = resolveShellForPi("C:\\nvm4w\\nodejs\\pi", {
      platform: "win32",
      pathEnv: "C:\\Windows\\system32;C:\\msys64\\usr\\bin",
      programFiles: "",
      programFilesX86: "",
      localAppData: "",
      access: mockAccess(new Set(["C:\\Windows\\system32\\bash.exe", msys2Bash])),
    });
    expect(result).toEqual({ path: msys2Bash, kind: "bash" });
  });

  it("probes Program Files\\Git for extensionless pi shim when PATH lacks bash", () => {
    const programFiles = "C:\\Program Files";
    const bash = "C:\\Program Files\\Git\\bin\\bash.exe";
    const result = resolveShellForPi("C:\\nvm4w\\nodejs\\pi", {
      platform: "win32",
      pathEnv: "C:\\Windows\\system32",
      programFiles,
      programFilesX86: "",
      localAppData: "",
      access: mockAccess(new Set([bash])),
    });
    expect(result).toEqual({ path: bash, kind: "bash" });
  });

  it("falls back to bare bash for extensionless pi shim when no bash.exe found", () => {
    const result = resolveShellForPi("C:\\nvm4w\\nodejs\\pi", {
      platform: "win32",
      pathEnv: "C:\\Windows\\system32",
      programFiles: "",
      programFilesX86: "",
      localAppData: "",
      access: mockAccess(new Set()),
    });
    expect(result).toEqual({ path: "bash", kind: "bash" });
  });

  it("uses $SHELL on unix", () => {
    const result = resolveShellForPi("/usr/local/bin/pi", {
      platform: "linux",
      access: mockAccess(new Set()),
      pathEnv: "",
    });
    expect(result.kind).toBe("bash");
  });
});
