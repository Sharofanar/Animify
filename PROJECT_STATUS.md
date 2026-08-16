# Animify 项目状态

> 最后更新：2026-08-17
> 仓库：`https://github.com/Sharofanar/Animify`  
> 主分支：`main`  
> Stage 6 第一 Batch 开始基线：`e11453d8de06c678f8820394f6a668d2884bf5e8 docs: define module boundary rules`
> Stage 6 第二 Batch 开始基线：`0b566c1aa3730f6c543d419f9522fcab561cfd40 feat: add clip trigger editing`
> Stage 6 第三 Batch 开始基线：`c6ceddada0aa73bd547f88cdc9a432f6f58695b5 feat: group clips in click steps`
> Stage 6 第四 Batch 开始基线：`286c9d48abb0f0be530dec50aec0735a0738e0ce feat: group animation clips by step`
> Stage 6 第五 Batch 开始基线：`1eece89743205ba69720fbf91b2d3091800fc99f feat: reorder click steps`
> Stage 7 第一 Batch 开始基线：`2798fed27c73b3c10f72dca05b0dad23cca2d63a docs: define stage 7 timeline architecture`
> Stage 7 第二 Batch 开始基线：`afea4efd90df2629ea2f145e97c1f86d81499b61 feat: add timeline view model`
> Stage 7 第三 Batch 开始基线：`7d8ada20f4875228bef7a993dc4aa14a370b6242 feat: add sequence-local timeline playback`
> Stage 7 Batch 4A 开始基线：`bf999ca1795c8eb4908e4d8c539fd635eec04c2a feat: add timeline hierarchy and selection`
> Stage 7 Batch 4B 开始基线：`294ea504be646a6d37661f0c3b05342856c7d00c feat: add timeline clip start editing`
> Stage 7 Batch 4C 开始基线：`7af7341c23d2c077d21a03faa5f272831d79a2cd feat: add timeline clip duration editing`
> Stage 7 Batch 5A 开始基线：`345b9884e5fa8c699ea00ab104bac76553b393e4 feat: add timeline keyframe timing editing`
> Stage 7 Batch 5B 开始基线：`aed24ef510276546bcf4e3ae3ffd69ab44c58a1a feat: add multi-keyframe timeline editing`
> Stage 7 Batch 6 开始基线：`9807f96983c04bd235357567100a48af5b364f14 feat: add timeline box selection`

本文档是 Animify 当前开发状态的长期事实来源。

任何开发者开始工作前，必须同时阅读：

1. `PROJECT_STATUS.md`
2. `DEVELOPMENT_RULES.md`
3. 当前 Git 工作区的 `git status`
4. 当前分支与 `origin/main` 的提交差异

本文档中的状态必须严格区分：

- **已验证完成**：代码已经实现，并且用户已经按照测试要求实际测试通过。
- **代码已实现，待用户验证**：代码存在于 GitHub 或工作区，但没有取得用户实际验收结果。
- **正在开发**：已经开始修改代码，但尚未形成完整、可测试阶段。
- **计划开发**：已经确定进入开发顺序，但还没有开始修改。
- **暂缓**：已经讨论或预留，但当前阶段不开发。
- **待确认**：现有信息不足，必须读取真实代码、日志或由用户测试后才能判断。

不得把“已经讨论”“已经规划”“代码能够编译”写成“已验证完成”。

---

## 一、当前代码与 GitHub 基线

### 1. 权威远端基线

本轮 Batch 3C-2 开始时 GitHub `origin/main` 最新提交：

```text
76f35fc refactor: extract keyframe commands
cc015fc refactor: extract element clone facade
ace9b08 refactor: extract animation element clone kernel
3aab46e refactor: extract basic element commands
5b1197c fix: pause hidden presentation media
11d1372 fix: disable text editing in presentation
93d7a32 fix: allow presentation clicks through elements
85b7bb0 fix: restore fullscreen video arrow seeking
ba39f48 fix: sync pending media input ownership
d68ce74 refactor: extract animation sequence commands
8a460e3 fix: initialize editor without selection
9f56c5e refactor: extract project document history
291f1c8 fix: stabilize deterministic presentation animations
dac4fe2 refactor: extract project persistence
bbc7f5d docs: sync stage 5.5 architecture status
23e4901 refactor: extract low risk editor boundaries
```

该提交之前已知的连续功能提交包括：

```text
f29b255 feat: sync click steps in html export
3f73e7d docs: add architecture cleanup roadmap
a9166c3 docs: plan App architecture cleanup
5391f11 feat: add step-based presentation playback
975f109 feat: add click step sequence-local timing
c7756b5 feat: add isolated clip preview
ba1cecc Add unified timeline playback controller
7cd0747 Enhance Timeline V2 with sticky ruler and keyframes
c6e8448 Add Timeline V2 and fix stale animation clip visibility
8f0234e Add duplicate asset review and read-only inspection mode
18b3c5c Add persistent media playback settings
ca1ea15 Expand resource center imports and asset relinking
1b94560 Add resource center and unused asset cleanup
0b5908e Secure asset storage and preserve animations when copying elements
da1c071 Unify animation clip selection across editors
02d7b2e Add multi-clip management and sequential playback
20b0c28 Add multi-selection animation batch editing
e2f61cc Add editable v2 keyframe easing
3e6b401 Add editable v2 clip playback controls
f53999c Add floating animation workspace
```

更早的主线提交已经建立：

- Animation Schema V2 兼容层
- 动画命令层
- 动画编译器
- HTML 导出接入
- 高级动画轨道检查器
- 关键帧数值编辑
- 关键帧位置编辑
- 防止关键帧互相穿越
- 关键帧新增与删除

### 2. 技术栈

已经确认的主要技术栈：

- React
- TypeScript
- Vite
- ESLint
- 浏览器 Web Animations API
- 浏览器本地项目持久化
- 独立 HTML 导出

Tailwind CSS、dnd-kit 以及其他依赖的当前实际版本和使用范围，必须以新本地环境中的 `package.json`、锁文件和真实 import 为准，不得凭历史记录猜测。

### 3. 历史临时工作副本冲突

历史 Work 工作区中曾出现以下状态：

```text
本地 main：490bd24 Add basic keyframe insertion and deletion
远端 main：ba1cecc Add unified timeline playback controller
本地状态：ahead 1, behind 14
```

`490bd24` 是基于较旧提交 `09b616e` 开发的关键帧增删实现。

远端后续代码已经独立实现了关键帧增删，并同时加入了更多动画功能。因此：

- 不得直接把 `490bd24` push 到最新 `main`。
- 不得直接把它 rebase、merge 或 cherry-pick 到最新版。
- 如果新本地环境中仍存在该提交，必须先创建可恢复备份，再逐项比较。
- 只有确认其中存在远端没有的必要改动时，才允许人工移植对应逻辑。
- 当前判断：该提交的大部分功能已被远端后续实现覆盖。
- 新本地检查结果：对象数据库中不存在 `490bd24`，当前无需迁移或处理该历史提交。

### 4. 新本地环境状态

首次安全检查日期：2026-07-24

- 本地绝对路径：`D:\Animify`
- 当前分支：`main`
- 当前 HEAD：`ba1cecc4da932544362bc7a6d88a547aadcd03f4`
- 本地 `origin/main`：`ba1cecc4da932544362bc7a6d88a547aadcd03f4`
- GitHub 远端 `main`：`ba1cecc4da932544362bc7a6d88a547aadcd03f4`
- 本地与 `origin/main` 的提交差异：ahead 0、behind 0
- 本地未 push 提交：无
- 工作区未提交修改：只有未跟踪的 `PROJECT_STATUS.md` 和 `DEVELOPMENT_RULES.md`
- 已跟踪文件修改：无
- 暂存修改：无
- Node.js 版本：`v22.13.0`
- npm 版本：`10.9.2`
- 依赖状态：`node_modules` 已存在，`npm.cmd ls --depth=0` 退出码为 0
- 依赖备注：检测到 5 个 extraneous 的 WASM 运行时包；未影响依赖解析、Build 或 Lint，本次未执行 `npm ci`
- Build 状态：`npm.cmd run build` 通过
- Lint 状态：`npm.cmd run lint` 通过
- 自动化测试状态：`package.json` 未定义 `test` 脚本
- Prettier 状态：项目中未发现 Prettier 配置
- 历史提交 `490bd24`：当前本地对象数据库中不存在
- Diff 检查：`git diff --check` 和 `git diff --cached --check` 均通过；Git 对 `src/components/editor/SlideCanvas.tsx` 输出 LF 将转换为 CRLF 的提示，但该文件没有内容修改
- 构建产物：`dist/` 由 `.gitignore` 忽略，Build 后未产生新的 Git 修改

同步结论：

- 当前本地 HEAD、本地 `origin/main` 和 GitHub 远端 `main` 完全一致。
- 当前不需要执行 pull、merge、rebase、reset、cherry-pick 或其他同步操作。
- 两个未跟踪维护文件必须继续保留，未经用户允许不得暂存或提交。

第 0 阶段正式复核结论（2026-07-24）：

- Codex 已再次执行实时 Git、远端、依赖、Build、Lint 和 Diff 检查，结果与首次安全检查一致。
- Work 已重新完整读取 `DEVELOPMENT_RULES.md`、`PROJECT_STATUS.md` 和当前 Git 状态。
- 第 0 阶段要求的基线、依赖、Build、Lint、Diff 和历史提交检查均已有真实结果。
- 当前没有分支分叉、未 push 提交、暂存修改或已跟踪文件修改。
- 5 个 extraneous WASM 运行时包没有影响依赖解析、Build 或 Lint，当前不构成后续测试阻塞。
- `SlideCanvas.tsx` 的 LF / CRLF 提示没有产生内容差异，当前不构成后续测试阻塞。
- 两个维护文件仍未被 Git 跟踪，存在被误删或未随仓库传递的维护风险，但不影响本地运行和人工回归；未经用户允许不得执行 `git add`。
- 结论：**第 0 阶段可以正式结束，可以进入第 1 阶段“最新基线回归测试”。**

### 5. Batch 2A 开始基线与第 5.5 阶段状态

复核日期：2026-07-29

- 当前分支：`main`
- Batch 2A 开始 HEAD：`bbc7f5d2bbf5403dcc2b0ede64014446cd258a3e`
- Batch 2A 开始时本地 `origin/main`：`bbc7f5d2bbf5403dcc2b0ede64014446cd258a3e`
- Batch 2A 开始前最新提交：`bbc7f5d docs: sync stage 5.5 architecture status`
- Batch 2A 开始时本地与 `origin/main`：ahead 0、behind 0
- Batch 2A 开始前工作区：干净
- Batch 2A 开始前暂存区：干净
- Batch 2A 实际提交范围：`PROJECT_STATUS.md`、`src/App.tsx`、新增 `src/utils/projectPersistence.ts`
- Batch 2A 正式提交：`dac4fe2a28c988da7285d71f101fa2ecfc0ee8c8 refactor: extract project persistence`
- 第 5 阶段 HTML 导出 Click Step 同步：已验证完成并通过提交 `f29b255` push
- 第 5.5 阶段：已开始
- 第 5.5 阶段 Batch 1：**已验证完成并通过提交 `23e4901` push（2026-07-28）**
- 第 5.5 阶段 Batch 2 前置只读架构审计：已完成
- 第 5.5 阶段 Batch 2A：**已验证完成并 commit / push**
- 第 5.5 阶段 Batch 2B：**已验证完成；manual QA passed；作为稳定 Project Document / History 架构基线**
- Batch 2B 开始基线：`main` = `origin/main` = `291f1c87d426fcdd8b7eb473046fd4c591cfebdf`，开始前 ahead 0、behind 0、工作区和暂存区干净

---

## 二、当前阶段总目标

当前阶段总目标是完成：

# Animify 动画与放映系统 V1

这一阶段需要形成完整闭环：

1. 用户可以为一个对象配置多个动画 Clip。
2. 用户可以编辑 Clip 的时间和播放参数。
3. 用户可以编辑关键帧数值、位置和缓动。
4. 用户可以单独预览当前选中的 Clip。
5. 用户可以预览当前页面的完整动画。
6. 用户可以设置动画是进入页面自动播放，还是点击后播放。
7. 放映模式支持类似 PowerPoint 的逐步播放。
8. 一次操作只推进一个动画步骤。
9. 当前页面动画步骤结束后，再进入下一页。
10. 编辑器放映和导出 HTML 使用一致的动画顺序与触发规则。
11. 动画修改支持保存恢复、Undo 和 Redo。
12. 删除对象、动画或资源后，不残留无效数据或幽灵 UI。
13. 每一个阶段都必须能够由用户独立测试。

本阶段不追求完整的 AE 级动画编辑能力。

本阶段完成的判断标准不是“代码已经写完”，而是：

- 代码实现完成；
- Build、Lint 和相关自动化测试通过；
- 用户按照测试步骤实际验证通过；
- 发现的问题已经分类并处理；
- 项目状态文档已经更新；
- 经用户明确允许后完成对应 Git 操作。

---

## 三、已验证完成的功能

### 1. TimelinePlaybackController V1

状态：**已验证完成**

已经确认：

- Timeline 使用统一播放时钟。
- Playhead 时间可以驱动画布动画状态。
- 支持播放。
- 支持暂停。
- 支持停止并回到零点。
- 支持从头重播当前页面。
- 用户已经对该阶段进行测试并判定通过。
- 对应代码已经 commit 并 push。
- GitHub 最新已知提交为 `ba1cecc`。

### 2. 第 1 阶段最新基线核心回归

状态：**已验证完成（2026-07-24）**

用户明确反馈：功能测试正常。

本轮确认范围：

- 页面与元素新增、复制、删除和切换
- 多 Clip 新增、选择、修改和删除
- 关键帧数值、位置、增删和缓动
- Timeline Seek、缩放、滚动、播放、暂停、继续和停止
- 删除 Clip 后浮动编辑器、右侧列表和 Timeline 同步
- 动画与关键帧 Undo / Redo
- 播放期间页面切换清理
- 自动保存与刷新恢复
- 独立 HTML 导出与现有 `slide-enter` 动画
- 资源中心和当前测试浏览器中的音视频基础功能

仍保留的边界：

- 其他浏览器和大型媒体文件仍需后续扩大兼容性测试。
- Click Step、非 `slide-enter` 触发和单 Clip 预览尚未实现，不属于本轮失败。

### 3. 单 Clip 预览 V1

状态：**已验证完成（2026-07-24）**

用户已经确认：

- 高级动画工作区与 Timeline 都能只预览当前选中的 Clip。
- 播放、暂停、继续、停止和重播正常。
- 从任一入口停止预览后，两个入口的状态和控件同步恢复。
- Timeline 的 Clip 停止与整页停止含义已经区分。
- 修复后的双向状态同步测试正常。

代码状态：

- Build、Lint 和 Diff 检查通过。
- 项目未定义自动化 `test` 脚本，该限制已记录。
- 对应提交：`c7756b5 feat: add isolated clip preview`。
- GitHub 状态：已 push。

---

## 四、代码已实现但仍需整体回归验证的功能

以下能力已经能够从 GitHub 提交和代码结构中确认存在，但不得自动视为全部经过用户最新版本回归测试。

### 1. Animation Schema V2

代码中已经实现：

- `AnimationScene`
- `AnimationSequence`
- `AnimationClip`
- `AnimationTrack`
- `AnimationKeyframe`
- 动画触发类型结构
- 动画播放参数结构
- 旧版动画数据兼容转换
- Scene revision 更新机制

状态：**代码已实现，最新版整体回归待确认**

### 2. 动画编译与播放

代码中已经实现：

- V2 动画编译器
- 数值轨道编译
- 多轨道关键帧合并
- Clip 时间计算
- 播放速度
- 重复次数
- 播放方向
- Canvas 使用 Web Animations API
- 编辑器与 HTML 导出复用动画编译结果

当前已知限制：

- 通用 `compileSlideAnimations` 仍只自动选择 `slide-enter` Sequence。
- 第 4 阶段正式放映控制器已经按步骤显式调用 `compileAnimationSequence` 接入页面级 Click Step。
- Hover、指定对象 Click、Keyboard、Media Time 和 Manual 仍待第 9 阶段运行时接入。

状态：**页面级 Click Step 运行时已用户验证完成；其他触发仍待开发**

### 3. 高级动画工作区

代码中已经实现：

- 浮动动画工作区
- 按设置决定始终显示或按需显示
- Clip 详情编辑
- 属性面板与高级动画编辑器联动
- 当前 Clip 选择状态同步
- Timeline 与高级编辑器选择状态同步

状态：**当前测试浏览器中用户回归通过**

### 4. Clip 管理

代码中已经实现：

- 新增 Clip
- 删除 Clip
- 复制 Clip
- 多 Clip 管理
- Clip 顺序播放
- Clip 开始时间
- Clip 持续时间
- Clip 启用状态
- Clip 重复次数
- Clip 播放方向
- Clip 播放速度
- 多选对象批量设置动画

状态：**核心用户回归通过，极端边界仍需后续扩大测试**

### 5. 关键帧编辑

代码中已经实现：

- 修改关键帧数值
- 修改关键帧位置
- 防止关键帧互相穿越
- 相邻关键帧保留最小间隔
- 新增关键帧
- 删除关键帧
- 每条基础轨道至少保留两个关键帧
- 编辑关键帧区间缓动
- 最后一个关键帧不设置无意义的后续区间缓动
- 对新增和删除操作接入项目历史记录

状态：**当前清单范围内用户验证通过**

### 6. Timeline V2-B

代码中已经实现：

- Timeline 标尺
- Timeline 缩放
- Timeline 横向滚动
- 固定图层名称列
- Playhead
- Clip 条目
- Clip 级聚合关键帧标记
- 单击选择 Clip
- 打开 Clip 详细编辑
- 播放、暂停和停止按钮
- Timeline 与画布时间同步

状态：**当前清单范围内用户验证通过**

### 7. 幽灵 Clip 修复

历史问题：

- 已经删除的动画仍显示在当前页面动画列表或 Timeline 中。

GitHub 中存在对应修复提交：

```text
c6e8448 Add Timeline V2 and fix stale animation clip visibility
```

状态：**最新版删除流程用户验证通过**

### 8. 资源中心

代码中已经实现：

- 资源中心
- 资源导入
- 资源重新关联
- 未使用资源清理
- 重复资源检查
- 只读检查模式
- 资源持久化
- 复制元素时保留动画
- 资源 Blob URL 与导出 Data URL 的处理

状态：**当前清单中的资源基础回归通过，大文件和异常资源边界待后续测试**

### 9. 音频与视频

代码中已经实现：

- 音频和视频元素
- 手动播放设置
- 进入页面播放设置
- 循环
- 静音
- 音量
- 编辑画布不自动触发正式放映行为
- 放映模式和 HTML 导出使用媒体设置
- 全屏视频期间保护媒体快捷键
- 媒体控件获得焦点时，不错误推进演示文稿

状态：**当前测试浏览器中基础回归通过，跨浏览器测试仍待确认**

### 10. 项目历史

代码中已经实现：

- Undo
- Redo
- 连续输入的历史分组
- 部分动画命令的独立历史事务
- 文本输入框保留原生撤销行为
- 项目修改进入项目历史

状态：**当前清单中的 Undo / Redo 回归通过，复杂长链操作仍待后续扩大测试**

---

## 五、当前开发状态

# 第 4 阶段：PPT 式放映控制器

状态：**已验证完成（2026-07-26）**

本阶段实现：

- 新增纯 `PresentationPlaybackState` 状态机，运行时状态不写入项目数据、Undo / Redo 或 `AnimationClip.startMs`。
- 放映计划直接读取现有 `AnimationSequence`、`sequenceOrder` 和 Sequence 级公共有效时长。
- 页面级 Click Step 只消费无 `targetElementId` 的 `click` Sequence；指定对象点击仍留在第 9 阶段。
- 真正进入页面时自动从 `slide-enter` Sequence 的局部 0ms 开始播放，`slide-enter` 不占 Click Step 编号。
- 每次前进只启动一个尚未执行的 Click Step；Step 1、2、3 分别从各自 Sequence 的局部 0ms 开始。
- `Space`、`Enter`、`ArrowRight`、`PageDown` 和放映空白区域点击共用同一个普通推进入口。
- 当前 Sequence 播放时忽略普通重复前进；键盘自动重复事件也不会推进，因此不会创建重叠播放实例。
- 第 4 阶段首轮人工验收确认上述保护锁生效，同时发现缺少可主动跳过长动画的强制步进 UX；随后增加的放映模式滚轮专用强制步进已通过用户核心人工验收。
- 滚轮向下严格只跨越一个演示状态边界：有活动 Sequence 时只把它按自身局部有效时长采样并标记到完成态，停留在该完成视觉；没有活动 Sequence 时才启动下一个 Click Step，稳定状态下本页步骤全部完成时才进入下一页。
- Wheel Up / Down 形成对称语义：活动 Sequence 上滚只取消并回到开始前确定态，下滚只完成并停在结束确定态；开始前态、播放中和完成态之间不会在一次手势中连续跨越两层。
- 滚轮向上会取消正在播放的 Sequence 并恢复到此前确定的已完成 Sequence 状态；活动 `slide-enter` 被取消时保持未完成并恢复页面起始态，活动 Click Step 被取消时保留它之前的完成态；没有活动 Sequence 时继续沿用既有逐步回退和上一页末态规则。
- 滚轮强制步进首轮复测发现：取消活动 `slide-enter` 后状态机虽未把它标记完成，但空 Sequence sample 会让 Canvas 显示静态设计终态，视觉上错误地像已完成。当前已用显式 `slide-enter` 初始帧采样修正；Wheel、`ArrowLeft` 和 `PageUp` 共用的回退路径同时受益，后续核心人工验收已确认回退语义正常。
- 后续人工验收发现尚未执行的 future Click Sequence 未进入正式放映 Canvas 采样，目标元素会 fallback 到设计终态并提前显示。当前 runtime sample 已明确区分 `pending`、`completed`、`active`：未被历史 Sequence 建立状态的元素使用最早 pending Sequence 的真实 local 0ms Track / Keyframe；同一元素已有 completed / active 状态时，future pending 不参与渲染并不得覆盖历史确定态。
- 第 5 阶段人工验收进一步确认：pending 初始基线与 active Clip 参与合成必须分开解释。正式规则已改为 active Clip 在 `localTime < startMs` 时不参与合成；此前没有历史状态的元素可继续保留其 pending 初始基线。
- 导出 Runtime 修正后，用户继续验收发现编辑器正式放映仍按整个 active Sequence 提前应用 delayed Clip 首帧。当前已把 `presentationPlayback.ts` 的资格判断下沉到逐编译 Animation，并让 `SlideCanvas.tsx` 的正式 Presentation sampling 消费相同的 participating / pending baseline 结果；Timeline V2-B 的 `animationTimelineTimeMs` 预览分支未修改。
- 滚轮手势先归一化像素 / 行 / 页 delta，再累计到阈值；首次触发后保持手势锁，直到连续 wheel event 静默 `240ms`，一次鼠标滚轮或触控板惯性事件串最多移动一步。
- 正式放映的非交互区域 wheel 使用非 passive 监听并阻止页面滚动；媒体、原生 / authored 控件、显式 wheel owner、ARIA 滚轮控件、真实可滚动区域、浏览器缩放手势和全屏媒体继续保留输入所有权。
- 当前页面 Click Step 全部处于稳定完成态后，下一次普通推进或独立的强制向下滚轮才进入下一页；如果最后一个 Step 正在播放，本次向下滚只完成它而不切页。
- `ArrowLeft` 和 `PageUp` 使用确定性 Sequence 结束采样逐步回退：依次撤回已完成 Click Step、撤回 `slide-enter`、回到页面起始状态，再次回退才进入上一页。
- 进入上一页时恢复该页全部 Sequence 的结束采样，形成连续的 PPT 式回退体验。
- 新增正式放映专用 Hook，只有一个 `requestAnimationFrame` 循环推进当前 Sequence 的局部时间。
- 进入正式放映前停止编辑器 Timeline / 单 Clip 预览；正式放映、整页 Timeline 和单 Clip 预览不会并发控制 Canvas。
- `SlideCanvas` 在正式放映中对每个已显示 Sequence 分别调用 `compileAnimationSequence(scene, sequenceId)`。
- 已完成 Sequence 按各自有效局部结束时间采样，当前 Sequence 按自己的局部播放时间采样；没有把 Click Step 拼接成页面绝对时间。
- Sequence 受控采样启用时，`SlideCanvas` 不再启动原有自主 Web Animation 定时器，避免双播放器。
- 视频 / 音频、按钮、链接、输入控件和其他真实交互控件继续保留点击与键盘所有权。
- 全屏媒体期间暂停放映导航；第一次 Escape 由浏览器退出媒体全屏，非媒体全屏状态下 Escape 退出 Animify 放映模式。
- 旧项目如果只有 `slide-enter`，该 Sequence 完成后的第一次推进直接进入下一页。

修改文件：

```text
src/App.tsx
src/components/editor/SlideCanvas.tsx
src/hooks/usePresentationPlaybackController.ts
src/utils/presentationPlayback.ts
PROJECT_STATUS.md
```

代码检查：

- `npm.cmd run lint`：通过，0 error、0 warning。
- `npm.cmd run build`：通过。
- 自动化测试：`package.json` 未定义 `test` 脚本，本轮未新增虚假 test 命令或大型测试框架。
- 状态机不落盘直接断言：首轮 20 项、滚轮首版强制步进 15 项、回退采样 18 项均通过；本次单边界强制前进新增 22 项断言通过，覆盖活动 `slide-enter` / Step 1 / Step 2 各自只完成不连播、稳定完成态下一手势才启动后续 Step、活动末 Step 不翻页及其后独立手势才请求下一页。
- pending / completed / active 采样优先级不落盘直接断言：15 项通过；覆盖 future Click local 0ms、正 `startMs` 初始帧标记、不同元素 pending 初始态、同一元素 completed / active 优先、多个 pending 只选择最早 Sequence，以及取消 `slide-enter` 后页面起始态。
- `git diff --check`：通过，仅有工作区 LF / CRLF 转换提示。

用户人工验收（2026-07-26）：

1. 页面进入自动执行 `slide-enter`，行为正常。
2. Click Step 按 Sequence 顺序逐步执行。
3. 每次普通推进只执行一步；动画播放中普通推进保护锁正常。
4. Wheel Down 在播放中只跳到当前 Sequence 完成态，下一次独立 Wheel Down 才开始下一个 Step。
5. Wheel Up 在播放中退回当前 Sequence 开始前的确定状态。
6. `ArrowLeft` / `PageUp` 与逐步回退状态机语义一致。
7. 最后一个 Step 完成后的下一次操作才翻页。
8. 返回上一页会恢复上一页全部步骤完成后的末态。
9. future / pending Click Sequence 的进入元素不会提前显示。
10. completed / active 确定状态不会被 future Sequence 覆盖。
11. `AnimationSequence`、`AnimationClip.startMs` 和播放采样继续保持 Sequence-local time。
12. 正式放映核心流程人工测试正常。

本阶段验收边界：

- 当前 Timeline V2-B 和编辑动画幕布尚未完整接入 Click Step Sequence 上下文，仍会把不同 Sequence 临时扁平显示；该限制属于第 7 阶段 Timeline V2-C，不是第 4 阶段阻塞项。
- 当前动画编辑区“整页播放”仍主要沿用 Timeline V2-B 行为，只执行 `slide-enter`；Click Step 的正式编辑器预览语义留到 Timeline V2-C，本阶段不继续修改。

当前未实现且保持边界：

- 第 6 阶段 Click Step 编辑 UI。
- 第 7 阶段 AE 式 Timeline V2-C 和 Sequence 分组 UI。
- Marker 重构。
- Hover、指定对象点击、Keyboard Trigger、Media Time Trigger。

当前结论：**已验证完成（2026-07-26）**

后续回归清单：

1. 使用已有第 3 阶段 QA 数据进入放映，确认只自动播放 `slide-enter`。
2. 在 Sequence 播放期间快速点击空白区域并连续按 `Space` / `Enter` / `ArrowRight` / `PageDown`，确认普通推进仍被保护锁忽略。
3. 在 `slide-enter` 播放期间向下滚一次，确认只到达 `slide-enter` 完成态且不启动 Step 1；等待手势锁释放后再次向下滚，才从 Step 1 的局部 0ms 启动。
4. 在 Step 1 / Step 2 播放期间分别向下滚一次，确认每次只完成当前 Step 并停在其完成态；下一次独立向下滚才启动后续 Step。
5. 在最后一个 Click Step 播放期间向下滚一次，确认只完成该 Step、不切页；等待一个新手势后再次向下滚，才进入下一页并自动从新页 `slide-enter` 局部 0ms 开始。
6. 使用带正 `startMs` 延迟的 `slide-enter`，在它播放期间向上滚一次，确认活动动画被取消、元素恢复进入前初始视觉且 `slide-enter` 未完成；等待一个新滚轮手势后再次向上滚，确认此时才进入上一页末态。
7. 在 Step 1 播放期间向上滚，确认恢复 `slide-enter` 完成态；在 Step 2 播放期间向上滚，确认恢复 Step 1 完成态。
8. 在没有活动 Sequence 时继续逐次向上滚，确认完整层级为：最后 Click Step 完成态 → 前一步完成态 → `slide-enter` 完成态 → 页面起始态 → 上一页末态。
9. 使用 `ArrowLeft` / `PageUp` 重复第 6 至 8 项，确认它们与滚轮共用相同确定性采样语义。
10. 分别用普通鼠标滚轮和触控板长滑 / 惯性滚动测试，确认一组连续 wheel event 最多前进或回退一个状态边界；停止约 `240ms` 后的新手势可以再移动一步。
11. 在视频 / 音频控件、放映工具栏按钮、真实可滚动区域和需要滚轮的控件上滚动，确认不误推进；全屏视频期间也不推进。
12. 在放映空白区域滚动时确认浏览器页面本身不滚动；`Ctrl` / `Meta` 加滚轮不触发步骤。
13. 验证只有 `slide-enter` 的旧页面、普通前进保护锁、Escape、重新播放，以及退出并重新进入放映没有回归。
14. 使用三个不同元素分别承载 `slide-enter`、Step 1、Step 2，确认页面进入和 Step 1 播放期间 Step 2 元素均保持自身 local 0ms 初始视觉，不再显示设计终态。
15. 分别把 Step 1 / Step 2 Clip 设置为淡入、放大进入和上滑进入，确认 pending 状态直接来自真实 Track / Keyframe：透明、透明且缩放至 0.92、透明且下移 28px。
16. 给 future Step 的最早 Clip 设置正 `startMs`，确认步骤尚未执行以及刚启动后的延迟期间都保持进入前初始视觉，直到局部开始时间到达。
17. 让同一元素先在 Step 1 完成动画、再在 Step 2 配置正 `startMs` 动画；Step 2 尚未开始以及 active local time 尚未到 `startMs` 时确认 Step 1 完成态不被覆盖，到达 `startMs` 后 Step 2 才从首 Keyframe 接管。

下一步边界：

- 第 4 阶段已经完成用户人工验收，并通过提交 `5391f11` commit / push。
- 第 5 阶段“HTML 导出 Click Step 同步”已通过用户人工验收。
- 第 5.5 阶段“渐进式架构拆分维护”已在稳定边界暂停；Batch 1、Batch 2A、Batch 2B、Batch 3A、Batch 3B-1、Batch 3B-2A、Batch 3B-2B、Batch 3C-1 与 Batch 3C-2 已验证完成。Batch 3C-3、Batch 4 与 Batch 5 保留为暂缓架构债务，不再阻塞 Stage 6。

# 已完成前置：第 3 阶段 Click Step 数据与命令层

状态：**已验证完成（2026-07-26）**

本阶段实现：

- 继续使用现有 `AnimationSequence`，没有新增第二套 Click Step 持久化结构。
- `trigger.type === "slide-enter"` 表示页面进入自动播放；`trigger.type === "click"` 表示一个页面点击步骤。
- 一个 Click Step 直接通过现有 `clipIds` 保存一个或多个 Clip。
- Click Step 顺序继续以现有 `animationScene.sequenceOrder` 为唯一持久化顺序来源。
- `AnimationSequence` 正式作为独立动画步骤的局部时间上下文；`AnimationClip.startMs` 正式定义为相对所属 Sequence 局部 0ms 的开始偏移。
- 正式合成语义：当 Sequence `localTime < clip.startMs` 时，该 Clip 不参与视觉合成、不应用首 Keyframe，也不取得对应元素 / 属性的视觉控制权；只有 `localTime >= clip.startMs` 后，Clip 才从自己的首 Keyframe 开始接管并播放。
- earlier completed / active 历史确定状态优先于当前 active Sequence 中尚未到 `startMs` 的 Clip；延迟 Clip 在开始前不得覆盖历史视觉。
- 对此前没有任何历史状态的元素，最早 pending Sequence 仍可用真实 Track / Keyframe 建立并保留“尚未执行”的初始基线，避免设计终态泄漏；该 pending 基线不等于 active Clip 在 `startMs` 前参与合成。
- 上述规则完全由持久化 Track / Keyframe 和 Sequence-local 时间判断，不得根据 preset ID 或“进入 / 强调 / 退出”等动画类别硬编码。
- Sequence 的触发时刻属于后续运行时状态，不写回 Clip；用户在页面进入多久后点击都不会改变已保存的 `startMs`。
- 一个 Clip 只能归属一个 Sequence；Clip 跨 Sequence 移动时保留原有局部 `startMs` 数值，不计算或保存页面绝对时间。
- 新增创建、修改、触发切换、步骤移动和按稳定顺序读取 Click Step 的不可变命令。
- 创建或修改步骤时移动 Clip 归属，不复制引用；从 Click Step 移出的 Clip 自动回到 `slide-enter` Sequence。
- 旧版兼容动画首次迁移仍默认建立 `slide-enter` Sequence。
- 旧版兼容 Clip 被明确移入 Click Step 后，后续属性同步不会再把它重复加入 `slide-enter` Sequence。
- 删除 Clip 时继续从所有 Sequence 清理引用并删除空 Sequence。
- 删除对象时在同一项目事务中清理 Clip target、空 Clip、空 Sequence 和对象触发引用；多目标 Clip 保留仍有效的目标。
- 所有新增步骤命令保持输入不可变，可由现有 `commitProjectChange` 作为单次 Undo / Redo 事务调用。
- 新增 Sequence 级公共规则，统一解析有序 Clip、局部开始、错峰、Clip effective duration、Sequence effective local duration、repeat、direction 和 playbackRate。
- 新增指定 Sequence 的公共编译入口；`compileAnimationSequence(scene, sequenceId)` 只编译指定 Sequence，编译结果从该 Sequence 局部 0ms 开始并保持时间隔离；本阶段未实现点击推进或运行时调度。
- 新增 Clip 和复制 Clip 的“下一个开始时间”只读取目标 / 所属 Sequence，不再扫描 Scene 全部 Clip。
- Click Step 数据和触发方式修改继续进入现有保存恢复和 Undo / Redo 体系。

本阶段明确未开发：

- PPT 式放映控制器。
- Click Step 编辑界面。
- HTML 导出 Click Step 同步。
- Timeline V2-C。

Marker 决定：

- 当前 Marker 仍是 `AnimationScene.markers` 下的 Scene-level 时间点，没有 Sequence 归属。
- 本阶段不修改 Marker 数据，避免借机扩大范围；在第 7 阶段 Timeline V2-C 开始前，必须决定 Marker 是页面级参考线、Sequence-local Marker，还是两者并存。

当前临时 Timeline 状态：

- 当前 Timeline V2-B 仍会把不同 Sequence 的 Clip 临时扁平显示到同一视觉标尺。
- 这只是当前 UI 的阶段性限制，不改变底层真实数据。
- 从第 3 阶段开始，底层正式时间语义是 **AnimationSequence-local time**。
- 当前扁平 Timeline 中的视觉位置不得解释为 Click Step 的页面全局绝对时间。
- 本轮没有修改 Timeline UI。

源代码变更：

```text
src/App.tsx
src/components/editor/PropertyPanel.tsx
src/types/presentation.ts
src/utils/animationCommands.ts
src/utils/animationCompiler.ts
src/utils/animationSequence.ts
```

检查结果：

- `npm.cmd run build`：通过。
- `npm.cmd run lint`：通过。
- 自动化测试：`package.json` 未定义 `test` 脚本。
- 使用仓库现有 Rolldown 对命令层执行不落盘断言：原 15 项通过。
- 本轮新增 Sequence-local 专项断言：16 项通过；新增 Clip 的目标 Sequence 隔离路径及 Sequence playback direction 2 项断言另行通过。
- 断言覆盖多 Clip 分组、步骤顺序、触发切换、旧项目默认 `slide-enter`、Clip 删除、对象删除引用清理、Sequence 隔离时长、指定 Sequence 编译、复制 / 新增 Clip 和跨 Sequence 移动保留 `startMs`。
- Git Diff：已检查，改动范围保持在本阶段数据与命令层及维护文档。

用户人工验收（2026-07-26）：

