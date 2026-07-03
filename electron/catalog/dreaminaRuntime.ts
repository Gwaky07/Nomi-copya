import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

export type DreaminaRuntimeMode =
  | { kind: "native"; bin: string }
  | { kind: "wsl"; distro: string; wslExe: string }
  | { kind: "missing"; message: string };

const WSL_DISTRO_CANDIDATES = unique([
  process.env.DREAMINA_WSL_DISTRO,
  process.env.JIMENG_WSL_DISTRO,
  "Ubuntu",
  "Ubuntu-22.04",
]);

function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const v = String(value || "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function resolveWslExe(): string {
  if (process.platform !== "win32") return "";
  const systemRoot = process.env.SystemRoot || "C:\\Windows";
  const candidate = path.join(systemRoot, "System32", "wsl.exe");
  return existsSync(candidate) ? candidate : "wsl.exe";
}

function probeWslCommand(distro: string, command: string): boolean {
  const wslExe = resolveWslExe();
  if (!wslExe) return false;
  const result = spawnSync(wslExe, ["-d", distro, "--", "bash", "-lc", command], {
    windowsHide: true,
    stdio: "ignore",
  });
  return result.status === 0;
}

export function resolveDreaminaWslDistro(): string {
  if (process.platform !== "win32") return "";
  for (const distro of WSL_DISTRO_CANDIDATES) {
    if (probeWslCommand(distro, "true")) return distro;
  }
  return "";
}

export function isDreaminaInstalledInWsl(distro: string): boolean {
  return Boolean(distro) && probeWslCommand(distro, 'test -x "$HOME/.local/bin/dreamina"');
}

export function resolveDreaminaRuntimeMode(
  nativeBin?: string,
  options: { requireInstalled?: boolean } = {},
): DreaminaRuntimeMode {
  const requireInstalled = options.requireInstalled !== false;
  if (nativeBin && existsSync(nativeBin)) return { kind: "native", bin: nativeBin };
  if (process.platform !== "win32") {
    return { kind: "missing", message: "未找到即梦 CLI（dreamina）。请先安装官方 CLI，或在终端确认 dreamina 已在 PATH 中。" };
  }
  const distro = resolveDreaminaWslDistro();
  if (distro && (!requireInstalled || isDreaminaInstalledInWsl(distro))) {
    return { kind: "wsl", distro, wslExe: resolveWslExe() };
  }
  if (distro) {
    return {
      kind: "missing",
      message: `未找到即梦 CLI（dreamina）。已找到 WSL 发行版 ${distro}，但里面还没装 dreamina。请先在 WSL 里安装官方即梦 CLI。`,
    };
  }
  return {
    kind: "missing",
    message: "未找到即梦 CLI（dreamina）。Windows 版即梦接入需要先安装可用的 WSL 发行版（如 Ubuntu），再装官方 CLI。",
  };
}

export function translateWindowsPathToWslPath(input: string): string {
  const value = String(input || "").trim();
  if (!value) return "";
  if (process.platform !== "win32") return value;
  if (/^[a-z]+:\/\//i.test(value)) return value;
  if (value.startsWith("/mnt/")) return value;

  const normalized = value.replace(/\\/g, "/");
  const drive = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (drive) {
    return `/mnt/${drive[1].toLowerCase()}/${drive[2]}`;
  }

  const extended = /^\/\/\?\/([A-Za-z]):\/(.*)$/.exec(normalized);
  if (extended) {
    return `/mnt/${extended[1].toLowerCase()}/${extended[2]}`;
  }

  return value;
}

export function mapDreaminaLocalPath(pathValue: string, mode: DreaminaRuntimeMode): string {
  if (mode.kind !== "wsl") return pathValue;
  return translateWindowsPathToWslPath(pathValue);
}

export function bashQuote(value: string): string {
  const text = String(value ?? "");
  if (text === "") return "''";
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

export function buildDreaminaWslCommand(args: string[]): string {
  const executable = '"$HOME/.local/bin/dreamina"';
  return ["exec", executable, ...args.map(bashQuote)].join(" ");
}

export function getDreaminaInstallHint(mode: DreaminaRuntimeMode): string {
  if (mode.kind === "native") return "即梦 CLI 已安装";
  if (mode.kind === "wsl") return `即梦 CLI 已安装（WSL: ${mode.distro}）`;
  return mode.message;
}

export function isWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(String(value || ""));
}

export function getDreaminaWslPathForTempDir(tempDir: string): string {
  return translateWindowsPathToWslPath(tempDir || os.tmpdir());
}

export function translateWslPathToWindowsPath(input: string): string {
  const value = String(input || "").trim();
  if (!value) return "";
  if (process.platform !== "win32") return value;

  const normalized = value.replace(/\\/g, "/");
  const match = /^\/mnt\/([a-zA-Z])\/(.*)$/.exec(normalized);
  if (!match) return value;

  const rest = match[2].replace(/\//g, "\\");
  return `${match[1].toUpperCase()}:\\${rest}`;
}

export function translateDreaminaArgForWsl(arg: string): string {
  const value = String(arg || "");
  if (process.platform !== "win32") return value;
  const eq = value.indexOf("=");
  if (!value.startsWith("--") || eq < 0) return value;

  const key = value.slice(0, eq);
  const raw = value.slice(eq + 1);
  const pathFlags = new Set(["--image", "--images", "--video", "--audio", "--first", "--last", "--download_dir"]);
  if (!pathFlags.has(key)) return value;

  const parts = raw.split(",");
  const translated = parts
    .map((part) => {
      const p = part.trim();
      if (!p) return p;
      if (isWindowsAbsolutePath(p) || p.startsWith("/mnt/")) return translateWindowsPathToWslPath(p);
      return p;
    })
    .join(",");
  return `${key}=${translated}`;
}

export function translateDreaminaOutputPathForWindows(input: string): string {
  return translateWslPathToWindowsPath(input);
}
