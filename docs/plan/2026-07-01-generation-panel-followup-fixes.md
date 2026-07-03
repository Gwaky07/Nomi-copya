# 生成面板后续根因修复（2026-07-01）
## 背景

上传多选和生成前拦截已经修过，但用户贴出的运行日志还暴露了两条生成区真问题：

- 项目库封面会把 `mp4` 当静态图喂给图片组件，导致视频项目反复报“图片加载失败”
- 助手模型下拉把同名不同供应商的模型当成同一个选项，触发重复 key，且选中值也会互相撞

这两条都属于“生成区主流程仍有真实异常”，需要一起收口。

## 根因

### 1. 视频被当项目封面图

项目封面派生逻辑目前是：

- 有 `result.url` 就直接取 `result.url`
- 否则回退 `result.thumbnailUrl`

这个规则没区分 `result.type`。当结果是视频而且只有 `url=xxx.mp4`、没有静态缩略图时，项目库会把 `mp4` 塞进 `thumbnailUrls`，最终被 `NomiImage` 当图片加载。

### 2. 助手模型选择器 identity 不唯一

助手模型选择器目前只用 `modelKey` 作为：

- 下拉选项的 `key`
- 下拉选项的 `value`
- 当前选中值

但模型目录里允许出现“不同供应商、同一个 `modelKey`”的记录，所以：

- React children key 重复
- 选中态和切换逻辑也会串

## 修复范围

- `src/workbench/project/projectNormalize.ts`
- `src/workbench/project/projectNormalize.test.ts`
- `electron/workspace/workspaceRepository.ts`
- `electron/workspace/thumbnailDerive.equivalence.test.ts`
- `src/workbench/ai/AssistantModelPicker.tsx`

## 不动项

- 不改项目库 UI 结构
- 不改 `NomiSelect` 通用组件
- 不改助手偏好存储结构（仍存 `{ vendorKey, modelKey }`）
- 不改模型目录数据结构

## 执行方案

1. 封面派生改成“只收可静态展示的地址”
   - 优先取 `thumbnailUrl`
   - 仅当 `result.type === 'image'` 时，才允许回退到 `result.url`
   - 视频/音频如果没有缩略图，就不进入封面列表
2. 助手模型选择器改用 `vendorKey::modelKey` 作为选项 identity
   - 选项 `value` 唯一
   - 当前值也用复合 identity
   - `onChange` 再解析回 `{ vendorKey, modelKey }`
   - 同名模型出现多家时，label 补供应商信息，避免用户看不出区别
3. 回归测试补两类场景
   - 视频结果只有 `mp4 url` 时不应进入封面列表
   - 同名模型多家接入时，下拉选项 identity 不再冲突

## 回滚

只需回滚上述 5 个文件。

## 验收

- 缩略图派生相关测试通过
- 生成区现有测试不回归
- `typecheck` 通过
- `build` / `lint:ci` 通过