1. 原 `slide-enter` 动画新增和时间设置正常。
2. 整页播放顺序正常。
3. 暂停、继续、停止和重播正常。
4. 单 Clip 预览、暂停、继续、停止以及两个入口状态同步正常。
5. 关键帧新增、修改、Undo、Redo 正常。
6. 自动保存和刷新恢复正常。
7. 独立 HTML 中现有 `slide-enter` 动画顺序和时间正常。
8. Sequence-local 专项 QA 通过：
   - `slide-enter`：1 个 Clip，局部 `startMs = 0`。
   - Click Step 1：2 个 Clip，局部 `startMs = 0 / 1000`。
   - Click Step 2：1 个 Clip，局部 `startMs = 0`。
   - Step 1 effective duration = `1500ms`。
   - Step 2 effective duration = `9000ms`。
   - Step 1 compiled delays = `[0, 1000]`。
   - Step 1 dry duplicate `startMs = 1500ms`。
   - Step 2 的 `9000ms` 不影响 Step 1。
9. QA 数据经过刷新、重新读取后，Sequence 归属和局部时间保持正确。
10. QA 数据成功从 `localStorage` 备份恢复。
11. 恢复后再次整页播放正常。
12. Console 在编辑器测试过程中没有出现新的产品运行红色错误。

HTML 本地打开兼容性观察：

- 独立 HTML 通过 `file://` 直接打开时，Console 曾出现一次浏览器本地 file URL / unique security origin 相关错误。
- 本轮实际动画播放正常，当前没有证据证明该错误由第 3 阶段引起，因此不作为第 3 阶段阻塞项。
- 该现象记录为待后续定位的 HTML 本地打开兼容性观察项，本轮不修复。

当前结论：**已验证完成**

下一步边界：

- 第 3 阶段已经结束并通过用户验收，对应代码已通过提交 `975f109` push。
- 第 4 阶段已经直接复用 Sequence-local time、`compileAnimationSequence` 和公共时长规则完成代码实现，并通过用户核心人工验收。
- 第 5 阶段“HTML 导出 Click Step 同步”已验证完成（2026-07-28）。

## 已完成前置：单 Clip 预览 V1

状态：**已验证完成（2026-07-24）**

用户验收结论：

- 首轮测试发现高级动画工作区与 Timeline 的停止状态显示不一致。
- 根因是 Timeline 永久显示了含义模糊的整页/Clip 共用停止控件，不是两套预览状态或多个计时器竞争。
- 修复后，两个入口统一显示“预览 Clip / 暂停 Clip / 继续 Clip”。
- Clip 重播和停止仅在 Clip 预览态显示；整页停止独立标注为“停止整页”。
- 用户最终反馈：测试正常。

已验证实现：

- 只播放当前选中的 Clip，不播放同页其他 Clip。
- 复用 TimelinePlaybackController 和绝对时间轴，没有创建第二个计时器。
- Clip 的重复、方向、播放速度、关键帧和缓动继续使用现有项目数据与编译规则。
- 支持播放、暂停、继续、停止和从头重播。
- 停止后恢复预览开始前的 Playhead 和画布状态。
- 切页、切换或删除 Clip、项目修改、Undo / Redo 和模式切换会清理预览。
- 预览状态不写入项目数据，也不产生独立 Undo 记录。

源代码变更：

```text
src/App.tsx
src/components/editor/AnimationFloatingPanel.tsx
src/components/editor/AnimationTimeline.tsx
src/components/editor/SlideCanvas.tsx
src/hooks/useTimelinePlaybackController.ts
src/utils/animationCompiler.ts
```

检查与 Git 状态：

- `npm.cmd run lint`：通过，0 error、0 warning。
- `npm.cmd run build`：通过。
- 自动化测试：`package.json` 未定义 `test` 脚本。
- `git diff --check`：通过，仅有 LF / CRLF 转换提示。
- 用户人工测试：通过。
- 用户已手动完成 commit 和 push。
- 对应提交：`c7756b58c7aff13fc17dd832d807058a2555c775`。
- 第 3 阶段开始前 `main` 与 `origin/main` 一致，且当时仅 `PROJECT_STATUS.md` 有状态同步修改；当前工作区状态见第一节第 5 项。
- `PROJECT_STATUS.md` 和 `DEVELOPMENT_RULES.md` 已纳入版本控制。

阶段衔接：

- 第 3 阶段“Click Step 数据与命令层”已经用户验收，并通过提交 `975f109` push。
- 第 4 阶段核心功能已经用户人工验收；第 5 阶段也已验证完成。

---

## 六、下一步开发顺序及依赖

### 第 0 阶段：建立安全开发基线

状态：**已正式结束（2026-07-24）**

任务：

1. 读取 `PROJECT_STATUS.md` 和 `DEVELOPMENT_RULES.md`。
2. 检查 `git status`。
3. 检查当前分支。
4. 检查本地 HEAD。
5. 检查本地与 `origin/main` 的差异。
6. 确认是否存在用户未提交修改。
7. 确认是否存在历史提交 `490bd24`。
8. 在不覆盖任何用户修改的前提下确定同步方案。
9. 安装或验证项目依赖。
10. 运行 Build、Lint 和已有测试。
11. 把真实结果写回本文件。

依赖：

- 必须最先完成。
- 未完成前不得开始功能开发。
- 任何会修改 Git 历史或工作区的操作必须取得用户明确许可。

正式结束依据：

- 本地 `main`、本地 `origin/main` 和 GitHub 远端 `main` 均为 `ba1cecc4da932544362bc7a6d88a547aadcd03f4`。
- Ahead 0、behind 0，本地没有未 push 提交。
- 已跟踪文件无修改，暂存区为空，Stash 为空。
- 依赖检查、Build、Lint 和 Diff 检查已通过。
- 项目未定义自动化 `test` 脚本，该限制已记录。
- 没有发现必须在打开浏览器前处理的运行、Git 或数据迁移阻塞。

### 第 1 阶段：最新基线回归测试

状态：**已验证完成（2026-07-24）**

阶段目标：

- 先确认单 Clip 预览将依赖的现有动画数据、统一播放时钟、Timeline、历史记录和持久化路径稳定。
- 发现问题时先分类和记录，不在同一轮扩展到单 Clip 预览实现。
- 核心门槛通过后，才允许进入第 2 阶段功能开发。

重点验证：

- 页面新增、复制、删除和切换
- 元素新增、复制、删除
- 动画新增与删除
- 多 Clip 管理
- 关键帧数值修改
- 关键帧位置修改
- 关键帧新增与删除
- 关键帧缓动
- Timeline Playhead
- 播放、暂停、停止
- 删除动画后 Timeline 是否立即同步
- Undo 和 Redo
- 项目保存与刷新恢复
- HTML 导出
- 资源中心
- 音频和视频

依赖：

- 第 0 阶段完成。

结果处理：

- 用户已经实际测试通过的项目标记为“已验证完成”。
- 仅代码检查通过的项目标记为“代码已实现，待用户验证”。

#### 人工回归执行顺序

测试数据原则：

- Animify 会把项目修改自动保存到浏览器本地存储；如果当前项目包含重要内容，不点击“重置项目”。
- 优先在左侧“幻灯片”区域新增一个独立测试页面。
- 资源和媒体测试只使用可丢弃的小文件；永久清理资源不属于本轮核心门槛。

按以下顺序执行：

1. 启动开发服务器，打开编辑器和 Console，确认无白屏、崩溃、资源初始化失败或持续重复错误。
2. 新增测试页面并在原页面与测试页面之间切换，确认画布、缩略图和选择状态对应当前页面。
3. 新增形状，使用右键“复制副本”、Delete、顶部“撤销”和“重做”验证元素与历史记录。
4. 进入“动画”模式，在属性栏“动画”标签打开 Animation Workspace，为形状添加“淡入”Clip。
5. 再添加“上滑进入”Clip，验证右侧动画列表、浮动编辑器和 Timeline 的选择同步。
6. 修改 Clip 的开始时间、持续时间、循环次数、播放速度和方向，确认 Timeline 与属性值同步。
7. 新增中间关键帧，修改位置、数值和缓动，确认 Timeline 标记和边界保护正确。
8. 对关键帧编辑、新增和删除分别执行 Undo / Redo，确认一次操作对应一个历史步骤。
9. 测试 Timeline Seek、Playhead 拖动、缩放、横向滚动以及画布时间同步。
10. 测试整页播放、暂停、继续、停止、播到结尾后重播，确认统一时钟和 0 时刻恢复正确。
11. 删除第二个 Clip，检查浮动编辑器、右侧列表和 Timeline 同时移除；再用 Undo / Redo 验证幽灵 Clip 修复。
12. 播放到中间时切换页面再返回，确认旧播放状态和动画实例已清理。
13. 复制包含动画的测试页面并播放，确认复制页使用独立元素与 Clip 引用；再测试页面删除、Undo 和 Redo。
14. 等待自动保存后刷新，确认页面、元素、Clip、关键帧、时间参数和缓动恢复；刷新后的新操作仍可 Undo / Redo。
15. 导出独立 HTML，确认文件能打开并按现有 `slide-enter` 规则执行动画。
16. 最后扩展测试资源中心、小图片、浏览器原生 MP4 / MP3 和刷新恢复。

进入第 2 阶段的核心门槛：

- 动画 Clip 新增、选择、修改和删除通过。
- Timeline Seek、播放、暂停、继续和停止通过。
- 删除 Clip 后三个动画界面同步，不出现幽灵 Clip。
- 动画和关键帧操作的 Undo / Redo 通过。
- 播放期间页面切换能够清理状态。
- 刷新后动画数据和 Timeline 能正确恢复。
- HTML 导出能够打开并执行现有 `slide-enter` 动画。

阻塞规则：

- 如果出现崩溃、数据丢失、动画数据不一致、幽灵 Clip、统一时钟失效、Undo / Redo 错乱或刷新恢复失败，暂停进入第 2 阶段，先记录并处理。
- 单纯缺少“只播放当前 Clip”不是本轮失败，因为它正是第 2 阶段计划开发内容。
- 资源中心或媒体的独立兼容性问题如果不影响动画数据、持久化或导出，可单独分类，不必自动阻塞单 Clip 预览开发。

### 第 2 阶段：单 Clip 预览 V1

状态：**已验证完成（2026-07-24）**

目标行为：

- 在高级动画工作区提供“预览当前 Clip”。
- 在合适的 Timeline Clip 交互位置提供单 Clip 预览入口。
- 只播放当前选中的 Clip。
- 不播放同一页面的其他 Clip。
- 预览不修改项目数据。
- 预览不产生 Undo 记录。
- 支持播放、暂停、停止和重新播放。
- 停止后恢复到预览开始前的正确视觉状态。
- 切换页面时自动停止。
- 删除正在预览的 Clip 时自动停止。
- 切换到其他 Clip 时不残留旧动画实例。
- 快速重复点击时不产生多个重叠播放器。
- Clip 播放参数和关键帧缓动必须生效。

需要优先检查的文件：

```text
src/App.tsx
src/components/editor/AnimationFloatingPanel.tsx
src/components/editor/AnimationTimeline.tsx
src/components/editor/AnimationTrackInspector.tsx
src/components/editor/SlideCanvas.tsx
src/hooks/useTimelinePlaybackController.ts
src/types/presentation.ts
src/utils/animationCompiler.ts
```

具体修改文件必须以读取最新版真实代码后的结果为准。

依赖：

- 第 0 阶段完成。
- 第 1 阶段至少完成与动画播放相关的基础回归。

### 第 3 阶段：Click Step 数据与命令层

状态：**已验证完成（2026-07-26）**

目标：

- 使用现有 `AnimationSequence` 作为动画步骤的主要组织结构。
- 明确区分页面进入自动播放和点击后播放。
- 一个点击步骤可以包含一个或多个 Clip。
- 使用稳定、可持久化的步骤顺序。
- 编辑步骤触发方式必须进入 Undo 和 Redo。
- 旧项目继续使用默认 `slide-enter` 行为。
- 不破坏现有 Animation Schema V2 数据。
- 每个 Sequence 建立独立局部 0ms，Clip 的 `startMs` 只相对所属 Sequence。
- 公共计算和编译规则必须让第 4、5、7 阶段复用，不得各自重新实现时长算法。

需要检查的文件：

```text
src/types/presentation.ts
src/utils/animationSchema.ts
src/utils/animationCommands.ts
src/utils/animationCompiler.ts
src/App.tsx
```

依赖：

- 单 Clip 播放能力稳定。
- 必须先确定运行时需要的数据形态，再开发界面。

### 第 4 阶段：PPT 式放映控制器

状态：**已验证完成（2026-07-26）**

目标行为：

- 页面进入时播放 `slide-enter` 动画。
- 鼠标点击空白放映区域时推进一个步骤。
- 空格推进一个步骤。
- Enter 推进一个步骤。
- ArrowRight 推进一个步骤。
- PageDown 推进一个步骤。
- 当前页面所有步骤结束后，下一次操作进入下一页。
- ArrowLeft 和 PageUp 支持回退动画步骤。
- 回退到页面起始状态后，再次回退才进入上一页。
- 媒体控件获得焦点时，快捷键仍归媒体控件处理。
- 全屏视频播放时，不误触发页面或动画步骤切换。
- Escape 退出放映模式。
- 切换页面时清理上一页播放状态。

依赖：

- Click Step 数据与命令层已验证完成。
- 单 Clip 播放能力稳定。
- 必须直接使用第 3 阶段已经建立的 Sequence-local time、`compileAnimationSequence` 和 Sequence 级公共计算规则，禁止建立第二套 Click Step 时间模型。
- 用户已于 2026-07-27 明确要求开始第 5 阶段。

### 第 5 阶段：HTML 导出 Click Step 同步

状态：**已验证完成（2026-07-28）**

本阶段架构约束：

- 第 5 阶段继续按原计划开发，不因 `App.tsx` 体量暂停或改变 HTML Click Step 同步范围。
- 第 5 阶段新增逻辑不得继续大量堆入 `App.tsx`；具有明确独立职责的逻辑优先进入 util、Hook、controller、service / runtime helper 或独立组件。
- 本阶段禁止为了减少 `App.tsx` 行数进行无关重构，也禁止在实现 HTML Click Step 同步时顺手大拆 `App.tsx`。
- 不按文件长度机械拆函数；只有存在真实职责边界时才提取模块，避免产生大量单层转发文件。
- 已有 `useTimelinePlaybackController`、`usePresentationPlaybackController`、`animationSequence` 和 `presentationPlayback` 等独立模块继续作为正确职责方向，不得重新塞回 `App.tsx`。
- `src/utils/exportHtml.ts` 在阶段开始前约 1199 行，同时承担 portable project / asset packaging、HTML / CSS template、player runtime、DOM / media construction，以及 navigation / keyboard / fullscreen 等职责；提取新增运行时并加入最小启动层后当前约 1130 行。
- 第 5 阶段新增 Click Step playback plan / player runtime 时必须立即控制职责边界，不得继续把所有新逻辑堆入 `exportHtml.ts`。
- 新增职责优先考虑独立的 `exportPlaybackPlan.ts`、`exportPlayerRuntime.ts`，或依据真实依赖确定的等价模块。
- 本阶段不借机全面重构现有 `exportHtml.ts`；既有资源打包和 template 的全面整理留到后续独立维护。

目标：

- 导出 HTML 使用与编辑器放映一致的步骤顺序。
- 相同快捷键产生相同行为。
- 相同触发规则产生相同动画。
- 最后一个步骤后再切换页面。
- 媒体控件和全屏视频继续保留正确行为。
- 导出文件不依赖 Animify 编辑器运行环境。
- 导出后的资源可以正常读取。

本轮实现：

- 新增 `src/utils/exportPlaybackPlan.ts`，直接复用 `createPresentationSlidePlaybackPlan`、Sequence 级局部时长和 `compileAnimationSequence(scene, sequenceId)`，为每张页面生成可序列化的 `slide-enter` / Click Step 播放计划与逐 Sequence 编译结果。
- 新增 `src/utils/exportPlayerRuntime.ts`，只承担当独立 HTML 无法 import 编辑器模块时所需的 standalone DOM / rAF 调度、确定性 WAAPI 采样和输入路由；没有修改持久化动画数据模型。
- `src/utils/exportHtml.ts` 只保留 portable project / 资源打包、HTML / CSS 模板、DOM / media construction 和新 Runtime 接线；旧的 `slide-enter`-only 动画计时器已移除，文件没有因本阶段继续大量膨胀。
- 人工验收确认 standalone HTML 首次直接打开时，有声 autoplay media 会受浏览器 user activation 策略限制；此前页面在加载时立即 `renderSlide()`，媒体 `play()` 又被推迟到下一帧，因此首次进入含自动播放音频的页面可能被拒绝。
- 导出 HTML 现统一显示最小“开始放映”启动层。启动前 `exportPresentationStarted = false`，不 mount 播放计划、不创建 completed / active / pending 状态、不执行第一页 `slide-enter`、不播放媒体，也不响应页面推进、回退、Wheel 或 resize 重挂载。
- “开始放映”按钮在一次真实 click 内通过 `startExportPresentation()` 只打开一次 Runtime 门闩，随后同步挂载第一页并沿用现有 `enterExportSlide` 正常启动第一页 `slide-enter`；门闩本身不 advance、不消费 Click Step，也不是第二套播放状态机。
- 启动按钮位于 `app` 放映点击区域之外，同时显式 `preventDefault()` / `stopPropagation()`；重复点击由一次性门闩拒绝，不会额外推进 Step 或翻页。
- 页面进入媒体仍读取原 `startBehavior`、muted、loop、volume 和 controls 数据；`playSlideMedia()` 改为在启动或导航手势的同步调用栈内调用一次 `play()`。拒绝时继续保留原 warning 和原生 controls，不重试、不强制静音、不使用浏览器 hack。
- 页面进入时自动从 `slide-enter` Sequence 的局部 0ms 开始；普通推进在活动 Sequence 播放期间保持锁定，稳定态每次只启动一个 Click Step，最后 Step 完成后的下一次推进才进入下一页。
- Wheel Down / Up 使用与编辑器一致的 `24px` 阈值和 `240ms` 静默手势锁；活动 Sequence 下滚只完成当前 Sequence，活动 Sequence 上滚只取消并恢复前一确定状态。
- 导出端逐元素、逐编译 Animation 执行 completed / active / pending 确定性采样：历史 completed / 已开始 active 状态优先；只有尚未被历史状态建立视觉的元素才由最早 pending Sequence 的真实 Track / Keyframe 建立初始基线。
- 第 5 阶段首轮人工验收发现 active Sequence 会把正 `startMs` Clip 的首 Keyframe 提前用于合成，导致 earlier completed 元素在延迟期消失；根因是 Runtime 先按 Sequence 选中 active，再通过 before-delay 标记提前采样该 Sequence 最早 Clip。
- 当前已把参与资格下沉到每个编译 Animation：`localTime < timing.delay` 时 active Clip 完全不参与；到达 delay 后才从首 Keyframe 接管。此前没有历史状态的元素继续保留既有 pending baseline，避免静态设计终态闪现。
- future / delayed Clip 不按 preset ID 或动画类别硬编码；判断只使用 Sequence-local time 和真实编译 Track / Keyframe。
- 编辑器正式放映随后发现同一边界仍由 Sequence 级筛选和 `applyInitialFrameBeforeDelay` 提前接管；现已由 `getPresentationRenderableAnimationSamples` 按逐 Animation 的 Sequence-local delay 判断参与资格，并显式返回独立的 pending baseline 标志。
- `SlideCanvas` 仅在正式 Presentation 受控采样分支消费该结果：有历史状态时 delayed active Clip 在 `startMs` 前不存在；无历史状态时才保留最早 active / pending Sequence 的真实首帧基线。旧 Timeline V2-B 编辑预览分支保持不变。
- 返回上一页时直接恢复该页所有 Sequence 完成后的末态；切页和重新挂载时取消上一页 rAF 与 WAAPI 实例。
- 点击空白区域、Space、Enter、ArrowRight、PageDown 进入统一普通推进；ArrowLeft / PageUp 进入统一回退，并处理 `event.repeat`。
- 视频、音频、原生 / authored controls、全屏媒体、可滚动区域和 Ctrl / Meta + Wheel 保留输入所有权；非交互放映区域的 wheel 会阻止页面滚动。
- 只有 `slide-enter` 的旧页面继续自动播放进入动画，完成后下一次推进直接进入下一页。
- 本轮没有修改 `App.tsx`、Timeline 编辑器预览、动画预设、AnimationClip 数据结构、第 5.5 / 6 / 7 阶段功能或已记录的 Delete Clip UX Bug；`SlideCanvas.tsx` 只修改正式 Presentation sampling 的最小分支。

实际修改文件：

```text
PROJECT_STATUS.md
src/components/editor/SlideCanvas.tsx
src/utils/presentationPlayback.ts
src/utils/exportHtml.ts
src/utils/exportPlaybackPlan.ts
src/utils/exportPlayerRuntime.ts
```

代码检查：

- `npm.cmd run lint`：通过，0 error、0 warning。
- `npm.cmd run build`：通过。
- 项目未定义正式 `test` 脚本，本轮没有新增假的测试命令。
- 导出播放计划直接断言：7 项通过，覆盖 Sequence 顺序、各 Sequence 局部时长、Step 1 `[0, 1000]` delay、Step 2 局部 0ms 和跨 Sequence 编译隔离。
- standalone runtime 状态机直接断言：13 项通过，覆盖自动 `slide-enter`、普通播放锁、Wheel Down 单边界、Wheel Up / 稳定态回退、页面起始态和上一页末态。
- completed / active / pending 确定性采样首轮直接断言：5 项通过，覆盖正 `startMs` pending 初始帧、最早 pending 唯一性、历史状态优先和 active Sequence 正式接管。
- `startMs` 合成边界与导出播放回归纯逻辑断言 14 项、WAAPI 确定性采样断言 3 项，合计 17 项通过；确认有 earlier completed 状态时 active delayed Clip 在 0ms / 999ms 不参与、1000ms 才接管。
- 编辑器正式 Presentation sampling 与状态机新增 19 项直接断言通过；覆盖 0ms / 999ms 保持 earlier completed、1000ms 接管、`startMs = 0`、无历史 active / pending baseline、延迟 `slide-enter` 初始态、普通推进锁、Wheel Down / Up 和上一页末态。
- standalone 启动层新增 29 项直接断言通过：Runtime 16 项覆盖 pre-start 无状态、mount / advance / wheel 禁止、首次开始只开门闩、重复开始无效、首次 mount 只启动第一页 `slide-enter`；生成 HTML 13 项覆盖启动层、隐藏导航、事件不冒泡、同步媒体调用、完整 `file://` 单文档结构和生成脚本语法。
- `git diff --check`：通过，仅有工作区 LF / CRLF 转换提示。
- 用户人工测试：已全部通过。用户确认页面进入自动播放、Click Step 顺序与单步推进、最后一步后翻页、completed / active / pending、同一元素跨 Sequence 的历史完成态、普通推进锁、键盘推进、Wheel Down / Up、上一页末态、旧 `slide-enter` 页面兼容、正 `startMs` 合成语义、编辑器正式放映与导出 HTML 一致性、standalone 启动层、有声媒体 autoplay、`file://` 打开及页面导航均正常。
- QA 测试数据已恢复为测试前原项目，没有保留在项目数据或源码中。

依赖：

- 编辑器放映中的 Click Step 行为先稳定。
- 不允许编辑器与导出端分别设计两套不一致的规则。

### 第 5.5 阶段：渐进式架构拆分维护

状态：**架构拆分在稳定边界暂停（Batch 1、Batch 2A、Batch 2B、Batch 3A、Batch 3B-1、Batch 3B-2A、Batch 3B-2B、Batch 3C-1 与 Batch 3C-2 已验证完成；Batch 3C-3、Batch 4 与 Batch 5 暂缓）**

#### 1. 阶段位置与总体原则

- 第 5.5 阶段只能在第 5 阶段完成、通过用户人工验收并完成独立 commit / push 后开始。
- 第 5.5 阶段位于第 6 阶段 Click Step 编辑 UI 之前；第 6 阶段开始前必须至少完成必要的一轮职责拆分。
- 目标不是为了减少行数机械拆文件，而是按真实职责边界渐进拆分，减少 God Component / God Module，明确状态所有权，并降低第 6、7 阶段继续开发时的耦合风险。
- 判断优先级依次是：职责混杂、状态所有权不清、修改一个功能牵连无关功能、难以独立测试或复用，最后才是文件体量。
- 不创建大量只有一层转发的无意义文件，不把已经独立的职责重新塞回 `App.tsx`。
- 每个 Batch 必须独立完成：开发 → lint → build → `git diff --check` → 对应人工回归 → 独立 commit → 独立 push。
- 禁止一次完成全部第 5.5 阶段重构；每个 Batch 验收并完成 Git 闭环后，才能进入下一 Batch。
- 第 5.5 阶段已于 2026-07-28 开始；Batch 1 首轮人工验收发现的页面复制关键帧问题已修复，用户复测确认全部通过；Batch 1 已通过提交 `23e4901 refactor: extract low risk editor boundaries` 完成 commit / push。
- Batch 2 前置只读架构审计已完成；Batch 2A 已按审计边界完成实现、用户人工验证和 Git 闭环；Batch 2B 已按规划完成 Project Document / History 生命周期边界抽离及 final no-op 最小修复，并通过全部人工 QA，作为后续工作的稳定架构基线。Batch 3A 已通过人工 QA，并通过 `d68ce74 refactor: extract animation sequence commands` 完成 Git 闭环；Batch 3B-1、Batch 3B-2A、Batch 3B-2B、Batch 3C-1 与 Batch 3C-2 也已完成实现和人工 QA。
- 开发时间与当前维护收益综合评估后，Stage 5.5 在 Batch 3C-2 后正式暂停于可维护、可测试且不阻塞产品功能的稳定边界；原拆分计划并非全部完成，也不得写成 complete。

#### 2. 已确认架构事实与治理优先级

##### A. 必须优先治理

1. `src/App.tsx`
   - 审计时约 6279 行，是第 5.5 阶段最高优先级技术债。
   - 以下职责混杂描述属于 Batch 2B 前的历史审计结论：当时 App 同时承担项目文档与状态所有权、Undo / Redo 与历史事务、项目持久化 / 自动保存、资源生命周期、slide operations、selection / clipboard / shortcuts、动画编辑协调、Timeline / Clip preview / Presentation glue、HTML export coordination、页面和 Panel 组装，以及 `SlideNavigator` / `SortableSlideCard`。
   - Batch 2B 后，Project React state、`latestProjectRef`、History stacks、History Group 和核心 mutation transaction 已由 `useProjectDocument` / `projectHistory` 拥有；App 当前保留 Editor/UI orchestration、selection、asset runtime、playback、export 和组件组装等边界。
   - 必须按真实状态和职责所有权渐进提取，禁止一次性大拆或只为缩短文件进行机械搬运。

2. `src/utils/animationCommands.ts`
   - 审计时约 2918 行，已经形成 Sequence / Click Step、Clip、Keyframe、Timing / Easing、Scene cleanup 和 Legacy sync 等真实 Command Domain。
   - 需要按 Command Domain 渐进拆分，但原 `animationCommands.ts` 必须先保留为兼容 barrel / re-export，避免一次修改所有消费者。
   - 拆分时必须保护 Clip 唯一 Sequence 归属、Sequence-local time、旧项目兼容、引用清理和 Undo / Redo 命令入口。

##### B. 建议第 5.5 阶段拆分

3. `src/components/editor/PropertyPanel.tsx`
   - Basic、Font、Animation、Layer 已形成天然 UI 边界，属于低风险早期拆分候选。
   - 根 `PropertyPanel` 继续负责现有 Tab 和目标对象协调，不在 UI 拆分时改变属性状态语义。

4. `src/components/editor/AnimationTrackInspector.tsx`
   - 第 7 阶段前至少完成一轮合理的 UI 职责拆分。
   - 优先候选为 `AnimationClipCard`、`AnimationTrackCard`、Keyframe editor、Easing editor 和数值输入组件。
   - 根 Inspector 暂时继续持有现有选择、展开和输入草稿状态；本阶段不借机重新设计动画模型。

##### C. 观察但首轮不要移动核心

5. `src/components/editor/SlideCanvas.tsx`
   - 文件已经超过 2000 行并混合多种职责，但第 4 阶段刚稳定的播放和确定性采样核心不作为第 5.5 阶段首轮移动目标。
   - 首轮禁止优先移动 Sequence 编译选择、completed / active / pending 过滤、确定性 WAAPI 采样、active playback 实例管理，以及 initial frame / 防闪规则。
   - 如果本阶段处理 `SlideCanvas`，只优先考虑几何纯函数、selection overlay、transform handles、静态元素 renderer 和资源缺失占位等外围低风险职责。
   - 播放 / 采样核心继续作为编辑器、正式放映和未来 Timeline V2-C 的稳定基础。

##### D. 明确暂不拆或推迟

6. `src/components/editor/AnimationTimeline.tsx`
   - 结构性拆分推迟到第 7 阶段 Timeline V2-C。
   - 现有页面级扁平 Timeline 将被 `AnimationSequence → Object / Clip → AnimationTrack → Keyframe` 架构替代，不先重构旧结构再在第 7 阶段返工。

7. `src/utils/animationCompiler.ts`
   - 审计时约 656 行，但当前仍是单一高内聚编译管线，暂时不按文件长度机械拆分。

8. `src/utils/presentationPlayback.ts`
   - 继续保持纯放映状态机，不拆分，也不把运行时状态塞回 `App.tsx`。

9. `src/utils/animationSequence.ts`
   - 继续保持 Sequence-local 公共规则，不拆分，不建立第二套 Sequence 时间计算。

10. `src/types/presentation.ts`
    - 当前 fan-in 很高，但仍是统一持久化 Schema；暂时不为文件大小拆散类型。

#### 3. 正式推荐 Batch

##### Batch 1：App 低风险外围边界

状态：**已验证完成（2026-07-28）**

本轮实际抽离：

- `SlideNavigator` 与内部 `SortableSlideCard` 原样移至 `src/components/editor/SlideNavigator.tsx`；UI、props、缩略图、选择和 dnd-kit 排序语义未改变。
- Batch 1 首轮将 `normalizeSlideTitles`、`createBlankSlide`、`duplicateSlide` 原样移至 `src/utils/slideOperations.ts`；App 仍决定何时 mutation，并继续通过 `commitProjectChange` 提交历史事务。
- `ActiveAnimationContext`、`AnimationWorkspaceDisplayMode`、`ElementUpdates`、`ElementBatchUpdate`、`TimelinePlaybackStatus` 统一移至 `src/types/editor.ts`；`useTimelinePlaybackController` 保留原类型 re-export 兼容入口。
- `App.tsx` 从 6279 行降至 5841 行；该数字仅是职责移动结果，不作为阶段成功标准。
- 结构等价直接检查确认 UI 组件块与 Slide helper 块均为原样搬移；未增加 state、effect、controller 或运行时分支。
- 首轮人工验收发现复制含动画与关键帧的页面后，元素和 Clip 存在，但 V2 自定义关键帧丢失；Batch 1 在该状态下未通过。
- 对照 `f29b255` 后确认抽取前后 `duplicateSlide` 函数体等价，抽取过程没有漏搬 Scene 复制步骤；根因是原实现一直从 legacy `element.animations` 重建 V2 Scene，而 legacy mirror 无法表达自定义 Track / Keyframe 和 Click Sequence。
- 当前 `duplicateSlide` 改为深复制现有 `AnimationScene`，并按现有复制命名规则重映射 Sequence、Clip、Track、Keyframe ID，以及 Clip target、Sequence `clipIds`、可选触发目标和 legacy animation mirror 引用。
- Scene-level Path / Marker 保持原有页面内 ID 与语义但使用独立深复制；元素 style、media、动画 Keyframe / easing / value 等嵌套数据不与原页面共享可变引用；asset / media resource ID 继续沿用原共享资源语义。
- `handleDuplicateSlide`、`commitProjectChange`、Undo / Redo 快照入口均未修改，因此页面复制仍是一个既有历史事务。
- project / history / persistence、`commitProjectChange`、Undo / Redo、autosave、asset lifecycle、selection、playback 与 `SlideCanvas` sampling 均保留原位。
- Stage 5 的 `SlideCanvas`、Presentation sampling、HTML export 与 standalone Runtime 未修改。
- Batch 1 已完成人工验证、commit 和 push；正式提交为 `23e49015384380b48231e9e65d2f42adce57fc6c refactor: extract low risk editor boundaries`。
- Batch 1 完成时尚未开始 Batch 2；后续 Batch 2A 已单独进入实现。本 Batch 未修改 `animationCommands.ts`、PropertyPanel 结构、AnimationTrackInspector、Timeline V2-B、Stage 6 / 7 或 Delete Clip Bug。

实际提交文件：

```text
PROJECT_STATUS.md
src/App.tsx
src/components/editor/AnimationFloatingPanel.tsx
src/components/editor/AnimationTimeline.tsx
src/components/editor/PropertyPanel.tsx
src/components/editor/SlideNavigator.tsx
src/hooks/useTimelinePlaybackController.ts
src/types/editor.ts
src/utils/slideOperations.ts
```

代码检查：

- 三个抽离步骤均分别通过 `npm.cmd run lint` 与 `npm.cmd run build`。
- 项目仍未定义 `test` 脚本；本轮没有新增测试框架或假的 test 命令。
- `git diff --check` 通过，仅有 Git 的 LF / CRLF 转换提示。
- 页面复制回归不落盘直接断言：27 项通过，覆盖普通元素、完整 Sequence / Clip / Track / Keyframe、Keyframe offset / value / easing / hold、各级 ID 与引用重映射、legacy mirror、Path / Marker、资源 / media 语义、深复制隔离，以及 Undo / Redo 快照中的关键帧保留。
- 用户人工验收通过：Slide Navigator / Sortable Slide Card、slide operations、editor contract types、完整动画 Scene 深复制、页面复制隔离、Undo / Redo、页面排序 / 新增 / 删除、图片与媒体资源均正常；Timeline、正式放映与 HTML export 无回归。

Git 结果：

- Batch 1 已通过提交 `23e49015384380b48231e9e65d2f42adce57fc6c` commit 并 push。
- Commit message：`refactor: extract low risk editor boundaries`。
- `main` 与 `origin/main` 已同步，ahead 0、behind 0。

目标：

- 从 `App.tsx` 提取 `SlideNavigator` 和 `SortableSlideCard`。
- 提取纯 slide operations，以及标题规范化、复制等纯辅助。
- 统一重复的 editor contract types，包括 `ActiveAnimationContext`、`AnimationWorkspaceDisplayMode`、`ElementUpdates`、`ElementBatchUpdate` 和 `TimelinePlaybackStatus`。
- 先减少边界最明确、风险最低的 `App.tsx` 职责。

本 Batch 不得移动：

- project / history 核心状态所有权。
- Presentation playback。
- Timeline playback。
- `SlideCanvas` animation sampling。

回归重点：

- 页面新增、删除、复制、排序和选择。
- 缩略图。
- 动画引用和资源引用。
- Undo / Redo。

##### Batch 2：项目文档、历史与持久化

状态：**Batch 2A 已验证完成并 commit / push；Batch 2B 已验证完成，manual QA passed**

推荐执行顺序：

```text
Batch 2A：Project persistence adapter
→ Batch 2B：Project document + history transaction
→ 完整人工回归
→ commit / push
→ 重新评估 Batch 3 最小 Sequence Command Domain
→ Stage 6
```

Batch 2A 实际文件：

```text
src/utils/projectPersistence.ts
```

Batch 2A 目标职责：

- `STORAGE_KEY`。
- `localStorage` load / save / clear。
- JSON parse / fallback。
- slide title / Animation Schema compatibility normalization。
- legacy project / asset source 的持久化读取边界。

Batch 2A 明确不负责：

- Project React state ownership。
- Undo / Redo。
- history grouping。
- asset Blob lifecycle。
- selection。
- playback。

Batch 2A 实现结果（2026-07-29）：

- 新增低层 `src/utils/projectPersistence.ts`，统一拥有 Project storage key，以及同步 `localStorage` load / save / clear。
- `loadPersistedProject()` 保持原 fallback 策略：无存储或 JSON / 字段解析失败时返回现有 `demoProject` 的 Animation Schema 兼容结果，不新增弹窗、不清除或覆盖损坏存储。
- 持久化读取边界继续复用 `normalizeSlideTitles()` 和 `normalizeProjectAnimationScenes()`；没有复制标题或 Animation Schema 兼容规则。
- legacy asset `source` 在 adapter 中从 Project metadata 剥离，并作为独立 migration input 返回；`App.tsx` 仍把该输入放入原 `pendingLegacyAssetSources`，由既有 IndexedDB migration 负责 Blob 写入。
- App 的 autosave React effect 和 `assetStoreReady` 安全门闩保持原位；门闩通过后仅改为调用 `savePersistedProject(project)`。
- Reset 的产品决策、React state、history transaction 和 selection 更新保持原位；只有 Project storage 清除改为调用 `clearPersistedProject()`。
- 动画工作区显示偏好仍由 `App.tsx` 使用独立 localStorage key 读写，没有混入 Project persistence adapter。
- `project`、`latestProjectRef`、Undo / Redo stacks、history grouping、snapshot clone、`commitProjectChange`、资源 metadata / history 一致性和全部 asset Blob lifecycle 均未迁移。
- `App.tsx` 从 5841 行降至 5807 行；该变化只是职责抽离结果，不作为 Batch 成功标准。
- 本轮没有修改 SlideCanvas、Timeline、Presentation playback、Stage 5 export Runtime、selection / clipboard / shortcuts、Animation Workspace、`animationCommands`、Stage 6 / 7 或 Delete Clip Bug。

Batch 2A 修改文件：

```text
PROJECT_STATUS.md
src/App.tsx
src/utils/projectPersistence.ts
```

Batch 2A 代码检查：

