"""用 LibreOffice 刷新 Word 文档中的目录（填入标题和页码），并可导出 PDF 预览。

docx-js 生成的目录只是一个“域”，需要打开文档时更新才有内容。这个脚本在生成后
预先把目录内容算好写回 docx，这样用 Word / WPS 直接打开就能看到完整目录
（Word 打开时仍会提示更新域，点“是”即可按本机字体重新计算页码）。

用法：
    python3 tools/docgen/finalize.py docs/xxx.docx [--pdf 输出目录]
"""
import argparse
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import uno  # noqa: F401  LibreOffice 自带的 Python UNO 绑定
from com.sun.star.beans import PropertyValue


def prop(name, value):
    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


def connect(port):
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    for _ in range(60):
        try:
            ctx = resolver.resolve(f"uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext")
            return ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        except Exception:  # LibreOffice 尚未启动完成
            time.sleep(0.5)
    raise RuntimeError("无法连接 LibreOffice")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--pdf", help="同时导出 PDF 到该目录")
    args = parser.parse_args()

    port = 20000 + os.getpid() % 10000
    profile = tempfile.mkdtemp(prefix="lo-profile-")
    office = subprocess.Popen([
        "soffice", "--headless", "--invisible", "--nologo", "--norestore",
        f"-env:UserInstallation=file://{profile}",
        f"--accept=socket,host=127.0.0.1,port={port};urp;",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        desktop = connect(port)
        for name in args.files:
            path = Path(name).resolve()
            doc = desktop.loadComponentFromURL(path.as_uri(), "_blank", 0, (prop("Hidden", True),))
            indexes = doc.getDocumentIndexes()
            for i in range(indexes.getCount()):
                indexes.getByIndex(i).update()
            doc.refresh()
            doc.storeToURL(path.as_uri(), (prop("FilterName", "MS Word 2007 XML"),))
            if args.pdf:
                out_dir = Path(args.pdf).resolve()
                out_dir.mkdir(parents=True, exist_ok=True)
                pdf = out_dir / (path.stem + ".pdf")
                doc.storeToURL(pdf.as_uri(), (prop("FilterName", "writer_pdf_Export"),))
                print("PDF:", pdf)
            doc.close(True)
            print("目录已更新:", path)
    finally:
        office.terminate()
        office.wait(timeout=30)


if __name__ == "__main__":
    sys.exit(main())
