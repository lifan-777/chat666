"""汇总自动化测试结果，生成测试报告所需的数据。

先执行 `mvn -B test`（会生成 surefire 报告和 JaCoCo 覆盖率报告），再运行：
    python3 tools/collect_test_results.py

输出：
    docs/test-results/summary.json   测试数量、通过率、耗时、覆盖率
    docs/test-results/test-cases.md  每个测试用例的编号、所属类、描述、类型、结果
"""
import csv
import json
import re
import xml.etree.ElementTree as ET
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUREFIRE = ROOT / "target/surefire-reports"
JACOCO_CSV = ROOT / "target/site/jacoco/jacoco.csv"
TEST_SRC = ROOT / "src/test/java"
OUT = ROOT / "docs/test-results"

# 报告中的展示顺序：先单元测试，再接口集成测试，最后并发测试
CLASS_ORDER = [
    "UserServiceTest", "GoodsServiceTest", "OrderServiceTest", "CategoryServiceTest", "FavoriteServiceTest",
    "CommentServiceTest", "FileServiceTest", "StatsServiceTest", "JwtTokenProviderTest",
    "AuthApiTest", "TradeFlowIntegrationTest", "AdminApiTest", "FileUploadApiTest", "ConcurrentOrderTest",
]

DISPLAY_RE = re.compile(r'@DisplayName\("(?P<name>[^"]+)"\)')
METHOD_RE = re.compile(r'void\s+(?P<method>\w+)\s*\(')
CLASS_RE = re.compile(r'class\s+(?P<cls>\w+)')


def test_type(class_name, package):
    if class_name == "ConcurrentOrderTest":
        return "并发测试"
    if package.endswith(".controller"):
        return "接口集成测试"
    return "单元测试"


def parse_sources():
    """从测试源码中按书写顺序解析出 {类名: (类描述, [(方法名, 方法描述)])}。"""
    result = {}
    for path in TEST_SRC.rglob("*Test.java"):
        text = path.read_text(encoding="utf-8")
        class_match = CLASS_RE.search(text)
        if not class_match:
            continue
        cls = class_match.group("cls")
        head = text[:class_match.start()]
        class_display = DISPLAY_RE.findall(head)
        methods = []
        body = text[class_match.end():]
        pending = None
        for line in body.splitlines():
            d = DISPLAY_RE.search(line)
            if d:
                pending = d.group("name")
                continue
            m = METHOD_RE.search(line)
            if m and pending:
                methods.append((m.group("method"), pending))
                pending = None
        result[cls] = (class_display[-1] if class_display else cls, methods)
    return result


def parse_surefire():
    """返回 {类名: {"package":..., "time":..., "cases": {方法名: [结果...]}}}。"""
    suites = {}
    for xml_file in sorted(SUREFIRE.glob("TEST-*.xml")):
        root = ET.parse(xml_file).getroot()
        fqcn = root.get("name")
        package, cls = fqcn.rsplit(".", 1)
        cases = OrderedDict()
        for case in root.iter("testcase"):
            method = case.get("name").split("(")[0]
            if case.find("failure") is not None or case.find("error") is not None:
                outcome = "failed"
            elif case.find("skipped") is not None:
                outcome = "skipped"
            else:
                outcome = "passed"
            cases.setdefault(method, []).append(outcome)
        suites[cls] = {"package": package, "time": float(root.get("time", 0)), "cases": cases}
    return suites


def parse_coverage():
    totals = {k: [0, 0] for k in ("INSTRUCTION", "BRANCH", "LINE", "METHOD")}
    packages = OrderedDict()
    with JACOCO_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            pkg = row["PACKAGE"].replace("com.campus.market", "").lstrip(".") or "(root)"
            per = packages.setdefault(pkg, {k: [0, 0] for k in totals})
            for k in totals:
                missed, covered = int(row[f"{k}_MISSED"]), int(row[f"{k}_COVERED"])
                totals[k][0] += missed
                totals[k][1] += covered
                per[k][0] += missed
                per[k][1] += covered

    def pct(pair):
        total = pair[0] + pair[1]
        return round(pair[1] * 100.0 / total, 1) if total else None

    # 演示数据初始化类（init 包）在测试环境中被关闭，单独给出不含它的覆盖率
    business = {k: [sum(v[k][0] for n, v in packages.items() if n != "init"),
                    sum(v[k][1] for n, v in packages.items() if n != "init")] for k in totals}

    return {
        "lineExcludingInit": pct(business["LINE"]),
        "branchExcludingInit": pct(business["BRANCH"]),
        "instruction": pct(totals["INSTRUCTION"]),
        "branch": pct(totals["BRANCH"]),
        "line": pct(totals["LINE"]),
        "method": pct(totals["METHOD"]),
        "linesCovered": totals["LINE"][1],
        "linesTotal": sum(totals["LINE"]),
        "byPackage": [
            {"package": name, "line": pct(v["LINE"]), "branch": pct(v["BRANCH"]),
             "instruction": pct(v["INSTRUCTION"]), "linesTotal": sum(v["LINE"])}
            for name, v in packages.items()
        ],
    }


