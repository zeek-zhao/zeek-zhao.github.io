# zeek-zhao.github.io

本仓库是 GitHub Pages **产物仓**，站点地址为 <https://zeek-zhao.github.io>。

## 分支说明

- **`gh-pages`（唯一活跃分支 / live）**：由 `zeek-zhao/hexo-engine` 的构建流水线以孤儿分支强推方式写入，承载当前线上站点。请勿手工编辑该分支——所有内容改动都来自内容库 `zeek-zhao/ai-obsidian` 经流水线生成。
- **`main`（已废弃，历史快照）**：停留于 2025-04-08 的旧站文件（含旧主题、旧 `link/` 友链页等）。它**不参与** Pages 发布，也**不再维护**。保留仅作历史存档，不要在此分支上继续开发或期待其变更上线。

## 正确的修改路径

1. 内容改动：提交到私有内容库 `zeek-zhao/ai-obsidian`（push main 会经 `notify-publish` → `content-updated` 触发构建）。
2. 引擎/主题改动：提交到 `zeek-zhao/hexo-engine`（`.github/workflows/deploy.yml` 为唯一事实源）。
3. 线上效果以 `https://zeek-zhao.github.io` 及 `gh-pages` 分支为准；本 `main` 分支的任何改动都不会反映到线上。

> 备注：本说明由工作清单 Q10① 添加（2026-11-25），用于消除「main 分支是否生效」的长期歧义。
