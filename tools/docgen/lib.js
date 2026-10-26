/**
 * Word 文档生成公共库（基于 docx-js），保证所有文档格式统一：
 * A4 纸、正文宋体小四 1.5 倍行距、标题黑体、封面 + 修订记录 + 目录 + 正文、页眉页脚。
 *
 * 用法见 tools/docgen/README.md。
 */
const fs = require('fs');
const path = require('path');
const {
    AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, LineRuleType,
    NumberFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell,
    TableOfContents, TableRow, TextRun, VerticalAlign, WidthType,
} = require('docx');

const ROOT = path.resolve(__dirname, '../..');
const INFO = JSON.parse(fs.readFileSync(path.join(__dirname, 'project-info.json'), 'utf8'));

// ---------- 版式常量（单位：twip，1 cm ≈ 567 twip） ----------
const PAGE = { width: 11906, height: 16838 };            // A4
const MARGIN = { top: 1440, bottom: 1440, left: 1701, right: 1701 }; // 2.54 cm / 3 cm
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;       // 8504
const BODY_FONT = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '宋体', cs: 'Times New Roman' };
const HEAD_FONT = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: '黑体', cs: 'Arial' };
const CODE_FONT = { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: '宋体', cs: 'Consolas' };
const SIZE = { body: 24, table: 21, caption: 21, small: 18, code: 18 }; // half-points：小四 12pt / 五号 10.5pt / 小五 9pt
const COLOR = { primary: 'C2410C', headerFill: 'FDE7D3', keyFill: 'F3F4F6', border: '9CA3AF', muted: '6B7280' };

// ---------- 行内文本：支持 **加粗** 与 `代码` 标记 ----------
function runs(text, base = {}) {
    if (Array.isArray(text)) return text;               // 已经是 TextRun 数组
    const result = [];
    const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0;
    let m;
    const str = String(text);
    while ((m = pattern.exec(str)) !== null) {
        if (m.index > last) result.push(new TextRun({ text: str.slice(last, m.index), ...base }));
        const token = m[0];
        if (token.startsWith('**')) {
            result.push(new TextRun({ text: token.slice(2, -2), ...base, bold: true }));
        } else {
            result.push(new TextRun({ text: token.slice(1, -1), ...base, font: CODE_FONT }));
        }
        last = m.index + token.length;
    }
    if (last < str.length) result.push(new TextRun({ text: str.slice(last), ...base }));
    return result;
}

// ---------- 段落 ----------
function h1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(text)] });
}

function h2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}

function h3(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}

/** 正文段落，首行缩进 2 字符 */
function p(text, opts = {}) {
    return new Paragraph({
        alignment: opts.align || AlignmentType.JUSTIFIED,
        indent: opts.noIndent ? undefined : { firstLine: 480 },
        spacing: { line: 360, before: 0, after: 0 },
        children: runs(text),
    });
}

/** 无序列表（项目符号），level 从 0 开始 */
function bullets(items, level = 0) {
    return items.map((item) => new Paragraph({
        numbering: { reference: 'bullet', level },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360 },
        children: runs(item),
    }));
}

/** 有序列表：自动加“(1)(2)…”前缀，避免多处列表编号续接的问题 */
function steps(items) {
    return items.map((item, i) => new Paragraph({
        indent: { left: 480, hanging: 480 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360 },
        children: [new TextRun(`(${i + 1}) `), ...runs(item)],
    }));
}

/** 代码 / 配置片段：等宽字体、浅灰底 */
function code(lines) {
    const list = Array.isArray(lines) ? lines : String(lines).split('\n');
    return list.map((line, i) => new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'F5F5F5', color: 'auto' },
        spacing: { line: 260, before: i === 0 ? 120 : 0, after: i === list.length - 1 ? 120 : 0 },
        indent: { left: 240, right: 240 },
        children: [new TextRun({ text: line.length ? line : ' ', font: CODE_FONT, size: SIZE.code })],
    }));
}

function caption(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 200 },
        children: [new TextRun({ text, font: HEAD_FONT, size: SIZE.caption })],
    });
}

function pageBreak() {
    return new Paragraph({ children: [new PageBreak()] });
}

function blank(count = 1) {
    return Array.from({ length: count }, () => new Paragraph({ children: [] }));
}

// ---------- 图片 ----------
function imageSize(file) {
    const buf = fs.readFileSync(file);
    if (buf.readUInt32BE(0) === 0x89504e47) {
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: 'png', buf };
    }
    // JPEG：查找 SOF 段
    let offset = 2;
    while (offset < buf.length) {
        const marker = buf.readUInt16BE(offset);
        const length = buf.readUInt16BE(offset + 2);
        if (marker >= 0xffc0 && marker <= 0xffc3) {
            return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7), type: 'jpg', buf };
        }
        offset += 2 + length;
    }
    throw new Error('无法识别图片尺寸：' + file);
}