- project persistence 不落盘直接断言：19 项通过，覆盖 valid stored Project、missing storage fallback、malformed JSON fallback 且不清理原值、标题与 Animation Schema normalization、legacy animation、legacy asset source 提取、asset ID fallback、save → load round trip 和 clear。
- `npm.cmd run lint`：通过，0 error、0 warning。
- `npm.cmd run build`：通过。
- `git diff --check`：通过，仅有 `PROJECT_STATUS.md` 和 `src/App.tsx` 的 LF / CRLF 转换提示。
- 用户人工验证：通过。修改 → autosave → refresh 能保留最新内容；Reset 后恢复 demo 且再次刷新仍保持；普通元素和动画关键帧的 Undo / Redo 正常。
- 动画数据持久化回归：Video 的 AnimationScene / Sequence / Clip / Track / Keyframe 在刷新后完整保留。
- 资源回归：图片和视频在第一次、第二次刷新后均正常，无资源丢失或 missing asset；原 asset Blob lifecycle 与 readiness gate 行为保持。
- Presentation 基础回归：普通元素、页面导航和媒体播放正常。
- HTML export 基础回归：打开、开始放映、普通元素、页面导航以及图片 / 音频 / 视频资源正常。
- 状态：**已验证完成并通过 `refactor: extract project persistence` 完成 commit / push**。

Batch 2B 实际 Hook 文件：

```text
src/hooks/useProjectDocument.ts
```

Batch 2B 实际纯历史辅助文件：

```text
src/utils/projectHistory.ts
```

Batch 2B 实现职责：

- `project`。
- `latestProjectRef`。
- undo / redo stacks。
- history grouping。
- snapshot clone。
- 为 autosave 提供统一 Project document state；`assetStoreReady` 门闩和保存 effect 继续留在 App orchestration。
- mutation transaction。

事务边界：

- `commitProjectChange` 不能孤立拆出。
- 它必须与 history stacks、`latestProjectRef`、history grouping、redo 清理、no-op 判断等事务规则一起处理。
- App 可以继续保留必要的薄 orchestration 边界，用于 duplicate-review 只读保护、Clip preview 清理、Undo / Redo 后 selection 调整和播放/UI 协调。
- 资源 metadata 合并或永久删除仍必须同步处理当前项目及历史快照，不能因封装 history 而破坏资源一致性。
- 自动保存必须继续受 `assetStoreReady` 或等价 persistence-ready 门闩保护。

Batch 2B 实现结果（2026-07-30）：

- 新增 `src/hooks/useProjectDocument.ts`，统一拥有 `project` React state、`latestProjectRef`、Undo / Redo history state、history grouping，以及普通 mutation、无历史 document mutation、Undo / Redo 和跨快照 metadata transform 的公开边界。
- 新增 `src/utils/projectHistory.ts`，以不依赖 React 的纯逻辑统一 snapshot clone、60 条历史上限、Undo / Redo stack 转换、group 初始快照和当前 / Undo / Redo / 活跃 group snapshot 的一致性变换。
- `commitProjectChange` 的 reference-identity no-op 规则保持不变：updater 返回同一 Project 引用时不创建历史、不清空 Redo，也不触发 React 更新。
- 普通修改继续创建一个 Undo 边界并清空 Redo；`recordHistory: false` 在活跃 group 内只标记该 group 已变化，在 group 外仍按既有行为创建一个 Undo 边界。
- history group 只保存连续编辑开始前的初始快照；连续多次拖动 / 输入结束后只形成一个 Undo。
- 最终静态收尾发现原实现只记录“中间是否发生 mutation”，无法识别 `A → B → A`；该状态不能作为 final no-op 的稳定保证，因此没有执行原计划 commit / push。
- `finishProjectHistoryGroup()` 现在只在事务结束时比较最终 Project 与起始快照；顶层 `Project.updatedAt` 和仅用于编译缓存失效的 `AnimationScene.revision` 被明确视为 bookkeeping，其余 Project、Slide、元素、资源、动画数据和数组顺序继续参与内容等价判断。
- Group 最终内容等价时不压入 Undo，也不清空 Group 开始前已有的 Redo；最终确实变化时才压入一次起始快照并在同一 finish 边界清空 Redo。whole-project canonical comparison 不进入 pointermove / rAF / 中间 mutation。
- Undo / Redo 恢复值继续使用深快照，不与 history stack 中保存的可变对象共享引用；新修改后的 Redo 清理规则保持不变。
- 资源 metadata 合并和永久删除改为通过统一 snapshot transformer 同时处理 current、Undo、Redo 和活跃 group 初始快照；asset Blob、Object URL、IndexedDB migration 和永久删除副作用仍由 App 原有 asset lifecycle 负责。
- `App.tsx` 保留 selection、Undo / Redo 后 UI cleanup、Clip preview 清理、`animationPreviewKey`、duplicate-review mutation guard、Blob / Object URL / IndexedDB runtime lifecycle、`assetStoreReady` autosave gate，以及 Presentation、Timeline、Export、keyboard、clipboard、context menu 和 UI composition；没有把这些编辑器或运行时职责塞入 Project Document Hook。
- 页面选择、资源定位和 Presentation 翻页通过同步更新 `latestProjectRef` 的无历史 document mutation 继续保持 stack-neutral；快速连续 Presentation 导航仍会立即看到最新页面。
- autosave effect 与 `assetStoreReady` 门闩仍留在 `App.tsx`，继续调用 Batch 2A 的 `savePersistedProject(project)`；`useProjectDocument` 不依赖 localStorage、IndexedDB、Blob 或 Object URL。
- `App.tsx` 从 Batch 2A 后的 5807 行降至 5750 行；该变化只是职责抽离结果，不作为 Batch 成功标准。
- 本轮没有修改 `SlideCanvas` sampling、Presentation / Timeline Controller、Stage 5 export Runtime、asset lifecycle 整体、selection / clipboard / shortcuts、Animation Workspace、`animationCommands`、Stage 6 / 7 或 Delete Clip Bug。

Batch 2B 实际修改文件：

```text
PROJECT_STATUS.md
src/App.tsx
src/hooks/useProjectDocument.ts
src/utils/projectHistory.ts
```

Batch 2B 代码级验证：

- 不落盘直接断言：24 项通过，覆盖普通 mutation、reference no-op、Redo 清理、group 外 `recordHistory: false`、10 次 group 修改合并为一个 Undo、空 group、60 条上限、Undo / Redo 深快照恢复、资源 metadata 跨 current / Undo / Redo / active group 一致性，以及 autosave readiness gate / Blob lifecycle 未进入 Hook。
- final no-op History Group 专项直接断言：21 项通过，覆盖 `A → B` 一个 Undo、`A → B → A` 零新增 Undo、无重复 B snapshot、已有 Redo 在最终 no-op Group 后保留、真实变化 Group 清空旧 Redo、仅 `updatedAt` / Scene `revision` 变化不产生 History、内容字段仍参与比较、对象键顺序 canonicalization、数组语义以及 History max 60。
- `npm.cmd run lint`：通过，0 error、0 warning。
- `npm.cmd run build`：通过。
- `git diff --check`：通过；仅报告工作区既有 Git 行尾转换提示，不存在 whitespace error。

Batch 2B 最终人工 QA（2026-07-30）：

- 普通 Undo / Redo、连续拖动一个 Undo boundary、新实际 mutation 清空 Redo、autosave + F5、资源 + Undo / Redo + F5、Undo 状态保存、Reset + F5 和原 Project 恢复全部通过。
- Presentation smoke 通过：slide-enter、Click Step、Wheel Down / Up、页面切换、图片与 Video 均正常。
- standalone HTML Export smoke 通过：导出、页面、图片 / Video、slide-enter、Click Step 和页面导航均正常。
- 隐藏重复 Undo 专项通过：已有 `A → B` 历史后执行 `B → C → B`，一次 Ctrl+Z 直接回到 A，没有重复 B snapshot。
- Redo preservation 专项通过：`A → B → Undo(A)` 后执行 `A → C → A`，一次 Ctrl+Y 仍恢复到 B，final no-op Group 没有清空既有 Redo。
- 最终 History invariant：History max = 60；普通实际 mutation 产生一个 Undo，新实际 mutation 清空 Redo；连续 Group 最多产生一个 Undo；Group 最终回到起始文档时产生零 Undo 并保留 Redo；中间 mutation 不提前清空 Redo；只有 finish 确认真实内容变化后才提交 Undo 并清空 Redo。
- 内容等价比较只发生在 Group finish，并且只忽略确认属于 bookkeeping 的 `Project.updatedAt` 与 `AnimationScene.revision`；其他实际 Project 内容、对象值和数组顺序继续参与比较。
- 状态：**已验证完成；manual QA passed；作为稳定 Project Document / History 架构基线。后续 Batch 3A 也已通过人工 QA。**

Batch 2 当前明确禁止移动：

- `SlideCanvas` sampling。
- `usePresentationPlaybackController`。
- Presentation playback handlers。
- `useTimelinePlaybackController`。
- Stage 5 export Runtime。
- Asset lifecycle 整体抽离。
- selection / clipboard / shortcuts。
- Animation Workspace coordinator。
- `animationCommands` domain split。
- Timeline V2-B。
- Stage 6。
- Stage 7。
- Delete Clip UX Bug。

回归重点：

- 所有项目修改。
- Undo / Redo。
- 连续拖动历史分组和属性连续输入。
- 动画编辑历史。
- 自动保存、刷新恢复和重置项目。
- Asset metadata 在 Undo / Redo 快照中的一致性。
- 页面选择、资源定位和 Presentation 翻页等无历史导航。
- Timeline、正式放映和 HTML export 基础回归。

##### Batch 3A：Sequence / Click Step Command Domain

状态：**complete；manual QA passed；stable baseline；已通过 `d68ce74` commit / push；后续 Batch 3B-1、Batch 3B-2A 与 Batch 3B-2B 也已完成。**

实现结果：

- 新增 `src/utils/animationSequenceCommands.ts`，独立拥有 Sequence / Click Step 查询、创建、metadata 更新、trigger 更新和 Click Step 顺序移动，以及对应 command types。
- `src/utils/animationCommands.ts` 继续提供原公开 import path，并通过 compatibility re-export 暴露相同 Sequence command API；现有 App 和 UI 消费者无需修改 import。
- 新增最小中立层 `src/utils/animationCommandHelpers.ts`，只承载多个 command domain 共享的纯 helper；该模块不依赖 `animationCommands.ts` compatibility barrel，也没有形成通用巨型 helpers 文件。
- 依赖方向保持单向：`presentation types` / `animationSequence` / `animationCommandHelpers` → `animationSequenceCommands` → `animationCommands` compatibility exports；新 Sequence module 不反向 import barrel。
- Clip ownership 继续只由 `AnimationSequence.clipIds` 表达；创建或更新 Click Step 时会先解除旧 Sequence 归属，一个 Clip 最多属于一个 Sequence。
- Clip 跨 Sequence 移动时保留原 `startMs` 数值；没有引入页面绝对时间、触发时间转换或第二套 Sequence 模型。
- `sequenceOrder`、revision bump、immutable/no-op、无效输入 fallback、空 Sequence 清理和 legacy slide-enter fallback 均保持原实现行为。
- 本 Batch 没有拆 Clip、Keyframe、element-animation cleanup、batch update、legacy mirror/sync 或复制集成命令，没有修改 Presentation、Timeline、Export、Selection、Asset 或 UI。
- 不落盘直接断言共 171 项通过，覆盖查询顺序、创建、更新、trigger、重排、唯一 Clip ownership、跨 Sequence `startMs`、无效输入、revision、空/悬空引用和 compatibility barrel；另有 9 项 TypeScript barrel/type contract 断言通过。
- 相对 import 图检查覆盖 34 个 `src` TypeScript 文件，没有发现 circular import。
- `npm.cmd run lint`、`npm.cmd run build` 与 `git diff --check` 均通过；项目仍未新增临时 test script 或测试框架。
- 用户人工 QA 已确认既有 Click Step 顺序、`slide-enter`、Wheel Up / Down、Video / Image 动画和 standalone HTML Sequence 行为正常，未发现 Batch 3A extraction 回归。
- Batch 3A 没有改变 `sequenceOrder`、Clip ownership、`startMs`，也没有改变 Presentation、Timeline 或 Export 的时间语义。

后续：

- Batch 3A 独立 Git 闭环后已完成 Pending Media Interaction Bug 独立修复、自动检查和人工 QA。
- Pending Media Interaction Fix 已完成独立 Git 闭环；其后 Batch 3B-1、Batch 3B-2A 与 Batch 3B-2B 也已完成。未经用户明确要求不提前进入后续 Stage 5.5 Batch、Stage 6 或 Stage 7。

##### Batch 3B-1：Pure Element Command Facade — Basic Mutations

状态：**complete；manual QA passed；stable basic element command baseline；已纳入 `refactor: extract basic element commands` Git 闭环；后续 Batch 3B-2A 与 Batch 3B-2B 已完成。**

实现结果：

- 新增 Project 级纯命令 Facade `src/utils/elementCommands.ts`，公开 `insertElementsInProject`、`updateElementInProject`、`updateElementsInProject`、`reorderElementsInProject` 和 `deleteElementsInProject`。
- Facade 只接收调用方显式提供的 `PresentationProject`、`slideId`、`updatedAt`、已构造元素或精确 patch，并返回新 Project 与受影响元素 ID；无效 slide、无效 element、相同基础字段 / style 值和图层边界 no-op 尽量保持原 Project 引用。
- 已迁移普通元素插入、单元素更新、批量更新、键盘移动、Canvas 多选移动、Resize / Rotate 精确 style patch、`bring-forward` / `send-backward` / `bring-to-front` / `send-to-back` 四种图层操作，以及单元素 / 批量删除的 Project Document 变换。
- 单元素更新委托统一批量更新核心；元素更新完整复用 `applyElementBatchUpdatesToSlide`，继续保持 style 浅合并及 legacy animation / Animation Scene V2 同步。
- 元素删除完整复用 `deleteSlideElementsWithAnimations`，继续保持 Clip target、`Sequence.clipIds`、空 Sequence、`sequenceOrder`、trigger target 与 Scene revision 的完整清理语义；共享 Asset metadata 和 Blob 生命周期不属于该命令。
- 图层继续只由 `slide.elements` 数组顺序表达；没有新增 `zIndex`，多选内部顺序和未选元素相对顺序保持不变。
- App 继续拥有 `commitProjectChange`、History options / Group、Selection、Pointer / Keyboard orchestration、Clipboard、Context Menu、单 Clip preview 清理、Asset / Blob / Object URL / IndexedDB 生命周期和 UI 瞬态状态；Facade 不访问 React state、DOM、Presentation 或 Timeline，也不调用任何隐式时间源。
- Copy / Paste / Duplicate、clipboard snapshot、element / legacy ID 创建、App 路由统一和 Asset 导入流程没有进入本 Batch；其中纯动画克隆后来由 Batch 3B-2A 完成，纯 Element Clone Facade 与 App 路由后来由 Batch 3B-2B 完成，Asset 导入仍不属于这两个 Batch。
- 本轮没有修改 Animation Schema、Sequence-local time、Presentation / Export Runtime、Hidden Media Playback Lifecycle、Timeline 架构、Stage 6 或 Stage 7。

自动检查：

- Element Commands 不落盘运行时断言 66 项通过，覆盖纯度 / 引用、插入、单 / 批量更新、精确 move / resize / rotate patch、四种图层操作、完整动画删除清理、legacy / V2 同步和结果 ID。
- App / Facade 结构契约断言 25 项、Presentation interaction regression 断言 16 项通过；历史 Animation Commands / Hidden Media Lifecycle 专项脚本未落盘，本轮使用当前可执行的 Facade 集成与共享 interaction 纯逻辑断言覆盖相关回归边界。
- TypeScript relative import graph 覆盖 36 个模块，无循环依赖。
- `npm.cmd run lint`、`npm.cmd run build`、`git diff --check` 和 staged diff check 均通过；Build 只保留项目已有的 500 kB chunk warning。

人工 QA：

- 用户已确认普通元素新增、属性更新、Move / Resize / Rotate、Undo / Redo、四种图层操作、单删 / 批量删除及动画引用清理正常。
- Presentation 与 standalone HTML 冒烟正常；Copy / Paste / Duplicate 冒烟正常，确认未因 3B-1 Facade 抽取发生回归。
- Timeline 当前显示全部元素仍是既有 Timeline V2-B 结构；未来按动画元素 / AnimationSequence 组织属于 Stage 7，不是 Batch 3B-1 Bug，也没有在本轮实现或解决。

后续：

- Batch 3B-2A 已完成纯动画元素克隆内核；Batch 3B-2B 也已完成 Element Clone Facade、Copy / Paste / Duplicate 路由统一、clipboard snapshot 与 App 编排。

##### Batch 3B-2A：Pure Animation Element Clone Kernel

状态：**complete；manual QA passed；已验证完成；已通过 `refactor: extract animation element clone kernel` 完成 Git 闭环；后续 Batch 3B-2B 也已完成。**

实现结果：

- 新增 `src/utils/animationElementClone.ts`，公开 `CloneElementAnimationsCommand` 与 `cloneElementAnimationsForInsertedElements(command): Slide`，集中负责已经插入元素副本的 V2 动画克隆。
- 原 `cloneElementAnimationsToInsertedElements(...)` 保留公开签名和 import path，但只作为 compatibility wrapper 委托新纯内核；元素动画复制路径不再保留第二套平行算法。
- 新内核不访问 React、History、Selection、Clipboard、DOM、Asset / Blob，也不调用 `Date.now()`、`new Date()`、`Math.random()` 或 `crypto.randomUUID()`；调用方继续显式传入 `operationId`。
- Sequence、Clip、Track、Keyframe 候选 ID 由源 ID、显式 `operationId` 和稳定索引确定；目标 Scene 已存在候选时使用稳定递增后缀，同一 `operationId` 再次执行不会产生冲突。
- Clip、targets / subTarget、Track、Keyframe、对象 / 数组型 `keyframe.value`、easing、custom curve points、stagger、sourcePreset 和 metadata 嵌套数据均进行独立深复制；修改副本不会影响源 Scene、clipboard Scene snapshot 或同次操作的其他副本。
- 同页 Duplicate / Paste 继续复用原 Sequence，`sequenceOrder` 和 trigger 不变；新 Clip 紧跟源 Clip，多元素共享一个源 Clip 时只生成一个新 Clip，targets 只保留复制组内目标并重映射。
- 跨页非 `slide-enter` Sequence 只在至少含一个相关 Clip 时创建，并按源 `sequenceOrder` 追加；组内 click / hover target 重映射，组外 click 降级为页面 click，组外 hover 降级为 manual，不保留源页面失效 `targetElementId`。
- 跨页 `slide-enter` Clip 合并到目标页按顺序找到的第一个有效 `slide-enter`；目标已有时保留其 playback，目标没有时才创建一个并采用首个相关源 playback。历史源 Scene 的多个相关 `slide-enter` 合并到同一个实际运行 Sequence，不再新增运行时无法读取的第二个 `slide-enter`，也不清理目标页历史已有的额外 Sequence。
- 所有克隆 Clip 的 `startMs` 原样保留为所属 Sequence 的局部时间，不转成页面绝对时间，也不按目标 Sequence 时长偏移。
- `metadata.legacyAnimationId` 继续按 source / inserted elements 的 legacy animation 索引映射到副本；找不到有效映射时不保留源页面的无效 mirror ID，legacy / V2 Schema 未改变。
- 无相关 Clip 时返回原 Slide 引用、不创建 Sequence、不增加 revision；至少克隆一个 Clip 时 Scene revision 只按 `max(1, previous + 1)` 增加一次。paths、markers、非相关 Clip / Sequence 和源 Scene 不变。
- 历史异常数据中同一 Clip 被重复写入一个或多个 Sequence 时，只认首个有序归属并只克隆一次，用于维护“一 Clip 一 Sequence”不变量，不改变正常数据语义。
- 在 Batch 3B-2A 完成时，App 的 Copy / Paste / Duplicate 路由、`cloneSlideElementForInsert`、clipboard ref、History、Selection 和 element / legacy ID 创建尚未迁移；其中纯文档克隆与 App 路由现已由 Batch 3B-2B 完成，clipboard ref、History 和 Selection 仍保留在 App。

自动检查：

- Animation Element Clone 主断言、最终归属加固补充断言，以及 Animation deletion / legacy-V2、Element Commands、Presentation interaction、Hidden Media Lifecycle 回归的有效断言共 123 项通过。
- `npm.cmd run lint`、`npm.cmd run build`、`git diff --check` 和 TypeScript import cycle 检查通过；Build 只保留项目已有的 500 kB chunk warning。
- 断言使用不落盘脚本执行，没有新增测试框架、临时脚本或 QA 数据文件。

人工 QA（2026-08-05）：

- 用户已确认同页带关键帧动画 Duplicate、同页带动画元素 Copy / Paste、跨页 Click Step 正常。
- 跨页 `slide-enter` 在目标页无 `slide-enter` 和已有 `slide-enter` 两种路径均正常。
- 跨页副本的关键帧和缓动修改与源动画保持隔离。
- Undo / Redo 与正式 Presentation 回归正常。
- 当前 UI 尚无多目标 Clip 及元素级 click / hover trigger 的创建入口，因此多目标 Clip 部分 / 全部复制、trigger target 重映射 / 降级和历史异常重复 Clip 归属由确定性自动断言验证，不错误声明为 UI 人工创建测试。

后续：

- Batch 3B-2B 已完成 Element Clone Facade、App Copy / Paste / Duplicate 路由统一与 clipboard snapshot，并通过独立人工验收；History / Selection 仍由 App 编排，没有迁入 Facade。
- 未开始 Stage 6 或 Stage 7，也未处理 Duplicate Selection、连续 Paste、Canvas Paste 边界、Selected Element Adorner Layering、Timeline 或其他独立问题。

##### Batch 3B-2B：Element Clone Facade + App Routing

状态：**complete；manual QA passed；已验证完成；通过本次 `refactor: extract element clone facade` 完成 Git 闭环。**

实现结果：

- 新增纯 Project Document Facade `src/utils/elementCloneCommands.ts`，公开 `ElementCopySnapshot`、`ElementPastePlacement`、`createElementCopySnapshot`、`pasteElementSnapshotInProject`、`duplicateElementInProject` 及对应 Command / Result 类型。
- Copy snapshot 按源页面 `slide.elements` 图层顺序保存选中元素，不生成 ID、不修改 Project；Element、style、media、legacy animations、AnimationScene、Clip、Track、Keyframe、value、easing 与 metadata 均完整深隔离。
- snapshot 只保留元素既有 `assetId`，不复制 PresentationAsset metadata、Blob、Object URL、IndexedDB 或 Asset Store 数据。
- 普通 Paste 固定按原 snapshot 偏移 `+32px / +32px` 并整组追加到目标页面末尾；连续 Paste 仍基于原 snapshot，不累积偏移。
- Canvas Paste 接收 App 已换算的 slide-space 坐标，以复制组 `min(x) / min(y)` 为锚点保持相对位置，不计算旋转包围盒、不进行页面边界限制，并追加到目标页面末尾。
- Duplicate 继续只复制一个元素，偏移 `+32px / +32px`，并插入源元素后一位。
- Element 与 legacy animation ID 由显式 `operationId`、源 ID 和稳定索引确定性生成；目标 Project 已存在候选时使用稳定递增后缀，同一 operationId 重复执行仍不会冲突。Facade 不调用时间、随机数或 DOM API。
- V2 动画复制只委托 Batch 3B-2A 的 `cloneElementAnimationsForInsertedElements`；没有建立第二套 Clip / Sequence / Track / Keyframe 克隆算法，Sequence-local `startMs`、同页 Sequence 复用、跨页 trigger 与 `slide-enter` 合并语义保持不变。
- Keyboard Copy / Paste / Duplicate、元素右键 Copy / Paste / Duplicate、画布右键定位 Paste 均已统一接入 Facade。
- App 内本地 `CopiedElementClipboard` 类型、`cloneSlideElementForInsert`、`cloneAnimationSceneSnapshot` 以及重复 element / legacy / Scene clone 与数组插入实现已删除。
- App 继续拥有 `copiedElementsRef`、`hasCopiedElements`、History transaction、Selection、Property Panel 状态、Keyboard / Context Menu 路由、Canvas 坐标换算、operationId / updatedAt、Asset 删除后的 clipboard 失效、Asset / Blob 生命周期、单 Clip preview 清理、autosave gate 和 UI 副作用。
- Duplicate 后 `selectedElementId` / `selectedElementIds` 可能不一致、Keyboard / Context Paste Property Panel 差异、连续 Paste 重叠、Canvas Paste 无边界限制和既有 Selection 行为均按本轮重构边界保留，未顺手修改。

自动检查：

- Element Clone / App routing / animation integration 不落盘直接断言 105 项通过。
- Animation deletion / legacy-V2 回归不落盘直接断言 12 项通过；本轮实际执行合计 117 项。
- 最终 Git 收尾前另以当前源码重新执行 94 项整合断言，覆盖 snapshot、Paste / Canvas Paste / Duplicate、动画内核、Element Commands 删除同步、Presentation interaction、Hidden Media Lifecycle 与 App routing contract，全部通过。
- Element Commands、Presentation interaction 与 Hidden Media Lifecycle 相关回归包含在上述当前可执行集成断言中；未虚报未落盘的历史临时脚本。
- TypeScript relative import graph 覆盖 38 个模块、94 条依赖，0 cycle。
- `npm.cmd run lint`、`npm.cmd run build`、`git diff --check` 与 staged diff check 均通过；Build 只保留项目已有的 500 kB chunk warning。
- 所有不落盘断言脚本和生成文件执行后均已删除，没有进入最终 diff。

人工 QA（2026-08-05）：

1. Keyboard 综合通过：多选 Copy / Paste、单元素 Duplicate、带动画元素及 Undo / Redo 正常。
2. Context Menu 综合通过：元素右键 Copy / Paste / Duplicate、画布右键定位 Paste、不同 zoom 和带动画元素正常。
3. 跨页综合通过：`slide-enter`、Click Step、Presentation、保存刷新恢复及 Undo / Redo 正常。

阶段判断：

- Batch 3B-2B 已完成；后续 Batch 3C-1 与 Batch 3C-2 也已完成，但 Stage 5.5 原拆分计划没有整体完成。
- Batch 3C-3、Batch 4 面板 UI 边界和 Batch 5 App 动画编辑协调已转为暂缓架构债务，不作为 Stage 6 的 required next step。
- Stage 6 与 Stage 7 仍为计划开发、尚未开始。

##### Batch 3C-1：Keyframe Commands + Shared Rules

状态：**complete；manual QA passed；已验证完成；作为后续 Animation Command Domain 的稳定基线。**

实现结果：

- 新增 `src/utils/animationKeyframeRules.ts`，集中管理 Keyframe 排序、相邻间隔、可编辑 offset 边界、最大空隙插入、可新增 / 可删除 / 可编辑 easing 判定、easing normalization / equality、AnimationValue 插值，以及 value / easing 深复制规则。
- 新增纯 V2 文档命令模块 `src/utils/animationKeyframeCommands.ts`，公开 `updateAnimationKeyframeValueInSlide`、`updateAnimationKeyframeOffsetInSlide`、`updateAnimationKeyframeEasingInSlide`、`addAnimationKeyframeToSlide`、`deleteAnimationKeyframeFromSlide`。
- `animationCommands.ts` 继续作为 compatibility barrel，re-export 上述五个命令和公开类型；既有 import path 保持兼容，新命令模块不反向依赖 compatibility barrel。
- `AnimationTrackInspector.tsx` 已复用共享排序、边界、插入可用性、删除可用性和 easing 可编辑性规则，不再维护第二套重复 Keyframe 边界逻辑。
- 新增 Keyframe 命令已移除内部 `Date.now()`；App 在 React updater 外显式创建一次 `operationId`，命令依据 track ID、operation ID、稳定 insertion index 和冲突后缀生成确定性 Keyframe ID。
- 命令写入的 AnimationValue、AnimationEasing 与 custom curve 数据均进行深复制；跨属性 Track 的同步 easing 也各自拥有隔离对象。
- 命令仅处理 Animation Schema V2；没有修改 legacy animation mirror、Sequence、`sequenceOrder`、Clip ownership、Sequence-local `startMs`、Timeline、Marker、Presentation 或 HTML Export 时间语义。
- 只有实际内容变化才递增 `AnimationScene.revision` 并标记 `metadata.customized = true`；无效目标、无效数值、相同值、不可编辑末帧、无可用插入空隙和删除后不足两帧均返回原 Slide 引用。
- App 继续拥有 History transaction、Project `updatedAt`、Selection、Preview cleanup、operation ID 和 UI orchestration；Keyframe command / rules 不拥有 React state、History、DOM 或副作用。

自动检查：

- 当前可执行 Keyframe / shared rules / compatibility / regression 直接断言共 97 项通过。
- `npm.cmd run lint`、`npm.cmd run build`、`git diff --check` 与 staged diff check 通过；Build 只保留项目已有的 500 kB chunk warning。
- TypeScript relative import graph 覆盖 40 个模块、100 条依赖，0 cycle。
- 临时断言脚本和输出在检查后删除，没有进入最终 diff。

人工 QA（2026-08-06）：

1. Keyframe value、offset、easing 编辑正常；Undo / Redo、排序、最小间隔、动画结果均正常。
2. Keyframe 新增 / 删除正常；Undo / Redo、保存刷新恢复和正式 Presentation 均正常。

阶段判断：

- Batch 3C-1 已完成；Batch 3C-2 也已完成并通过人工 QA。
- Batch 3C-3“Clip / Preset / Timing”、Batch 4“面板 UI 边界”和 Batch 5“App 动画编辑协调”暂缓，Stage 5.5 原计划没有整体标记 complete。
- Stage 6 与 Stage 7 仍为计划开发、尚未开始。

##### Batch 3C-2：Legacy / V2 Compatibility + Scene Cleanup

状态：**complete；manual QA passed；已验证完成；作为后续 legacy / V2 compatibility 与 Scene cleanup 的稳定边界。**

实现结果：

- 新增 `src/utils/animationLegacyCompatibility.ts`，公开 `applyElementBatchUpdatesToSlide`、`deleteSlideElementsWithAnimations`、`isAnimationClipLiveForElements`、`AnimationCommandElementUpdates` 与 `AnimationCommandBatchUpdate`。
- 模块集中拥有 legacy animation → V2 Scene 增量同步、单元素 legacy mirror、同 preset 更新、CSS easing 同步、preset replacement 既有兼容路径、Clip reference cleanup、当前操作直接产生的空 Sequence cleanup、trigger target fallback、live Clip query 和 Scene revision / no-op 规则。
- 同 preset legacy 更新继续保留 Clip / Track / Keyframe ID、Track property、Keyframe offset / value、Sequence 归属、`metadata.customized` 与 V2-only playback；legacy delay 只同步为所属 Sequence 的局部 `startMs`。
- legacy easing 未变化时保留 spring、bounce、custom-curve、customized Track 与其他 advanced V2 data；legacy easing 实际变化时只更新 mirrored Clip 各 Track 的非末尾 Keyframe，并为 mutable easing / custom curve 数据建立独立引用。
- legacy 新增创建对应 V2 Clip；legacy 删除只删除对应 mirrored Clip，不影响 V2-only Clip。preset replacement 沿用既有行为，只清理由本次移除直接导致为空的 Sequence。
- 删除元素时保留多目标 Clip 的剩余 target，删除 targetless Clip，并同步清理所有 `Sequence.clipIds` 与本次直接产生的空 Sequence；click target 降级为 page click，hover target 降级为 manual，paths、markers、Asset metadata 和 Blob / Object URL 不受影响。
- `isAnimationClipLiveForElements` 保持纯查询：V2-only Clip 只需有效 target；legacy-backed Clip 还必须存在匹配的 legacy mirror；missing Clip target、targetless Clip 和 missing legacy mirror 均不 live。
- `animationCommandHelpers.ts` 新增低层 legacy ID、默认 ownership 和 direct-empty cleanup helper；compatibility 与尚未迁移的 Clip 删除逻辑共用同一套 `Sequence.clipIds` / `sequenceOrder` 清理算法。
- `animationCommands.ts` 继续作为 compatibility barrel，只 re-export compatibility API，不保留第二套实现；Keyframe 与 Sequence re-export 保持，Clip / Preset / Timing 实现暂时仍留在该文件。
- `elementCommands.ts` 直接依赖 `animationLegacyCompatibility.ts`，不再通过高层 barrel 反向取得 compatibility API。
- 未改变 AnimationScene schema、Clip ownership、Sequence-local time、Marker、Presentation completed / active / pending、Timeline、History、Selection、Clipboard、Asset / Blob lifecycle 或 Hidden Media Lifecycle。

自动检查：

- 实现阶段 109 项 compatibility / cleanup / live query 与相邻回归断言通过。
- 最终收尾以当前源码重新执行 73 项运行时语义断言和 13 项 ownership / purity / barrel 结构契约断言，全部通过；临时脚本与生成文件已删除，没有进入 Git。
- `npm.cmd run lint`、`npm.cmd run build` 与 `git diff --check` 通过；Build 只保留项目已有的 500 kB chunk warning。
- TypeScript relative import graph 覆盖 41 个模块、104 条唯一依赖，0 cycle。

人工 QA（2026-08-09）：

1. 单元素添加 preset、修改 duration / easing、删除带动画元素、Undo / Redo、保存刷新和正式 Presentation 全部正常。
2. 删除元素时关联动画正确清理，其他动画未发现异常，没有发现幽灵动画或明显空步骤。
3. 当前 UI 不支持多元素同时添加动画 preset：多选后 Animation 属性面板可显示多个元素，但“+ 添加动画”按钮 disabled。本批未修改 UI，不声称 multi-element preset UI QA passed；底层 compatibility 路径由自动断言覆盖，该限制不属于本批回归。

##### Batch 3C-3：Clip / Preset / Timing

状态：**DEFERRED / 暂缓。**

目标：

- Clip、Preset 与 Timing 命令仍留在 `animationCommands.ts`，作为已知架构债务保留。
- 必须继续复用现有 Sequence-local `startMs`、Clip 唯一 Sequence 归属和公共 Sequence 时长规则。
- 当前不阻塞功能开发；仅在新功能被该边界阻塞、出现明显维护压力或重复 Bug、或时间允许时重新评估。

##### Batch 4：面板 UI 边界

状态：**DEFERRED / 暂缓。**

目标：

- 将 `PropertyPanel` 的 Basic、Font、Animation、Layer 按现有职责拆分。
- 将 `AnimationTrackInspector` 的 Clip Card、Track Card、Keyframe、Easing 和 Input UI 按现有职责拆分。
- 只拆 UI 职责，不同时改变动画模型、命令语义或状态所有权。

回归重点：

- 单选、多选和 mixed value。
- 字体、动画列表和图层操作。
- Clip 选择、Keyframe 和 Easing。
- 输入 blur / Enter 提交。
- Undo / Redo 历史分组。

##### Batch 5：App 动画编辑协调

状态：**DEFERRED / 暂缓。**

目标：

- 最后再处理 animation workspace selection、Clip preview coordination、Timeline coordination 和 animation editor glue。
- 继续复用 `useTimelinePlaybackController` 和 `usePresentationPlaybackController`，不得重新建立播放状态或把已有独立模块塞回 `App.tsx`。
- 不移动 `SlideCanvas` 的正式放映确定性采样核心。

回归重点：

- Clip 选择同步和 Timeline 选择。
- 单 Clip 预览和整页预览。
- 播放、暂停和停止。
- 切页和正式放映。
- 动画模式、Timeline 和 Presentation 模式互斥。

#### 4. 后续阶段依赖

第 6 阶段开始条件：

- 第 5 阶段完成、通过人工验收并完成独立 commit / push。
- 第 5.5 阶段至少完成必要的一轮职责拆分。
- `App.tsx` 不再继续以当前模式吸收全部 Click Step UI 状态。
- `animationCommands` 至少为 Sequence / Click Step UI 提供清晰 Command Domain。
- 上述必要条件已经满足；Batch 3C-3、Batch 4 与 Batch 5 的暂缓不再作为 Stage 6 前置阻塞。

第 7 阶段开始前：

- `AnimationTrackInspector` 至少完成一轮合理 UI 拆分。
- `App.tsx` 的动画编辑协调边界进一步明确。
- `AnimationTimeline` 的结构性重构留到第 7 阶段本身完成。
- `SlideCanvas` 的 completed / active / pending 模型必须作为稳定基础复用，不得重写第二套编辑采样语义。

阶段边界：

- 不与第 5 阶段 HTML Click Step 同步混合开发。
- 不提前实现第 6 阶段 Click Step 编辑 UI 或第 7 阶段 Timeline V2-C。
- Batch 1、Batch 2A、Batch 2B、Batch 3A、Batch 3B-1、Batch 3B-2A、Batch 3B-2B、Batch 3C-1 与 Batch 3C-2 已验证完成；Batch 2 前置只读架构审计已完成；Pending Media Interaction Fix 已通过自动检查和人工 QA。Batch 3C-3、Batch 4 与 Batch 5 暂缓；Stage 6 第一至第五 Batch 均已验证完成，Stage 6 整体 COMPLETE；Stage 7 第一至第三 Batch、Batch 4A、Batch 4B 与 Batch 4C 已完成并通过人工 QA。Stage 7 仍有正式路线中已记录的多关键帧、区域循环与 Marker 等高级 Timeline V2-C 能力，整体保持 IN PROGRESS。

