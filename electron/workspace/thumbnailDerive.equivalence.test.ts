import { describe, expect, it } from "vitest";
import { deriveThumbnailUrls } from "./workspaceRepository";
import { extractThumbnailUrlsFromRaw } from "../../src/workbench/project/projectNormalize";

const fixtures: Array<{ name: string; record: unknown }> = [
  { name: "null", record: null },
  { name: "undefined", record: undefined },
  { name: "non-object", record: 42 },
  { name: "empty-record", record: {} },
  { name: "payload-non-object", record: { payload: "oops" } },
  { name: "missing-generationCanvas", record: { payload: {} } },
  { name: "nodes-non-array", record: { payload: { generationCanvas: { nodes: "nope" } } } },
  {
    name: "top-level generationCanvas",
    record: {
      generationCanvas: {
        nodes: [{ result: { type: "image", url: "https://cdn/top.png" } }],
      },
    },
  },
  {
    name: "payload generationCanvas wins over top-level",
    record: {
      generationCanvas: { nodes: [{ result: { type: "image", url: "https://cdn/top.png" } }] },
      payload: { generationCanvas: { nodes: [{ result: { type: "image", url: "https://cdn/inner.png" } }] } },
    },
  },
  {
    name: "dirty nodes degrade safely",
    record: {
      payload: {
        generationCanvas: {
          nodes: [
            null,
            7,
            {},
            { result: null },
            { result: { type: "image", url: "https://cdn/a.png" } },
          ],
        },
      },
    },
  },
  {
    name: "thumbnail fallback and short-url filtering",
    record: {
      payload: {
        generationCanvas: {
          nodes: [
            { result: { type: "image", url: "abc" } },
            { result: { type: "video", thumbnailUrl: "https://cdn/thumb.png" } },
            { result: { type: "image", url: "", thumbnailUrl: "https://cdn/fallback.png" } },
          ],
        },
      },
    },
  },
  {
    name: "video mp4 without thumbnail is skipped",
    record: {
      payload: {
        generationCanvas: {
          nodes: [
            { result: { type: "video", url: "nomi-local://asset/project/video.mp4" } },
            { result: { type: "image", url: "https://cdn/still.png" } },
          ],
        },
      },
    },
  },
  {
    name: "respects max",
    record: {
      payload: {
        generationCanvas: {
          nodes: Array.from({ length: 9 }, (_, i) => ({
            result: { type: "image", url: `https://cdn/n${i}.png` },
          })),
        },
      },
    },
  },
];

describe("thumbnail derive main/renderer equivalence", () => {
  for (const { name, record } of fixtures) {
    it(`matches exactly: ${name}`, () => {
      expect(deriveThumbnailUrls(record)).toEqual(extractThumbnailUrlsFromRaw(record));
    });
  }

  it("respects custom max in main process", () => {
    const record = {
      payload: {
        generationCanvas: {
          nodes: Array.from({ length: 6 }, (_, i) => ({
            result: { type: "image", url: `https://cdn/n${i}.png` },
          })),
        },
      },
    };
    expect(deriveThumbnailUrls(record, 4)).toEqual(extractThumbnailUrlsFromRaw(record));
    expect(deriveThumbnailUrls(record, 2)).toEqual([
      "https://cdn/n0.png",
      "https://cdn/n1.png",
    ]);
  });
});
