# Animify 项目状态

> 最后更新：2026-07-24  
> 仓库：`https://github.com/Sharofanar/Animify`  
> 主分支：`main`  
> GitHub 已知最新基线：`ba1cecc Add unified timeline playback controller`

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

当前已知 GitHub `origin/main` 最新提交：

```text
ba1cecc Add unified timeline playback controller
```

该提交之前已知的连续功能提交包括：

```text
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
- 本功能尚未 commit 或 push。

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

- 编译器目前主要自动处理 `slide-enter` Sequence。
- Click、Hover、Keyboard、Media Time 等触发方式尚未完整接入运行时。

状态：**代码已实现，非 `slide-enter` 触发仍待开发**

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

# 单 Clip 预览 V1

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
- 未执行 git add、commit、push、pull、merge、rebase、reset、clean、restore 或 PR 操作。
- `PROJECT_STATUS.md` 和 `DEVELOPMENT_RULES.md` 仍为未跟踪维护文件。

下一项计划任务：

- 第 3 阶段“Click Step 数据与命令层”。
- 当前仅完成路线图整理，尚未开始第 3 阶段代码开发。

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

目标：

- 使用现有 `AnimationSequence` 作为动画步骤的主要组织结构。
- 明确区分页面进入自动播放和点击后播放。
- 一个点击步骤可以包含一个或多个 Clip。
- 使用稳定、可持久化的步骤顺序。
- 编辑步骤触发方式必须进入 Undo 和 Redo。
- 旧项目继续使用默认 `slide-enter` 行为。
- 不破坏现有 Animation Schema V2 数据。

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

- Click Step 数据与命令层完成。
- 单 Clip 播放能力稳定。

### 第 5 阶段：HTML 导出 Click Step 同步

目标：

- 导出 HTML 使用与编辑器放映一致的步骤顺序。
- 相同快捷键产生相同行为。
- 相同触发规则产生相同动画。
- 最后一个步骤后再切换页面。
- 媒体控件和全屏视频继续保留正确行为。
- 导出文件不依赖 Animify 编辑器运行环境。
- 导出后的资源可以正常读取。

需要检查的文件：

```text
src/utils/exportHtml.ts
src/utils/animationCompiler.ts
src/types/presentation.ts
```

依赖：

- 编辑器放映中的 Click Step 行为先稳定。
- 不允许编辑器与导出端分别设计两套不一致的规则。

### 第 6 阶段：Click Step 编辑界面

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

### 第 7 阶段：Timeline V2-C

计划内容：

- 在 Timeline 上显示动画步骤分组。
- 拖动 Clip 调整开始时间。
- 拖动 Clip 边缘调整持续时间。
- 直接拖动单个关键帧。
- 框选多个关键帧并批量移动。
- 展开和折叠多条属性轨道。
- 提供区域循环和 Marker 编辑。
- 为音频等可用媒体显示波形。
- 提供统一的多层吸附、边界和冲突提示。
- 拖动期间实时预览。
- 一次拖动只生成一个 Undo 记录。
- 禁止产生负时间、无效持续时间或非法关键帧顺序。
- Timeline 操作与高级动画编辑器保持同步。

依赖：

- Click Step 的步骤含义已经确定。
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
- 单 Clip 预览和 Click Step 将继续增加播放状态。

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

- `App.tsx` 已承担大量项目状态、历史、资源、动画和放映逻辑。

优化目标：

- 按真实职责拆分 Hook 或控制器。
- 保持现有行为不变。
- 每次只拆分当前功能直接相关的部分。
- 不进行一次性大规模重构。

适合插入阶段：

- Click Step
- 放映控制器
- 资源功能后续维护

### 3. 关键帧公共规则统一

现状：

- 关键帧排序、边界、插值和间隔规则可能分散在检查器、命令层和编译器中。

优化目标：

- 使用统一工具函数。
- UI、命令层和编译器采用相同边界规则。
- 防止出现 UI 允许但命令拒绝，或预览与导出结果不同。

适合插入阶段：

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

### 1. 当前没有确认中的严重 Bug

截至本文档建立时，没有取得最新版上的明确崩溃、数据损坏或无法启动报告。

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

现象：

- 当前放映模式中的空格、Enter、右方向键和 PageDown 主要用于切换页面。

分类：

- 在 Click Step 尚未实现前属于现有正常行为。
- 完成 Click Step 后必须改为“先推进动画步骤，步骤结束后再翻页”。

### 5. 非 `slide-enter` Trigger 不自动播放

现象：

- 类型中已经存在 Click、Hover、Keyboard、Media Time 和 Manual。
- 当前编译器主要自动处理 `slide-enter`。

分类：

- 明确的阶段性限制。
- 不是 Bug。
- Click Step 将在当前 V1 主线接入。
- Hover、指定对象点击、指定键盘按键、媒体时间和手动 API 已归入第 9 阶段“扩展动画触发系统 V2”。

### 6. Timeline 不能直接拖动编辑 Clip

现象：

- 当前 Timeline 主要用于显示、选择、缩放、滚动、Seek 和播放。

分类：

- Timeline V2-B 的正常边界。
- 拖动 Clip 和调整持续时间属于 Timeline V2-C。

### 7. 每条基础轨道至少保留两个关键帧

现象：

- 只剩两个关键帧时删除按钮禁用。
- 关键帧之间保留最小间隔。
- 关键帧不能互相穿越。

分类：

- 基础模式的正确保护行为。
- 不是 Bug。

### 8. 媒体控件阻止放映快捷键

现象：

- 视频或音频控件获得焦点时，空格等按键不推进页面。
- 全屏视频期间，放映导航被限制。

分类：

- 正确行为。
- 用于避免媒体播放操作误触发页面切换。

### 9. FLV 资源不能直接在画布播放

分类：

- 资源可以进入资源管理范围，但专用播放或转码兼容层尚未实现。
- 已归入第 11 阶段“媒体编辑、波形与兼容性 V2”。
- 不是当前 Bug。

### 10. 历史本地提交不能直接 push

现象：

- 历史临时工作副本中的 `490bd24` 落后远端多个提交。

分类：

- Git 基线分叉风险。
- 不是产品功能 Bug。
- 必须在新本地环境中安全处理。

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
- 多页面 Click Step：尚未实现

### 单 Clip 预览 V1 代码检查

- Lint：`npm.cmd run lint` 通过，0 error、0 warning。
- Build：`npm.cmd run build` 通过。
- 自动化测试：项目未定义 `test` 脚本。
- Diff：已检查变更范围和关键播放、清理路径；`git diff --check` 通过，仅输出行尾转换提示。
- 人工功能测试：首轮发现停止状态显示不同步；修复后用户复测正常，单 Clip 预览 V1 已验证完成。

### 阶段转换记录

```text
2026-07-24：第 0 阶段经 Work 复核后正式结束
2026-07-24：进入第 1 阶段最新基线人工回归
2026-07-24：用户明确反馈功能测试正常，第 1 阶段验证完成
2026-07-24：第 2 阶段“单 Clip 预览 V1”代码实现完成
2026-07-24：用户测试发现高级工作区与 Timeline 的停止状态显示不同步
2026-07-24：状态显示根因已修复，Lint、Build 和 Diff 检查通过
2026-07-24：用户反馈修复后测试正常，第 2 阶段已验证完成
当前状态：第 2 阶段“单 Clip 预览 V1”已验证完成，尚未 commit 或 push
下一计划任务：第 3 阶段“Click Step 数据与命令层”，尚未开始开发
```

---

## 十一、下一位开发者的直接开发入口

当前入口：

- 第 2 阶段“单 Clip 预览 V1”已经由用户验证通过。
- Build、Lint 和 Diff 检查通过；项目没有自动化 `test` 脚本。
- 当前变更尚未执行 git add、commit 或 push。
- 下一计划任务是第 3 阶段“Click Step 数据与命令层”，但尚未开始，必须等待用户明确要求。
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

### 第 3 阶段开始前的边界

1. 只开发 Click Step 数据与命令层，不同时开发放映控制器或编辑界面。
2. 优先复用现有 `AnimationSequence`、Schema V2 和动画命令层。
3. 旧项目继续保持默认 `slide-enter` 行为。
4. 触发方式修改必须进入保存恢复、Undo 和 Redo。
5. 先确定数据形态、迁移与无效引用清理规则，再修改 UI。
6. 完成独立可测试阶段后停止，不自动进入第 4 阶段。

### Git 状态说明

- 建议的 commit 文案由本轮对话提供，但当前没有 commit 授权，也没有执行 commit。
- 只有用户明确允许后，才能暂存并提交当前源代码与维护文件。
- commit 不等于 push；push 仍需单独授权。

未经用户允许，不得 commit 或 push。
