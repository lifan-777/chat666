#!/usr/bin/env bash
# 把 docs/diagrams/*.puml 渲染为同名 PNG。
# 依赖：Java 17+、Graphviz（dot）、PlantUML jar。
# 用法：PLANTUML_JAR=/path/to/plantuml.jar tools/render_diagrams.sh [图名...]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIAGRAM_DIR="$ROOT/docs/diagrams"
PLANTUML_JAR="${PLANTUML_JAR:-/tmp/claude-0/-home-user-chat666/f54fb586-91a5-54c4-852e-59ab01a7064b/scratchpad/plantuml.jar}"

if [[ ! -f "$PLANTUML_JAR" ]]; then
    echo "找不到 PlantUML：$PLANTUML_JAR" >&2
    echo "请从 https://repo.maven.apache.org/maven2/net/sourceforge/plantuml/plantuml/ 下载后设置 PLANTUML_JAR" >&2
    exit 1
fi

if [[ $# -gt 0 ]]; then
    files=()
    for name in "$@"; do
        files+=("$DIAGRAM_DIR/${name%.puml}.puml")
    done
else
    files=("$DIAGRAM_DIR"/*.puml)
fi

java -Djava.awt.headless=true -jar "$PLANTUML_JAR" -charset UTF-8 -tpng -o "$DIAGRAM_DIR" "${files[@]}"
echo "已渲染 ${#files[@]} 张图到 $DIAGRAM_DIR"
