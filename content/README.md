# 内容填写说明

## 个人档案

编辑 `content/profile.json`。不想公开的字段可以留空，页面不会显示空内容。

### 添加比赛经历

在 `competitions` 中复制模板项，填写 `title`、`date` 和 `image`，有奖项时再填 `award`，完成后把 `draft` 改成 `false`。证明图片放在 `public/profile/competitions/`，路径写成 `/profile/competitions/文件名.webp`。`description` 可以留空。

### 添加 GitHub 项目

在 `githubProjects` 中复制模板项，填写 `name`、`description` 和 `href`，完成后把 `draft` 改成 `false`。

保留 `draft: true` 的模板不会显示在网站上。

## 新增一篇记录

1. 复制 `content/records/_template.md`。
2. 按年份保存，例如 `content/records/2026/first-competition.md`。
3. 把 `draft` 改成 `false` 后，文章才会出现在网站上。
4. 图片放到 `public/records/年份/文章名/`，在 Markdown 中使用以 `/records/` 开头的路径。

文件名使用小写英文、数字和连字符，文章标题可以正常使用中文。

文章不需要分类。`tags` 可以留空，等内容积累后再决定是否增加筛选功能。

如果希望某篇经历出现在“档案”页，把 `featured` 改成 `true`。
