# 让 Windows 通过 WSL 接入即梦 CLI

> 2026-06-30 · 状态：进行中
> 真相源：本文件

## 目标

让 Windows 用户在 Nomi 里能直接安装并使用官方即梦 `dreamina` CLI，而不是停在“请去 WSL 手动装”的死路上。

## 范围

- Windows 下自动探测可用的 WSL 发行版
- 安装/登录/生成统一走 WSL 执行
- Windows 侧路径自动翻译成 WSL 路径
- 接入卡文案按平台分流，不再误导
- 补齐单测

## 不动项

- 不改即梦官方 CLI 的协议和解析器
- 不碰现有非 Windows 的本机执行路径
- 不新增第三方依赖

## 验收

- Windows 下能一键安装到 WSL
- 安装后能读到 `dreamina user_credit`
- 登录设备码流程能走通
- 生成命令能把本地素材正确传进 WSL
- 相关测试通过
