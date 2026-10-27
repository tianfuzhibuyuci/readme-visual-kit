# 发布材料与步骤

本仓库地址：https://github.com/tianfuzhibuyuci/readme-visual-kit

以下是发布与推广检查清单；实际部署状态以 GitHub Actions 和 Pages 页面为准，不虚构 Stars。

## 仓库建议

- 名称：`readme-visual-kit`（仓库已创建）
- 描述：Three source-referenced README diagrams. Local SVG renderer + agent skill. No API key.
- Topics：`readme`、`svg`、`developer-tools`、`agent-skills`、`documentation`、`diagrams`
- 许可证：MIT，完整文本已包含。

## 发布前

1. 运行 `npm test`，核对 `docs/QA.md`。
2. 打开 `docs/gallery/index.html`，确认示例效果符合你的预期。
3. 检查没有混入私人源码、密钥或本机路径；将来给真实项目生成时特别检查 evidence 输出。
4. 在你自己的 GitHub 账户创建一个空仓库，然后按 GitHub 页面给出的命令添加 remote 并推送。本地压缩包不包含 Git 登录凭证。
5. 如需在线演示，在仓库 Pages 设置中选择发布分支的 `/docs`，入口已准备好。是否可用以你账户和仓库的实际设置为准。

## 第一条介绍文案

我做了一个很小的开源工具：把项目说明变成三张 README 图——功能流程、简化架构、快速上手。

它不是“AI 随便画图”：每个节点附源码文件和行号，生成明暗 SVG、可编辑 JSON 和离线预览。Node.js 本地运行，无额外 API Key。

目前带了 CLI、中文网页、Python 库三个自建示例。最想知道的是：你项目的 README 哪一段最难让新人看懂？欢迎拿真实项目试试，告诉我哪里画得不对。

发布时补上**实际**仓库与演示地址，不编造用户数、效果提升或采用案例。

## 争取真实反馈

先邀请几位有项目的同学/开发者试用，记录他们是否成功生成第一张图。用获准公开的前后对比图介绍工具，针对真实问题迭代。遵守社区发帖规则，避免批量骚扰、互 Star 交换、买星或要求先 Star 才能使用。

100 Star 是你的课程目标，不是这个工具可以保证的结果。优先验证“别人愿不愿意实际用”，再推广。
