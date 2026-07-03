import { describe, expect, it } from "vitest";
import {
  bashQuote,
  buildDreaminaWslCommand,
  translateDreaminaArgForWsl,
  translateDreaminaOutputPathForWindows,
  translateWindowsPathToWslPath,
  translateWslPathToWindowsPath,
} from "./dreaminaRuntime";

const isWindows = process.platform === "win32";

describe("dreaminaRuntime", () => {
  it("quote 传给 bash 的单个参数", () => {
    expect(bashQuote("a b")).toBe("'a b'");
    expect(bashQuote("a'b")).toBe("'a'\"'\"'b'");
  });

  it("构造 WSL 命令时保持参数整体", () => {
    const cmd = buildDreaminaWslCommand(["--prompt=hello world", "--download_dir=/mnt/c/temp"]);
    expect(cmd).toContain("exec");
    expect(cmd).toContain("'--prompt=hello world'");
    expect(cmd).toContain("'--download_dir=/mnt/c/temp'");
  });

  it("Windows 路径可翻到 WSL", () => {
    if (!isWindows) {
      expect(translateWindowsPathToWslPath("/tmp/a.png")).toBe("/tmp/a.png");
      return;
    }
    expect(translateWindowsPathToWslPath("C:\\Users\\me\\a.png")).toBe("/mnt/c/Users/me/a.png");
    expect(translateWindowsPathToWslPath("D:/work/a.png")).toBe("/mnt/d/work/a.png");
  });

  it("WSL 路径可翻回 Windows", () => {
    if (!isWindows) {
      expect(translateWslPathToWindowsPath("/mnt/c/Users/me/a.png")).toBe("/mnt/c/Users/me/a.png");
      return;
    }
    expect(translateWslPathToWindowsPath("/mnt/c/Users/me/a.png")).toBe("C:\\Users\\me\\a.png");
  });

  it("只翻路径参数，不动 prompt", () => {
    if (!isWindows) {
      expect(translateDreaminaArgForWsl("--prompt=hello")).toBe("--prompt=hello");
      return;
    }
    expect(translateDreaminaArgForWsl("--image=C:\\Users\\me\\a.png")).toBe("--image=/mnt/c/Users/me/a.png");
    expect(translateDreaminaArgForWsl("--images=C:\\a.png,C:\\b.png")).toBe("--images=/mnt/c/a.png,/mnt/c/b.png");
    expect(translateDreaminaArgForWsl("--prompt=hello world")).toBe("--prompt=hello world");
  });

  it("输出路径翻回 Windows 时保持非 WSL 路径不变", () => {
    if (!isWindows) {
      expect(translateDreaminaOutputPathForWindows("/tmp/x.png")).toBe("/tmp/x.png");
      return;
    }
    expect(translateDreaminaOutputPathForWindows("/mnt/c/temp/x.png")).toBe("C:\\temp\\x.png");
    expect(translateDreaminaOutputPathForWindows("https://cdn/x.png")).toBe("https://cdn/x.png");
  });
});