/**
 * 插入图片并在下方加图题。
 * @param file 相对仓库根目录的路径，例如 docs/diagrams/usecase.png
 * @param title 图题，例如“图 2-1 系统用例图”
 * @param opts.widthCm 显示宽度（厘米，默认 15，最大 15）；opts.maxHeightCm 最大高度（默认 20）
 */
function figure(file, title, opts = {}) {
    const full = path.isAbsolute(file) ? file : path.join(ROOT, file);
    const { width, height, type, buf } = imageSize(full);
    const maxWidthPx = Math.min(opts.widthCm || 15, 15) / 2.54 * 96;
    const maxHeightPx = (opts.maxHeightCm || 20) / 2.54 * 96;
    const scale = Math.min(maxWidthPx / width, maxHeightPx / height);
    const result = [new Paragraph({
        alignment: AlignmentType.CENTER,
        // 图片段落必须用单倍行距，否则 1.5 倍固定行高会把图片裁成一条
        spacing: { before: 120, line: 240, lineRule: LineRuleType.AUTO },
        keepNext: true,
        children: [new ImageRun({ type, data: buf, transformation: { width: Math.round(width * scale), height: Math.round(height * scale) } })],
    })];
    if (title) result.push(caption(title));
    return result;
}

// ---------- 表格 ----------
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: COLOR.border };
const BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };

function cellParagraphs(value, { bold = false, align = AlignmentType.LEFT, size = SIZE.table } = {}) {
    const lines = Array.isArray(value) ? value : String(value ?? '').split('\n');
    return lines.map((line) => new Paragraph({
        alignment: align,
        spacing: { line: 300 },
        children: runs(line, { size, bold }),
    }));
}

function widthsFrom(ratios, total = CONTENT_WIDTH) {
    const sum = ratios.reduce((a, b) => a + b, 0);
    const widths = ratios.map((r) => Math.floor((r / sum) * total));
    widths[widths.length - 1] += total - widths.reduce((a, b) => a + b, 0);
    return widths;
}

/**
 * 普通数据表：表题在上，表头浅橙色底纹并在跨页时重复。
 * @param opts.headers 表头数组；opts.rows 二维数组（单元格内可用 \n 换行，可用 **加粗**）
 * @param opts.widths 各列相对宽度；opts.caption 表题，例如“表 3-1 用户表 users”
 * @param opts.center 需要居中的列下标数组
 */
function table({ headers, rows, widths, caption: title, center = [] }) {
    const columnWidths = widthsFrom(widths || headers.map(() => 1));
    const header = new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => new TableCell({
            width: { size: columnWidths[i], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: COLOR.headerFill, color: 'auto' },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            borders: BORDERS,
            children: cellParagraphs(h, { bold: true, align: AlignmentType.CENTER }),
        })),
    });
    const body = rows.map((row) => new TableRow({
        children: row.map((value, i) => new TableCell({
            width: { size: columnWidths[i], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
            borders: BORDERS,
            children: cellParagraphs(value, { align: center.includes(i) ? AlignmentType.CENTER : AlignmentType.LEFT }),
        })),
    }));
    const result = [];
    if (title) result.push(new Paragraph({
        alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: title, font: HEAD_FONT, size: SIZE.caption })],
    }));
    result.push(new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths, rows: [header, ...body] }));
    result.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    return result;
}

/**
 * 键值表（两列，左列灰底加粗），适合用例描述、接口说明等。
 * @param pairs [[键, 值], ...]
 */
function kvTable(pairs, { caption: title, keyWidth = 1, valueWidth = 4 } = {}) {
    const columnWidths = widthsFrom([keyWidth, valueWidth]);
    const rows = pairs.map(([k, v]) => new TableRow({
        children: [
            new TableCell({
                width: { size: columnWidths[0], type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: COLOR.keyFill, color: 'auto' },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 50, bottom: 50, left: 100, right: 100 },
                borders: BORDERS,
                children: cellParagraphs(k, { bold: true, align: AlignmentType.CENTER }),
            }),
            new TableCell({
                width: { size: columnWidths[1], type: WidthType.DXA },
                margins: { top: 50, bottom: 50, left: 100, right: 100 },
                borders: BORDERS,
                children: cellParagraphs(v),
            }),
        ],
    }));
    const result = [];
    if (title) result.push(new Paragraph({
        alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: title, font: HEAD_FONT, size: SIZE.caption })],
    }));
    result.push(new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths, rows }));
    result.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    return result;
}