### 第 6 阶段：Click Step 编辑界面

状态：**COMPLETE；第一、第二、第三、第四、第五 Batch 均已完成并通过人工 QA（2026-08-11）**

#### 第一 Batch：Click Trigger Editing — Single Clip Trigger + Step Number

状态：**COMPLETE；MANUAL QA PASSED（2026-08-10）**

本 Batch 实现：

- Clip 卡片显示真实触发方式：`页面进入 · 自动播放` 或 `点击播放 · Step N`。
- 单个 Clip 可在 `slide-enter` 与页面级 page-click Click Step 之间切换。
- 自动播放 → 点击播放时，为当前 Clip 追加一个新的 Click Step。
- 点击播放 → 自动播放时，当前 Clip 合并进既有 `slide-enter` Sequence；没有该 Sequence 时使用确定性 fallback 创建。
- 每次切换只移动当前 Clip，同一 Click Step 中其他 Clip 的归属和 `startMs` 不变。
- `AnimationClip.startMs` 数值始终保持为所属 Sequence 的局部偏移，不写入 trigger runtime time，也不新增 `Clip.sequenceId`。
- 当前操作产生的空 Sequence 自动清理，`sequenceOrder` 同步删除失效引用。
- 删除较早 page Click Step 后，后续 Step N 由当前 page-click Sequence 顺序自动重排。
- targeted click、hover、keyboard、media-time 和 manual 等 advanced trigger 保持可见但只读，命令路径为 no-op，不被本 Batch 改写。
- UI 通过 semantic request 调用 App；App 继续拥有 History、Project `updatedAt`、operation identity、Preview cleanup 和 orchestration；纯 Document mutation 位于 `animationSequenceCommands.ts`。
- `animationCommands.ts` 继续只作为兼容公开入口 re-export 新 Sequence API，没有建立第二套实现。

调用路径：

```text
AnimationTrackInspector
→ AnimationFloatingPanel
→ App.handleSetAnimationClipTrigger
→ commitProjectChange
→ setAnimationClipTriggerInSlide
```

实际修改文件：

```text
PROJECT_STATUS.md
src/App.tsx
src/components/editor/AnimationFloatingPanel.tsx
src/components/editor/AnimationTrackInspector.tsx
src/utils/animationCommands.ts
src/utils/animationSequenceCommands.ts
```

本次最终自动检查（2026-08-10，基于当前源码重新执行）：

- Domain / ownership / cleanup / no-op / deterministic ID / purity / isolation：45 项通过。
- Presentation / standalone HTML Export trigger regression：27 项通过。
- UI / App / compatibility contract：17 项通过。
- 合计：89 项直接断言通过；断言使用 Rolldown 内存入口执行，没有留下临时脚本或 QA 数据文件。
- TypeScript relative import graph：41 modules / 105 unique relative dependencies / 0 cycles。
- `npm.cmd run lint`：通过，0 error、0 warning。
- `npm.cmd run build`：通过；只保留既有 500 kB chunk warning。
- `git diff --check` 与 `git diff --cached --check`：通过；仅有既有 LF / CRLF 转换提示。
- 项目仍未定义正式 `test` script，本 Batch 没有新增虚假 test 命令或测试框架。

人工 QA（2026-08-10）：

1. 一个元素三个 Clip，Clip 2 `startMs = 300ms`；Clip 2 自动播放 → 点击播放后显示 Step 1，`startMs` 保持 300ms，Clip 1 / Clip 3 仍自动播放，Undo / Redo 正常。
2. Clip 2 = Step 1、Clip 3 = Step 2；编辑器 Presentation 与 standalone HTML 均按页面进入自动 Clip → 第一次点击 Step 1 → 第二次点击 Step 2 的顺序运行，二者一致。
3. Clip 2 从 Step 1 切回自动播放后，Clip 3 由 Step 2 自动重编号为 Step 1；Undo / Redo、autosave、refresh 后 trigger 与 Step 编号均保持正常。

#### 第二 Batch：Multiple Clips in One Click Step

状态：**COMPLETE；MANUAL QA PASSED（2026-08-10）**

本 Batch 实现：

- `getAnimationPageClickSteps(scene)` 按持久化 Sequence 顺序查询当前有效 page-click Steps；targeted click 等 advanced trigger 不进入编辑列表。
- 新增纯命令 `moveAnimationClipToClickStepInSlide(slide, { clipId, targetSequenceId })` 与公开类型 `MoveAnimationClipToClickStepCommand`；`animationCommands.ts` 仅维持 compatibility re-export surface，没有第二套 Sequence mutation。
- 一个 page-click `AnimationSequence` 可通过既有 `clipIds` 包含多个 Clip，没有新增 grouping schema、`Clip.sequenceId` 或持久化 Step 编号。
- Inspector 的当前 Clip 可选择页面进入自动播放、新建点击步骤或加入已有 Step N；当前 Step 由受控 selection 显示，选择自身不会产生 mutation。
- “新建点击步骤”继续复用第一 Batch 的 `setAnimationClipTriggerInSlide`，`createNewClickStep?: boolean` 仅表达当前 click Clip 显式创建新 Step；“加入已有 Step”不生成 operation ID。
- 有效移动从唯一源 Sequence 移除当前 Clip，保留目标 Step 原 Clip 顺序，并把当前 Clip 追加到目标 `clipIds` 末尾；正常结果中 Clip 仅属于目标 Sequence。
- 源 Sequence 仍有其他 Clip 时保留；因本次移动变空时只删除该源 Sequence，并同步删除其 `sequenceOrder` 引用，不全局清理无关历史 malformed Sequence。
- 空 Step 删除后，后续 Step N 继续从当前有效 page-click Sequence 顺序动态派生并自动收敛；没有持久化 `stepNumber`、`clickStepIndex` 或 display index。
- `Clip.startMs` 始终保持为目标 Sequence 局部 0ms 的偏移；移动不重建 Clip，不修改 Track、Keyframe 或其他 timing 数据。
- missing Clip、missing target、非 page-click target、当前 Step、advanced trigger source 和 ownership 歧义均返回原 Slide，不增加 Scene revision。
- UI 只发送 semantic request；`AnimationFloatingPanel` 只转发 callback；App 只负责 active slide mapping、Project `updatedAt`、History transaction、Selection / active Clip 保持和 Preview cleanup routing。
- 一个“加入 Step N”动作只调用一次 `commitProjectChange`，形成一个 Undo / Redo transaction；actual mutation 通过既有引用门闩清理 isolated preview，no-op 不清理 Preview。

调用路径：

```text
AnimationTrackInspector
→ AnimationFloatingPanel
→ App.handleMoveAnimationClipToClickStep
→ commitProjectChange
→ moveAnimationClipToClickStepInSlide
```

实际修改文件：

```text
PROJECT_STATUS.md
src/App.tsx
src/components/editor/AnimationFloatingPanel.tsx
src/components/editor/AnimationTrackInspector.tsx
src/utils/animationCommands.ts
src/utils/animationSequenceCommands.ts
```

本次最终自动检查（2026-08-10，基于当前源码重新执行）：

- Multiple Clips domain、ownership、source cleanup、sequenceOrder cleanup、no-op、第一 Batch trigger switching、Sequence Commands、Presentation 与 standalone HTML Export trigger regression：51 项通过。
- UI / App orchestration contract 与 TypeScript import graph：11 项通过。
- 合计：62 项直接断言通过；断言通过 Rolldown 内存入口执行，临时入口已删除，没有留下测试脚本或 QA 数据文件。
- TypeScript relative import graph：41 modules / 104 relative dependencies / 0 cycles。
- `npm.cmd run lint`：通过，0 error、0 warning。
- `npm.cmd run build`：通过；只保留既有 500 kB chunk warning。
- `git diff --check`：通过；仅有既有 LF / CRLF 转换提示。提交前继续执行 `git diff --cached --check`。
- 项目仍未定义正式 `test` script，本 Batch 没有新增虚假 test 命令或测试框架。

人工 QA（2026-08-10）：

1. Clip A = Step 1、Clip B = Step 2；把 B 加入 Step 1 后两者均显示 Step 1，原 Step 2 删除且没有幽灵 Step，Undo / Redo 正常。
2. 同一 Step 内 Clip A `startMs = 0`、Clip B `startMs = 300ms`；Presentation 与 standalone HTML 第一次点击均启动同一 Step，A 立即开始、B 约 300ms 后开始，后续 Step 需下一次点击。
3. 一个 Clip 在 Step 1 → Step 2 → Step 1 间切换；Undo / Redo、autosave、refresh 后保持唯一目标归属、自动编号和空 Step cleanup。

#### 第三 Batch：Step / Clip Grouping UI

状态：**COMPLETE；MANUAL QA PASSED（2026-08-10）**

本 Batch 实现：

- 新增纯查询 `AnimationClipGroup` / `getAnimationClipGroups(scene)`；统一依据 `sequenceOrder`、Sequences 与 live Clips 派生 Inspector 分组，不修改持久化 schema，也不产生 mutation、History 或 revision。
- 第一条有效 `slide-enter` Sequence 派生“页面进入自动播放”组；每条有效 page-click Sequence 派生“点击步骤 · Step N”组；同一 Sequence 的多个 Clip 保持在同一组并遵循 `clipIds` 顺序。
- page-click Step 编号先基于整页有效 Sequence 全局派生，再按当前选中元素过滤可见 Clip；因此当前元素可以显示 Step 1 与 Step 3，不会错误压缩为局部 Step 1 与 Step 2。只有实际全局 Step 被删除或失效时，后续 Step 才自动收敛编号。
- 缺失 Clip 引用安全忽略；仅含缺失 Clip 的空 page-click Sequence 不生成 Step；重复 ownership 按有序第一归属只展示一次；advanced trigger、额外 `slide-enter` ownership 与 orphan Clip 归入“其他触发方式”。
- Inspector 新增“页面进入自动播放”“点击步骤 · Step N”“其他触发方式”分组标题和可见 Clip 数量；继续复用既有 `AnimationClipCard`，active Clip、Selection、trigger、timing、keyframe、duplicate 与 delete 行为保持不变。
- 本 Batch 没有引入 Step reorder，也没有修改 App orchestration、Presentation runtime 或 standalone HTML Export；Clip / Track / Keyframe 数据与 Sequence-local `startMs` 语义保持不变。

实际修改文件：

- `PROJECT_STATUS.md`
- `src/components/editor/AnimationTrackInspector.tsx`
- `src/utils/animationCommands.ts`
- `src/utils/animationSequenceCommands.ts`

最终自动检查（2026-08-10）：

- 重新执行 36 项 grouping query / domain / runtime 直接断言与 16 项 UI / import contract 断言，共 **52 项**，全部通过；断言覆盖整页 Step 1 / 2 / 3、选中元素仅显示全局 Step 1 / 3、实际删除全局 Step 后 2 / 3 → 1 / 2、missing-only empty Sequence、missing ref、pure query、同 Step `clipIds` 顺序、duplicate ownership、orphan / advanced fallback、第一/第二 Batch 回归、Presentation / Export 顺序与 local timing，以及 Inspector 无 History / 无 Step reorder contract。
- 断言使用不落库临时脚本执行，完成后已删除；未留下临时文件。项目仍未定义正式 `test` script，因此不虚报 `npm test`。
- TypeScript import graph：41 modules、104 relative dependencies、0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有 `> 500 kB` chunk warning（主 JS 约 516.48 kB），继续视为 non-blocking warning。
- `git diff --check`：通过，仅有既有 LF / CRLF 转换提示。

人工 QA（2026-08-10）：

1. Visual grouping 通过：自动播放、Step 与其他触发方式分组、Clip 数量及组内顺序正确；当前元素只拥有全局 Step 1 / Step 3 时，UI 保持显示 Step 1 / Step 3。
2. Dynamic regroup 通过：trigger / Step 归属变化后立即重新分组，Undo / Redo 正常；只有实际删除更早的全局 Step 后编号才自动收敛。
3. Empty Step cleanup、autosave / refresh persistence 与 Presentation 回归通过；没有幽灵 Step，保存刷新后分组和归属保持正确。

#### 第四 Batch：Click Step Reorder / Step Ordering UI

状态：**COMPLETE；MANUAL QA PASSED（2026-08-10）**

本 Batch 实现：

- 每个有效 page-click Step group header 显示一组 `↑` / `↓` 控件，并提供“上移点击步骤”“下移点击步骤”的 `title` 与 `aria-label`；页面进入自动播放和其他触发方式组不显示 reorder controls，一个多 Clip Step 也只显示一组控件。
- 继续复用纯命令 `moveAnimationClickStepInSlide` 与既有 `sequenceOrder` 槽位替换算法；仅做窄兼容，使其通过 `getAnimationPageClickSteps(scene)` 统一使用 targetless、含 live Clip 的有效全局 page-click Step 集合，避免 targeted click 与 missing-only Sequence 干扰 index、边界和目标。
- Step N 是整张 Slide 的有效 page-click Sequence 全局位置编号，不是当前元素 Inspector 的局部编号；编号继续在 query 层动态派生，不写入 schema、Sequence 或 Clip。
- 当前元素只显示 Step 1 / Step 3 时，Step 3 上移会与隐藏的全局 Step 2 调换；结果为当前元素 Step 1 / Step 2，其他元素原 Step 2 变为全局 Step 3，不会把当前可见 Step 3 直接与 Step 1 交换。
- reorder 的对象是完整 page-click Sequence；跨元素和多 Clip Step 均整体移动，即使 Inspector 只显示该 Sequence 的部分 Clip，也不拆分 ownership 或改变 Step 内 Clip 顺序。
- `Sequence.clipIds` 内容、顺序与引用保持不变；Clip 对象、Sequence-local `startMs`、其他 timing、Track、Keyframe、trigger、playback、markers 与 paths 均保持不变。
- 第一全局 Step 上移、最后全局 Step 下移、missing Sequence、non-page-click、targeted click、missing-only / invalid Step、无有效目标和实际顺序未变化均为 no-op：返回原 Slide、revision 不变，Project 不产生新引用。
- 有效 reorder 只创建新的 Slide / AnimationScene / `sequenceOrder`，Scene revision 增加一次；不创建或删除 Sequence，也不生成 operation ID。
- 调用路径保持 `AnimationTrackInspector → AnimationFloatingPanel → App → moveAnimationClickStepInSlide → Project`；一个上移/下移只调用一次 `commitProjectChange`，形成一个 Undo / Redo transaction。
- Selection 与 active Clip 保持；actual mutation 通过既有 App wrapper 清理 isolated preview，no-op 返回原 Project，因此不产生 History，也不清理 Preview。
- Presentation 与 standalone HTML Export runtime 文件未修改；两者继续从持久化 Sequence 顺序读取新的全局点击顺序，并保持每个 Clip 的 Sequence-local timing。

实际修改文件：

- `PROJECT_STATUS.md`
- `src/App.tsx`
- `src/components/editor/AnimationFloatingPanel.tsx`
- `src/components/editor/AnimationTrackInspector.tsx`
- `src/utils/animationSequenceCommands.ts`

最终自动检查（2026-08-10，基于收尾源码重新执行）：

- Step reorder、global / hidden Step、multi-element、multi-Clip、UI / App contract、第一/第二/第三 Batch、Presentation 与 standalone HTML Export regression：共 **60 项**直接断言通过。
- TypeScript import graph：41 modules、111 relative dependencies、0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有 `> 500 kB` chunk warning（主 JS 约 518.34 kB），继续视为 non-blocking warning。
- `git diff --check`：通过，仅有既有 LF / CRLF 转换提示；提交前继续执行 `git diff --cached --check`。
- 断言使用临时 Rolldown 内存入口执行，完成后已删除；没有留下临时脚本或 QA 数据文件。项目仍未定义正式 `test` script，不虚报 `npm test`。

人工 QA（2026-08-10）：

1. Step 1=A、Step 2=B、Step 3=C；Step 3 上移后变为 A / C / B，Undo 恢复 A / B / C，Redo 恢复 A / C / B。
2. Element A 拥有全局 Step 1 / Step 3，Element B 拥有 Step 2；在 A Inspector 上移 Step 3 后，A 显示 Step 1 / Step 2，B 原 Step 2 变为 Step 3，Presentation 顺序为 A 原 Step 1 → A 原 Step 3 → B 原 Step 2。
3. 同一 Click Step 内 Clip A `startMs = 0`、Clip B `startMs = 300ms`；上下移动后两者始终一起移动，一次点击仍触发整个 Step，0 / 300ms 局部 timing、Undo / Redo、autosave 与 refresh persistence 均正常。

#### 第五 Batch：Invalid Sequence Protection UI / Product Closure

状态：**COMPLETE；MANUAL QA PASSED（2026-08-11）**

本 Batch 实现与最终语义：

- normal editable 只包括：第一条有效、持久化有序且含唯一归属 live Clip 的 `slide-enter` Sequence；以及持久化有序、targetless、至少含一个唯一归属 live Clip 的 page-click Sequence。
- protected state 包括 targeted click、hover、manual、keyboard / media-time 等 unsupported / advanced trigger、ambiguous ownership、orphan Clip、additional slide-enter、malformed trigger、empty Sequence、missing-only Sequence，以及不在 `sequenceOrder` 中的 Sequence。
- 新增/统一纯查询 `getAnimationClipOwnerSequences`、`getAnimationPrimarySlideEnterSequence`、`getAnimationClipStage6Capabilities` 与 `getAnimationPageClickSteps`；`animationCommands.ts` 继续只提供 compatibility re-export。
- `getAnimationPageClickSteps` 是 Stage 6 UI、commands 与 Presentation 的 normal page-click Step 单一来源；Step 编号、join target、reorder 集合和普通放映顺序均从该查询派生。
- empty / missing-only page-click 不显示普通 Step、不占 Step N、不作为 join / reorder target、不消耗 Presentation 点击，也不被自动删除。
- mixed live / missing Sequence 在至少含一个唯一归属 live Clip 时仍是有效 Step；live Clips 正常显示，missing references 安全忽略但继续保留在 `clipIds`，不执行文档修复。
- targeted click、hover、manual 与其他 advanced trigger 统一落入“其他触发方式”；普通 trigger / Step editor 只读或 disabled，不自动转换。
- ambiguous Clip 只安全展示一次，不显示假 Step；trigger switching、join、create 等危险 mutation 在 command 层 no-op，不解除多重 ownership。
- orphan Clip fallback 展示但不伪造 Step，也不自动创建 Sequence；additional slide-enter 只有第一条有效 Sequence 可作为普通自动播放，后续 Sequence protected，不 merge、不删除。
- omitted `sequenceOrder` Sequence 不进入普通 editable 集合，不自动插回顺序表；最终审查补强 reorder，使其只替换有效 Step 的首次持久化槽位，并保留 omitted Sequence、重复引用和缺失引用原状。
- join、reorder、trigger editor 均过滤无效 / protected target；UI disabled 入口不能替代 command no-op，底层命令继续独立兜底。
- protected no-op 返回原 Slide，revision 与 Project reference 不变，不产生 History，也不清理 Preview；Selection / active Clip 继续由既有 App orchestration 保持。
- normal mutation 仍是一个操作一个 History transaction；只清理本次操作真正变空的 source Sequence，不清理无关历史 malformed / empty Sequence；actual mutation 才触发既有 Preview cleanup。
- `presentationPlayback.ts` 只做必要的 effective auto / page-click query 对齐，没有修改状态机、rAF 或交互逻辑；empty、missing-only、targeted 与 advanced trigger 不再占普通放映步骤，mixed live / missing 仍按 Sequence-local timing 播放。
- standalone HTML Export runtime 文件未修改；Export playback plan 继续复用 Presentation plan，因此继承同一有效 Step 集合与顺序。

实际修改文件：

- `PROJECT_STATUS.md`
- `src/components/editor/AnimationTrackInspector.tsx`
- `src/utils/animationCommands.ts`
- `src/utils/animationSequence.ts`
- `src/utils/animationSequenceCommands.ts`
- `src/utils/presentationPlayback.ts`

最终自动检查（2026-08-11，基于收尾源码重新执行）：

- 实现阶段的 99 项 invalid / protection matrix 与 12 项 omitted `sequenceOrder` follow-up 共 111 项断言已通过；对应临时脚本此前已经删除，本次不虚报为重新运行。
- 收尾阶段重新创建并执行独立的 Rolldown 内存断言，共 **101 项**通过，覆盖 invalid / protection、第一至第四 Batch 回归、全局 Step 编号、join、trigger switching、multi-Clip、Step reorder、Presentation、HTML Export、UI protection contract，以及 omitted / duplicate / missing `sequenceOrder` 保持；临时脚本执行后已删除。
- TypeScript import graph：41 modules、112 relative dependencies、0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有 `> 500 kB` chunk warning（主 JS 约 520.49 kB），继续视为 non-blocking warning。
- `git diff --check`：通过；提交前继续执行 `git diff --cached --check`。
- 项目仍未定义正式 `test` script，本 Batch 不虚报 `npm test`。

人工 QA（2026-08-11）：

1. QA-1 正常 Stage 6 路径通过：auto ↔ click、join existing Step、grouping、Step reorder、multi-Clip 与 Undo / Redo 均无退化，正常 Clip 未被 protection 误伤。
2. QA-2 的 hover / targeted click / manual / advanced / malformed 状态在当前产品 UI 不可自然构造，因此记录为 **MANUAL UI NOT REACHABLE / AUTOMATED COVERAGE PASSED**；不新增 debug UI，也不要求用户手工篡改文档，保护语义由实现阶段 111 项及收尾 101 项自动断言覆盖。
3. QA-3 persistence + Presentation 通过：正常 auto、至少两个 Click Steps、join / reorder、Undo / Redo、autosave、refresh 与 Presentation 顺序正常，无 ghost Step、Clip 消失或错误 protected。

Stage 6 完成结论：

- trigger method editing、Step number、Clip grouping、multiple Clips in one Step、join existing Step、Step reorder、invalid Sequence protection、Undo / Redo、Presentation alignment 与 product closure 均已完成并通过对应自动检查和人工 QA。
- 没有新的 Stage 6 blocking 项；Stage 6 整体正式标记 **COMPLETE**，不再人为创建新的 Stage 6 Batch。
- 下一主要开发入口：**Stage 7 — Timeline V2-C**。本次只记录入口，尚未开始 Stage 7 实现。
- Stage 5.5 Batch 3C-3、Batch 4 与 Batch 5 继续作为 deferred 架构债务，不因 Stage 6 完成而恢复。

目标：

- 在动画工作区显示触发方式。
- 可以选择进入页面播放或点击播放。
- 显示当前动画属于第几个点击步骤。
- 支持把多个 Clip 放入同一步骤。
- 支持调整步骤顺序。
- 禁止产生找不到 Clip 的无效 Sequence。
- 界面修改支持 Undo 和 Redo。
- 提示文字清楚区分“时间顺序”和“点击步骤顺序”。

依赖：

- 数据层、运行时和导出规则已经稳定。
- 第 5.5 阶段至少完成一轮 `App.tsx` 渐进式职责拆分，避免 Click Step UI 状态继续集中膨胀。

### 第 7 阶段：Timeline V2-C

状态：**IN PROGRESS；第一 Batch COMPLETE / MANUAL QA PASSED（2026-08-11）；第二 Batch COMPLETE / MANUAL QA PASSED（2026-08-12）；第三 Batch COMPLETE / MANUAL QA PASSED（2026-08-13）；Batch 4A COMPLETE / MANUAL QA PASSED（2026-08-14）；Batch 4B COMPLETE / MANUAL QA PASSED（2026-08-15）；Batch 4C COMPLETE / MANUAL QA PASSED（2026-08-15）；Batch 5A COMPLETE / MANUAL QA PASSED（2026-08-16）；Batch 5B COMPLETE / MANUAL QA PASSED（2026-08-16）；Batch 6 COMPLETE / MANUAL QA PASSED（2026-08-17）；Stage 7 整体仍未完成**

#### 第一 Batch：Timeline View Model Foundation

状态：**COMPLETE；MANUAL QA PASSED（2026-08-11）**

本 Batch 建立唯一、纯的 `AnimationScene → AnimationTimelineViewModel` 读取层：

```text
AnimationScene
→ src/utils/animationTimeline.ts
→ AnimationTimelineViewModel
→ App useMemo
→ AnimationTimeline
```

最终实现与语义：

- 新增 `src/utils/animationTimeline.ts`；唯一新增 runtime public API 为 `getAnimationTimelineViewModel`，并导出明确的 Timeline 派生类型。Timeline hierarchy、ownership、target、duration、protection 与 Keyframe display data 统一由该纯 read/query model 生成。
- Sequence groups 按第一条有效 primary `slide-enter`、有效 targetless page-click Steps、protected / historical data 排列；global Step N 继续由共享 normal page-click query 动态派生，不持久化 Step number，也不按跨 Sequence `startMs`、Clip ID 或当前 element 局部列表排序。
- `Clip.startMs` 继续严格表示所属 Sequence 的 local offset；没有跨 Sequence 累加、page-global timing 字段、Scene timing 改写或 schema 变更。Sequence semantic duration 复用 `getAnimationSequenceLocalDurationMs`。
- `rulerExtentMs` 只表达最低 4 秒、末尾 750ms padding 与刻度布局；不充当 semantic playback duration。现有 page-flat editor clock、Playhead、play / pause / seek 与 controller 语义暂时保持，留给第二 Batch 处理 active Sequence / Sequence-local Playhead。
- Timeline Object rows 从 `Sequence → live Clip → live target` 派生；不再遍历全部 `slide.elements` 创建空行。无动画 element 不显示“暂无动画”Timeline row，但 Canvas 上的元素及编辑能力不受影响。
- 同一 Object 的多个 Clip 全部保留，顺序来自 Sequence order + `Sequence.clipIds`。一个 multi-target Clip 只有一个 canonical Clip identity，以 targets 中第一个真实存在的 element 作为确定性 anchor，其余 target IDs 与 availability 全部保留。
- live + missing target 继续显示 live target 并保留 diagnostics；all-missing target 不伪造 Object row，进入 protected / unanchored model。orphan Clip 进入仅存在于 View Model 的 synthetic protected group；ambiguous ownership 只产生一个 canonical entry；additional slide-enter、omitted `sequenceOrder`、advanced 与 malformed data 均保持 protected / diagnostic。
- Track 保持 authored order；Keyframe 使用现有排序规则，保留 identity 与 raw offset，并派生安全 display offset / Sequence-local display time。读取过程不修改 Track、Keyframe、offset、duration、targets、clipIds 或 sequenceOrder。
- protected UI 只提供最小只读投影、计数、颜色与原因提示；没有 repair button、migration 或 normalization。整个 Batch 为零 document/schema mutation、零 Scene repair。
- Selection source 未重写：Element selection 继续由 App 持有，active Clip 继续来自 `activeAnimationContext`，Timeline callback 继续传真实 `clipId`。没有新增 `timelineSelectedClip`、`activeSequenceId`、`selectedSequenceId`、Track selection 或 Keyframe selection。
- App 只以 `useMemo` 构建 View Model、把 model 传给 Timeline，并从兼容字段读取旧 controller duration；`AnimationTimeline` 删除 raw element grouping、ownership inference、Clip regrouping、duration 与 Keyframe projection 业务规则，同时保留 zoom、scroll、ruler、现有 Playhead、controls 与 semantic callbacks。
- `useTimelinePlaybackController`、current time、preview range、`SlideCanvas` sampling、Presentation runtime/state machine、standalone HTML Export runtime 与 Hidden Media lifecycle 均未修改。

最终自动检查（2026-08-11，基于收尾源码重新执行）：

- Timeline View Model、Stage 6、Keyframe Commands、current Timeline compatibility duration、Presentation 与 Export 综合回归：**61 项**通过。
- protected / compatibility / purity 边界：**29 项**通过。
- UI / App / domain static contract：**18 项**通过。
- 本次收尾实际共 **108 项断言**通过；均通过不落盘 Node / TypeScript 内存脚本执行，没有留下临时脚本或 QA 数据。
- TypeScript import graph：42 modules、111 internal edges、0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有 `> 500 kB` chunk warning（主 JS 约 528.13 kB），继续视为 non-blocking warning。
- `git diff --check`、未跟踪新文件的独立 whitespace check 与提交前 `git diff --cached --check` 均通过；仅有既有 LF / CRLF 转换提示。

人工 QA（2026-08-11）：

1. A / B / C / D 中只有 A、C 有动画时，Timeline 只显示 A / C；B / D 不再产生空动画行，Canvas 上仍可正常存在、选择和编辑。
2. 同一 Object 多 Clip 全部正确显示并与 active Clip、Property Panel、Animation Workspace 对应；0–600ms、600–1200ms 与 2000–2600ms 的 Sequence-local Timeline projection 均正确。
3. auto、Step 1、Step 2、multi-Clip Step、Clip selection、Workspace grouping 与 Presentation smoke 全部通过；global Step order、Sequence-local timing 和 Presentation 行为未改变。

#### 第二 Batch：Active Sequence / Sequence-local Playhead + Editor Phase Sampling

状态：**COMPLETE；MANUAL QA PASSED（2026-08-12）**

本 Batch 完成 editor timing semantic migration：

```text
AnimationScene
→ AnimationTimelineViewModel
→ Active Sequence
→ Sequence-local Playhead
→ completed / active / pending editor samples
→ SlideCanvas
```

最终实现与语义：

- `App.activeAnimationSequenceId` 是唯一新增的 Active Sequence editor state；它不持久化、不进入 Project / Slide / `AnimationScene`、localStorage document 或 History，也没有新增 `selectedSequenceId`、`currentStepId`、`timelineSequenceId` 或 `activeStepId`。
- `resolveAnimationTimelineActiveSequenceId` 与 `getAnimationTimelineNormalSequenceIdForClip` 统一 Active Sequence 解析：仍有效的 requested normal Sequence 优先；失效后才依次回退到 active Clip 的唯一 normal owner、primary `slide-enter`、first valid page-click Step，最后为 `null`。Clip selection 通过显式 event 驱动 Sequence，旧 active Clip 不会每次 render 抢占有效 requested Sequence。
- normal playback 只允许 primary valid `slide-enter` 和 valid targetless page-click Sequence。targeted click、hover、manual、keyboard、media-time、advanced / malformed trigger、ambiguous ownership、orphan、additional slide-enter、omitted `sequenceOrder` 等 protected state 不会伪装为普通 Active Sequence，但仍可选择、诊断和 isolated preview。
- Step reorder 只改变 `sequenceOrder`；Active Sequence 继续按稳定 `Sequence.id` 保持身份，动态 Step N 自动更新，不因 Step 3 → Step 2 而重置 local time。
- trigger switching、join existing Step、create new Step、Clip deletion、element animation cleanup、source Sequence cleanup、Undo 与 Redo 后都会重新 reconcile Active Sequence。成功移动当前 active Clip 后，App 从已提交 Project 重新查询其新 owner；editor reconciliation 本身不产生 History。
- `useTimelinePlaybackController` 从 slide-specific context 迁移为 opaque `contextKey`，其 identity 由 Slide ID + Active Sequence ID 构成且不包含 Clip ID。context change 会取消唯一 rAF、清 range / anchor，并同步回到 0ms / idle；同一 Sequence 内换 Clip 保持 local time，跨 Sequence 或 Slide 切换回到 0ms，不保存 per-Sequence cursor。
- normal playback duration 使用当前 Active Sequence 的 `semanticDurationMs`；`maximumAuthoredLocalEndMs` 不再控制普通 V2 editor playback。`rulerExtentMs` 继续只负责最低 4 秒、padding 与布局。
- zero-duration 与 null Active Sequence 保持 0ms / idle，不启动 rAF；normal Play / Replay / ruler seek 禁用。Canvas 仍可安全采样 local 0，protected-only Scene 仍可保留 isolated preview。
- `getAnimationTimelineEditorSamples` 按 normal Sequence order 派生 completed / active / pending：earlier 以 semantic duration 采样，current 使用并 clamp Sequence-local Playhead，later 固定为 pending 0ms metadata。不会跨 Sequence 比较或累加 `Clip.startMs`。
- editor pending 的锁定语义是 **no contribution**，不会读取第一关键帧、创建 first-frame baseline、提前抢 property control 或复用 Presentation pending baseline helper。completed 与 active 继续交由现有 compiler / compositor 处理 fill、direction、iterations、playbackRate、stagger 和 same-target composition。
- 一个 Sequence 内多个 Clip 共享同一 local clock；每个 Clip 仍由自己的 Sequence-local `startMs` 与 stagger gate 决定何时参与。active Sequence 不等于所有 Clip 立即参与。
- `SlideCanvas` 的普通 V2 editor path 已迁移到独立 `editorTimelineSequenceSamples` contract，只编译 completed + active normal Clip 白名单；protected / ambiguous Clip 与 pending Sequence 无 Canvas contribution。Presentation formal samples 使用独立 contract，Presentation state machine / controller、standalone HTML Export runtime 与 Hidden Media lifecycle 未修改。
- isolated Clip preview 与 normal Sequence playback 继续互斥。preview 保存 playback context 与 Active Sequence local `returnTimeMs`；取消或自然结束均恢复原 local frame但不自动 resume，Sequence / Slide 切换清 preview 并进入新 context 0ms，actual Project mutation 清 preview，no-op 不清理。
- 有有效 V2 normal context 时优先使用新的 editor Sequence sampling；没有有效 V2 context 时保留 legacy/static fallback，`compileSlideAnimations` 兼容路径未删除。
- Timeline 只增加最小 Active Sequence 表达、动态 label、semantic duration seek / play 边界和非 active normal Clip 视觉提示；Track / Keyframe selection 与层级 shell 未进入本 Batch。
- 本 Batch 没有修改 Animation Schema、Sequence ownership、`Clip.startMs` 持久化语义、History document、Presentation runtime 或 Export runtime。

最终自动检查（2026-08-12，基于收尾源码重新执行）：

- Active Sequence / editor phases / semantic duration / multi-Clip local clock / compiler：**59 项**通过。
- controller context / zero-duration / cleanup / single-rAF contract：**12 项**通过。
- SlideCanvas editor sampling / pending no contribution / legacy fallback：**10 项**通过。
- isolated preview contract：**10 项**通过。
- Stage 6 ownership / cleanup / no-op / trigger / reorder regressions：**11 项**通过。
- Stage 7 Batch 1 View Model / protection / purity regressions：**21 项**通过。
- Presentation formal trigger / sampling regressions：**12 项**通过。
- standalone HTML Export trigger / Sequence-local runtime regressions：**9 项**通过。
- UI / App orchestration contract：**13 项**通过。
- 本次收尾实际共 **157 项断言**通过；使用不落盘 Node / TypeScript 断言执行，没有创建或遗留临时脚本、fixture 或 QA 文件。
- TypeScript import graph：42 modules、118 relative edges、0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有 `> 500 kB` chunk warning（主 JS 531.97 kB），继续视为 non-blocking warning。
- `git diff --check`：通过；提交前继续执行 `git diff --cached --check`。
- 项目仍未定义正式 `test` script，本 Batch 不虚报 `npm test`。

人工 QA（2026-08-12）：

1. QA-1 Active Sequence + Sequence-local Playhead 通过：auto、Step 1、Step 2、不同 duration / `startMs`、Sequence selection、seek / play、同 Sequence 换 Clip、跨 Sequence、A → B → A 与 Slide 切换均符合 context reset / time retention 规则。
2. QA-2 completed / active / pending 通过：earlier settled contribution 保持，current 使用 local sampling，later 保持静态设计状态且不抢第一帧；切换到 later Step 后从 local 0 正常进入。用户确认 pending = no contribution 是当前 editor design lock，不是 Bug。
3. QA-3 isolated Clip preview + Presentation smoke 通过：preview 与 Sequence playback 互斥，取消和自然结束均恢复原 local frame且不自动 resume，Sequence / Slide 切换正确清理；正式 Presentation 行为无回归。

#### 第三 Batch：Hierarchy Shell & Selection Contract

状态：**COMPLETE；MANUAL QA PASSED（2026-08-13）**

本 Batch 在既有纯 View Model 与 Sequence-local editor timing 上建立最终层级与选择契约：

```text
AnimationScene
→ Timeline View Model
→ Sequence hierarchy
→ Active Sequence
→ Clip / Track / Keyframe selection
→ Sequence-local Playhead
→ Editor phase samples
→ SlideCanvas
```

最终实现与语义：