def main():
    sources = parse_sources()
    suites = parse_surefire()
    ordered = [c for c in CLASS_ORDER if c in suites] + sorted(c for c in suites if c not in CLASS_ORDER)

    classes, rows = [], []
    counters = {"单元测试": 0, "接口集成测试": 0, "并发测试": 0}
    total = passed = failed = skipped = 0
    duration = 0.0
    for cls in ordered:
        suite = suites[cls]
        ttype = test_type(cls, suite["package"])
        class_display, methods = sources.get(cls, (cls, []))
        method_names = [m for m, _ in methods] + [m for m in suite["cases"] if m not in dict(methods)]
        display = dict(methods)
        n = sum(len(v) for v in suite["cases"].values())
        p = sum(v.count("passed") for v in suite["cases"].values())
        f = sum(v.count("failed") for v in suite["cases"].values())
        s = sum(v.count("skipped") for v in suite["cases"].values())
        total, passed, failed, skipped = total + n, passed + p, failed + f, skipped + s
        duration += suite["time"]
        classes.append({"name": cls, "displayName": class_display, "type": ttype, "tests": n, "passed": p,
                        "failed": f, "skipped": s, "timeSeconds": round(suite["time"], 2)})
        for method in method_names:
            outcomes = suite["cases"].get(method, [])
            if not outcomes:
                continue
            counters[ttype] += 1
            prefix = "UT" if ttype == "单元测试" else "IT"
            seq = counters["单元测试"] if prefix == "UT" else counters["接口集成测试"] + counters["并发测试"]
            ok = outcomes.count("passed")
            result = "通过" if ok == len(outcomes) else f"失败（{len(outcomes) - ok}）"
            if len(outcomes) > 1:
                result += f"（{ok}/{len(outcomes)} 次）"
            rows.append({"id": f"{prefix}-{seq:02d}", "class": cls, "method": method,
                         "description": display.get(method, method), "type": ttype, "result": result})

    coverage = parse_coverage()
    summary = {
        "total": total, "passed": passed, "failed": failed, "skipped": skipped,
        "passRate": round(passed * 100.0 / total, 1) if total else 0,
        "durationSeconds": round(duration, 1),
        "testCaseCount": len(rows),
        "byType": {t: sum(c["tests"] for c in classes if c["type"] == t) for t in counters},
        "classes": classes,
        "coverage": coverage,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# 自动化测试用例清单",
        "",
        f"共 {len(rows)} 个测试用例（参数化/重复测试按执行次数计共 {total} 次执行），"
        f"通过 {passed}，失败 {failed}，跳过 {skipped}，总耗时约 {summary['durationSeconds']} 秒。",
        "",
        f"代码覆盖率（JaCoCo）：行 {coverage['line']}%，分支 {coverage['branch']}%，指令 {coverage['instruction']}%，方法 {coverage['method']}%；"
        f"不含演示数据初始化（init 包，测试环境关闭）时行 {coverage['lineExcludingInit']}%，分支 {coverage['branchExcludingInit']}%。",
        "",
        "| 编号 | 测试类 | 用例描述 | 类型 | 结果 |",
        "| --- | --- | --- | --- | --- |",
    ]
    lines += [f"| {r['id']} | {r['class']} | {r['description']} | {r['type']} | {r['result']} |" for r in rows]
    (OUT / "test-cases.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"tests={total} passed={passed} failed={failed} cases={len(rows)} "
          f"line={coverage['line']}% branch={coverage['branch']}% -> {OUT}")


if __name__ == "__main__":
    main()
