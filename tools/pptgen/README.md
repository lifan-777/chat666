# 答辩 PPT 生成

`docs/06-答辩演示.pptx` 由本目录的 `build-deck.js`（pptxgenjs）生成，16:9，共 23 页，每页附讲稿备注。

```bash
cd tools/pptgen
npm install
node build-deck.js
```

- 个人信息读取 `tools/docgen/project-info.json`，修改后重新生成即可更新封面。
- 测试数字读取 `docs/test-results/summary.json` 与 `e2e/output/results.json`，代码规模与接口数量在运行时统计 `src/`。
- 缺陷列表在 `defects.json`，与《软件测试报告》保持一致时修改这里即可。
- `theme.js` 把主题色（橙色 #F97316 等）写入 pptx 主题。