- Timeline 层级为 `Sequence → Object / Clip → Track → Keyframe`。normal `slide-enter` 与 page-click Sequence header 使用 View Model 动态标签“页面进入 · 自动播放”和“点击播放 · Step N”；Step N 不持久化，随有效 Sequence order 自动收敛。
- normal Sequence header 可显式切换唯一 App editor-only `activeAnimationSequenceId`；Sequence selection 与 Clip selection 分离。Active Clip 的唯一 source 继续是 `activeAnimationContext`，没有新增 `selectedSequenceId`、`timelineSelectedClip`、`currentStepId` 或 `activeStepId`。
- 新增 editor-only `AnimationTimelineSelection` typed union：Clip identity 使用真实 Sequence group / Sequence / Clip ID；Track 与 Keyframe 继续增加真实 `trackId` / `keyframeId`。selection 不使用 index、label、preset name、property name 或 offset，不进入 Project、Slide、Scene、persistence 或 History。
- 点击 Clip 激活 parent Clip；点击 Track / Keyframe 选择真实 descendant 且 parent Clip 继续 active。Track 保持 authored order，Keyframe 使用真实 identity 和 Sequence-local display time。
- `reconcileAnimationTimelineSelection` 是纯 query：保留仍存在且归属合法的 Clip / Track / Keyframe；Keyframe 删除回退 Track、Track 删除回退 Clip、Clip 删除回退当前合法 active Clip 或 `null`。外部 active Clip 切换清理旧 descendant；membership 变化按真实 Clip identity 修复 Sequence context；Step reorder 保持 identity；Undo / Redo 与 Slide 切换安全且不产生 document mutation / History。
- Sequence 默认展开，使用初始为空的 collapsed ID 集合；Clip 默认折叠，使用显式 `expandedClipIds`，空集合表示所有 Clip collapsed。collapse / expand 仅为 Timeline-local React UI state，不改变 document、View Model、Active Sequence、selection、playback 或 History。
- 新增 typed `AnimationTimelineRevealRequest`（`clipId` + `requestId`），把 navigation intent 与 selection / playback 分离。Animation Workspace、Inspector / Property Panel 等外部 Clip 入口会协调 normal owner、自动展开 parent Sequence、纵向滚动 canonical Clip row，并在 timing 完全位于 viewport 外时执行最小横向 reveal。
- reveal 不自动展开 Clip / Track / Keyframe，不 seek、不修改 Playhead。同 Sequence 切 Clip保持 local time；跨 Sequence 的 0ms reset 只来自第二 Batch 既有 Slide + Sequence controller context change。protected Clip 可 reveal / inspect，但不会抢占 normal Active Sequence。
- 不同元素即使使用同一 Preset、相同名称、property、Keyframe offset / value，仍以不同 Clip / Track / Keyframe ID 保持独立 canonical entries、selection 与 ownership。当前 UI 尚不能自然 author true multi-target Clip；底层 `targets=[A,B,C]` 仍只投影一个 canonical Clip entry，没有新增 debug 或 authoring UI。
- protected / invalid / orphan / ambiguous 数据继续安全只读显示，不 repair、normalize 或迁移 document。
- `useTimelinePlaybackController.ts`、Stage 7 第二 Batch Active Sequence / Sequence-local Playhead / semantic duration / completed-active-pending / delayed Clip gate / preview lifecycle、`SlideCanvas` sampling、Presentation runtime、standalone Export runtime、Animation Schema、animation commands 与 History document behavior 均未修改；Batch 4 未开始。

最终自动检查（2026-08-13，基于收尾源码重新执行）：

- hierarchy / dynamic labels / real identity / selection reconciliation / delete fallback / membership / same-Preset independence / true multi-target canonical / Stage 6 / Batch 1 / Batch 2 / Presentation runtime：**35 项运行时断言**通过。
- hierarchy UI / App state ownership / default collapse / external reveal / controller / Canvas / Presentation / Export / no-mutation contract：**22 项静态断言**通过。
- 本次收尾实际共 **57 项断言**通过；没有把历史测试轮次重复相加，临时 TypeScript assertion entry 与 bundle 已删除。
- TypeScript import graph：42 modules、120 relative edges、0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有 `> 500 kB` chunk warning（主 JS 约 540.20 kB），继续视为 non-blocking warning。
- `git diff --check`：通过；提交前继续执行 `git diff --cached --check`。

人工 QA（2026-08-13）：

1. QA-1 Hierarchy / Selection：PASS。Sequence hierarchy、Clip / Track / Keyframe 展开与选择、parent Clip 协调正常；同 Sequence descendant selection 不异常 reset Playhead。基于反馈确定 Sequence 默认展开、Clip 默认折叠。
2. QA-2 External Selection / Reconcile：PASS。外部 Clip selection、descendant cleanup 与 reconciliation 正常；基于反馈增加 parent Sequence auto-expand、canonical Clip scroll / highlight，且不展开 Clip、不 seek。
3. QA-3 Independent Clips / Mutation / Presentation：PASS。不同元素分别使用相同动画 / Preset 仍为两个独立动画，selection 不串；mutation、Undo 与 Presentation smoke 正常。true multi-target 由自动断言覆盖。
4. Final Short QA-1 Default Collapse：PASS。Sequence 默认展开，Clip 默认折叠，Track / Keyframe 按需展开，折叠交互正常。
5. Final Short QA-2 External Clip Reveal：PASS。parent Sequence 自动展开、Timeline 定位对应 Clip、Clip 保持折叠，Playhead 不被 reveal 修改。

#### Batch 4A：Timing Edit Infrastructure + Clip startMs Direct Editing

状态：**COMPLETE；MANUAL QA PASSED（2026-08-14）**

本 Batch 只实现同一 normal Sequence 内的 `Clip bar body drag → clip.startMs`：

```text
Committed Project
→ App editor-only timing session
→ pure draft Slide projection
→ draft Timeline View Model
→ draft editor samples
→ existing SlideCanvas
```

最终实现与语义：

- 新增 `src/utils/animationTimelineTiming.ts`，职责限定为 direct timing eligibility、typed timing session / domain、10ms candidate normalization、0ms / ruler grid / current Playhead snapping、pure editor-only draft projection、protected-safe commit adapter 与 expected Sequence ownership gate；最终 authored mutation 委托既有 `updateAnimationClipTimingInSlide`。
- App 持有唯一 editor-only timing session。`pointermove` 只更新 session 和 draft Slide，不修改 Project、committed Slide / Scene、Scene revision、`Project.updatedAt`、History、autosave / persistence source 或 legacy mirror；只有有效 `pointerup` 通过一个 `commitProjectChange` transaction 提交一次真实 document command。
- Timeline View Model、editor samples 与现有 `SlideCanvas` 消费 draft Slide，因此固定 Playhead 下拖动可立即重新采样 Canvas；controller 继续消费 committed semantic duration，Playhead 不主动 seek，也没有新增第二个 clock。既有 editor invariant 保持为 **before `clip.startMs` = no contribution**；entrance Clip 在 startMs 前显示静态设计态不属于 4A Bug。
- Clip body drag 只修改 `clip.startMs`，并继续保持 Sequence-local；`durationMs`、`Sequence.clipIds`、ownership、Sequence trigger / playback、Track / Keyframe、stagger 与其他 Clip 均不改变。不同 Clip 即使同 Preset、同名和相同 timing，仍按真实 `sequenceId + clipId` 独立修改。
- direct-edit 仅允许 normal、live、unique-owner、expected normal Sequence、有效 primary slide-enter 或 targetless page-click、有效 sequence order 与 finite source timing。targeted click、hover、manual、keyboard、media-time、advanced、ambiguous、orphan、additional slide-enter、omitted order、malformed、missing-only、NaN / Infinity 均只读；UI gate 与 commit adapter 双重保护且不 repair document。
- `durationMode=fixed` 仍允许 authored Clip start 超过 fixed duration，不 clamp、不扩展 fixed duration、不改变 Clip duration。true multi-target Clip 仍是一个 canonical Clip，所有 targets 一起移动；stagger 不写回 start。
- snapping 仅包含 0ms、当前 ruler grid 和 current Playhead；soft threshold 为 6 CSS px，按当前 `pixelsPerMs` 保持不同 zoom 下的像素语义。candidate 使用 10ms precision，最终 persisted start 继续由既有 command 取整数 ms。
- drag threshold 为 3px；阈值前保持普通 click / selection，不 pause、不创建 draft、不提交 mutation。阈值后 parent Clip 成为 active selection，Active Sequence identity 保持；若当前 Sequence 正在播放才调用既有 `pause()`，Playhead 保持当前位置。
- pointer lifecycle 完整覆盖 pointerdown、threshold、`setPointerCapture`、pointermove、pointerup、pointercancel、lostpointercapture、Escape、listener cleanup 与 context invalidation；finish guard 防止 duplicate commit。Slide / Project replacement、Clip 删除、ownership / revision 变化、Undo / Redo、Slide 切换和 unmount 均不会把 stale session 提交到新 context。
- Escape、pointercancel、lost capture 均丢弃 draft并产生 0 个 History entry；一次完整有效 drag 只产生 1 个 History entry，Undo 一次恢复 source start，Redo 一次恢复 final start。same-value no-op 保持 Project / Slide same-ref，不增加 revision、`updatedAt` 或 History，也不误触发 Preview cleanup。
- active isolated Clip preview 时 direct timing disabled；没有修改 preview lifecycle。`useTimelinePlaybackController.ts`、`SlideCanvas.tsx`、Presentation runtime、standalone Export runtime、Animation Schema 与 Stage 6 commands 均未修改。
- Batch 4A 明确没有实现 duration / left-edge resize、Keyframe drag / offset editing、cross-Sequence move、overlap hint、“接在后面”、“从 0ms 开始”、Marker editing、multi-select timing 或其他 Clip / Keyframe snapping；其中 right-edge duration resize 后续由独立 Batch 4B 完成，Batch 4C 仍未开始。

最终自动检查（2026-08-14，基于 closeout 源码重新执行）：

- timing domain、draft purity、eligibility、History / no-op、Stage 6 ownership / protection、Stage 7 Batch 1–3、Presentation / Export 与 UI / App static contract：首轮完整覆盖 **62 项断言**通过；最终审查补强 unmount cleanup 后，又基于最终源码执行 **31 项针对性断言**并通过。本次 closeout 实际执行共 **93 项断言**，没有与实现阶段历史 110 项机械累加。
- TypeScript import graph：43 modules、125 relative edges、0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；最终源码仅保留既有 `> 500 kB` chunk warning（主 JS 约 546.22 kB），继续视为 non-blocking warning。
- `git diff --check`：通过；断言使用不落盘 Node / Vite 内存脚本，没有创建或遗留临时脚本、fixture 或 QA 文件。

人工 QA（2026-08-14）：

1. QA-1 Clip start drag / Canvas draft preview：PASS。Clip bar 实时移动，Canvas 在固定 Playhead 下随 draft timing 即时变化，Playhead 不跟随，其他 Clip 不移动；entrance Clip 在 start 前显示静态设计态已确认属于既有 no-contribution 语义。
2. QA-2 Escape / Undo / Redo / no-op：PASS。Escape / cancel 恢复 source，正常松手只提交一次，Undo / Redo 各一次完整恢复，没有 pointermove History 串，no-op 正常。
3. QA-3 click-vs-drag / selection / Presentation smoke：PASS。普通 click 不误改 start，同 Sequence selection 正常，Playhead 不异常 reset；Presentation 正常并消费新的 authored start。

#### Batch 4B：Clip Base Duration Resize

状态：**COMPLETE；MANUAL QA PASSED（2026-08-15）**

本 Batch 在 4A 单一 timing infrastructure 上实现同一 normal Sequence 内的 `Clip right-edge drag → clip.durationMs`：

```text
Committed Project
→ App typed timing session
→ pure duration draft Slide
→ draft Timeline View Model / editor samples
→ existing SlideCanvas immediate preview
→ pointerup one real command
→ one History step
```

最终实现与语义：

- `animationTimelineTiming.ts` 扩展为 `clip-start | clip-duration` typed timing domain，统一拥有 direct-edit eligibility、source timing / pointer context session、candidate normalization、snapping、pure draft projection、context validation 与 protected-safe commit adapter；没有新增第二套 session、History model 或 duration command module。
- right-edge resize 只提交 authored base `clip.durationMs`；`clip.startMs`、`Sequence.clipIds`、ownership、Track / Keyframe、fixed Sequence duration、iterations、Clip / Sequence playbackRate、repeat、direction、stagger、targets、Schema 与其他 Clip 均不改变。不同 Clip 即使同 Preset、同名、同 property / timing，也继续按真实 `sequenceId + clipId` 独立修改。
- authored base end 为 `startMs + durationMs`。effective runtime duration / end 继续由既有 shared helper 根据 iterations、Clip / Sequence playbackRate、Sequence repeat、stagger 与 targets 派生，绝不写回 authored duration；反馈区显示基础时长、authored 结束，并仅在明显不同时补充有效结束。
- pointermove 只更新 editor-only session 与 pure draft Slide，不修改 Project、committed Slide / Scene、revision、`Project.updatedAt`、History、autosave / persistence source或 legacy mirror。Timeline View Model、editor samples 与现有 `SlideCanvas` 消费 draft，因此固定 Playhead 下 Canvas 即时重新采样且 Playhead 不主动 seek；有效 pointerup 才通过一个 `commitProjectChange` transaction 委托 `updateAnimationClipTimingInSlide` 提交一次真实 mutation。
- minimum authored duration 锁定为 1ms；普通 candidate 使用 10ms precision，靠近下界时可精确 clamp 到 1ms。0、negative、NaN 与 Infinity 不会写入 document，整数 persistence、revision、same-ref no-op 与安全 legacy duration mirror 继续由既有 timing command负责。
- duration snapping 只作用于 authored right-edge time，继续复用 ruler grid、current Playhead 与合法情况下有意义的 0ms guide；snap threshold 为 6 CSS px。drag threshold 为 3px，阈值前保持普通 click / selection，阈值后才创建 timing draft并在 playing 时复用既有 `pause()`。
- direct edit 只允许 normal、live、unique-owner、expected valid Sequence、finite source timing且至少含一个可编译 Track。targeted click、hover、manual、keyboard、media-time、advanced、ambiguous、orphan、additional slide-enter、omitted order、malformed、missing-only、NaN / Infinity 与无可编译 Track 均由 UI gate + commit adapter 双重保护为 read-only / no-op，不执行 repair。
- `durationMode=fixed` 不 clamp Clip、不重写 `Sequence.durationMs`；`durationMode=auto` 继续通过共享 semantic duration helper自然重算。true multi-target Clip 仍只有一个 canonical entry与一个共享 base duration，stagger及 last-target effective end继续派生。
- pointer lifecycle完整复用4A的pointerdown、3px threshold、`setPointerCapture`、pointermove、pointerup、pointercancel、lostpointercapture、Escape、context invalidation与unmount cleanup；finish guard避免duplicate commit。Escape / pointercancel / lost capture为0 History，一次有效drag为一个History step，Undo / Redo各一次恢复source / final duration，same-value no-op保持Project / Slide same-ref且不误清Preview。
- isolated Clip preview active时direct timing仍disabled；selection继续保持parent Clip / Active Sequence且不自动选择Keyframe。Slide / Project replacement、Clip删除、ownership / revision / Sequence变化、Undo / Redo或unmount不会把stale session提交到新context。
- 人工QA发现并修复minimum visual width interaction bug：authored width仍为`durationMs × pixelsPerMs`，visual width为`max(authoredWidthPx, 12px)`；handle从错误的authored near-left edge改为`clipLeft + visualWidthPx`，即用户看到的visual right edge。约10 CSS px的hit target以更高z-order和独立pointerdown阻止body start-drag，其余body区域继续负责4A start drag。
- visual edge只负责rendering / hit testing，candidate baseline仍严格使用source authored duration / authored end加当前pointer displacement；因此1ms Clip在visual 12px右边缘pointerdown时保持1ms零跳变，向右按既有precision增长，向左仍clamp 1ms。
- 极短duration显示修复仅属于formatting：1–99ms使用`1ms`、`5ms`等毫秒文案，较长时间继续显示秒；document minimum和timing precision没有改变。
- `useTimelinePlaybackController.ts`、`SlideCanvas.tsx`、Presentation runtime、standalone Export runtime、Animation Schema、Stage 6 commands与4C Keyframe rules均未修改。本 Batch没有实现left-edge resize、cross-Sequence move、Keyframe timing / snapping、Marker / neighboring Clip snapping、overlap hint或multi-select timing。

最终自动检查（2026-08-15，基于closeout最终源码重新执行）：

- 4B duration domain、minimum-width geometry / formatting、draft purity / Canvas compile preview、pointer / History contract、fixed / auto / effective timing、same-Preset / multi-target、4A、Stage 6、Stage 7 Batch 1–3、Presentation / Export与UI / App contract：**93项断言**通过；没有把实现阶段135项或minimum-width修复阶段39项历史轮次机械累加。
- TypeScript import graph：43 modules、118 relative edges、0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有`> 500 kB` chunk warning（主JS约550.30 kB），继续视为non-blocking warning。
- `git diff --check`与提交前`git diff --cached --check`：通过；临时 assertion entry、bundle与cycle-check脚本均已删除。

人工QA（2026-08-15）：

1. QA-1 Duration Resize + Canvas Preview最终PASS：start / Playhead / other Clips不动，right edge与Canvas draft即时变化；首次发现的minimum-width visual/authored edge分叉经修复后复测PASS，1ms显示、visual right-edge resize、零跳变、向右拉长、向左clamp及body start drag均正常。
2. QA-2 Auto Sequence Semantic Duration：PASS。拉长结束最晚Clip时Sequence总时长自然增加，缩短时合理缩短；fixed、iterations / rate / stagger与true multi-target底层语义由自动断言覆盖。
3. QA-3 Escape / Undo / Redo / Presentation：PASS。Escape恢复source，松手只提交final value，Undo / Redo各一次恢复，pointermove没有History链；Presentation smoke、正式播放中的新duration与其他trigger顺序正常。

#### Batch 4C：Single Keyframe Timing + Product Closure

状态：**COMPLETE；MANUAL QA PASSED（2026-08-15）**

本 Batch 在 4A / 4B 共用 timing infrastructure 上完成单个 Keyframe 的直接时间编辑，并关闭 Stage 7 Batch 4 direct timing 产品边界：

```text
Clip body        → clip.startMs
Clip right edge  → clip.durationMs
Keyframe marker  → keyframe.offset
```

最终实现与语义：

- `keyframe.offset` 是唯一新增编辑路径所写入的 document timing 字段；没有新增 Keyframe absolute time、Track duration、Sequence-level Keyframe time 或 page-flat timing。Keyframe 所属 Sequence-local time 固定为 `clip.startMs + clip.durationMs × keyframe.offset`，反向拖动固定为 `(candidateLocalTime - clip.startMs) / clip.durationMs`。
- `getAnimationKeyframeOffsetBounds` 已完成 non-finite hardening：selected / previous / next relevant offset 为 `NaN`、`Infinity`、`-Infinity`，identity 缺失或无法形成 finite legal interval 时返回显式有限 lock；Timeline direct edit 与既有 Inspector 百分比输入同步 disabled，不传播 non-finite bounds、不写回 malformed value、不自动 repair document，command 保持 safe same-ref no-op。
- 历史 duplicate offset 保持原样，不自动分散、删除或 normalize；真实 mutation identity 始终为 `clipId + trackId + keyframeId`。若一侧存在满足间隔的合法区间，可将对应 Keyframe 拖离 duplicate；没有合法区间时保持 inspect-only。
- Offset 始终限制在 `0..1`，previous / next neighbor 的 `0.001` normalized gap 为 semantic authority，禁止 crossing 或由本 Batch 创建新 duplicate。bounds 允许时 first Keyframe 可向右、last Keyframe 可向左，合法外边界继续是 0 与 1，不强制端点永久固定。
- 最终 candidate pipeline 为：source-relative pointer delta → Sequence-local raw candidate time → 在合法 local interval 内尝试 ruler grid / current Playhead / zero snapping → 未 snap 时按 10ms Timeline precision 规范化 → inverse mapping 得到 raw offset → `0..1` 与 neighbor bounds clamp → finite validation → 约 6 位小数 offset normalization → 再以 neighbor bounds 作最终保护。0.001 semantic gap优先于10ms视觉精度；snap阈值为6 CSS px，没有新增Marker、其他Clip、其他Track/Sequence Keyframe等snap source。
- `animationTimelineTiming.ts` 的typed session现统一支持`clip-start`、`clip-duration`与`keyframe-offset`。Keyframe session持有真实Slide / Sequence / Clip / Track / Keyframe identity、source / candidate timing、finite bounds及pointer/snap context；session只属于editor state，不持久化、不进入History。
- Keyframe diamond复用4A/4B同一pointerdown、3px threshold、pointer capture、pointermove、pointerup、pointercancel、lost capture、Escape、context invalidation与unmount cleanup。阈值前保持普通真实Keyframe selection；阈值后才进入timing edit，播放中只在此时调用既有pause，Playhead始终不seek。
- pointermove只创建pure draft Slide：仅复制目标Slide → Clip → Track → selected Keyframe并替换offset；Project、committed Slide、Scene revision、Project.updatedAt、History、autosave、persistence、legacy animation及IDs不变。draft不重新排序authored Track array，其他Track保持引用；Timeline View Model、editor samples与既有SlideCanvas消费draft并在固定Playhead下即时重插值。
- pointerup在重新验证owner、IDs、finite bounds、source revision/context后，委托既有`updateAnimationKeyframeOffsetInSlide`完成最终mutation、stable offset → keyframeId排序、revision与no-op；一次有效gesture只经过一个`commitProjectChange`并形成一个History step。Undo / Redo各一次恢复source / final offset；Escape、pointercancel、lost capture与same-value no-op均为0 History。
- Batch 3 selection继续是唯一selection source；drag identity使用真实keyframeId，parent Track / Clip与normal owner Sequence保持协调，同Sequence不reset Playhead。isolated Clip preview active时三种direct timing均disabled；Slide / Project replacement、Clip / Track / Keyframe删除、ownership / revision变化、external Undo / Redo或unmount不会提交stale draft。
- 4B的12px minimum Clip width继续只影响rendering / hit testing；Keyframe authored/inverse timing始终使用真实`startMs + durationMs × offset`，不会按minimum visual width拉伸。Clip body、visual right-edge duration handle和Keyframe diamond三个hit target互不串联。
- Keyframe offset继续V2-only；没有mirror legacy arbitrary Keyframe、重建legacy preset、覆盖advanced V2 Track或改变compiler/runtime语义。`App.tsx`、`useTimelinePlaybackController.ts`、`SlideCanvas.tsx`、Presentation runtime、standalone Export runtime与Animation Schema均未修改。
- 本 Batch没有实现cross-Sequence move、Keyframe跨Track/Clip、multi-Keyframe drag、box selection、ripple timing、Keyframe add/delete新入口、drag-out delete、curve/easing/value graph、left-edge Clip resize或Marker editing。

最终自动检查（2026-08-15，基于closeout最终源码重新执行）：

- non-finite / duplicate bounds、Inspector防线、Sequence-local与inverse mapping、neighbor gap、draft purity / compiler preview、commit/no-op/context、4A / 4B、minimum-width、Batch 2 / 3、Stage 6保护及UI / App lifecycle contract：**88项断言**通过；没有机械累加实现阶段105项。
- TypeScript relative import graph：43 modules / 119 unique edges / 0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有`> 500 kB`chunk warning（主JS约555.66 kB），继续视为non-blocking warning。
- `git diff --check`通过；临时assertion entry、bundle与cycle-check脚本均已删除，提交前继续执行`git diff --cached --check`。

人工QA（2026-08-15）：

1. QA-1 Single Keyframe Drag：PASS。marker与固定Playhead下Canvas即时变化，Playhead不动，ruler / Playhead snapping正常；中间Keyframe不cross，其他Keyframe及Clip start / duration / ownership不变，Undo / Redo与真实selection identity正常，无控制台异常。
2. QA-2 Bounds / Cancel / Undo / Redo：PASS。neighbor bounds与no-overlap正确，Escape恢复committed位置，普通click不误拖，一次drag只形成最终commit，Undo / Redo各一次恢复；malformed与duplicate由自动断言覆盖。
3. QA-3 Batch 4 Interaction + Presentation：PASS。Clip body、Clip right edge、Keyframe marker分别只修改`startMs`、`durationMs`、`offset`且互不串；Presentation页面进入、Step 1、Step 2与新timing正常，保存/刷新后Keyframe timing保持。

#### Batch 5A：Multi-Keyframe Selection & Group Move

状态：**COMPLETE；MANUAL QA PASSED（2026-08-16）**

本 Batch 在同一个 Clip 内建立跨 Track 的多 Keyframe selection 与 rigid group move，并继续复用 Batch 4 的 editor-only timing infrastructure：

```text
same Clip Keyframes
→ Ctrl/Cmd toggle 或 Timeline-local touch multi-select mode
→ explicit primary / real Track + Keyframe IDs
→ selected marker as drag anchor
→ one shared groupDeltaOffset
→ one atomic command
→ one History step
```

最终实现与语义：

- `AnimationTimelineSelection` 继续是唯一 selection source；Keyframe selection 显式保存 `sequenceGroupId`、可选 `sequenceId`、`clipId`、`primary` 与 `selectedKeyframes[]`。identity 只使用真实 `trackId + keyframeId`，不依赖 array index、offset、property、label 或 Preset，也没有第二套 multi-selection state。
- 普通 marker click 产生 singleton；`Ctrl/Cmd` 使用 `event.ctrlKey || event.metaKey` toggle，同一 Clip 内允许跨 Track；Timeline-local touch“多选”mode复用相同 toggle 语义。Shift 没有 range-selection 语义；关闭 touch mode 不立即丢失已有 group，下一次普通 marker click恢复 singleton。
- selection 不跨 Clip 或 Sequence 合并；跨 Clip click会先协调 Active Clip / normal owner，再在目标 Clip 建立 singleton。protected / orphan / ambiguous / malformed Keyframe仍可 singleton inspect，但不能加入 editable multi-selection；group出现 invalid member时整组锁定，不 partial move、不自动 repair。
- `primary` 始终显式存在；新 toggle-in member成为primary，抓住另一个已选 marker开始group drag时该真实anchor成为primary。primary或其他member被外部删除后，`reconcileAnimationTimelineSelection`按确定性的ViewModel Track / Keyframe顺序保留survivors并选择primary；全部member消失时回退surviving Track，再回退Clip / `null`。Undo恢复外部删除数据时不会偷偷重新加入已经reconcile掉的成员；group move自身Undo / Redo因真实IDs不变而保持完整selection。
- QA-1期间补齐Timeline空白click：pointerdown只建立empty-click candidate，不改变selection；pointerup仍为普通click时才清除Keyframe selection并经既有reconciliation回退当前Active Clip。movement `>= 3px`、pointercancel、离开原background、modifier、Playhead保护区或命中marker / duration handle / Clip body / ruler / controls / labels时取消。该路径不改变Active Clip、Active Sequence、Playhead、Project、History、revision或`updatedAt`，不capture空白pointer、不`preventDefault`，为5B保留background drag边界。
- `getAnimationKeyframeGroupOffsetBounds`位于纯`animationKeyframeRules.ts`，按每个affected Track计算legal delta interval，再以`sharedMin = max(trackMin...)`、`sharedMax = min(trackMax...)`求交集。selected → selected不构成边界；outside → selected与selected → outside继续保留`0.001`normalized gap；支持continuous / non-contiguous / cross-Track selection。
- 每个member共享唯一`groupDeltaOffset`：`candidateOffset[i] = sourceOffset[i] + groupDeltaOffset`。用户实际pointerdown的selected marker是唯一anchor；grid、current Playhead与legal zero guide只对anchor计算一次snap，再将同一delta投影到所有members，不逐member snap / clamp / round。3px drag threshold、6 CSS px snap threshold、10ms anchor candidate precision与约六位offset delta normalization保持锁定。
- multi-Track bounds使用所有affected Track区间的交集；任一member碰到0 / 1、outside neighbor或另一Track更窄边界时整组一起停止，relative offset / local-time spacing不压缩。fully selected historical duplicate可一起rigid move且不repair；unselected duplicate继续作为outside boundary。non-finite selected/outside offset、missing Track/Keyframe、duplicate illegal identity、non-finite或non-positive duration、invalid shared bounds均锁定整组。
- `updateAnimationKeyframeOffsetsInSlide(slide, { clipId, keyframes, deltaOffset })`位于`animationKeyframeCommands.ts`并由compatibility barrel导出。command先对所有IDs、source offsets、delta与group bounds作all-or-nothing验证，不循环调用N次single-Keyframe command；成功只clone one Clip、affected Tracks与selected Keyframes，Scene revision只`+1`，affected Track最终按`offset → keyframeId`稳定排序，unaffected Tracks保持same-ref；no-op或任一invalid input返回原Slide same-ref。
- pointermove只产生editor-only draft：draft保持authored Track / Keyframe array order，只clone Slide → Scene → one Clip → affected Tracks → selected Keyframes；committed Project / Slide、revision、`updatedAt`、History、autosave source、persistence、legacy animation与IDs均不变。draft继续通过Timeline View Model → editor samples → existing SlideCanvas提供固定Playhead下的即时Canvas preview。
- pointer lifecycle继续复用pointer capture、3px threshold、pointermove、pointerup、pointercancel、lost capture、Escape、context invalidation与unmount cleanup。modifier click只toggle、不进入drag；真正越过阈值时才调用既有pause且Playhead不seek。pointerup最多一次atomic commit / one History；Escape、pointercancel、lost capture、context失效与no-op均为0 History，Undo / Redo各一次恢复整组source / final offsets。
- Inspector在multi count > 1时显示“已选择 N 个关键帧”，标出primary / members并锁定single-Keyframe offset、value、easing与delete controls，避免将primary-only编辑误解为group edit；singleton恢复原Inspector。本 Batch没有增加multi-value editor。
- Clip body、visual right-edge duration handle、singleton marker、multi-selected marker与empty background五类hit target保持闭合：分别只路由4A start、4B duration、4C singleton offset、5A rigid group offset和selection fallback，互不串联。
- isolated Clip preview active时group move与其他direct timing一样disabled；Slide / Project replacement、Clip / Track / Keyframe删除、ownership / revision变化、external Undo / Redo或unmount会cancel整个session，禁止stale commit。
- 本 Batch未修改controller、`SlideCanvas.tsx`、Presentation runtime、standalone Export runtime或Animation Schema；没有实现Box Selection、cross-Clip / cross-Sequence group、Delete、Copy/Paste、Scale/Ripple、Region Loop或Marker editing。

最终自动检查（2026-08-16，基于closeout最终源码重新执行）：

- selection / primary / Ctrl-Cmd / cross-Track / cross-Clip reset / protected-malformed exclusion / reconciliation / empty-click fallback，group bounds / 0.001 gap / duplicates / malformed lock，rigid candidate / anchor snap / shared clamp / precision，atomic command / revision / clone / sort / no-op，draft / context / pointer / History contract，以及4A / 4B / 4C / Stage 6 / Presentation / Export untouched-scope回归：**118项断言**通过；没有把实现阶段111项或空白点击修复阶段14项历史轮次机械累加。
- TypeScript relative import graph：43 modules / 122 relative edges / 0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有`> 500 kB`chunk warning（主JS约567.78 kB），继续视为non-blocking warning。
- `git diff --check`：通过；提交前继续执行`git diff --cached --check`。临时assertion entry与bundle均已删除。

人工QA（2026-08-16）：

1. QA-1 Multi-Keyframe Rigid Group Move：PASS。同一Clip内Ctrl/Cmd跨Track多选、整组同步移动、relative spacing、Canvas即时预览、固定Playhead、selection与parent Clip / Active Sequence均正常。期间发现的空白点击无法取消multi-selection缺口已最小修复，补充复测确认ordinary empty Timeline click清除Keyframe selection并回退Active Clip，group drag regression正常。
2. QA-2 Shared Bounds / Cancel / Undo / Redo：PASS。左右shared bounds整组clamp、不压缩spacing、不cross outside neighbor、不越过0 / 1；Escape整组恢复，正常commit后Undo / Redo各一次恢复整组，Playhead / context无异常。
3. QA-3 Selection Modes + Interaction Regression + Presentation：PASS。ordinary singleton、Ctrl/Cmd toggle、touch multi-select、4A body start、4B duration、4C singleton offset、5A group move与hit-target隔离均正常；Presentation auto → Step 1 → Step 2 smoke通过。

#### Batch 5B：Box Selection & Advanced Interaction Closure

状态：**COMPLETE；MANUAL QA PASSED（2026-08-16）**

本 Batch 把展开 Track 的空白时间区域接入既有 5A multi-Keyframe selection，并在同一 Clip 内支持跨 Track 框选：

```text
empty Track time background
→ 3px promotion
→ visible editable marker DOM rect intersection
→ existing AnimationTimelineSelection
→ existing 5A rigid group move
```

最终实现与语义：

- 新增 co-located `useAnimationTimelineBoxSelection.ts`，职责只包括 Box pointer session、client / viewport-local geometry、visible marker DOM registry、preview hits、pointer capture、cancel lifecycle与scroll / context validation。它不依赖document command、timing command、Presentation或Export，也不复制5A selection / group move。
- Box scope严格取起手Track所属Clip；同一Clip内可跨多个展开Track，other Clip与other Sequence marker即使落入视觉矩形也忽略。候选只来自当前实际rendered且viewport可见的marker DOM；collapsed、offscreen、protected、malformed、non-live、non-unique-owner或timing不可编辑Keyframe不参与，也不auto repair。
- hit geometry统一使用pointer `clientX / clientY`与marker `getBoundingClientRect()`的rect intersection，不使用center-only、整行范围、document offset或DOM偶然顺序。marker identity仍为真实`trackId + keyframeId`。
- Desktop在multi-select mode ON时普通empty Track drag启动Box；mode OFF时仅`Shift + drag`启动，普通drag不Box。Touch / iPad复用5A“多选”mode，ON时empty Track drag启动Box，OFF时保留Timeline scroll。`Ctrl/Cmd + empty drag`没有additive语义，也未实现union、subtract、XOR或range selection。
- 5A empty click与5B Box共用一套background candidate：pointerdown不修改semantic selection；movement `< 3px`且最终为普通click时清Keyframe selection并回退当前Active Clip；达到`>= 3px`且满足activation才promote为Box；达到阈值但不满足activation时既不Box也不deselect。
- pointer priority保持`Keyframe marker > duration handle > Clip body > empty Track background`；ruler、Playhead、controls与labels独立。pointer capture只在越过3px并正式promote后获取；pointerup、pointercancel、lost capture、Escape、unmount、context / hierarchy / collapse invalidation与external scroll均清理session、overlay和capture。
- Box期间固定source scroll context，overlay使用viewport-local坐标；external scroll按首版contract安全cancel。首版明确**no edge auto-scroll**，没有acceleration、offscreen hit或复杂content-space重映射。
- Box结果采用replacement semantics。原primary仍在final hit set时保留；否则按Timeline ViewModel的Track display order → Keyframe display order选择确定性first hit。有效gesture零命中时不生成empty Keyframe selection，而是清Keyframe selection并fallback Box scope Clip。
- rectangle与preview marker highlight只存在于Timeline / hook local transient state；pointermove不高频写App semantic selection，pointerup最多一次semantic callback。Cancel保持gesture前selection；Box不修改Project、Slide timing、Keyframe offset、Clip start / duration、Scene revision、`updatedAt`、History、autosave source或persistence。
- Box完成后继续消费唯一`AnimationTimelineSelection`，拖任一selected marker直接复用5A shared bounds、single anchor snap、rigid delta、atomic command、one revision / one History与Undo / Redo；没有Box-specific selection或group timing implementation。
- Active Clip保持scope Clip，Active Sequence保持normal unique owner；Box不移动或seek Playhead，也不因selection change暂停playback。只有后续真实5A timing drag越过既有threshold才触发pause。
- active Box期间局部阻止网页文字选择；overlay为translucent violet fill + clear border、`pointer-events: none`且位于marker下层，结束即消失。没有persistent region、resize / transform handle或Region Loop状态。
- QA-1首次测试中Box表面行为正常，但发现阻塞性React Hooks-order error与Vite HMR 500，因此首次QA-1判FAIL。根因是5B custom hook直接加入已由Fast Refresh挂载的`AnimationTimeline` hook signature，失败HMR保留的旧fiber与新signature不一致。
- 阻塞修复新增稳定`AnimationTimelineBoxSelectionBoundary`：长期挂载的`AnimationTimeline`恢复既有hook signature并始终渲染Boundary；Boundary自首次mount起无条件调用`useAnimationTimelineBoxSelection`。最终AST与浏览器检查确认没有conditional、loop、nested callback或early-return hook count变化，Hooks-order blocker **RESOLVED**。
- 本 Batch未修改controller、`SlideCanvas.tsx`、Presentation runtime、standalone Export runtime或Animation Schema；没有实现Region Loop、Marker editing / hit、advanced / Box snap、edge auto-scroll、cross-Clip / cross-Sequence selection / group move、Delete、Copy/Paste、Scale、Ripple或retime handles。

最终自动检查（2026-08-16，基于closeout最终源码重新执行）：

- Box activation / empty-click、geometry、scope / visible / editable filtering、replacement / primary / zero-hit、pointer / overlay / cancel lifecycle、Hooks-order AST、5A selection / rigid command / draft、4A / 4B / 4C、Batch 3 reconciliation、Presentation / Export与scope isolation：**90项定向断言**通过。
- 真实无头浏览器cold load、Timeline mount、marker availability、multi-select / zoom state update、Box start、Escape cancel、pointerup finish、editing / animation unmount-remount、React / Hooks console与Vite overlay：**15项runtime检查**通过；React runtime errors = 0，Hooks-order errors = 0，Vite error overlay = none。
- 本次closeout实际重新执行共**105项（90定向 + 15浏览器）**；没有机械累加实现阶段95项或Hooks修复阶段21项。TypeScript relative import graph：44 modules / 124 relative edges / 0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有`> 500 kB`chunk warning（主JS约574.52 kB），继续视为non-blocking warning。
- `git diff --check`与新增hook独立whitespace检查通过；临时assertion、bundle、browser profile与log均已删除，提交前继续执行`git diff --cached --check`。

人工QA（2026-08-16）：