// ---------- 封面、修订记录、目录 ----------
function coverPage(docTitle, docNo) {
    const line = (label, value) => new Paragraph({
        alignment: AlignmentType.LEFT,
        indent: { left: 2000 },
        spacing: { line: 480 },
        children: [
            new TextRun({ text: label + '：', font: HEAD_FONT, size: 30 }),
            new TextRun({ text: '  ' + value + '  ', font: BODY_FONT, size: 30, underline: {} }),
        ],
    });
    return [
        ...blank(2),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: INFO.school, font: HEAD_FONT, size: 36 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: INFO.course + '课程设计', font: HEAD_FONT, size: 32, color: COLOR.muted })] }),
        ...blank(3),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: INFO.projectName, font: HEAD_FONT, size: 52, bold: true, color: COLOR.primary })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160 }, children: [new TextRun({ text: INFO.projectNameEn, font: HEAD_FONT, size: 28, color: COLOR.muted })] }),
        ...blank(1),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: docTitle, font: HEAD_FONT, size: 44, bold: true })] }),
        ...blank(4),
        line('学    院', INFO.college),
        line('班    级', INFO.className),
        line('姓    名', INFO.author),
        line('学    号', INFO.studentId),
        line('指导教师', INFO.teacher),
        line('文档编号', docNo),
        line('版    本', INFO.version),
        ...blank(3),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: INFO.date, font: HEAD_FONT, size: 30 })] }),
    ];
}

function revisionTable(history) {
    const rows = history || [[INFO.version, INFO.date, INFO.author, '创建文档，完成全部章节']];
    return [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '修订记录', font: HEAD_FONT, size: 32, bold: true })] }),
        ...table({ headers: ['版本', '日期', '修订人', '修订说明'], rows, widths: [1, 1.5, 1.2, 4], center: [0, 1, 2] }),
    ];
}

function toc() {
    return [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '目    录', font: HEAD_FONT, size: 32, bold: true })] }),
        new TableOfContents('目录', { hyperlink: true, headingStyleRange: '1-3' }),
    ];
}

// ---------- 组装文档 ----------
function header(docTitle) {
    return new Header({
        children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.border, space: 4 } },
            children: [new TextRun({ text: `${INFO.projectName} · ${docTitle}`, size: SIZE.small, color: COLOR.muted })],
        })],
    });
}

function footer() {
    return new Footer({
        children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页'], size: SIZE.small })],
        })],
    });
}

/**
 * 生成完整文档。
 * @param meta.title 文档名称，例如“软件需求规格说明书”
 * @param meta.docNo 文档编号，例如“CM-SRS-001”
 * @param meta.history 修订记录（可选）
 * @param body 正文元素数组（h1/p/table/figure… 的返回值，可嵌套数组）
 */
function buildDocument(meta, body) {
    const pageProps = { page: { size: PAGE, margin: MARGIN } };
    return new Document({
        creator: INFO.author,
        title: `${INFO.projectName} - ${meta.title}`,
        description: meta.title,
        features: { updateFields: true },
        styles: {
            default: {
                document: { run: { font: BODY_FONT, size: SIZE.body }, paragraph: { spacing: { line: 360 } } },
            },
            paragraphStyles: [
                { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: HEAD_FONT, size: 32, bold: true, color: '111827' },
                    paragraph: { spacing: { before: 240, after: 240, line: 360 }, alignment: AlignmentType.LEFT, outlineLevel: 0, keepNext: true } },
                { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: HEAD_FONT, size: 28, bold: true, color: '1F2937' },
                    paragraph: { spacing: { before: 240, after: 120, line: 360 }, outlineLevel: 1, keepNext: true } },
                { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: HEAD_FONT, size: 24, bold: true, color: '374151' },
                    paragraph: { spacing: { before: 160, after: 80, line: 360 }, outlineLevel: 2, keepNext: true } },
            ],
        },
        numbering: {
            config: [{
                reference: 'bullet',
                levels: [
                    { level: 0, format: LevelFormat.BULLET, text: '●', alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 840, hanging: 360 } }, run: { size: 16 } } },
                    { level: 1, format: LevelFormat.BULLET, text: '○', alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 1320, hanging: 360 } }, run: { size: 16 } } },
                ],
            }],
        },
        sections: [
            { properties: pageProps, children: coverPage(meta.title, meta.docNo) },
            {
                properties: { ...pageProps, page: { ...pageProps.page, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } } },
                footers: { default: footer() },
                children: [...revisionTable(meta.history), pageBreak(), ...toc()],
            },
            {
                properties: { ...pageProps, page: { ...pageProps.page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
                headers: { default: header(meta.title) },
                footers: { default: footer() },
                children: body.flat(Infinity),
            },
        ],
    });
}

async function save(doc, relativePath) {
    const out = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await Packer.toBuffer(doc));
    console.log('已生成', relativePath);
    return out;
}

module.exports = {
    INFO, ROOT, CONTENT_WIDTH,
    h1, h2, h3, p, bullets, steps, code, caption, figure, table, kvTable, pageBreak, blank,
    buildDocument, save, runs,
};
