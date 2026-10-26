# 文档生成工具

`docs/` 目录下的 Word 文档都由本目录的脚本生成（基于 [docx](https://www.npmjs.com/package/docx) 库），格式统一、可重复生成。

## 填写个人信息

先修改 `project-info.json` 中的学校、学院、姓名、学号、班级、指导教师等字段，再重新生成文档，封面和页眉会自动更新。

## 生成全部文档

```bash
(cd tools/docgen && npm install)   # 首次使用需要安装 docx 库（Node.js 18+）
bash tools/docgen/build-all.sh
```

`build-all.sh` 会依次运行各文档脚本，然后调用 `finalize.py`（需要 LibreOffice）预先填好目录页码。
没有安装 LibreOffice 也可以只运行 `node tools/docgen/02-srs.js` 等脚本，用 Word 打开时按提示“更新域”即可生成目录。

| 脚本 | 输出 |
|---|---|
| `01-plan.js` | `docs/01-项目开发计划书.docx` |
| `02-srs.js` | `docs/02-软件需求规格说明书.docx` |
| `03-design.js` | `docs/03-软件设计说明书.docx` |
| `04-implementation.js` | `docs/04-软件实施与部署说明书.docx` |
| `05-test-report.js` | `docs/05-软件测试报告.docx` |

## lib.js 常用函数

| 函数 | 说明 |
|---|---|
| `h1/h2/h3(text)` | 一/二/三级标题（一级标题自动分页），编号写在文字里，如 `h2('2.1 产品描述')` |
| `p(text)` | 正文段落，首行缩进两字符，支持 `**加粗**` 与 `` `代码` `` |
| `bullets([...])` / `steps([...])` | 项目符号列表 / 带 (1)(2) 编号的步骤 |
| `table({ caption, headers, rows, widths, center })` | 数据表，表头底纹、跨页重复表头 |
| `kvTable([[键, 值], ...], { caption })` | 两列键值表，适合用例描述、接口说明 |
| `figure(path, caption, { widthCm, maxHeightCm })` | 插图（PNG/JPG）并在下方加图题 |
| `code(lines)` | 代码 / 配置片段 |
| `buildDocument({ title, docNo }, body)` + `save(doc, path)` | 组装封面、修订记录、目录、正文并保存 |