1. QA-1：首次因Hooks-order runtime error + Vite HMR 500判FAIL；Boundary修复后复测PASS。Box rectangle、同Clip跨两个Tracks多Keyframe selection、explicit primary、5A group move复用与Console均正常，Hooks-order blocker RESOLVED。
2. QA-2：PASS。ordinary empty click deselect、mode OFF plain drag no Box、Shift + drag Box、Escape cancel、zero-hit Clip fallback与collapsed / protected exclusion均正常。
3. QA-3：PASS。normal marker click、Ctrl/Cmd toggle、Box、5A rigid group、4C singleton、4B duration、4A body start与hit-target closure正常；Presentation auto → Step 1 → Step 2 smoke通过，Export保持untouched。

#### Batch 6：Region Loop

状态：**COMPLETE；MANUAL QA PASSED（2026-08-17）**

本 Batch 在唯一 Sequence-local editor Playhead 上新增一个 App-owned、editor-only Region Loop，并保持 Project document、正式 Presentation 与 standalone Export 完全隔离：

```text
Current Slide ID + current normal Active Sequence ID
→ one transient Region { slideId, sequenceId, startMs, endMs }
→ optional controller loopRange
→ existing Sequence-local editor sampling
```

最终实现与语义：

- 新增纯 `src/utils/animationTimelineRegion.ts`，集中 Region type、finite normalization、10ms pointer candidate、1ms minimum edge、handle candidate、committed duration reconciliation、controller loop range normalization与half-open modulo wrap。模块无React、App、document command、Presentation或Export依赖，规则deterministic且finite-safe。
- Region只由App拥有，shape为`{ slideId, sequenceId, startMs, endMs }`；不进入Project、Slide、AnimationScene、schema、autosave、localStorage、History、revision或`updatedAt`。纯create / resize / clear保持Project same-ref、Scene revision与timestamp不变。
- Region严格绑定当前Slide ID + 当前normal Active Sequence ID，只允许一个值且无`Map<sequenceId, Region>`或per-Sequence cache。Sequence A → B与Slide切换会clear；B → A不会恢复旧Region。Step reorder / dynamic Step N变化只要Slide与Sequence ID不变就保留Region。
- protected / historical Clip仍可inspect，但不能成为Region owner；原normal Active Sequence仍存在时Region继续属于该normal owner，没有normal Active Sequence时Region button与gesture禁用，已有Region clear。
- Region使用Active Sequence-local time，唯一范围为`0 <= startMs < endMs <= semanticDurationMs`。上界直接来自Timeline View Model中复用`getAnimationSequenceLocalDurationMs`的现有semantic duration：auto使用derived duration，fixed Sequence由fixed `durationMs`权威；`rulerExtentMs`只负责layout，绝不参与Region bound或playback。
- Region最终state为whole integer milliseconds；唯一semantic minimum为`endMs > startMs`，因此1ms合法。pointer candidate约10ms精度，但合法最小边界仍可精确保持1ms；没有引入frame rate或视觉最小时间。
- playback interval锁定为`[startMs, endMs)`；exact end立即wrap到start。`wrapAnimationTimelineRegionTime`使用modulo保留one-loop、multi-loop与large rAF delta overshoot，并对接近length的floating residue归零，始终返回`start <= time < end`。
- `useTimelinePlaybackController`只新增optional`loopRange`，不知道Region UI、Slide或Sequence ownership。Region start/end不进入现有Slide ID + Active Sequence ID context key；range变化不是context reset。
- Region active时：Playhead在区间内从当前位置继续；在before、after或exact end按Play时从Region start开始；Pause保持当前位置；manual ruler seek / scrub允许停到Region外并pause，下一次Play再从start；Stop继续回0；无Region时恢复普通semantic-duration completion。
- controller在Region loop中不触发normal completion，而用modulo持续wrap。playing时Clear不pause、不跳0或Region start；controller以当前显示Playhead和当前wall clock重新锚定，再继续普通Sequence playback。
- isolated Clip one-shot`playRange`与normal Sequence`loopRange`保持两个独立概念，优先级为isolated preview > Region。Region不循环preview、不改变natural end、return frame、cancel restore或no-resume；preview期间Region state保留但overlay dimmed，create、handles与Clear禁用，preview结束后恢复active。
- Timeline新增独立约20px Region lane，结构为36px ruler → 20px Region lane → Tracks；Region band与handles不覆盖ruler或Track rows。emerald Region surface与violet Box surface分离，Region lane不启动Box，Track background不创建Region，ruler继续只负责seek / scrub。
- toolbar“循环区间”使用一次性armed mode；empty Region lane只有armed时才能drag create。短click不创建且保持armed，Escape退出armed；L→R与R→L均按min/max生成，成功create后auto-disarm。
- create与left/right handle resize均先建立pointer candidate；只有movement达到既有3 CSS px threshold才capture、pause当前Sequence并更新Timeline-local draft。pointerdown不pause、不写App；pointermove不高频写App；pointerup最多一次editor-state update。Escape、pointercancel、lost capture、context invalidation与unmount均取消并恢复source，0 History。
- left handle只改start、right handle只改end，约8px hit target高于band body；handles不能cross，拖过另一端时clamp而不swap，至少保留1ms。未实现whole-region drag。
- Region首版没有grid、Playhead、Marker、Keyframe或Clip snapping；只有10ms candidate precision + semantic clamp，advanced snapping继续留在后续有限closure。
- committed semantic duration shrink只clamp end；start不自动左移，无法保持`start < end`时clear。Region不进History，所以duration commit后Region收敛，随后Undo document不会恢复旧end或复活已clear Region。
- 4A / 4B timing pointermove draft只影响Region临时视觉projection；authoritative App Region只随committed semantic duration reconcile。Escape timing edit后完整Region恢复，真实commit后才执行永久clamp / clear。
- `AnimationTimelineSelection`未增加Region kind。Region handles直接交互，不改变Active Clip / Active Sequence / selection / Playhead，除非既有context reconciliation本身要求。
- shared sticky header高度由36px ruler + 20px Region lane同一source派生；5B Box的`viewportTopInsetPx`、external reveal的`visibleTop`与track-visible viewport calculation共用该值，Box hit geometry没有20px偏移。`useAnimationTimelineBoxSelection.ts`保持未修改。
- Region gesture hooks位于稳定`AnimationTimelineRegionInteractionBoundary`子Fiber，主`AnimationTimeline` hook signature未改变；Boundary无conditional、loop、nested callback或early-return hook count变化，保持5B之后的Fast Refresh / Hooks-order安全边界。
- `getAnimationTimelineEditorSamples`、`SlideCanvas.tsx` editor sampling、Presentation controller/runtime、standalone Export plan/runtime、Animation Schema与Stage 6 command语义均未修改。Region只改变controller输出的当前Sequence-local Playhead progression。

最终自动检查（2026-08-17，基于closeout最终源码重新执行）：

- Region normalization / finite / ownership / 1ms / precision / semantic duration / duration shrink / handle clamp / half-open modulo，以及App/controller/UI/pointer/shared-header/untouched-scope contract：**88项closeout断言**通过；没有机械累加实现阶段92项。
- TypeScript relative import graph：45 modules / 135 local edges / 0 cycles。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；仅保留既有`> 500 kB`chunk warning（主JS约584.70 kB），继续视为non-blocking warning。
- `git diff --check`与空staging上的`git diff --cached --check`通过；只有既有LF / CRLF转换提示。临时assertion与cycle-check脚本已删除。
- 当前浏览器控制环境的可用实例列表为空，因此本次closeout没有虚报cold-mount browser automation；真实browser行为由下述用户QA覆盖。

人工QA（2026-08-17）：

1. QA-1 Region Loop Playback：PASS。Region连续循环、end → start无明显停顿或累计漂移、Canvas、Pause / Resume与console表现正常。
2. QA-2 Seek / Resize / Clear：PASS。Region外seek与exact end、Play outside → start、handles / no-cross、Escape、Clear、clear后普通completion及playing clear无明显跳时均正常。
3. QA-3 Context / Isolation / Regression：PASS。isolated preview inactive / recover、Active Sequence与Slide change clear、5B Box、5A group move、4A / 4B / 4C timing、Presentation smoke与Export isolation均正常；Step reorder same-ID contract由自动断言覆盖。

#### Stage 7 下一优先 targeted audit：Pre-trigger Baseline / Editor–Presentation Sampling Parity

状态：**OBSERVED；与Region Loop独立；尚未实施；Stage 7完成前需要targeted boundary audit**

已观察现象：页面进入自动播放Sequence内，delayed entrance Clip在`clip.startMs`前，Editor当前`pending / before-start → no contribution`语义会保留static design state，导致元素提前可见；到Clip start附近才进入动画态。Presentation中的pre-trigger视觉表现正常。

边界与下一步：

- 该问题不是Region Loop bug，Batch 6没有修改`getAnimationTimelineEditorSamples`、`SlideCanvas` sampling或Presentation，也没有增加Region-specific sampling branch。
- 下一轮只先做“Pre-trigger Baseline / Editor–Presentation Sampling Parity”targeted boundary audit，同时考虑同一Sequence delayed entrance Clip与future Sequence entrance Clip。
- 不能简单对future元素统一`display:none`，否则可能破坏普通属性动画；也不能给所有pending Clip无条件套first Keyframe，否则会错误抢占历史或其他属性状态。
- audit目标是建立统一、数据驱动的pre-trigger baseline semantics，使Editor Timeline state尽量匹配Presentation，同时保留普通属性动画、earlier completed / active状态与Sequence-local timing。
- 该audit之后仍有Marker minimum ownership / display / edit contract，以及finite advanced snapping / conflict-feedback closure。Stage 7继续保持IN PROGRESS。

Stage 7 Batch 4 direct timing editing现已**COMPLETE**：4A负责Clip start、4B负责Clip authored base duration、4C负责single Keyframe offset；三者共用editor-only timing draft → Timeline / Canvas preview → one final command → one History infrastructure。

Stage 7整体仍为**IN PROGRESS**。Batch 6已完成editor-only Region Loop；下一优先入口为Pre-trigger Baseline / Editor–Presentation Sampling Parity targeted boundary audit，其后仍有Marker minimum ownership / display / edit contract与finite advanced snapping / conflict-feedback closure。

未来cross-Sequence move仍只是candidate：默认preserve existing Sequence-local`startMs`，显式提供“从0ms开始”和“接在后面”，overlap仅给non-blocking hint并允许intentional parallel；它不是当前architecture invariant，也未在4A / 4B / 4C实现。

Stage 7 稳定 editor flow：

```text
AnimationScene
→ Timeline View Model
→ Active Sequence
→ Sequence-local Playhead
→ Editor phase samples
→ SlideCanvas
```

旧 slide-level / page-flat clock 已不再控制普通 V2 editor Canvas；Stage 7 整体仍未完成。

已知非阻塞 UI 文案问题：

- Animation Workspace 可能同时显示持久化 `Sequence.name`（例如“点击步骤 3”）与动态派生的“点击播放 · Step 2”。这是 Sequence name / dynamic Step wording 冲突，不属于本 Batch timing 或 View Model 缺陷；本次只记录，不修改 Sequence name 或 Step numbering。

Stage 7 后续 timing candidate UX：

- Batch 4A 已完成同一 normal Sequence 内的 Clip start direct editing。
- Batch 4B 已完成同一 normal Sequence 内的 Clip authored base duration right-edge resize，并保持 start、ownership、effective duration 与 runtime 语义分离。
- Batch 4C 已完成同一 normal Sequence 内的 single Keyframe offset timing，并保持Sequence-local mapping、neighbor gap、selection与runtime语义分离。
- Batch 5A 已完成同一 Clip 内跨 Track multi-Keyframe selection与rigid group move，并保持atomic command、editor-only draft、single History与既有runtime隔离。
- Batch 5B 已完成同一 Clip 内跨 Track Box Selection、visible / editable DOM rect hit、replacement / zero-hit fallback、local preview与完整cancel lifecycle；首版no edge auto-scroll，且直接复用5A selection / group move。
- Batch 6 已完成当前normal Active Sequence内的editor-only Region Loop、dedicated lane、half-open modulo playback、outside seek、isolated preview priority与committed-duration reconciliation；无whole-region drag、无snapping。
- 未来跨 Sequence move 默认候选更新为 preserve existing Sequence-local `startMs`，并显式提供“从 0ms 开始”与“接在后面”；overlap 只提供 non-blocking hint，intentional parallel 继续允许。
- 该建议不是已锁定 architecture invariant；Batch 4A / 4B / 4C 均没有修改 Stage 6 join / move command，也没有实现 cross-Sequence DnD。

下一正式开发入口：**Stage 7 — Pre-trigger Baseline / Editor–Presentation Sampling Parity targeted boundary audit**。本次closeout只记录入口，不开始sampling修复、Marker或advanced snapping。

正式产品设计：

- 采用偏 After Effects 风格的“纵向 `AnimationSequence` 分组 + 多层可展开轨道”。
- 不采用“自动播放 / Step 1 / Step 2 / Step 3 标签页切换”作为主要 Timeline 架构。
- 目标层级是：

```text
AnimationSequence
→ Object / Clip
→ AnimationTrack
→ Keyframe
```

顶层示意：

```text
▼ 页面进入 · 自动播放
    标题
        Opacity
        Position
    背景
        Opacity

▼ Click Step 1
    图片
        Position
        Scale
    箭头
        Opacity

▼ Click Step 2
    说明文字
        Position
        Opacity

▶ Click Step 3
```

正式原则：

1. `slide-enter` 和每个 Click Step 都是一级 Sequence 分组。
2. Sequence 按实际演示步骤顺序纵向排列。
3. 每个 Sequence 都拥有自己的局部 0ms。
4. `Clip.startMs` 相对于所属 Sequence。
5. 每个 Sequence 可以展开和折叠。
6. Sequence 内按 Object / Clip 展示。
7. Object / Clip 后续可以继续展开具体 `AnimationTrack`。
8. Keyframe 显示在对应属性轨道。
9. 折叠时仍保留 Clip 摘要时间条和聚合关键帧信息。
10. Timeline 应能从简洁折叠状态逐级展开到专业轨道编辑状态。
11. Clip 开始时间拖动、Clip 持续时间边缘拖动、单关键帧拖动、多关键帧框选和移动、多属性轨道、Marker、区域循环、音频波形、吸附和冲突提示，都必须建立在这一纵向层级结构中。
12. 不允许第 7 阶段重新退回“整张幻灯片一个页面绝对时间轴”的 Click Step 时间模型。

编辑器确定性视觉状态原则：

- 当 Timeline 正在编辑某个 `AnimationSequence` 时，所有更早 Sequence 视为 completed，并按各自 Sequence-local 结束状态采样。
- 当前正在编辑的 Sequence 视为 active，由该 Sequence 自己的局部 Playhead 时间采样。
- 所有更晚 Sequence 视为 pending，保持尚未执行状态，且不得覆盖 completed / active 的确定视觉。
- 不再使用一条页面级绝对 Timeline 控制所有 Click Step。
- 编辑器 Timeline 和正式放映必须复用 completed / active / pending 的确定性视觉状态模型。
- 正式放映的 active time 来自 Presentation Playback Controller。
- Timeline 编辑的 active time 来自用户拖动当前 Sequence 的局部 Playhead。

因此展开 Step 2 时，画布应确定性表现为：

```text
页面进入和 Step 1：已完成
Step 2：随自身局部 Playhead 变化
Step 3 及以后：保持未执行状态
```

其他实现要求：

- 开始 Timeline V2-C 前先确定现有 Scene-level Marker 与 Sequence-local Timeline 的页面级 / Sequence-local / 双层归属和显示规则。
- 拖动期间实时预览。
- 一次拖动只生成一个 Undo 记录。
- 禁止产生负时间、无效持续时间或非法关键帧顺序。
- Timeline 操作与高级动画编辑器保持同步。

依赖：

- Click Step 的步骤含义已经确定。
- 第 5.5 阶段至少完成一轮 `App.tsx` 渐进式职责拆分。
- TimelinePlaybackController 保持稳定。
- 关键帧排序、边界、插值和最小间隔规则先统一到公共工具层。
- 波形显示依赖第 11 阶段的媒体元数据与波形数据能力；其他 Timeline V2-C 能力不必等待媒体阶段。
- 不得在步骤系统尚未稳定时提前修改 Timeline 数据含义。

### 第 8 阶段：动画与放映系统 V1 收尾

任务：

- 完整回归测试
- 自动化测试补充
- README 更新
- 过期注释清理
- 无障碍检查
- 大项目性能检查
- 保存和恢复测试
- 多页面测试
- 多对象测试
- 多 Clip 测试
- 媒体与动画组合测试
- HTML 导出测试

依赖：

- 前述 V1 主线功能全部完成。

### 第 9 阶段：扩展动画触发系统 V2

计划内容：

- Hover 触发。
- 指定对象点击触发。
- 指定键盘按键触发。
- 媒体播放到指定时间触发。
- 更完整的手动触发 API。
- 编辑器放映和 HTML 导出复用同一触发解析与调度规则。
- 触发配置进入保存恢复、Undo 和 Redo。
- 缺失目标、删除对象和切页时正确清理触发状态。

依赖：

- 第 3 至第 6 阶段的 Click Step 数据、运行时、导出和编辑界面稳定。
- 第 11 阶段为媒体时间触发提供可靠的媒体时间与资源能力；其他触发类型可以先独立实现。

### 第 10 阶段：高级动画轨道、缓动与混合 V2

计划内容：

- Motion Path 可视化路径编辑。
- 文字按字符、单词和行播放。
- SVG 子部件与 SVG 描边动画编辑。
- Clip Path、颜色、滤镜和自定义属性轨道。
- Spring、Bounce 和自定义曲线完整运行时。
- AE 式速度曲线编辑。
- 轨道独立混合。
- Add 和 Multiply 高级混合行为。
- 多动画冲突可视化。
- 编辑器预览、放映和 HTML 导出保持一致。

依赖：

- 动画与放映系统 V1 收尾完成。
- 关键帧公共规则和 Timeline V2-C 稳定。
- 每类轨道先定义可持久化、可导出并可向后兼容的数据规则，再开发编辑界面。

### 第 11 阶段：媒体编辑、波形与兼容性 V2

计划内容：

- FLV 专用播放或转码兼容层。
- 视频剪辑。
- 音频剪辑。
- 音频波形生成、持久化与 Timeline 显示。
- 媒体时间触发所需的精确时间事件。
- 大型媒体文件性能和异常资源恢复。
- 扩大浏览器音视频兼容性测试。
- 编辑器、放映和 HTML 导出采用一致的媒体区间与资源规则。

依赖：

- 当前资源中心、Blob 持久化和 HTML 导出路径稳定。
- Timeline 波形 UI 与第 7 阶段协同，但媒体数据生成与生命周期由本阶段负责。

### 第 12 阶段：平台与生态能力

计划内容：

- 后端账户与身份系统。
- 云端项目同步。
- 多人实时协作。
- 在线模板市场。
- 插件系统。
- 权限、版本、冲突处理、审计和数据迁移规则。
- 将“AE 级完整动画能力”拆成可独立验收的后续轨道、合成、表达式和性能子阶段，不作为单次大任务开发。

依赖：

- 本地优先的数据模型和核心编辑器能力稳定。
- 先完成账户、存储、权限和版本协议，再接入多人协作、市场或插件执行环境。

---

## 七、待优化项目

待优化项目可以在相关主线功能开发时一并处理，但不得借机进行无关重构。

### 1. 播放控制器职责整理

现状：

- Timeline 已经有统一播放控制器。
- 单 Clip 预览复用 Timeline 控制器的受控区间。
- 正式放映使用独立 `usePresentationPlaybackController`，只在放映模式运行一个 Sequence-local rAF 调度循环。
- 三种播放意图互斥，不同时控制 Canvas。

优化目标：

- 明确整页播放、单 Clip 播放和放映步骤播放的职责边界。
- 避免多个计时器同时控制画布。
- 避免在 `App.tsx` 中继续堆积播放细节。
- 为播放状态增加独立测试。

适合插入阶段：

- 单 Clip 预览
- Click Step 放映控制器

### 2. `App.tsx` 拆分

现状：

- `App.tsx` 在 Batch 1 前审计时为 6279 行；Batch 1 完成后当前为 5841 行。
- 当前仍承担大量项目状态、历史、资源、动画、放映和界面组装逻辑，继续属于高优先级技术债；是否继续拆分仍以真实职责和状态所有权为标准，不以是否超过 6000 行作为机械门槛。
- 第 5 阶段期间只限制继续膨胀，不进行大规模重构，也不改变当前功能范围。

优化目标：

- 按真实职责拆分 util、Hook、controller、service / runtime helper 或独立组件。
- 保持现有行为不变。
- 优先提取项目持久化 / 自动保存、slide operations、编辑器快捷键、selection / editor state、animation editor coordination、presentation / timeline controller glue、export coordination，以及独立 workspace / toolbar / panel 组装逻辑。
- 延续 `useTimelinePlaybackController`、`usePresentationPlaybackController`、`animationSequence` 和 `presentationPlayback` 已建立的独立职责方向。
- 不进行一次性大规模重构，不机械拆函数，不创建大量只有一层转发的文件。

正式安排：

- 第 5 阶段完成、用户验收并 commit / push 后，单独执行第 5.5 阶段“`App.tsx` 渐进式架构拆分维护”。
- 第 6 阶段 Click Step 编辑 UI 和第 7 阶段 AE 式 Timeline 开始前，必须至少完成一轮渐进式职责拆分，避免后续 UI 状态继续集中膨胀。

### 3. 关键帧公共规则统一

现状：

- Batch 3C-1 已新增 `animationKeyframeRules.ts`，Keyframe 排序、相邻间隔、offset 边界、最大空隙插入、可新增 / 删除 / 编辑 easing 判定、easing normalization / equality、AnimationValue 插值和深复制规则已由 Inspector 与 Keyframe Command Domain 共同复用。
- 编译器的播放采样职责保持不变；本轮没有借规则抽离修改 animation compiler、Presentation 或 Export Runtime。

后续原则：

- 后续 Keyframe UI 和命令必须继续复用统一工具函数，不得重新建立平行边界规则。
- Timeline V2-C 的关键帧拖动与高级编辑必须在该共享规则层上渐进扩展，并保持 Sequence-local time。
- 防止出现 UI 允许但命令拒绝，或编辑、预览与导出语义不一致。

后续扩展阶段：

- Timeline V2-C
- 关键帧拖动
- 关键帧相关 Bug 修复

### 4. 自动化测试

需要逐步补充：

- 动画命令单元测试
- 关键帧边界测试
- 关键帧插值测试
- TimelinePlaybackController 测试
- 单 Clip 播放测试
- Click Step 状态机测试
- 页面步骤回退测试
- HTML 导出行为测试
- 资源清理测试
- 旧项目兼容测试

适合插入阶段：

- 每次开发相关功能时同步补充。
- 不等待所有功能结束后一次性补测试。

### 5. 过期注释清理

现状：

- Timeline 部分历史注释仍可能表示播放控制器“未来接入”，但当前远端已经接入统一控制器。

优化目标：

- 注释必须描述当前真实行为。
- 删除与当前代码矛盾的注释。
- 保留架构原因、边界条件和兼容性说明。

适合插入阶段：

- 修改对应文件时顺带处理。

### 6. README 更新

现状：

- 已知 README 仍接近 Vite 默认模板。

优化目标：

- 项目介绍
- 安装方式
- 开发命令
- 架构入口
- 数据保存方式
- 动画系统说明
- 测试方式
- Git 协作规则入口

适合插入阶段：

- 动画与放映系统 V1 收尾。

### 7. 大项目性能

需要检查：

- 多页面时的 React 渲染
- 多 Clip 编译
- Timeline 大量条目
- Blob URL 生命周期
- 资源存储体积
- 本地持久化耗时
- Undo 快照体积
- HTML 导出体积

适合插入阶段：

- 功能闭环完成后。
- 出现明确性能问题时提前处理。

### 8. 无障碍与交互提示

需要检查：

- 按钮 `aria-label`
- 键盘操作
- 焦点管理
- 禁用状态原因
- Timeline 拖动提示
- 当前步骤提示
- 屏幕阅读器文本
- 颜色对比度

适合插入阶段：

- 对应 UI 功能开发时同步处理。

### 9. 导出 Presentation 品牌启动体验

当前状态：

- 第 5 阶段只实现朴素、稳定的“开始放映”遮罩和按钮，其真实点击同时承担浏览器 user activation 的技术职责。

未来视觉优化：

- 可将普通启动入口升级为 Animify 品牌启动动画。
- 设想以类似手写路径描绘的方式逐步绘制 “Animify” 字样，完成后短暂停顿，再过渡进入第一页 Presentation。
- 品牌动画必须继续建立在同一个一次性启动门闩和真实用户点击上，不得另建播放状态机或绕过媒体 autoplay 策略。

阶段边界：

- 这是未来视觉 / 品牌启动体验优化，本轮禁止实现复杂路径动画或 Apple hello 风格效果。
- 应在 Stage 5 功能完成后另行排期，不阻塞当前朴素启动入口验收。

---

## 八、已归入后续阶段的远期需求

以下能力仍不属于当前 Click Step 主线，但已经分配到明确的待做阶段，不再作为无归属的暂缓清单。

### 第 7 阶段：Timeline V2-C

- 直接拖动单个关键帧
- 框选多个关键帧
- 批量移动关键帧
- 多轨道展开
- 区域循环
- Marker 编辑
- 波形显示
- 多层吸附系统

### 第 9 阶段：扩展动画触发系统 V2

- Hover 触发
- 指定对象点击触发
- 指定键盘按键触发
- 媒体播放到指定时间触发
- 更复杂的手动触发 API

### 第 10 阶段：高级动画轨道、缓动与混合 V2

- Motion Path 可视化路径编辑
- 文字按字符、单词和行播放
- SVG 子部件和 SVG 描边动画
- Clip Path、颜色、滤镜和自定义属性轨道
- Spring、Bounce、自定义曲线和 AE 式速度曲线
- 轨道独立混合、Add / Multiply 和冲突可视化

### 第 11 阶段：媒体编辑、波形与兼容性 V2

- FLV 专用播放或转码兼容层
- 视频剪辑
- 音频剪辑
- 音频波形
- 媒体时间触发所需的媒体时间能力
- 大型媒体和跨浏览器兼容性

### 第 12 阶段：平台与生态能力

- 云端项目同步
- 多人实时协作
- 后端账户系统
- 在线模板市场
- 插件系统
- AE 级能力拆分后的长期子阶段

执行规则：

- 以上项目在对应阶段到达前仍视为暂缓，不得因为已经列入路线图就提前开发。
- 每个阶段开始前仍需读取真实代码、确认依赖并拆成独立可测试任务。

---

## 九、已知 Bug、UX 问题与正常行为

### 1. 当前没有确认中的数据损坏或无法启动 Bug

截至本文档建立时，没有取得最新版上的明确崩溃、数据损坏或无法启动报告。当前另有已确认的 Video animation / compositor 生命周期问题，见本节第 13 项。

状态：**待新本地环境和用户回归确认**

### 2. 幽灵 Clip

现象：

- 删除动画后，当前页面动画列表或 Timeline 仍显示旧 Clip。

分类：

- 原问题属于数据同步 Bug。
- GitHub 已有修复提交。
- 最新版是否在所有删除路径中完全解决：待回归。

### 3. 单 Clip 预览 V1 状态显示不同步

历史现象：

- 首轮用户测试发现，从高级动画工作区停止预览后，Timeline 的方块停止控件仍显示；反向操作也会造成另一入口看起来未同步结束。

处理结果：

- 问题属于 UI 状态表达不一致，不是两套播放状态或两个计时器竞争。
- 已拆分 Clip 停止和整页停止的显示与事件入口，并统一两个界面的状态文案。
- 用户复测反馈正常。
- 状态：**已验证完成（2026-07-24）**。

### 4. 放映按键直接翻页

历史现象：

- 第 4 阶段前，放映模式中的空格、Enter、右方向键和 PageDown 直接切换页面。

处理结果：

- 第 4 阶段代码已改为统一“推进一个 Sequence / Step”。
- 当前页 Click Step 全部完成后，下一次推进才翻页。
- 首轮人工验收确认播放期间普通推进保护锁符合预期，但用户需要能够主动跳过长动画；该反馈分类为第 4 阶段 UX 缺陷。
- 已增加滚轮向下 / 向上的强制步进，不改变普通点击和键盘前进的保护行为。
- 后续复测发现活动 `slide-enter` 取消后错误显示静态终态；根因是空 Sequence sample 没有表达页面起始视觉，而不是 `completedSequenceIds` 错误加入了 `slide-enter`。
- 当前已让未执行的 `slide-enter` 输出显式初始采样，并让 Canvas 在正延迟前应用该 Sequence 最早动画的初始帧；Click Step 和后续 Clip 仍不会提前覆盖前态。
- 随后人工测试确认滚轮向下能够强制完成动画，但发现首版会在同一 transition 中继续调用普通 advance，从而同时跨过“当前播放中 → 当前完成态 → 下一 Step 播放中”两个边界；该行为已改为一次手势严格只完成当前活动 Sequence，稳定态的下一次独立手势才继续推进。
- 状态：**已验证完成（2026-07-26）**。

### 5. Clip 选择上下文中的 Delete 误删元素

现象：

- Timeline 或右侧“当前页面动画”已有明确 Clip 选择 / 高亮上下文时，按 Delete 仍会删除整个画布元素。

预期：

- 有明确 Clip 选择上下文时，Delete 只删除当前 Clip。
- 只有不存在 Clip 选择上下文、画布元素处于选择状态时，Delete 才删除元素。

分类：

- 已确认 UX / 键盘命令路由 Bug。
- 本轮仅记录，不修改删除逻辑；需在后续独立任务中统一 Clip 与元素选择上下文的 Delete 优先级，并验证 Undo / Redo。

状态：**待开发**

### 6. 非 `slide-enter` Trigger 不自动播放

现象：

- 类型中已经存在 Click、Hover、Keyboard、Media Time 和 Manual。
- 当前编译器主要自动处理 `slide-enter`。

分类：

- 页面级 Click Step 已在第 4 阶段接入正式放映运行时，并通过用户核心人工验收。
- Hover、指定对象点击、指定键盘按键、媒体时间和手动 API 仍属于阶段性限制，不是当前 Bug。
- 这些扩展触发已归入第 9 阶段“扩展动画触发系统 V2”。

### 7. Timeline 不能直接拖动编辑 Clip

现象：

- 当前 Timeline 主要用于显示、选择、缩放、滚动、Seek 和播放。

分类：

- Timeline V2-B 的正常边界。
- 拖动 Clip 和调整持续时间属于 Timeline V2-C。

### 8. 每条基础轨道至少保留两个关键帧

现象：

- 只剩两个关键帧时删除按钮禁用。
- 关键帧之间保留最小间隔。
- 关键帧不能互相穿越。

分类：

- 基础模式的正确保护行为。
- 不是 Bug。

### 9. 媒体控件阻止放映快捷键

现象：

- 视频或音频控件获得焦点时，空格等按键不推进页面。
- 全屏视频期间，放映导航被限制。

分类：

- 正确行为。
- 用于避免媒体播放操作误触发页面切换。

### 10. FLV 资源不能直接在画布播放

分类：

- 资源可以进入资源管理范围，但专用播放或转码兼容层尚未实现。
- 已归入第 11 阶段“媒体编辑、波形与兼容性 V2”。
- 不是当前 Bug。

### 11. 历史本地提交不能直接 push

现象：

- 历史临时工作副本中的 `490bd24` 落后远端多个提交。

分类：

- Git 基线分叉风险。
- 不是产品功能 Bug。
- 必须在新本地环境中安全处理。

### 12. 独立 HTML 通过 `file://` 打开时的 Console 兼容性观察

现象：

- 第 3 阶段人工验收期间，独立 HTML 通过 `file://` 直接打开时，Console 曾出现一次浏览器本地 file URL / unique security origin 相关错误。
- 同一次验收中的实际动画播放正常。
- Pending Media Interaction 人工 QA 期间仍出现 file URL / unique security origin 相关资源警告，但本轮媒体输入验收没有因此失败。

分类：

- 当前没有证据证明该错误由第 3 阶段引起。
- 不作为第 3 阶段阻塞项。
- 作为 HTML 本地打开兼容性观察项留待后续独立检查导出资源引用与可移植性，本轮不修复。
- 当前证据不足以把该警告直接标记为无害或已解决。

### 13. Video animation / compositor 生命周期问题

已确认现象：

- Timeline / 普通动画预览中的 Video 动画正常。
- 编辑器正式 Presentation 中，Video 动画可能出现闪烁 / 抽动、局部白屏；鼠标移动或触发重绘后可能暂时恢复。
- standalone HTML 的导出播放计划没有丢失该 Clip：target `elementId`、DOM 查找和 Runtime WAAPI 创建均已确认存在，但实际导出 Video 动画不可见。
- standalone 原生全屏还会出现可见局部白屏 / 重绘问题。

已证明的编辑器 Presentation 根因：

- deterministic Presentation sampling 的 `renderableCompiledAnimations` 引用会随每个 rAF 变化。
- 现有 WAAPI 生命周期因此在每帧执行 cancel → recreate → pause → `currentTime`，造成 Video compositor 状态持续重置。
- 修复必须只在动画定义变化时重建 WAAPI；仅局部时间变化时只更新 `currentTime`。
- 修复不得按 Video preset 特判，也不得用 `will-change`、`translateZ` 或强制 GPU hack 掩盖生命周期根因。

Presentation Part A 修复与验收（2026-07-30）：

- `SlideCanvas` 的 deterministic WAAPI Map 现在同时保存 compiler 输出 definition 与浏览器 `Animation` instance。
- compiler 输出在同一 scene / Sequence 定义期间保持不可变且引用稳定；同一 animation ID 下 definition 引用不变时，rAF 只更新既有实例的 `currentTime`。
- Keyframe、timing、target、Sequence / Clip 集合或页面变化产生新的 compiler definition 时，旧实例会被取消并建立新实例。
- 不再使用每帧新建的 `renderableCompiledAnimations` 数组引用触发全量 cleanup；组件卸载仍会清理全部实例，参与集合变化仍会清理失效实例。
- 新增 `src/utils/deterministicAnimationLifecycle.ts`，集中表达 reuse、definition replacement、失效实例清理和 unmount 清理规则。
- 该修复是全部元素共用的 deterministic animation lifecycle 规则，没有 Video、preset 或动画类别特判，也没有 GPU / repaint workaround。
- completed / active / pending、pending baseline、`localTime < startMs` 不参与合成、Wheel / retreat 与媒体自身播放时间语义均未改变。
- 内存 mock 直接断言 16 项通过：覆盖连续 3 帧复用、创建次数、仅更新时间、definition 替换、startMs 前后边界、active / completed / pending baseline 稳定、Sequence 切换、页面切换和组件卸载清理。
- 用户人工 QA 已确认：正式 Presentation 的 Video 普通动画不再抽动 / 闪烁；Timeline 播放、暂停、scrub 正常；Video 可进入并正常播放 Click Step。
- `startMs = 1000ms` 回归通过：`localTime < startMs` 时保持前一 Sequence completed 状态，到达 `startMs` 后才由当前 Clip 接管。
- Wheel Down / Wheel Up 回归通过。
- Part A 状态：**代码修复完成，人工 QA 通过，已解决**。

Standalone HTML 重新验证结论：

- 当前重新人工测试已无法复现此前记录的“Video animation invisible”。
- standalone HTML 的 Video 普通动画、Click Step 和 `startMs = 1000ms` 均已通过人工 QA。
- 本轮没有修改任何 Export implementation，因此不得声称 Part A 已证明修复 Export；当前只记录“无法复现”。
- 不启动 speculative repair。若以后取得稳定复现步骤，再重新开启 Export Runtime 动态诊断。
- 原计划 Part B 当前关闭：**无需启动代码修复；等待未来稳定复现证据**。

原生全屏发白观察：

- 同一视频只在一块显示设备上出现，拖到另一块显示设备后正常；另一个导入视频也未出现该问题。
- 当前证据更符合特定显示设备 / Chromium / OS 色彩或 compositor 路径差异，属于 environment-specific observation，不是当前已确认的 Animify defect。
- 不计划增加 `filter`、`brightness`、`will-change`、`translateZ` 或其他代码 workaround。

分类与顺序：

- 与 Batch 2A persistence adapter 无关；Part A 只修复编辑器正式 Presentation 的通用 deterministic WAAPI 生命周期。
- Part A 已完成人工验证；Export 当前无法复现且不启动猜测性修复。Part A Git 闭环后已按计划进入 Batch 2B，Batch 2B 已通过全部人工 QA 并作为稳定架构基线。

状态：**Part A 已解决并通过人工 QA；Export 现象当前无法复现；全屏发白记录为环境观察项**

### 14. Pending Media Interaction Bug

现象：

- 编辑器正式 Presentation 和 standalone HTML 均可复现。
- 尚未出现的 pending Video 虽然视觉上不可见，但 DOM 仍参与 pointer hit-test。
- 点击该不可见 Video 所在区域会直接播放声音，Video 不会因此出现，同时该点击不会推进下一 Step。
- 鼠标停留在该区域时，Wheel 输入被媒体抢占，无法推进；鼠标移出 Video 区域后 Wheel 可正常触发下一 Step。

实现结果（2026-07-31）：

