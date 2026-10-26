#!/usr/bin/env bash
# 重新生成 docs/ 下的全部 Word 文档，并用 LibreOffice 预先填好目录。
set -euo pipefail
cd "$(dirname "$0")/../.."

for script in tools/docgen/0*.js; do
    node "$script"
done

if command -v soffice >/dev/null 2>&1; then
    python3 tools/docgen/finalize.py docs/0*.docx
else
    echo "未检测到 LibreOffice，跳过目录预填充（用 Word 打开时选择“更新域”即可）"
fi
