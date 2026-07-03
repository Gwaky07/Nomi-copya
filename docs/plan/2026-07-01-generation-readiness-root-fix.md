# 生成区运行前总闸根因修复（2026-07-01）

## 背景

素材库上传的多选问题已修好，但生成区仍有一条更主干的回归：

- 文生视频模式本来不需要参考素材，却在本地就被拦住
- `source_video` 驱动的视频编辑模式，明明已经有源视频，也会被总闸误判成“不能生成”

体感上就是生成区一大片按钮灰掉、批量生成和单点生成都不正常。

## 根因

`generationRunController.ts` 现在把视频节点分成了两层校验：

1. 先按当前 archetype mode 的必填槽做检查
2. 再统一追加一层“视频必须有首帧/尾帧/参考图数组”的总闸

第二层是旧的兜底启发式，没有跟当前 mode 的真实 `transportTaskKind` 和槽声明对齐，导致：

- `text_to_video` 的 `t2v` 模式被误拦
- `source_video` 模式虽然满足了自己的必填槽，仍会被第二层误拦
- `omni` 这类没有单槽必填、但模式整体仍需至少一种参考的模式，和 `t2v` 被混成一类

## 修复范围

- `src/workbench/generationCanvas/runner/generationRunController.ts`
- `src/workbench/generationCanvas/runner/canRunGenerationNode.test.ts`

## 不动项

- 不改模型档案定义
- 不改生成 UI
- 不处理 `source_video` 连线投递链路（本次只修运行前判定）

## 执行方案

1. 视频节点按**当前 mode 的 transportTaskKind**判定：
   - `text_to_video`：必填槽通过后即可生成
   - `image_to_video`：必填槽通过后，还要确认当前 mode 至少有一种槽值
2. 保留已有的必填槽错误提示
3. 增加回归测试覆盖：
   - HappyHorse `t2v`
   - HappyHorse `edit`
   - Seedance Apimart `t2v`
   - Dreamina Seedance `t2v`
   - Seedance `omni` 仍需参考

## 回滚

只回滚上述两处代码即可，上传修复不受影响。

## 验收

- 相关单测全过
- 生成画布测试集全过
- `typecheck` 通过
