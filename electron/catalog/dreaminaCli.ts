// 即梦官方 dreamina CLI 的二进制定位 + spawn 封装（IO 层；纯解析在 dreaminaCodec.ts）。
// processOperation（生成）与登录 IPC（设备码登录/积分自检/退登）共用这一份 spawn，避免两处各搓一遍。
//
// 关键坑：GUI 版 Electron 的 PATH 极简（不含用户 shell 的 ~/.local/bin），而官方安装脚本默认把
// dreamina 装到 ~/.local/bin。所以定位要兜底常见安装位；Windows 则优先走 WSL 执行，避免把两套命令链
// 写成并行版。

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildDreaminaWslCommand,
  resolveDreaminaRuntimeMode,
  translateDreaminaArgForWsl,
} from "./dreaminaRuntime";

/** dreamina 可能的安装位（官方脚本默认 ~/.local/bin；homebrew/手动放 /usr/local/bin、/opt/homebrew/bin）。 */
function candidateBinPaths(): string[] {
  const home = os.homedir();
  const names = process.platform === "win32" ? ["dreamina.exe", "dreamina.cmd", "dreamina"] : ["dreamina"];
  const dirs = [path.join(home, ".local", "bin"), "/usr/local/bin", "/opt/homebrew/bin", path.join(home, "bin")];
  return dirs.flatMap((dir) => names.map((n) => path.join(dir, n)));
}

/** PATH 兜底目录（spawn 时合并进 env.PATH，治 GUI Electron 极简 PATH）。 */
function extraPathDirs(): string[] {
  const home = os.homedir();
  return [path.join(home, ".local", "bin"), "/usr/local/bin", "/opt/homebrew/bin", path.join(home, "bin")];
}

/**
 * 解析 dreamina 真实可执行路径：env 覆盖 → 已知安装位逐个探。返回 "" 表示未安装（调用方负责引导安装）。
 * 不做 `which`（GUI PATH 不可靠），直接探文件存在性。
 */
export function resolveDreaminaBin(): string {
  const override = (process.env.DREAMINA_BIN || process.env.JIMENG_BIN || "").trim();
  if (override && existsSync(override)) return override;
  for (const candidate of candidateBinPaths()) {
    if (existsSync(candidate)) return candidate;
  }
  return "";
}

export function isDreaminaInstalled(): boolean {
  return resolveDreaminaRuntimeMode(resolveDreaminaBin()).kind !== "missing";
}

export type DreaminaRunResult = { code: number; stdout: string; stderr: string };

function spawnDreaminaNative(bin: string, args: string[], timeoutMs: number): Promise<DreaminaRunResult> {
  const mergedPath = [...extraPathDirs(), process.env.PATH || ""].filter(Boolean).join(path.delimiter);
  return new Promise<DreaminaRunResult>((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true, env: { ...process.env, PATH: mergedPath } });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      reject(new Error(`即梦 CLI 执行超时（${args[0] || "?"}）`));
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

function spawnDreaminaWsl(distro: string, wslExe: string, args: string[], timeoutMs: number): Promise<DreaminaRunResult> {
  const translatedArgs = args.map(translateDreaminaArgForWsl);
  const command = buildDreaminaWslCommand(translatedArgs);
  return new Promise<DreaminaRunResult>((resolve, reject) => {
    const child = spawn(wslExe, ["-d", distro, "--", "bash", "-lc", command], {
      windowsHide: true,
      env: { ...process.env, LANG: process.env.LANG || "C.UTF-8", LC_ALL: process.env.LC_ALL || "C.UTF-8" },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      reject(new Error(`即梦 CLI 执行超时（${args[0] || "?"}）`));
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/**
 * 跑一条 dreamina 命令，收齐 stdout/stderr。超时杀进程。
 * 参数走数组（不过 shell），无注入面。
 */
export function runDreaminaCli(args: string[], opts: { timeoutMs?: number; bin?: string } = {}): Promise<DreaminaRunResult> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const nativeBin = opts.bin || resolveDreaminaBin();
  const runtime = resolveDreaminaRuntimeMode(nativeBin || undefined);
  if (runtime.kind === "missing") {
    return Promise.reject(new Error(runtime.message));
  }
  if (runtime.kind === "native") {
    return spawnDreaminaNative(runtime.bin, args, timeoutMs);
  }
  return spawnDreaminaWsl(runtime.distro, runtime.wslExe, args, timeoutMs);
}