- 根因确认是确定性视觉 participation 与 DOM pointer / focus / input ownership 未同步；本轮没有修改 Presentation 状态机或动画采样顺序。
- 新增共享纯语义模块 `src/utils/presentationInteraction.ts`，根据 element static opacity 与已经由 Presentation 解析好的 ordered renderable samples 计算 `ownsInput` 和诊断 reason；不读取 DOM、preset ID、媒体 ID、页面绝对时间或 Project schema。
- 只有真实定义 opacity 的动画取得 opacity 交互权；transform-only animation 保留已有 opacity authority。active opacity animation 从 `startMs` participation 边界立即拥有输入，不引入 opacity 阈值。
- completed endpoint 按 `fill`、`direction`、`iterations` 和既有 sample 顺序解析；更晚的 opacity authority 覆盖更早结果，future pending baseline 不得覆盖 earlier active / completed authority。
- 编辑器正式 Presentation 与 standalone HTML 均在实际媒体 element hit-test container 写入 `data-presentation-input-owner="true|false"`；owner=false 时整层禁用 pointer hit-test、设置 inert 并安全 blur 容器内旧 focus，Click / Wheel 因此回到 Presentation。
- owner=true 时原生 Audio / Video controls 和导出 Video 自定义全屏按钮保持现有行为；没有动态切换 `controls`。
- 浏览器 Fullscreen 是临时输入所有权 override；fullscreen 中不应用 inert / pointer disable，退出后立即按最新 Presentation sampled state 重新判断。
- Editor 使用共享 helper，Export Runtime 使用轻量独立 adapter；同一批 contract fixtures 必须保持完全一致。
- Interaction gate 只管理用户输入所有权，不卸载或重建 media，不修改 `src`、`currentTime`、WAAPI definition identity，不调用 pause / play，也不改变 autoplay 行为。
- 本轮只同步输入所有权；人工 QA 已确认尚未出现的 pending Audio / Video 不会因交互而提前发声。已经播放的媒体在确定隐藏后是否自动 pause 仍是独立生命周期问题，本轮没有实现。
- `exportPlaybackPlan.ts`、`animationCompiler.ts`、`deterministicAnimationLifecycle.ts`、Presentation Controller 与 Project Schema 均未修改。
- 代码级验证：interaction 与 Editor / Export contract 共 73 项、fullscreen / focus gate 6 项、standalone HTML 生成 5 项均通过；35 个 TypeScript 文件 import graph 无循环，Lint、Build 与 `git diff --check` 通过。以上不替代用户人工 QA。
- 用户人工 QA（2026-07-31）已通过：
  - 编辑器与 standalone HTML 的 pending Video 隐藏时不再抢占 Click / Wheel，也不会提前播放声音；出现后原生播放、暂停、进度条和媒体控件所有权正常。
  - retreat / exit 后确定隐藏的 Video 不再抢占输入，节点没有重新出现或闪烁。
  - 同一 Video 已由较早 Step 显示且未来仍有 pending 动画时，步骤之间仍可操作媒体，画布其他位置可继续推进。
  - Audio 的 pending / 出现后输入语义在编辑器和 standalone HTML 中均正常；无动画媒体不会被误加 inert。
  - 静态 `opacity: 0` 媒体不会形成隐形可交互控件。
  - 正 `startMs` 延迟期间媒体不参与输入，Wheel 仍只跨一个动画边界。
  - 编辑器与 standalone HTML 的全屏媒体输入保护、退出全屏后的 Presentation 输入恢复和播放进度保持均正常。
- 当时 Batch 3B 尚未开始；其后的 Batch 3B-1、Batch 3B-2A 与 Batch 3B-2B 现均已完成。

状态：**实现完成；自动检查通过；manual QA passed；已验证完成；纳入本次独立 Git 闭环**

### 15. Standalone Export Fullscreen Arrow-Key Seeking Bug（已解决）

根因：

- standalone HTML 在 `window` capture 阶段注册全局 `keydown`。
- 全屏元素为 `HTMLVideoElement` 时，旧分支对 `ArrowLeft` / `ArrowRight` 先调用 `preventDefault()` 和 `stopPropagation()`，随后直接返回。
- 该路径既取消了浏览器原生 Video controls 的 seek 默认动作，也没有显式修改 `currentTime`，因此方向键完全无效。

实现结果（2026-08-01）：

- Fullscreen Video 的 `ArrowLeft` / `ArrowRight` 在任何 `preventDefault()` / `stopPropagation()` 之前直接退出 Presentation handler。
- 浏览器原生 Video controls 继续负责方向键 seek；该返回路径不会调用 Presentation advance / retreat，也不会切换 Step 或页面。
- Space 继续由 export Runtime 显式切换一次播放 / 暂停，不推进 Presentation。
- Enter、PageDown、PageUp 在全屏媒体期间继续阻止 Presentation 推进；本轮没有把 Enter 改为媒体播放 / 暂停。
- Escape 继续保留浏览器原生全屏退出行为。
- Fullscreen API 请求目标仍是 `<video>` 本身，`fullscreenchange` 后仍聚焦该 Video。
- 退出全屏后 Video 保持焦点时，媒体继续拥有方向键和 Enter；这是已确认的合理媒体焦点语义，不强制 blur。用户点击画布空白后，Presentation 键盘输入立即恢复。

人工 QA（2026-08-01）：

- 全屏播放和暂停状态下，左右方向键均可调整 Video 进度；Video 不暂停、不重载，Step 和页码不变化。
- 长按方向键可连续 seek，不切换 Step / 页面、不退出全屏，且未出现明显双重 seek。
- Space 每次只切换一次播放 / 暂停，不推进 Presentation。
- Enter / PageDown / PageUp 在全屏期间均不推进 Presentation，也不退出全屏。
- Escape 正常退出 Video 全屏；退出后媒体焦点语义和点击空白恢复 Presentation 输入均符合预期。

自动检查：

- standalone fullscreen / generation assertions：31 项通过。
- 生成后 `keydown` 实际行为 assertions：22 项通过。
- Presentation interaction ownership assertions：14 项通过。
- TypeScript relative import graph：35 个文件、87 条相对依赖，无循环。
- `npm.cmd run lint`、`npm.cmd run build` 与 `git diff --check` 均通过。

状态：**根因确认；实现完成；自动检查通过；manual QA passed；已验证完成。**

### 16. Fullscreen Media Enter-Key Parity

现象：

- 编辑器正式 Presentation 的 Video 全屏中，Enter 会播放 / 暂停。
- standalone HTML 的 Video 全屏中，Enter 当前无反应。
- Space 在两端均可播放 / 暂停。

后续产品语义建议评估：

- Space / Enter：播放或暂停。
- ArrowLeft / ArrowRight：调整媒体进度。
- Escape：退出媒体全屏。
- PageUp / PageDown：不操作媒体，也不推进演示。

边界：

- 这是独立的媒体键盘一致性 UX，不属于本次 Arrow-Key Seeking 根因修复。
- 本轮只记录，不实现 Enter parity，也不改变现有 Presentation 状态机或媒体焦点所有权。

状态：**待独立评估 / 开发。**

### 17. Hidden Media Playback Lifecycle Bug（已解决）

根因：

- Editor Presentation 与 standalone HTML 已能从确定性视觉采样判断媒体是否稳定隐藏，但该状态此前只驱动 pointer / inert / focus 等输入所有权，没有驱动 `HTMLMediaElement` 播放生命周期。
- 同页 Step 不会重建媒体节点，因此已经开始播放的 Audio / Video 在视觉隐藏和输入权撤销后仍会继续运行播放时钟并发声。

实现结果（2026-08-03）：

- 共享纯判定只把 `static-hidden`、`pending-opacity-hidden`、`completed-opacity-hidden` 视为确定稳定隐藏；不使用 `ownsInput === false` 代替视觉生命周期语义。
- Editor 使用 ref、standalone Runtime 使用 `WeakMap<HTMLMediaElement, boolean>` 记录节点级 `pauseRequired` 转换；初始异常播放且稳定隐藏，或 visible → hidden 时只调用一次 `pause()`。
- `active-opacity`、transform-only、fullscreen override，以及 earlier completed 仍可见而 future Sequence pending 的状态均不会误暂停；退出动画 active 期间继续播放，只在 completed-hidden 稳定边界暂停。
- 只调用 `pause()`；同一媒体节点的 `currentTime`、`src`、`volume`、`muted`、`playbackRate` 均保持，未调用 `load()`，也不卸载或重建节点。
- hidden → visible 只更新生命周期状态，不自动 `play()`；媒体重新显示后保持暂停并保留同页播放进度。
- Editor autoplay timer 与 Export `playSlideMedia()` 都在执行 `play()` 前读取当前稳定隐藏 gate；隐藏 autoplay 被拦截，可见的合法 `slide-enter` autoplay 保持原行为。
- fullscreen 期间暂停要求被 override；退出 fullscreen 后立即按底层确定性状态重新判断，若仍稳定隐藏则暂停一次。
- 页面切换继续使用既有页面生命周期停止并销毁当前页媒体；返回页面会创建新媒体节点，不承诺跨页保留 `currentTime`。

自动检查与人工 QA：

- Hidden Media Lifecycle 专项断言 74 项、既有 interaction regression contracts 16 项、TypeScript import cycle、Lint、Build 与 `git diff --check` 均通过。
- 用户已在 Editor Presentation 与 standalone HTML 中完成 Audio / Video 人工 QA：稳定隐藏暂停、退出动画期间继续播放、retreat / pending、autoplay、再次显示保持暂停、同页 `currentTime` 保留、fullscreen override / 退出后重判和跨页生命周期均符合预期。

状态：**已解决；自动检查通过；Editor / Standalone HTML 人工 QA 通过。**

### 18. Presentation Element Click Blocking Bug（已解决）

根因：

- 编辑器正式 Presentation 复用 `SlideCanvas` 的 `bare` 模式，但 `SlideElementView` 的普通元素外层 wrapper 仍无条件挂载编辑器选择 `onClick`。
- `handleElementClick` 首先调用 `event.stopPropagation()`，使普通 Text / Image / Shape / SVG 的 click 无法到达 App 外层的统一 `handlePresentSurfaceClick`，因此 Presentation 不推进。
- standalone HTML 不挂载该编辑器选择 handler，所以没有同一问题。

实现结果（2026-08-02）：

- `bare=true` 时，普通展示元素 wrapper 不再挂载编辑器选择 `onClick`；click 自然冒泡到统一 Presentation 推进入口。
- `bare=false` 时继续挂载原有 `handleElementClick`，编辑器单击选择与 Shift 多选语义保持不变。
- 没有修改 `handleElementClick` 本身、pointerdown、`App.handlePresentSurfaceClick`、Presentation Controller、媒体控件的事件保护、pending media input ownership 或 standalone export 点击路由。
- 正式 Presentation 仍只由根层 click 路由调用一次 advance；没有新增 capture 或 pointerdown 推进入口。

自动检查：

- SlideElementView / bare click 结构与事件契约断言：29 项通过。
- Presentation media input ownership 断言：8 项通过。
- standalone export generation / click route 断言：11 项通过。
- TypeScript relative import graph：35 个文件、87 条相对依赖，无循环。
- `npm.cmd run lint`、`npm.cmd run build` 与 `git diff --check` 均通过。

人工 QA（2026-08-02）：

- 正式 Presentation 点击普通 Text、Image、Shape 和 SVG 均恰好推进一个 Step，不出现编辑器选中框、控制点或正式文本编辑，也不双重推进。
- Video / Audio 原生控件继续正常播放与暂停，点击控件不推进 Presentation。
- pending Audio 隐藏区域不会提前播放，点击恰好推进一个 Step。
- 编辑模式的单击选择、Shift 多选、拖动、缩放、双击文本编辑和右键菜单全部正常。
- 动画播放中快速连续点击不会跳过多个 Step 或页面；最后一个 Step 完成后点击只进入下一页一次，初始动画状态正常。
- standalone HTML 的普通 Text / Image 点击继续正常单步推进，导出端未受影响。

状态：**根因确认；实现完成；自动检查通过；manual QA passed；已验证完成。**

### 19. Presentation Transient Text Editing / Selection Bug（已解决）

根因：

- 正式 Presentation 使用 `SlideCanvas bare={true}`，但此前 `isEditing` 没有检查 `bare`，`onStartEditing` 仍可调用 `setEditingElementId`，普通元素 wrapper 也仍挂载编辑器 `onDoubleClick`。
- 双击 Text、Shape 或 SVG 后实际创建的是受控 `textarea`，不是 `contentEditable` 节点；输入只更新 `SlideElementView` 本地 `draftContent`。Presentation 没有内容更新回调，因此临时文字不会写回 Project，blur、退出编辑或 React remount 后会恢复 Project 原文。
- bare 展示文字此前允许浏览器原生选择，因此快速双击还会产生蓝色 Selection。

核心实现（2026-08-02）：

- `bare=true` 时 `isEditing` 永远不能成立；`bare || readOnly` 时不提供 `onStartEditing`；普通元素 wrapper 不挂载编辑器 `onDoubleClick`。
- bare 模式下 Text、Shape 和 SVG 展示文字使用 `user-select: none` 与 `cursor: default`，不使用 `contentEditable`，也没有修改 pointer-events。
- bare 模式普通 `onClick` 继续保持未挂载编辑器选择 handler，click 自然冒泡到 App 的统一 Presentation 推进入口；没有新增 capture 或 pointerdown 推进路径。
- `bare=false` 的编辑模式继续保留原 textarea：双击进入编辑、focus / Selection、draft 输入、Enter / blur 提交和 Escape 取消语义均未改变。
- 本轮没有增加 Presentation 入口 `activeElement.blur()` 或 `removeAllRanges()`；它们仅作为未来防御性加固评估，不是本次核心修复的一部分。

自动检查：

- bare Presentation text-editing、普通编辑 textarea 与 click / advance 结构语义断言：52 项通过。
- Presentation media input ownership 断言：8 项通过。
- standalone export generation / click route 断言：11 项通过；导出实现未修改。
- TypeScript relative import graph：35 个文件、86 条相对依赖，无循环。
- `npm.cmd run lint`、`npm.cmd run build` 与 `git diff --check` 均通过。

人工 QA（2026-08-02）：

- 正式 Presentation 快速双击 Text、Shape、SVG 均不再出现蓝色选区、textarea 或编辑光标；字母、Backspace 和 Delete 不会改变展示文字，普通单击仍正常单步推进。
- 动画播放期间快速双击不产生选区或 textarea，不影响动画，也不连续跳过多个 Step。
- 编辑模式双击 Text 继续正常进入 textarea，光标、选择、输入和 Enter / blur 写回 Project 正常；Escape 正常取消且不提交。
- 编辑状态直接点击“放映”时，按钮点击先触发现有 textarea blur 并提交内容，Presentation 显示已提交文字；该行为属于正确的现有提交语义，不是编辑状态泄漏。

状态：**根因确认；核心实现完成；自动检查通过；manual QA passed；已验证完成。**

### 20. Standalone Export / Editor Text Selection UX

仍待独立处理：

- **Standalone Export Text Selection UX**：standalone HTML 的普通展示文字仍可能显示 I-beam 并允许原生选择；导出端没有 textarea 临时编辑问题。后续应只对展示文字设置 `user-select: none` 与 `cursor: default`，不得影响链接、按钮、表单或媒体控件。
- **编辑模式 Shift 多选文字高亮 UX**：Shift 多选元素时内部文字仍可能出现浏览器原生蓝色选区，但不会进入真实文本编辑。后续必须区分普通编辑选择状态与 textarea 编辑状态。
- **Presentation 入口焦点与 Selection 清理**：本轮没有实现 `activeElement.blur()` 或 `removeAllRanges()`；当前核心根因已经修复，入口清理仅保留为未来防御性加固评估，不得标记为已实现。

状态：**三个边界均未在本轮实现；待独立评估 / 开发。**

### 21. Audio Native Controls Keyboard Shortcut Parity

已观察行为：

- 焦点位于 Audio 播放按钮时，Space 可播放 / 暂停，但左右方向键不调整进度。
- 焦点位于 Audio 进度条时，左右方向键可调整进度，但 Space 不控制播放 / 暂停。
- 当前证据表明这是 Chrome 原生 Audio controls 的内部焦点语义，不是 Presentation 抢占按键。

后续边界：

- 可独立评估是否需要统一媒体快捷键。
- 任何后续实现不得造成浏览器原生 controls 与 Runtime 双重执行，也不得破坏焦点和无障碍语义。

状态：**待独立评估的媒体键盘一致性 UX**

### 22. Selected Element Adorner Layering

现象：

- 下层元素被选中时，其 resize handles 可能被上层元素覆盖。
- pointer 命中上层元素后显示移动光标，而不是下层已选元素的 resize 光标。
- 将被选元素置顶后，resize handles 与光标行为恢复正常。

分类与边界：

- 属于 Canvas selection adorner stacking / hit-testing UX，不是 Batch 3B-1 Project Command Facade 的数据变换问题。
- 后续需要独立检查 selection overlay、transform handles 的渲染层与 pointer 命中顺序；不得借此改变 `slide.elements` 的真实文档图层顺序。
- 本轮只记录，不修改 `SlideCanvas`、Pointer 路由或 Timeline。

状态：**已确认独立 UX；待后续诊断 / 修复，本轮未解决。**

### 23. Sequence name / 动态 Step 编号文案冲突

现象：

- Animation Workspace 可能同时显示持久化 `Sequence.name`（例如“点击步骤 3”）与当前根据有效全局 page-click 顺序动态派生的“点击播放 · Step 2”。

分类与边界：

- 属于 Sequence display wording / stale authored name UX，不是 Stage 7 第一 Batch View Model timing、global Step query 或 Sequence-local projection 错误。
- 动态 Step N 继续以共享 page-click query 为准；本轮不重命名 Sequence，不改 Step numbering，也不执行文档 migration。
- 后续应独立确定 persisted name 与动态 trigger label 的展示优先级。

状态：**人工 QA 已确认非阻塞文案问题；仅记录，未修复。**

---

## 十、最近测试状态

### 已知用户验证

```text
TimelinePlaybackController V1：用户测试通过
对应提交：ba1cecc
GitHub 状态：已 push
```

### 历史临时代码检查

历史本地提交 `490bd24` 曾通过：

- `npm run build`
- `npm run lint`
- `git diff --check`
- 关键帧辅助函数直接断言

但该提交：

- 基于旧版本开发；
- 没有取得用户实际功能测试结果；
- 没有 push；
- 已被远端后续实现大部分覆盖；
- 不得作为当前最新版测试结果。

### 最新 `origin/main` 整体测试

新本地环境检查结果：

- 依赖安装：已存在并通过 `npm.cmd ls --depth=0` 验证
- Build：`npm.cmd run build` 通过
- Lint：`npm.cmd run lint` 通过
- 自动化测试：`package.json` 未定义 `test` 脚本
- 开发服务器启动：用户验证通过
- 浏览器手动核心回归：用户反馈功能测试正常
- HTML 导出回归：用户验证通过
- 刷新恢复：用户验证通过
- Undo / Redo：用户验证通过
- 资源中心：当前测试浏览器中基础回归通过
- 音视频：当前测试浏览器中基础回归通过，跨浏览器仍待确认
- 多页面 Click Step：第 4 阶段正式放映核心流程已通过用户人工验证

### 单 Clip 预览 V1 代码检查

- Lint：`npm.cmd run lint` 通过，0 error、0 warning。
- Build：`npm.cmd run build` 通过。
- 自动化测试：项目未定义 `test` 脚本。
- Diff：已检查变更范围和关键播放、清理路径；`git diff --check` 通过，仅输出行尾转换提示。
- 人工功能测试：首轮发现停止状态显示不同步；修复后用户复测正常，单 Clip 预览 V1 已验证完成。

### 第 3 阶段 Click Step 数据与命令层代码检查

- Build：`npm.cmd run build` 通过。
- Lint：`npm.cmd run lint` 通过。
- 自动化测试：项目未定义 `test` 脚本。
- 命令级断言：原 15 项通过，覆盖多 Clip 步骤、顺序、触发切换、兼容迁移和删除清理。
- Sequence-local 专项断言：16 项通过；新增 Clip 的目标 Sequence 隔离路径及 Sequence playback direction 2 项断言另行通过。
- 专项检查确认指定 Sequence 编译不泄漏其他步骤、复制 / 新增 Clip 不读取其他 Sequence 的末尾时间、Clip 跨 Sequence 移动保留局部 `startMs`、旧 `slide-enter` 时间数值无需迁移。
- Diff：`git diff --check` 通过，仅输出工作区 LF / CRLF 转换提示。
- 人工功能测试：用户已完成并确认全部测试正常；详细结果见第五节“用户人工验收（2026-07-26）”。
- Sequence-local QA：三个 Sequence 的局部 `startMs`、effective duration、编译 delay、复制开始时间、保存读取和 `localStorage` 备份恢复全部通过。
- 现有 `slide-enter` 整页播放、单 Clip 预览、关键帧、Undo / Redo、自动保存、刷新恢复和独立 HTML 播放均回归正常。
- 编辑器测试期间 Console 没有出现新的产品运行红色错误。
- `file://` 直接打开独立 HTML 时曾出现一次浏览器安全来源相关错误，但播放正常且无证据表明由第 3 阶段引起，已列为非阻塞兼容性观察项。
- 状态：**已验证完成（2026-07-26）**。

### 第 4 阶段 PPT 式放映控制器代码检查

- 基线：`main`、HEAD 和 `origin/main` 均为 `975f109f3b8ce6a8461c07dc4a33216dbc8a7f1e`，阶段开始前工作区和暂存区干净。
- Lint：`npm.cmd run lint` 通过，0 error、0 warning。
- Build：`npm.cmd run build` 通过。
- 自动化测试：项目未定义 `test` 脚本。
- 状态机不落盘直接断言：首轮 20 项、滚轮首版强制步进 15 项、回退初始采样 18 项均通过；本次单边界强制前进专项断言 22 项通过。
- pending / completed / active 采样优先级不落盘直接断言：15 项通过。
- 断言覆盖 `slide-enter` 自动进入、Click Step 局部 0ms、普通播放中重复推进抑制、活动 Sequence 下滚只完成不连播、稳定完成态下一手势才启动后续 Step、活动末 Step 不翻页而后续独立手势才请求下一页、活动 `slide-enter` 取消后的页面起始采样、活动 Step 1 / 2 取消后的前一完成态和上一页末态。
- Canvas 正式放映路径逐 Sequence 调用 `compileAnimationSequence`，并以独立 local time 采样。
- `git diff --check`：通过，仅有 LF / CRLF 转换提示。
- 人工功能测试：用户确认页面进入、顺序推进、普通推进锁、Wheel Down / Up 单边界语义、`ArrowLeft` / `PageUp` 回退、最后一步后翻页、上一页末态恢复、future pending 初始视觉、completed / active 优先级和 Sequence-local time 均正常。
- 当前 Timeline V2-B / 编辑动画幕布尚未完整接入 Click Step Sequence 上下文；“整页播放”仍主要只执行 `slide-enter`。该限制已归入第 7 阶段 Timeline V2-C，不阻塞第 4 阶段完成。
- 状态：**已验证完成（2026-07-26）**。

### 第 5 阶段 HTML 导出 Click Step 同步代码检查

- 阶段开始基线：`main`、HEAD 和 `origin/main` 均为 `3f73e7dd207d6d08c3c807995f5de3c07949bfb9`，ahead 0、behind 0，工作区和暂存区干净。
- Lint：`npm.cmd run lint` 通过，0 error、0 warning。
- Build：`npm.cmd run build` 通过。
- 自动化测试：项目未定义 `test` 脚本，没有新增假的测试命令。
- 首轮导出播放计划 7 项、standalone runtime 状态机 13 项、completed / active / pending 采样 5 项，合计 25 项直接断言通过；本次另有 `startMs` 合成边界与播放回归纯逻辑 14 项、WAAPI 采样 3 项，合计 17 项直接断言通过。
- 新增导出边界断言明确覆盖：有 earlier completed 状态时 active delayed Clip 在 `localTime < startMs` 不参与，到达 `startMs` 才接管；无历史元素保留 pending baseline；`startMs = 0`、普通推进、Wheel、回退和上一页末态保持正常。
- 新增编辑器正式 Presentation sampling 与状态机直接断言 19 项通过，覆盖同一 startMs 边界、pending baseline、延迟 `slide-enter`、普通推进锁、Wheel Down / Up 和上一页末态。
- 新增 standalone 启动层直接断言 29 项通过：Runtime 16 项、生成 HTML 13 项；覆盖 pre-start 无状态、一次性 `startExportPresentation()`、首次 mount 只进入第一页 `slide-enter`、启动点击不冒泡、不额外 advance、媒体调用不再脱离启动 / 导航手势，以及生成脚本语法有效。
- `git diff --check`：通过，仅有 LF / CRLF 转换提示。
- 实际产品人工测试：全部通过。用户确认 `slide-enter` 自动播放、Click Step 独立单步推进与最后一步后翻页、future pending 隐藏、跨 Sequence 历史完成态、普通推进锁、键盘与 Wheel 导航、逐步回退和上一页末态、旧页面兼容、正 `startMs` 合成语义、编辑器与导出一致性、standalone 启动层、有声媒体 autoplay、`file://` 打开及按钮导航均正常。
- 状态：**已验证完成（2026-07-28）**。

### 阶段转换记录

```text
2026-07-24：第 0 阶段经 Work 复核后正式结束
2026-07-24：进入第 1 阶段最新基线人工回归
2026-07-24：用户明确反馈功能测试正常，第 1 阶段验证完成
2026-07-24：第 2 阶段“单 Clip 预览 V1”代码实现完成
2026-07-24：用户测试发现高级工作区与 Timeline 的停止状态显示不同步
2026-07-24：状态显示根因已修复，Lint、Build 和 Diff 检查通过
2026-07-24：用户反馈修复后测试正常，第 2 阶段已验证完成
2026-07-25：确认本地 HEAD 与 origin/main 均为 c7756b58c7aff13fc17dd832d807058a2555c775
2026-07-25：第 3 阶段“Click Step 数据与命令层”首轮代码实现和命令级检查完成
2026-07-25：用户只读复核确认首轮实现仅部分满足 Sequence-local time 模型
2026-07-25：补齐 Sequence-local time 正式语义、公共时长规则、指定 Sequence 编译和命令层隔离计算
2026-07-26：用户完成人工回归和 Sequence-local 专项 QA，确认全部测试正常
2026-07-26：第 3 阶段“Click Step 数据与命令层”正式标记为已验证完成
2026-07-26：第 3 阶段已通过提交 975f109 commit 并 push，main 与 origin/main 同步
2026-07-26：第 4 阶段“PPT 式放映控制器”代码实现、状态机直接断言、Lint、Build 和 Diff 检查完成
2026-07-26：第 4 阶段首轮人工验收确认普通推进保护锁生效，同时反馈需要滚轮强制步进；UX 修正代码与专项断言完成
2026-07-26：用户确认普通推进锁和滚轮向下强制完成能力正常；滚轮向上取消活动 slide-enter 时发现页面起始视觉采样错误，修正代码和 18 项回退断言完成
2026-07-26：用户要求滚轮向下一次只跨一个状态边界；状态机已改为活动 Sequence 只完成不连播，22 项专项断言完成，等待复测
2026-07-26：用户完成第 4 阶段正式放映核心人工验收，PPT 式放映控制器正式标记为已验证完成
2026-07-26：第 4 阶段已通过提交 5391f11 commit 并 push，main 与 origin/main 同步
2026-07-27：App.tsx 渐进式架构拆分计划已通过文档提交 a9166c3 commit 并 push
2026-07-27：第 5 阶段“HTML 导出 Click Step 同步”完成代码实现、Lint、Build、Diff 检查和 25 项直接断言
2026-07-27：第 5 阶段人工验收发现 active delayed Clip 提前应用首 Keyframe；export Runtime 已改为 localTime >= startMs 才参与合成，并完成 17 项边界与播放回归断言
2026-07-27：继续验收发现编辑器正式放映仍有同一边界；Presentation sampling 已改为逐 Animation 参与资格并完成 19 项直接断言，等待用户复测
2026-07-27：继续验收发现 standalone 有声媒体首次 autoplay 受浏览器 user activation 限制；已增加一次性“开始放映”入口并完成 29 项启动层直接断言
2026-07-28：用户确认第 5 阶段全部人工验收通过，QA 数据已恢复为测试前原项目
2026-07-28：正式开始第 5.5 阶段 Batch 1，完成低风险边界抽离、分步 Lint / Build 和结构等价检查
2026-07-28：Batch 1 首轮人工验收发现页面复制丢失 V2 关键帧；对照 f29b255 确认原函数已存在 legacy 重建缺陷，抽取本身未漏搬代码
2026-07-28：duplicateSlide 已改为深复制并重映射完整 V2 Scene，27 项直接断言、Lint、Build 和 Diff 检查通过
2026-07-28：用户完成 Batch 1 人工验收，确认职责抽离、完整动画复制、隔离、Undo / Redo、页面操作、Timeline、正式放映和 HTML export 全部正常
2026-07-28：Batch 1 已通过提交 23e4901 refactor: extract low risk editor boundaries commit 并 push，main 与 origin/main 同步
2026-07-28：Batch 2 前置只读架构审计完成，确定先执行 Batch 2A projectPersistence，再执行 Batch 2B useProjectDocument / history transaction；代码实现尚未开始
2026-07-29：Stage 5.5 状态同步已通过提交 bbc7f5d docs: sync stage 5.5 architecture status commit 并 push，main 与 origin/main 同步
2026-07-29：Batch 2A 新增 projectPersistence adapter 并完成 19 项直接断言、Lint、Build 和 Diff 检查
2026-07-29：用户完成 Batch 2A 人工验收，确认 autosave / refresh、AnimationScene V2、图片和视频资源、Reset、Undo / Redo、Presentation 与 HTML export 基础回归正常
2026-07-29：Batch 2A 通过 refactor: extract project persistence 完成 commit / push；独立 Video animation / compositor 生命周期问题已记录，未混入本提交
2026-07-29：Video Bug Part A 已分离 Presentation animation definition lifecycle 与 rAF time sampling，并完成 16 项生命周期 / startMs / cleanup 直接断言
2026-07-30：用户完成 Part A 全部人工 QA，确认正式 Presentation、Timeline、Click Step、startMs 和 Wheel 回归正常；Part A 标记为已解决
2026-07-30：standalone HTML 的 Video 普通动画、Click Step 和 startMs 重新测试通过，原“Video animation invisible”无法复现；未修改 Export implementation，不启动 speculative repair
2026-07-30：原生全屏发白仅在特定显示设备出现，记录为 environment-specific observation，不作为 Animify 当前代码缺陷
2026-07-30：Batch 2B 完成 Project Document / History 生命周期边界抽离及 24 项直接断言；代码已实现，等待用户人工验证，尚未 commit / push
2026-07-30：用户完成 Batch 2B 首轮完整人工 QA，普通 Undo / Redo、连续拖动、Redo invalidation、autosave、资源、Reset、Presentation 和 standalone HTML 均通过
2026-07-30：最终静态收尾确认原 Group 只记录中间 mutation，不能保证 A → B → A 零 History；已停止 Git 闭环并完成 finish-time 内容等价与事务级 Redo 最小修复，21 项专项断言通过
2026-07-30：用户完成 Batch 2B 最终专项 QA，确认 B → C → B 不产生隐藏重复 Undo，A → C → A 保留既有 Redo；Batch 2B 正式标记为已验证完成
2026-07-30：Initial Selection 独立修复通过人工 QA，并通过 `8a460e3 fix: initialize editor without selection` 完成 Git 闭环
2026-07-30：Batch 3A 提取 Sequence / Click Step Command Domain，完成 171 项运行时断言、9 项类型契约断言和无循环依赖检查
2026-07-31：用户完成 Batch 3A 人工 QA，确认 Click Step 顺序、slide-enter、Wheel、Video / Image 动画与 standalone HTML Sequence 行为正常；Batch 3A 已通过 d68ce74 完成 Git 闭环
2026-07-31：确认既有 Pending Media Interaction Bug：pending Video 仍参与 DOM hit-test 并抢占 pointer / wheel 输入；该问题不并入 Batch 3A，安排在 Batch 3B 前独立处理
2026-07-31：Pending Media Interaction Fix 已完成共享交互语义、Editor / Export owner bridge、pointer / focus gate、fullscreen override 与全部自动检查
2026-07-31：用户完成 Pending Media Interaction Fix 人工 QA，确认 Video / Audio 的 pending、retreat、startMs、无动画、静态 opacity 0、媒体控件及全屏输入语义正常
2026-08-01：Standalone Export Fullscreen Arrow-Key Seeking 完成最小修复和全部自动检查；用户人工 QA 确认播放 / 暂停 / 长按方向键 seek、Space、页面与 Step 隔离、Escape 和焦点恢复均正常
2026-08-01：Fullscreen Media Enter-Key Parity 作为独立 UX 记录，本轮不扩大范围实现
2026-08-02：Presentation Element Click Blocking 完成最小事件挂载修复、自动检查和人工 QA；普通 Text / Image / Shape / SVG 点击恢复统一单步推进，编辑模式与媒体输入无回归
2026-08-02：Presentation Transient Text Editing / Selection 完成 bare 文本编辑入口隔离、展示 Selection 禁用、自动检查和人工 QA；确认临时输入来自受控 textarea 路径而非 contentEditable
2026-08-02：Standalone Export Text Selection、编辑模式 Shift 多选文字高亮、Presentation 入口焦点 / Selection 清理与 Audio Native Controls Keyboard Shortcut Parity 继续作为独立问题，本轮未实现
2026-08-03：Hidden Media Playback Lifecycle 完成稳定隐藏转换暂停、Editor / Export autoplay gate 与 fullscreen override；74 项专项断言、16 项交互回归断言及 Editor / standalone HTML Audio / Video 人工 QA 全部通过
2026-08-04：Batch 3B-1 新增 Project 级 Pure Element Command Facade，迁移基础元素插入、更新、移动 patch、图层与删除纯变换；自动检查和用户人工 QA 全部通过
2026-08-05：Batch 3B-2A 新增 Pure Animation Element Clone Kernel，完成确定性 ID、深复制、跨页 trigger / slide-enter 规则、123 项有效自动断言和必要人工 QA
2026-08-05：Batch 3B-2B 新增 Pure Element Clone Facade，统一 Keyboard、元素右键和画布右键的 Copy / Paste / Duplicate 文档变换路由；117 项当前可执行断言和三个综合人工 QA 路径通过
2026-08-06：Batch 3C-1 新增 Keyframe Commands 与 Shared Rules，五个 V2 Keyframe 命令完成纯职责抽离，Inspector 统一复用排序 / 边界 / 插入 / easing 可用性规则；97 项当前可执行断言和 Keyframe 编辑、新增、删除、Undo / Redo、保存恢复、Presentation 人工 QA 通过
2026-08-09：Batch 3C-2 新增 Legacy/V2 Compatibility + Scene Cleanup 独立 domain，完成自动检查与单元素真实操作人工 QA；多元素批量添加 preset UI 当前不可触达，底层路径由自动断言覆盖
2026-08-10：Stage 6 正式开始；第一 Batch“Click Trigger Editing — Single Clip Trigger + Step Number”完成实现，用户已通过三条必要人工 QA 路径
2026-08-10：第一 Batch 基于当前源码重新执行 45 项 domain 断言、27 项 Presentation / Export 回归、17 项 UI / App contract、Lint、Build、Diff 与 import-cycle 检查，全部通过
2026-08-10：Stage 6 第二 Batch“Multiple Clips in One Click Step”完成实现；Multiple Clips ownership、空 Step cleanup、Sequence-local timing、Presentation、standalone HTML Export、Undo / Redo 与 persistence 三条人工 QA 全部通过
2026-08-10：第二 Batch 基于当前源码重新执行 51 项 domain / runtime 断言、11 项 UI / App / import contract、Lint、Build、Diff 与 import-cycle 检查，全部通过
2026-08-10：Stage 6 第三 Batch“Step / Clip Grouping UI”完成实现；全局 Step 编号、selected-element filtering、动态重新分组、空 Step cleanup、Undo / Redo、persistence 与 Presentation 人工 QA 全部通过
2026-08-10：第三 Batch 基于当前源码重新执行 36 项 grouping query / domain / runtime 断言、16 项 UI / import contract、Lint、Build、Diff 与 import-cycle 检查，共 52 项专项断言全部通过
2026-08-10：Stage 6 第四 Batch“Click Step Reorder / Step Ordering UI”完成实现；全局/隐藏 Step、跨元素、multi-Clip whole-Sequence reorder、Undo / Redo、Sequence-local timing 与 persistence 三条人工 QA 全部通过
2026-08-10：第四 Batch 基于收尾源码重新执行 60 项 domain / global ordering / UI / App / Presentation / Export 断言、Lint、Build、Diff 与 import-cycle 检查，全部通过
2026-08-11：Stage 6 第五 Batch“Invalid Sequence Protection UI / Product Closure”完成；normal / protected capability、single-source effective Step query、command no-op、无自动文档修复与 Presentation query 对齐已闭环，三条人工 QA 结论为 PASSED（advanced UI 记录 MANUAL UI NOT REACHABLE / AUTOMATED COVERAGE PASSED）
2026-08-11：第五 Batch 基于收尾源码重新执行 101 项 invalid / protection / Batch 1–4 / UI / Presentation / Export 断言、Lint、Build、Diff 与 import-cycle 检查，全部通过；最终审查同时补强 reorder 对 omitted / duplicate / missing `sequenceOrder` 引用的保持
2026-08-11：Stage 7 第一 Batch“Timeline View Model Foundation”完成并通过三条人工 QA；animated-only Object rows、same Object multi-Clip、Sequence-local projection、Selection / Workspace 与 Presentation smoke 均通过
2026-08-11：Stage 7 第一 Batch 收尾重新执行 61 项综合回归、29 项 protection / purity 边界和 18 项 UI / App / domain static contract，共 108 项断言；Lint、Build、Diff 与 import-cycle 检查全部通过
2026-08-12：Stage 7 第二 Batch“Active Sequence / Sequence-local Playhead + Editor Phase Sampling”完成并通过三条人工 QA；Active Sequence、Sequence-local duration / time、completed / active / pending editor sampling、isolated preview return frame 与 Presentation smoke 均通过
2026-08-12：Stage 7 第二 Batch 收尾基于当前源码重新执行 157 项 Active Sequence / controller / Canvas / preview / Stage 6 / Batch 1 / Presentation / Export / UI-App 断言；Lint、Build、Diff 与 42 modules / 118 relative edges / 0 cycles 检查全部通过
2026-08-13：Stage 7 第三 Batch“Hierarchy Shell & Selection Contract”完成 Sequence → Object/Clip → Track → Keyframe 层级、typed selection / pure reconciliation、默认折叠 UX 与 external Clip reveal；初始三项 QA 和两项 final short QA 全部 PASS
2026-08-13：第三 Batch 收尾基于当前源码重新执行 35 项运行时断言与 22 项静态契约断言，共 57 项；Lint、Build、Diff 与 42 modules / 120 relative edges / 0 cycles 检查全部通过
2026-08-14：Stage 7 Batch 4A“Timing Edit Infrastructure + Clip startMs Direct Editing”完成；editor-only timing session、pure draft Canvas preview、normal/protected eligibility、0/grid/Playhead snapping、单次 History 与完整 pointer lifecycle 已通过三项人工 QA
2026-08-14：Batch 4A closeout 先执行 62 项完整覆盖断言，最终审查补强 unmount cleanup 后再对最终源码执行 31 项针对性断言，本轮实际共 93 项；Lint、Build、Diff 与 43 modules / 125 relative edges / 0 cycles 检查全部通过
2026-08-15：Stage 7 Batch 4B“Clip Base Duration Resize”完成；authored base duration right-edge resize、pure draft Canvas preview、fixed / auto Sequence、minimum-width visual / authored geometry 解耦、1ms 显示与完整 pointer / History lifecycle 已通过三项人工 QA（含 QA-1 minimum-width retest）
2026-08-15：Batch 4B closeout 基于最终源码重新执行 93 项定向回归断言；Lint、Build、Diff 与 43 modules / 118 relative edges / 0 cycles 检查全部通过，Build 仅保留既有 `> 500 kB` non-blocking warning
2026-08-15：Stage 7 Batch 4C“Single Keyframe Timing + Product Closure”完成；non-finite bounds / Inspector防线、single Keyframe marker offset drag、Sequence-local映射、pure draft Canvas preview、neighbor gap、single History与4A / 4B / 4C hit target closure通过三项人工QA
2026-08-15：Batch 4C closeout基于最终源码重新执行88项定向回归断言；Lint、Build、Diff与43 modules / 119 unique edges / 0 cycles检查全部通过，Build仅保留既有`> 500 kB`non-blocking warning
2026-08-16：Stage 7 Batch 5A“Multi-Keyframe Selection & Group Move”完成；same-Clip / cross-Track selection、explicit primary、Ctrl/Cmd与touch toggle、rigid shared delta、atomic command、editor-only draft、single History、empty-click fallback与4A / 4B / 4C / 5A hit-target closure通过三项人工QA及empty-click补充复测
2026-08-16：Batch 5A closeout基于最终源码重新执行118项断言；Lint、Build、Diff与43 modules / 122 relative edges / 0 cycles检查全部通过，Build仅保留既有`> 500 kB`non-blocking warning
2026-08-16：Stage 7 Batch 5B“Box Selection & Advanced Interaction Closure”完成；same-Clip / cross-Track visible editable marker Box、3px promotion、replacement / zero-hit fallback、local preview、完整cancel lifecycle与5A group move复用通过三项人工QA。QA-1首次发现Hooks-order + Vite HMR 500阻塞，`AnimationTimelineBoxSelectionBoundary`修复后复测PASS，blocker RESOLVED
2026-08-16：Batch 5B closeout基于最终源码重新执行90项定向断言与15项真实浏览器runtime检查，共105项；Lint、Build、Diff与44 modules / 124 relative edges / 0 cycles检查全部通过，React / Hooks runtime errors为0，Build仅保留既有`> 500 kB`non-blocking warning
2026-08-17：Stage 7 Batch 6“Region Loop”完成；App-owned editor-only Region、Slide + normal Active Sequence binding、1ms / 10ms、half-open modulo loop、outside seek、playing clear、isolated preview priority、dedicated lane、handles、shared sticky inset与完整pointer lifecycle通过三项人工QA
2026-08-17：Batch 6 closeout基于最终源码重新执行88项定向断言；Lint、Build、Diff与45 modules / 135 local edges / 0 cycles检查全部通过，Build仅保留既有`> 500 kB`non-blocking warning。当前浏览器控制实例为空，未虚报closeout browser automation；用户真实browser QA全部PASS
2026-08-17：Region QA同时观察到独立Editor pre-trigger baseline / Presentation sampling parity问题：delayed entrance Clip在start前no-contribution会保留static design state并提前可见；Batch 6未修改sampling，下一入口改为targeted boundary audit
当前状态：第 5.5 阶段 Batch 1、Batch 2A、Batch 2B、Batch 3A、Batch 3B-1、Batch 3B-2A、Batch 3B-2B、Batch 3C-1 与 Batch 3C-2 已验证完成；Stage 5.5 架构拆分暂停于稳定边界，Batch 3C-3、Batch 4 与 Batch 5 暂缓；Stage 6 整体 COMPLETE；Stage 7 第一至第三 Batch、Batch 4A、Batch 4B、Batch 4C、Batch 5A、Batch 5B与Batch 6 COMPLETE / MANUAL QA PASSED。Stage 7整体仍为IN PROGRESS，下一入口为“Stage 7 — Pre-trigger Baseline / Editor–Presentation Sampling Parity targeted boundary audit”
```

