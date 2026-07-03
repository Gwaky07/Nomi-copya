import { describe, it, expect, vi, beforeEach } from "vitest";

// 把 dreaminaCli（spawn IO）整体 mock 掉，喂合成 stdout，验进程路径端到端不需真二进制。
const runDreaminaCli = vi.fn();
const resolveDreaminaBin = vi.fn(() => "/fake/bin/dreamina");
const resolveDreaminaRuntimeMode = vi.fn(() => ({ kind: "native", bin: "/fake/bin/dreamina" }));
vi.mock("./dreaminaCli", () => ({
  runDreaminaCli: (...args: unknown[]) => runDreaminaCli(...args),
  resolveDreaminaBin: () => resolveDreaminaBin(),
}));
vi.mock("./dreaminaRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dreaminaRuntime")>();
  return {
    ...actual,
    resolveDreaminaRuntimeMode: (...args: unknown[]) => resolveDreaminaRuntimeMode(...args),
  };
});

import { executeProcessOperation } from "./processOperation";
import { DREAMINA_CURATED_MAPPINGS } from "./dreaminaVideos";
import {
  valuesFromMapping,
  taskStatusFromResponse,
  collectAssetUrls,
} from "../tasks/responseParsing";
import type { JsonRecord } from "../jsonUtils";

const writeAsset = vi.fn(() => ({ data: { url: "nomi-local://asset/proj/assets/v.mp4" } }));
const proc = (args: string[], appendDownloadDir = false) => ({ bin: "dreamina", parser: "dreamina-cli" as const, appendDownloadDir, args });
const call = (args: string[], opts: { projectId?: string; appendDownloadDir?: boolean } = {}) =>
  executeProcessOperation({ process: proc(args, opts.appendDownloadDir), context: {}, projectId: opts.projectId ?? "", writeAsset });

beforeEach(() => {
  runDreaminaCli.mockReset();
  writeAsset.mockClear();
  resolveDreaminaBin.mockReturnValue("/fake/bin/dreamina");
  resolveDreaminaRuntimeMode.mockReturnValue({ kind: "native", bin: "/fake/bin/dreamina" });
});

describe("executeProcessOperation", () => {
  it("提交态：querying + submit_id，无媒体", async () => {
    runDreaminaCli.mockResolvedValue({ code: 0, stdout: '已提交\n{"submit_id":"u-1","gen_status":"querying"}', stderr: "" });
    const { response } = await call(["text2video", "--prompt=cat"]);
    const r = response as JsonRecord;
    expect(r.submit_id).toBe("u-1");
    expect(r.gen_status).toBe("querying");
    expect(r.video_url).toEqual([]);
  });

  it("空值参数（--flag=）被丢弃，不发给 CLI", async () => {
    runDreaminaCli.mockResolvedValue({ code: 0, stdout: '{"submit_id":"u-1","gen_status":"querying"}', stderr: "" });
    await call(["text2video", "--prompt=cat", "--ratio="]);
    expect(runDreaminaCli).toHaveBeenCalledWith(["text2video", "--prompt=cat"], expect.anything());
  });

  it("create 命令默认不追加 --download_dir（官方仅 query_result 支持）", async () => {
    runDreaminaCli.mockResolvedValue({ code: 0, stdout: '{"submit_id":"u-1","gen_status":"querying"}', stderr: "" });
    await call(["text2image", "--prompt=cat"]);
    expect(runDreaminaCli).toHaveBeenCalledWith(["text2image", "--prompt=cat"], expect.anything());
  });

  it("成功态（远端 URL）→ video_url 带公网链接", async () => {
    runDreaminaCli.mockResolvedValue({
      code: 0,
      stdout: '{"submit_id":"u-2","gen_status":"success","videos":[{"video_url":"https://cdn/r.mp4"}]}',
      stderr: "",
    });
    const { response } = await call(["query_result"]);
    expect((response as JsonRecord).video_url).toEqual(["https://cdn/r.mp4"]);
  });

  it("成功态（本地下载文件，路径不存在）→ existsSync 拦，不假装有结果", async () => {
    runDreaminaCli.mockResolvedValue({
      code: 0,
      stdout: '{"submit_id":"u-3","gen_status":"success","results":[{"file_path":"/tmp/nope/v.mp4"}]}',
      stderr: "",
    });
    const { response } = await call(["query_result"], { projectId: "proj", appendDownloadDir: true });
    expect((response as JsonRecord).video_url).toEqual([]);
    expect(writeAsset).not.toHaveBeenCalled();
  });

  it("非 maestro vip：退出码非 0 且无 submit_id/gen_status → 抛清晰错误", async () => {
    runDreaminaCli.mockResolvedValue({ code: 1, stdout: "", stderr: "current account is not maestro vip" });
    await expect(call(["text2video", "--prompt=cat"])).rejects.toThrow(/maestro vip/);
  });

  it("CLI 静默 exit=1 时用 user_credit 解释会员档位问题", async () => {
    runDreaminaCli
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: '{"total_credit":1327,"user_id":847058235831368,"vip_level":"standard"}', stderr: "" });
    await expect(call(["text2image", "--prompt=cat"])).rejects.toThrow(/vip_level=standard/);
  });

  it("未装 CLI → 抛安装引导错误", async () => {
    resolveDreaminaBin.mockReturnValue("");
    resolveDreaminaRuntimeMode.mockReturnValue({ kind: "missing", message: "未找到即梦 CLI，请一键安装" });
    await expect(call(["text2video"])).rejects.toThrow(/未找到即梦 CLI|一键安装/);
  });
});

describe("DREAMINA_CURATED_MAPPINGS：归一响应 → 状态/资产提取（mapping 接线正确）", () => {
  const mapping = DREAMINA_CURATED_MAPPINGS[0];
  const rm = mapping.create.response_mapping as JsonRecord;

  it("querying → running（会被 admitTask 续查）", () => {
    const resp = { submit_id: "u-1", gen_status: "querying", video_url: [] };
    expect(taskStatusFromResponse(resp, rm, mapping.statusMapping, [])).toBe("running");
  });

  it("success + video_url → succeeded + 抽到资产", () => {
    const resp = { submit_id: "u-2", gen_status: "success", video_url: ["https://cdn/r.mp4"] };
    const assetUrls = valuesFromMapping(resp, rm, "video_url").flatMap(collectAssetUrls);
    expect(assetUrls).toEqual(["https://cdn/r.mp4"]);
    expect(taskStatusFromResponse(resp, rm, mapping.statusMapping, assetUrls)).toBe("succeeded");
  });

  it("fail → failed", () => {
    const resp = { submit_id: "u-3", gen_status: "fail", fail_reason: "内容安全", video_url: [] };
    expect(taskStatusFromResponse(resp, rm, mapping.statusMapping, [])).toBe("failed");
  });

  it("task_id 从 submit_id 映射", () => {
    const resp = { submit_id: "u-9", gen_status: "querying" };
    const pm = mapping.create.provider_meta_mapping as JsonRecord;
    expect(valuesFromMapping(resp, pm, "task_id")).toEqual(["u-9"]);
  });
});