---

## 十一、下一位开发者的直接开发入口

当前入口：

- 第 2 阶段“单 Clip 预览 V1”已经由用户验证通过，并通过提交 `c7756b5` push。
- 第 3 阶段“Click Step 数据与命令层”已经用户验收，并通过提交 `975f109` push。
- 第 4 阶段“PPT 式放映控制器”核心功能已经用户人工验收并标记为已验证完成。
- Lint、Build、Diff、状态机专项断言和 pending / completed / active 采样优先级断言通过；项目没有自动化 `test` 脚本。
- 第 4 阶段代码已通过提交 `5391f11` commit 并 push。
- `App.tsx` 渐进式架构拆分计划已通过文档提交 `a9166c3` commit 并 push；第 5.5 阶段已开始，Batch 1 已验证完成并通过提交 `23e4901` push，Batch 2 前置只读架构审计已完成，Batch 2A 已验证完成并完成 commit / push。
- 第 4 阶段直接复用 Sequence-local time、`compileAnimationSequence` 和 Sequence 级公共计算规则，没有另建 Click Step 时间模型。
- 滚轮强制步进仍接入同一个 Presentation Playback Controller；普通推进锁保持不变，Wheel Down / Up 均遵守一次手势只跨一个确定状态边界，并已通过用户人工验收。
- 第 5 阶段“HTML 导出 Click Step 同步”已经完成代码实现、代码级检查和用户人工验收，正式标记为已验证完成。
- 第 5 阶段新增职责已进入 `exportPlaybackPlan.ts` 和 `exportPlayerRuntime.ts`，没有修改 `App.tsx` 或开始无关大重构。
- standalone HTML 必须先由用户点击“开始放映”；启动前没有播放状态或媒体 autoplay，启动点击只进入第一页并为后续有声媒体提供浏览器 user activation，该行为已经用户人工验收。
- Batch 2A 开始基线是 `bbc7f5d2bbf5403dcc2b0ede64014446cd258a3e docs: sync stage 5.5 architecture status`；Batch 2A 已通过 `refactor: extract project persistence` 完成 Git 闭环。
- 第 5.5 阶段 Batch 1 已完成人工验证、commit 和 push；不再存在“待验证”或“待 Git 闭环”状态。
- Batch 2 前置只读架构审计已完成。Stage 5.5 Batch 2A“Project persistence adapter”已验证完成并 push；Video Bug Part A 已解决并完成人工 QA / Git 闭环。Export 现象当前无法复现，不启动 speculative repair；Batch 2B“Project document + history transaction”及 final no-op 修复已通过全部人工 QA 并成为稳定架构基线。Batch 3A 最小 Sequence Command Domain 已通过人工 QA，并通过 `d68ce74` 完成独立 Git 闭环；Batch 3B-1 Pure Element Command Facade 已完成自动检查、人工 QA 与独立 Git 闭环。
- Pending Media Interaction Fix 已完成代码实现、自动检查和人工 QA，并纳入 `fix: sync pending media input ownership` 独立 Git 闭环；Batch 3B-2A、Batch 3B-2B、Batch 3C-1 与 Batch 3C-2 已验证完成。
- Stage 5.5 architecture refactor paused at a stable boundary。Batch 3C-3、Batch 4 与 Batch 5 为暂缓架构债务，不是当前 required next step；Stage 6 第一至第五 Batch 均已完成并通过人工 QA，Stage 6 整体 COMPLETE。
- Stage 7 第一 Batch“Timeline View Model Foundation”、第二 Batch“Active Sequence / Sequence-local Playhead + Editor Phase Sampling”、第三 Batch“Hierarchy Shell & Selection Contract”、Batch 4A“Timing Edit Infrastructure + Clip startMs Direct Editing”、Batch 4B“Clip Base Duration Resize”、Batch 4C“Single Keyframe Timing + Product Closure”、Batch 5A“Multi-Keyframe Selection & Group Move”、Batch 5B“Box Selection & Advanced Interaction Closure”与Batch 6“Region Loop”均已完成自动检查与人工QA；下一入口为“Stage 7 — Pre-trigger Baseline / Editor–Presentation Sampling Parity targeted boundary audit”。cross-Sequence move仍只是future candidate，Waveform继续Stage 11。
- Standalone Export Fullscreen Arrow-Key Seeking Fix 已完成根因修复、自动检查和人工 QA；浏览器原生 Video controls 继续负责全屏方向键 seek，Presentation 不消费这些按键。
- Presentation Element Click Blocking Fix 已完成根因修复、自动检查和人工 QA；bare Presentation 的普通展示元素 click 现在冒泡到统一推进路由，编辑模式选择与媒体控件输入保持不变。
- Presentation Transient Text Editing / Selection Fix 已完成根因修复、自动检查和人工 QA；bare Presentation 不再拥有双击 / textarea 编辑入口，Text / Shape / SVG 展示文字不再产生原生 Selection，编辑模式 textarea 语义保持不变。
- Hidden Media Playback Lifecycle 已完成根因修复、自动检查和 Editor / standalone HTML Audio / Video 人工 QA；稳定隐藏后 pause，同页重新显示保持暂停并保留 `currentTime`，跨页返回按新页面节点生命周期处理。
- Fullscreen Media Enter-Key Parity、Standalone Export Text Selection、编辑模式 Shift 多选文字高亮、Presentation 入口焦点 / Selection 防御性清理、Audio Native Controls Keyboard Shortcut Parity 与 `file://` 资源警告继续作为独立待处理项；本轮未实现这些问题。
- 原暂缓项目已经分配到第 7、9、10、11、12 阶段；不得提前并行开发。

### 下次第一步：安全检查

进入项目后完整读取两份维护文件，并执行：

```bash
git status --short --branch
git log --oneline --decorate -15
git diff
git diff --cached
```

不得直接执行 pull、reset、clean、rebase、merge、restore 或其他 Git 写操作。

### 第 5.5 阶段 Batch 2B 代码实现后的边界

1. 第 3 阶段数据与命令层已经用户验证，并通过提交 `975f109` push。
2. 第 5 阶段已实现独立 HTML 的 Click Step 同步；Click Step 编辑 UI 和 Timeline V2-C 仍未开发。
3. `AnimationClip.startMs` 继续只表示相对所属 Sequence 局部 0ms；运行时触发时间不进入持久化数据。`localTime < startMs` 时 Clip 不参与视觉合成，到达 `startMs` 后才从首 Keyframe 接管；该规则不依赖 preset ID 或动画类别。
4. 放映控制器直接使用 `AnimationSequence`、`sequenceOrder`、Sequence 级有效时长和 `compileAnimationSequence`。
5. 已完成 Sequence 和当前 Sequence 都以各自的局部时间采样，不存在 Click Step 页面绝对时间模型。
6. 正式放映只运行一个 rAF 调度循环，并与编辑器 Timeline、单 Clip 预览互斥。
7. 普通前进保护、滚轮强制前进 / 回退、切页恢复和媒体 / 可滚动控件保护已形成独立可测试阶段。
8. 旧项目继续保持默认 `slide-enter` 行为，原 `startMs` 数值无需迁移。
9. Marker 保持 Scene-level，归属方案留到 Timeline V2-C 前决定。
10. standalone HTML 在启动前不创建播放状态；一次真实“开始放映”点击只打开门闩并正常进入第一页，媒体 autoplay 不采用重试、强制静音或浏览器 hack。
11. 第 5 阶段代码实现、代码级检查、人工验收和 Git 闭环均已完成。
12. 第 5.5 阶段 Batch 1 首轮人工验收发现页面复制丢失 V2 关键帧；`slideOperations.ts` 已改为复制完整 Scene，用户复测通过，Batch 1 已验证完成并 push。
13. Batch 2A 只抽离 Project JSON 的 localStorage / normalization / legacy source 解析边界，并已验证完成并 push。
14. Batch 2B 已把 Project React state、`latestProjectRef`、History stacks、grouping、snapshot clone、mutation transaction、Undo / Redo 和跨历史快照 metadata transform 抽入 `useProjectDocument` / `projectHistory`；autosave readiness gate、asset Blob lifecycle、selection、playback 与 Timeline 仍在原职责边界。
15. Video animation / compositor 生命周期问题与 persistence adapter 和 Batch 2B 无关；Part A Presentation 已修复并通过人工 QA。Export Video animation invisible 当前无法复现且未修改 Export implementation；全屏发白为 environment-specific observation，不增加 workaround。
16. Batch 2B 已通过完整人工 QA 与 final no-op / Redo preservation 专项 QA，正式标记为已验证完成并作为稳定架构基线。
17. Batch 3A 已提取独立 Sequence / Click Step Command Domain 并保留 `animationCommands.ts` compatibility barrel；人工 QA 已通过并通过 `d68ce74` 完成 Git 闭环，未改变动画时间语义。
18. Pending Media Interaction Fix 已实现 sampled-state input owner、Editor / Export DOM bridge、pointer / focus gate 与 fullscreen override，并通过自动检查和人工 QA；播放生命周期继续由独立 Hidden Media Playback Lifecycle 边界负责。
19. Standalone Export Fullscreen Arrow-Key Seeking Fix 已通过最小 export 键盘路由修改恢复浏览器原生 seek，并通过自动检查和人工 QA；Fullscreen Media Enter-Key Parity 单独保留为待处理 UX。
20. Presentation Element Click Blocking Fix 已通过 bare wrapper 条件事件挂载恢复普通展示元素的统一 click 推进，并通过自动检查和人工 QA。
21. Presentation Transient Text Editing / Selection Fix 已从 `isEditing`、`onStartEditing`、`onDoubleClick` 和 bare 展示样式四个边界关闭 Presentation 的 textarea / 原生 Selection 路径，并通过自动检查和人工 QA；standalone export 文字选择、编辑模式 Shift 多选高亮和 Presentation 入口主动 blur / Selection 清理仍是独立待处理项。
22. Hidden Media Playback Lifecycle 使用共享稳定隐藏 reason、Editor ref 与 Export WeakMap 实现 transition-only pause，并通过 Editor / standalone HTML Audio / Video 人工 QA；同页隐藏 / 显示保留 `currentTime` 且不自动恢复播放，跨页不承诺保留媒体进度。
23. Batch 3B-1 已新增 Project 级 Pure Element Command Facade 并迁移基础插入、更新、精确 style patch、图层和删除变换；App 继续拥有 History、Selection、交互与 Asset 生命周期。
24. Batch 3B-2A 已新增 Pure Animation Element Clone Kernel；旧元素动画复制 API 已委托该内核，确定性 ID、深复制、跨页 trigger 与 `slide-enter` 合并语义已经用户 QA 和自动断言确认。
25. Batch 3B-2B 已新增 Pure Element Clone Facade，并统一 Keyboard、元素右键和画布右键的 Copy / Paste / Duplicate 文档变换路由；clipboard ref、History、Selection、坐标换算、Asset 生命周期和 UI orchestration 继续由 App 拥有。
26. Batch 3C-1 已新增纯 Keyframe Command Domain 与 Shared Rules；五个 V2 Keyframe 命令、Inspector 边界规则、确定性 operation ID、深复制及 no-op / revision 语义已通过自动断言和人工 QA，legacy / V2 compatibility、Scene cleanup、Clip / Preset / Timing 仍留给后续独立 Batch。
27. Batch 3C-2 已把 legacy / V2 incremental sync、Scene cleanup 与 live query 提取到 `animationLegacyCompatibility`，并把低层 ownership cleanup 集中到 `animationCommandHelpers`；Compatibility barrel 只 re-export，Element Commands 直接依赖低层 domain。3C-2 已通过自动检查和人工 QA；3C-3、Batch 4 与 Batch 5 暂缓，不阻塞 Stage 6。
28. Stage 6 第一 Batch 已建立单 Clip `slide-enter` ↔ page-click 切换、Step N 派生显示、确定性新 Click Sequence、Sequence-local `startMs` 保留、空 Sequence / `sequenceOrder` 清理和 advanced trigger 保护；History、Preview 与 Project timestamp 继续由 App orchestration 拥有。
29. Stage 6 第二 Batch 已允许一个 page-click Sequence 通过既有 `clipIds` 包含多个 Clip；加入已有 Step 保留 Clip / Track / Keyframe 和 Sequence-local `startMs`，维护唯一 ownership、源空 Step / `sequenceOrder` cleanup 与自动 Step renumbering。Inspector → FloatingPanel → App → Sequence command 继续保持 semantic routing，一个动作一个 History transaction，advanced trigger 与 no-op 保持保护。
30. Stage 6 第三 Batch 已新增纯 `getAnimationClipGroups(scene)` 查询与 Inspector Step / Clip grouping UI；全局 page-click Step 编号在 selected-element filtering 之前派生，同一 Sequence 的 Clip 保持 `clipIds` 顺序，missing、duplicate ownership、orphan、advanced trigger 与额外 `slide-enter` ownership 均有安全呈现规则。该 Batch 不修改 schema、History、App orchestration、Presentation / Export runtime，也未实现 Step reorder。
31. Stage 6 第四 Batch 已在 page-click group header 提供全局 Step 上移/下移，并复用 `moveAnimationClickStepInSlide`；`getAnimationPageClickSteps` 统一有效 reorder 集合，当前元素非连续可见 Step 仍与隐藏的全局相邻 Step 调换。multi-element / multi-Clip Sequence 整体移动，`clipIds`、Clip/Track/Keyframe、Sequence-local `startMs`、trigger 与 playback 保持；App 继续拥有单次 History transaction 与 actual-only Preview cleanup。
32. Stage 6 第五 Batch 已建立 `getAnimationClipOwnerSequences`、`getAnimationPrimarySlideEnterSequence`、`getAnimationClipStage6Capabilities` 与共享 `getAnimationPageClickSteps`，把 empty / missing-only / advanced / ambiguous / orphan / additional slide-enter / omitted state 排除在普通编辑路径之外；UI 只读保护与 command no-op 双层兜底，不执行自动文档修复。Presentation 仅对齐 effective Step query，Export runtime 未修改；Stage 6 整体 COMPLETE。
33. Stage 7 第一 Batch 已新增纯 `animationTimeline.ts` / `getAnimationTimelineViewModel`，统一 normal / protected Sequence、global Step number、canonical Clip、animated Object row、target、Track / Keyframe、semantic duration 与 diagnostics 读取模型；App 只做 `useMemo` orchestration，Timeline 不再遍历全部元素创建空行。Sequence-local `startMs`、旧 Playhead/controller、Canvas sampling、Presentation 与 Export 语义在第一 Batch 未修改，随后由第二 Batch 单独迁移 editor timing path。
34. Stage 7 第二 Batch 已建立唯一 editor-only Active Sequence、Slide + Sequence controller context、Sequence-local semantic duration / Playhead，以及 completed / active / pending editor phase samples；pending 对 Canvas 无 contribution，completed + active 继续由既有 compiler / compositor 合成。`SlideCanvas` 普通 V2 editor path 已迁移，isolated preview 恢复 local return frame；Presentation formal samples 与 standalone Export runtime 保持独立且未修改。
35. Stage 7 第三 Batch 已建立 Sequence → Object/Clip → Track → Keyframe 层级、真实 ID typed selection、pure reconciliation / delete fallback、Sequence 默认展开 / Clip 默认折叠与 external Clip reveal；selection、reveal、playback 分离，same-Preset 独立 Clip 与 true multi-target canonical 规则已通过自动断言和人工 QA。
36. Stage 7 Batch 4A 已新增 `animationTimelineTiming.ts` 与 App editor-only timing session，使用 pure draft Slide 驱动 Timeline / editor samples / existing SlideCanvas；normal Clip bar body drag 仅提交 Sequence-local `startMs`，pointermove 不修改 document，0/grid/Playhead snapping、3px drag threshold、6px snap threshold、10ms precision、protected gate、cancel、单次 History、Undo / Redo 与 no-op 均通过自动断言和人工 QA。
37. Stage 7 Batch 4B 已在同一 timing session 中增加 normal Clip visual right-edge authored base duration resize；candidate 始终基于 source authored duration 与 pointer delta，最低 1ms，minimum 12px 只属于 rendering / hit testing，fixed / auto Sequence、multi-target / same-Preset、pure draft Canvas、单次 commit、cancel / no-op、protected gate 与 Presentation / Export 隔离均已验证。
38. Stage 7 Batch 4C 已在同一timing session中增加single Keyframe marker offset drag；non-finite bounds与Inspector同步锁定且不repair，Sequence-local mapping / inverse mapping、0..1、neighbor 0.001 gap、10ms precision、grid / Playhead snapping、pure draft Canvas、真实ID selection、V2-only command与single History均已验证。4A / 4B / 4C direct timing editing COMPLETE；Stage 7因multi-Keyframe、区域循环与Marker等剩余正式路线仍为IN PROGRESS。
39. Stage 7 Batch 5A 已将唯一`AnimationTimelineSelection`扩展为same-Clip / cross-Track multi-Keyframe真实ID selection与explicit primary；Ctrl/Cmd和touch mode负责toggle，selected marker作为anchor，通过纯group bounds交集、0.001 outside gap、single snap / rigid delta、all-or-nothing batch command、editor-only draft与one History完成group move。ordinary empty Timeline click回退Active Clip且不修改document；Box、cross-Clip / cross-Sequence group、Region Loop与Marker editing未实现，Stage 7仍为IN PROGRESS。
40. Stage 7 Batch 5B 已新增co-located Box hook与稳定Hooks Boundary，从展开Track empty time background以multi-select drag或desktop Shift+drag启动same-Clip / cross-Track框选；只命中visible editable DOM marker rect，使用replacement、deterministic primary与zero-hit Clip fallback，pointermove仅local preview，pointerup一次semantic selection，external scroll / Escape / cancel / lost capture / context / unmount安全清理。首版no edge auto-scroll，直接复用5A selection / rigid group move，不修改Project / History / revision；Region Loop、Marker与advanced snapping仍未开始。
41. Stage 7 Batch 6 已新增App-owned editor-only Region `{slideId, sequenceId, startMs, endMs}`与纯`animationTimelineRegion`规则；Region绑定当前Slide + normal Active Sequence且无cache，使用semantic duration、1ms minimum、10ms precision与`[start,end)`modulo wrap。controller optional loopRange不进入context，manual outside seek、Stop 0、playing Clear、isolated preview priority、dedicated Region lane、one-shot create、non-crossing handles、committed duration reconciliation、shared sticky inset与0 History / revision / persistence均已通过自动检查和人工QA；无whole-region drag、无snapping。下一入口为pre-trigger sampling parity targeted audit。

### Git 状态说明

- 第 5.5 阶段 Batch 1 开始基线：`f29b25546009a8b375f2ae61c825418a3325be88`。
- Batch 1 正式提交：`23e49015384380b48231e9e65d2f42adce57fc6c refactor: extract low risk editor boundaries`。
- 第 5 阶段已通过提交 `f29b255 feat: sync click steps in html export` commit 并 push。
- 第 5.5 阶段 Batch 1 开始前工作区和暂存区干净。
- Batch 1 提交范围固定为 9 个文件：`PROJECT_STATUS.md`、`src/App.tsx`、3 个 editor component 共享契约消费者、Timeline Hook，以及 3 个新增职责模块。
- Batch 1 已验证完成并完成 commit / push。
- Batch 2A 开始时 `main`、本地 `origin/main` 均为 `bbc7f5d2bbf5403dcc2b0ede64014446cd258a3e`，ahead 0、behind 0。
- Batch 2A 开始前工作区和暂存区均干净。
- Batch 2A 正式提交范围只有 `PROJECT_STATUS.md`、`src/App.tsx` 和新增 `src/utils/projectPersistence.ts`，提交信息为 `refactor: extract project persistence`。
- Batch 2A 已完成人工验证、commit 和 push；`main` 与 `origin/main` 同步，工作区和暂存区干净。
- Video Bug Part A 开始基线：`dac4fe2a28c988da7285d71f101fa2ecfc0ee8c8`。
- Part A 正式提交范围仅包含 `PROJECT_STATUS.md`、`src/components/editor/SlideCanvas.tsx` 和新增 `src/utils/deterministicAnimationLifecycle.ts`，提交信息为 `fix: stabilize deterministic presentation animations`。
- Part A 已完成人工验证、commit 和 push；`main` 与 `origin/main` 同步，工作区和暂存区干净。
- Batch 2B 开始基线：`main`、本地 `origin/main` 均为 `291f1c87d426fcdd8b7eb473046fd4c591cfebdf`，ahead 0、behind 0，开始前工作区和暂存区干净。
- Batch 2B 最终提交范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/hooks/useProjectDocument.ts`、`src/utils/projectHistory.ts`，提交信息为 `refactor: extract project document history`；本次 Git 闭环不包含 Batch 3。
- Batch 3A 开始基线：`main`、本地 `origin/main` 均为 `8a460e339a1300bef157faaadeea33f744daebd8`，ahead 0、behind 0，开始前工作区和暂存区干净。
- Batch 3A 已通过用户人工 QA，并通过 `d68ce742644158f6b90c126c2a0b7d3ad757ba4d refactor: extract animation sequence commands` 完成独立 Git 闭环；`main` 与 `origin/main` 在本轮修复开始前同步。
- Hidden Media Playback Lifecycle 开始基线：`main`、本地 `origin/main` 均为 `11d1372160f4104642642f69173f4a4b05ee63e4`，ahead 0、behind 0；最终提交范围固定为 `PROJECT_STATUS.md`、`src/components/editor/SlideCanvas.tsx`、`src/utils/exportHtml.ts`、`src/utils/exportPlayerRuntime.ts`、`src/utils/presentationInteraction.ts`，提交信息为 `fix: pause hidden presentation media`。
- Batch 3B-1 开始基线：`main`、本地 `origin/main` 均为 `5b1197cb71763ed28f788a7253bcb4e7885730b5`，ahead 0、behind 0，开始前工作区与暂存区干净；最终提交范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/utils/elementCommands.ts`，提交信息为 `refactor: extract basic element commands`。
- Batch 3B-2A 开始基线：`main`、本地 `origin/main` 均为 `3aab46ef212b2b59210f146d30d2a11e47db8770`，ahead 0、behind 0，开始前工作区与暂存区干净；最终提交范围固定为 `PROJECT_STATUS.md`、`src/utils/animationCommands.ts`、`src/utils/animationElementClone.ts`，提交信息为 `refactor: extract animation element clone kernel`。
- Batch 3B-2B 开始基线：`main`、本地 `origin/main` 均为 `ace9b08ec7507706c36728433553399bb75454f1`，ahead 0、behind 0，开始前工作区与暂存区干净；最终提交范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/utils/elementCloneCommands.ts`，提交信息为 `refactor: extract element clone facade`。
- Batch 3C-1 开始基线：`main`、本地 `origin/main` 均为 `cc015fc22fc4aff5bf228c40b2b2742f1b78db48`，ahead 0、behind 0，开始前工作区与暂存区干净；最终提交范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationFloatingPanel.tsx`、`src/components/editor/AnimationTrackInspector.tsx`、`src/utils/animationCommands.ts`、`src/utils/animationKeyframeCommands.ts`、`src/utils/animationKeyframeRules.ts`，提交信息为 `refactor: extract keyframe commands`。
- Batch 3C-2 开始基线：`main`、本地 `origin/main` 均为 `76f35fcdcc36fa49471f9f9271b37a6b166d789f`，ahead 0、behind 0，开始前工作区与暂存区干净；最终提交范围固定为 `PROJECT_STATUS.md`、`src/utils/animationLegacyCompatibility.ts`、`src/utils/animationCommandHelpers.ts`、`src/utils/animationCommands.ts`、`src/utils/elementCommands.ts`，提交信息为 `refactor: extract animation compatibility`。
- Stage 6 第一 Batch 开始基线：`main`、本地 `origin/main` 均为 `e11453d8de06c678f8820394f6a668d2884bf5e8`，ahead 0、behind 0，开始前工作区与暂存区干净。
- Stage 6 第一 Batch 最终范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationFloatingPanel.tsx`、`src/components/editor/AnimationTrackInspector.tsx`、`src/utils/animationCommands.ts`、`src/utils/animationSequenceCommands.ts`，提交信息为 `feat: add clip trigger editing`。
- Stage 6 第二 Batch 开始基线：`main`、本地 `origin/main` 均为 `0b566c1aa3730f6c543d419f9522fcab561cfd40`，ahead 0、behind 0，开始前工作区与暂存区干净。
- Stage 6 第二 Batch 最终范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationFloatingPanel.tsx`、`src/components/editor/AnimationTrackInspector.tsx`、`src/utils/animationCommands.ts`、`src/utils/animationSequenceCommands.ts`，提交信息为 `feat: group clips in click steps`。
- Stage 6 第三 Batch 开始基线：`main`、本地 `origin/main` 均为 `c6ceddada0aa73bd547f88cdc9a432f6f58695b5`，ahead 0、behind 0，开始前工作区与暂存区干净。
- Stage 6 第三 Batch 最终范围固定为 `PROJECT_STATUS.md`、`src/components/editor/AnimationTrackInspector.tsx`、`src/utils/animationCommands.ts`、`src/utils/animationSequenceCommands.ts`，提交信息为 `feat: group animation clips by step`。
- Stage 6 第四 Batch 开始基线：`main`、本地 `origin/main` 均为 `286c9d48abb0f0be530dec50aec0735a0738e0ce`，ahead 0、behind 0，开始前工作区与暂存区干净。
- Stage 6 第四 Batch 最终范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationFloatingPanel.tsx`、`src/components/editor/AnimationTrackInspector.tsx`、`src/utils/animationSequenceCommands.ts`，提交信息为 `feat: reorder click steps`。
- Stage 6 第五 Batch 开始基线：`main`、本地 `origin/main` 均为 `1eece89743205ba69720fbf91b2d3091800fc99f`，ahead 0、behind 0，开始前工作区与暂存区干净。
- Stage 6 第五 Batch 最终范围固定为 `PROJECT_STATUS.md`、`src/components/editor/AnimationTrackInspector.tsx`、`src/utils/animationCommands.ts`、`src/utils/animationSequence.ts`、`src/utils/animationSequenceCommands.ts`、`src/utils/presentationPlayback.ts`，提交信息为 `feat: protect invalid animation sequences`。
- Stage 7 第一 Batch 开始基线：`main`、本地 `origin/main` 均为 `2798fed27c73b3c10f72dca05b0dad23cca2d63a`，ahead 0、behind 0，开始前工作区与暂存区干净。
- Stage 7 第一 Batch 最终范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationTimeline.tsx`、`src/utils/animationTimeline.ts`，提交信息为 `feat: add timeline view model`。
- Stage 7 第二 Batch 开始基线：`main`、本地 `origin/main` 均为 `afea4efd90df2629ea2f145e97c1f86d81499b61`，ahead 0、behind 0；开始前工作区已有且仅有本 Batch 的 5 个未暂存源码修改，暂存区为空，`PROJECT_STATUS.md` 尚未修改。
- Stage 7 第二 Batch 最终范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationTimeline.tsx`、`src/components/editor/SlideCanvas.tsx`、`src/hooks/useTimelinePlaybackController.ts`、`src/utils/animationTimeline.ts`，提交信息为 `feat: add sequence-local timeline playback`。
- Stage 7 第三 Batch 开始基线：`main`、本地 `origin/main` 均为 `7d8ada20f4875228bef7a993dc4aa14a370b6242`，ahead 0、behind 0；开始前工作区和暂存区干净。
- Stage 7 第三 Batch 最终范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationTimeline.tsx`、`src/utils/animationTimeline.ts`，提交信息为 `feat: add timeline hierarchy and selection`。
- Stage 7 Batch 4A 开始基线：`main`、本地 `origin/main` 均为 `bf999ca1795c8eb4908e4d8c539fd635eec04c2a`，ahead 0、behind 0；开始前工作区和暂存区干净。
- Stage 7 Batch 4A 最终范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationTimeline.tsx`、`src/utils/animationTimelineTiming.ts`，提交信息为 `feat: add timeline clip start editing`。
- Stage 7 Batch 4B 开始基线：`main`、本地 `origin/main` 均为 `294ea504be646a6d37661f0c3b05342856c7d00c`，ahead 0、behind 0；closeout 开始前只有 `src/App.tsx`、`src/components/editor/AnimationTimeline.tsx`、`src/utils/animationTimelineTiming.ts` 三个未暂存源码修改，暂存区为空，`PROJECT_STATUS.md` 尚未修改。
- Stage 7 Batch 4B 最终范围固定为 `PROJECT_STATUS.md`、`src/App.tsx`、`src/components/editor/AnimationTimeline.tsx`、`src/utils/animationTimelineTiming.ts`，提交信息为 `feat: add timeline clip duration editing`。
- Stage 7 Batch 4C 开始基线：`main`、本地`origin/main`均为`7af7341c23d2c077d21a03faa5f272831d79a2cd`，ahead 0、behind 0；closeout开始前只有`src/components/editor/AnimationTimeline.tsx`、`src/components/editor/AnimationTrackInspector.tsx`、`src/utils/animationKeyframeCommands.ts`、`src/utils/animationKeyframeRules.ts`、`src/utils/animationTimeline.ts`、`src/utils/animationTimelineTiming.ts`六个未暂存源码修改，暂存区为空，`PROJECT_STATUS.md`尚未修改。
- Stage 7 Batch 4C 最终范围固定为`PROJECT_STATUS.md`与上述六个源码文件，提交信息为`feat: add timeline keyframe timing editing`。
- Stage 7 Batch 5A 开始基线：`main`、本地`origin/main`均为`345b9884e5fa8c699ea00ab104bac76553b393e4`，ahead 0、behind 0；closeout开始前只有`src/App.tsx`、`src/components/editor/AnimationFloatingPanel.tsx`、`src/components/editor/AnimationTimeline.tsx`、`src/components/editor/AnimationTrackInspector.tsx`、`src/utils/animationCommands.ts`、`src/utils/animationKeyframeCommands.ts`、`src/utils/animationKeyframeRules.ts`、`src/utils/animationTimeline.ts`与`src/utils/animationTimelineTiming.ts`九个未暂存源码修改，暂存区为空，`PROJECT_STATUS.md`尚未修改。
- Stage 7 Batch 5A 最终范围固定为`PROJECT_STATUS.md`与上述九个源码文件，提交信息为`feat: add multi-keyframe timeline editing`。
- Stage 7 Batch 5B 开始基线：`main`、本地`origin/main`均为`aed24ef510276546bcf4e3ae3ffd69ab44c58a1a`，ahead 0、behind 0；closeout开始前只有`src/components/editor/AnimationTimeline.tsx`与新增`src/components/editor/useAnimationTimelineBoxSelection.ts`两个未暂存源码修改，暂存区为空，`PROJECT_STATUS.md`尚未修改。
- Stage 7 Batch 5B 最终范围固定为`PROJECT_STATUS.md`、`src/components/editor/AnimationTimeline.tsx`与`src/components/editor/useAnimationTimelineBoxSelection.ts`，提交信息为`feat: add timeline box selection`。
- Stage 7 Batch 6 开始基线：`main`、本地`origin/main`均为`9807f96983c04bd235357567100a48af5b364f14`，ahead 0、behind 0；closeout开始前只有`src/App.tsx`、`src/components/editor/AnimationTimeline.tsx`、`src/hooks/useTimelinePlaybackController.ts`与新增`src/utils/animationTimelineRegion.ts`四个未暂存源码修改，暂存区为空，`PROJECT_STATUS.md`尚未修改。
- Stage 7 Batch 6 最终范围固定为`PROJECT_STATUS.md`与上述四个源码文件，提交信息为`feat: add timeline region looping`。

未经用户允许，不得 commit 或 push。
