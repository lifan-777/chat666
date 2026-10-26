/**
 * 生成答辩演示文稿 docs/06-答辩演示.pptx（16:9，pptxgenjs）。
 *
 * 用法：
 *   cd tools/pptgen && npm install && node build-deck.js
 *
 * 所有统计数字都在运行时从仓库文件读取：
 *   docs/test-results/summary.json   自动化测试与覆盖率
 *   e2e/output/results.json          端到端系统测试
 *   src/**                           代码规模、接口数量
 *   tools/docgen/project-info.json   封面个人信息
 *   tools/pptgen/defects.json        缺陷记录
 */
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa6');
const { applyTheme } = require('./theme');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/06-答辩演示.pptx');

// ---------------------------------------------------------------- 数据
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const INFO = readJson('tools/docgen/project-info.json');
const SUMMARY = readJson('docs/test-results/summary.json');
const E2E = readJson('e2e/output/results.json');
const DEFECTS = readJson('tools/pptgen/defects.json');
const COV = SUMMARY.coverage;

function walk(dir, ext) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) return [];
    return fs.readdirSync(full, { withFileTypes: true }).flatMap((e) => {
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) return walk(rel, ext);
        return e.name.endsWith(ext) ? [rel] : [];
    });
}

function lineCount(files) {
    return files.reduce((sum, f) => sum + (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/\n/g) || []).length, 0);
}

const javaFiles = walk('src/main/java', '.java');
const testFiles = walk('src/test/java', '.java');
const jsFiles = walk('src/main/resources/static/js', '.js');
const controllerSrc = walk('src/main/java/com/campus/market/controller', '.java')
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const concurrentSrc = fs.readFileSync(path.join(ROOT, 'src/test/java/com/campus/market/controller/ConcurrentOrderTest.java'), 'utf8');

const STATS = {
    javaFiles: javaFiles.length,
    javaLines: lineCount(javaFiles),
    testFiles: testFiles.length,
    testLines: lineCount(testFiles),
    jsFiles: jsFiles.length,
    jsLines: lineCount(jsFiles) + lineCount(['src/main/resources/static/css/app.css']),
    endpoints: (controllerSrc.match(/@(Get|Post|Put|Delete)Mapping/g) || []).length,
    diagrams: fs.readdirSync(path.join(ROOT, 'docs/diagrams')).filter((f) => f.endsWith('.png')).length,
    buyers: Number((concurrentSrc.match(/BUYERS\s*=\s*(\d+)/) || [])[1]),
    rounds: Number((concurrentSrc.match(/@RepeatedTest\(value\s*=\s*(\d+)/) || [])[1]),
};
const serviceCov = COV.byPackage.find((p) => p.package === 'service');

// ---------------------------------------------------------------- 主题
const THEME = {
    name: 'Campus Market',
    headFontFace: 'Microsoft YaHei',
    bodyFontFace: 'Microsoft YaHei',
    colors: {
        dk1: '1F2937', lt1: 'FFFFFF', dk2: '4B5563', lt2: 'F4F5F7',
        accent1: 'F97316', accent2: 'FDBA74', accent3: '10B981', accent4: '3B82F6', accent5: '8B5CF6', accent6: 'EC4899',
        hlink: 'EA580C', folHlink: '9A3412',
    },
};
const HEX = { ...THEME.colors, orangeTint: 'FFF1E6', border: 'E5E7EB', muted: '6B7280', code: '111827' };

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = `${INFO.projectName} 答辩演示`;
pres.author = INFO.author;
pres.subject = '软件工程课程设计答辩';
const C = pres.SchemeColor;

const W = 10;
const H = 5.625;
const M = 0.5;
const FOOTER = `${INFO.projectName} · 软件工程课程设计答辩`;

// ---------------------------------------------------------------- 版式（layout）
pres.defineSlideMaster({
    title: 'COVER',
    background: { color: HEX.dk1 },
    objects: [
        { placeholder: { options: { name: 'title', type: 'title', x: M, y: 1.45, w: 5.2, h: 0.9, fontSize: 40, bold: true, color: C.background1, align: 'left', valign: 'middle', margin: 0 }, text: '' } },
        { placeholder: { options: { name: 'body', type: 'body', x: M, y: 2.35, w: 5.2, h: 0.5, fontSize: 18, color: C.accent2, align: 'left', valign: 'top', margin: 0 }, text: '' } },
    ],
});

pres.defineSlideMaster({
    title: 'CONTENT',
    background: { color: HEX.lt2 },
    margin: [0.5, 0.5, 0.55, 0.5],
    objects: [
        { placeholder: { options: { name: 'kicker', type: 'body', x: M, y: 0.22, w: 6, h: 0.28, fontSize: 11, bold: true, color: C.accent1, align: 'left', margin: 0, valign: 'middle' }, text: '' } },
        { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.5, w: 9, h: 0.62, fontSize: 26, bold: true, color: C.text1, align: 'left', margin: 0, valign: 'middle' }, text: '' } },
        { text: { text: FOOTER, options: { x: M, y: 5.27, w: 6, h: 0.25, fontSize: 9, color: HEX.muted, margin: 0, valign: 'middle' } } },
    ],
    slideNumber: { x: 8.9, y: 5.27, w: 0.6, h: 0.25, fontSize: 9, color: HEX.muted, align: 'right', margin: 0 },
});

pres.defineSlideMaster({
    title: 'CLOSING',
    background: { color: HEX.dk1 },
    objects: [
        { placeholder: { options: { name: 'title', type: 'title', x: M, y: 1.7, w: 9, h: 1.0, fontSize: 44, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0 }, text: '' } },
        { placeholder: { options: { name: 'body', type: 'body', x: M, y: 2.75, w: 9, h: 0.5, fontSize: 18, color: C.accent2, align: 'center', valign: 'top', margin: 0 }, text: '' } },
    ],
});

// ---------------------------------------------------------------- 工具函数
const ICON_CACHE = new Map();
async function icon(name, color = 'FFFFFF') {
    const key = name + color;
    if (!ICON_CACHE.has(key)) {
        const Comp = fa[name];
        if (!Comp) throw new Error('未知图标 ' + name);
        const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: 256 }));
        const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
        ICON_CACHE.set(key, 'image/png;base64,' + png.toString('base64'));
    }
    return ICON_CACHE.get(key);
}

/** 圆形底色上的白色图标 */
async function iconBadge(slide, name, x, y, d = 0.48, fill = C.accent1, iconColor = 'FFFFFF') {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: 'icon-badge-' + name });
    slide.addImage({ data: await icon(name, iconColor), x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5, altText: name });
}

function imageSize(rel) {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.12, blur: 8, offset: 2, angle: 90 });

/** 卡片：白色圆角矩形 + 柔和阴影 */
function card(slide, x, y, w, h, opts = {}) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w, h, rectRadius: opts.radius ?? 0.12,
        fill: { color: opts.fill || C.background1 },
        line: { color: opts.line || HEX.border, width: opts.line ? 1 : 0.75 },
        shadow: opts.noShadow ? undefined : shadow(),
        objectName: opts.name || 'card',
    });
}

/**
 * 把图片按比例放进框里（居中），外面套一个带阴影的白色圆角相框。
 * 返回图片实际位置。
 */
function framedImage(slide, rel, box, opts = {}) {
    const pad = opts.pad ?? 0.08;
    const { w: pw, h: ph } = imageSize(rel);
    const maxW = box.w - pad * 2;
    const maxH = box.h - pad * 2;
    const scale = Math.min(maxW / pw, maxH / ph);
    const iw = pw * scale;
    const ih = ph * scale;
    const ix = box.x + (box.w - iw) / 2;
    const iy = box.y + (opts.top ? pad : (box.h - ih) / 2);
    if (!opts.noFrame) {
        card(slide, ix - pad, iy - pad, iw + pad * 2, ih + pad * 2, { radius: 0.08, name: 'frame' });
    }
    slide.addImage({ path: path.join(ROOT, rel), x: ix, y: iy, w: iw, h: ih, altText: opts.alt || path.basename(rel) });
    return { x: ix, y: iy, w: iw, h: ih };
}

function caption(slide, text, x, y, w) {
    slide.addText(text, { x, y, w, h: 0.28, fontSize: 11, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
}

let sectionTitle = '';
function contentSlide(kicker, title, notes) {
    const slide = pres.addSlide({ masterName: 'CONTENT', sectionTitle });
    slide.addText(kicker, { placeholder: 'kicker' });
    slide.addText(title, { placeholder: 'title' });
    if (notes) slide.addNotes(notes);
    return slide;
}

function section(title) {
    sectionTitle = title;
    pres.addSection({ title });
}

/** 要点列表（项目符号） */
function bulletList(slide, items, box, fontSize = 14) {
    slide.addText(items.map((t, i) => ({
        text: t,
        options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: 6 },
    })), { ...box, fontSize, color: C.text1, valign: 'top', margin: 0.04, isTextBox: true });
}

/** 带标题的小卡片：图标 + 粗体标题 + 说明 */
async function infoCard(slide, { x, y, w, h, iconName, title, text, fill }) {
    card(slide, x, y, w, h, { fill });
    await iconBadge(slide, iconName, x + 0.18, y + 0.18, 0.42);
    slide.addText(title, { x: x + 0.72, y: y + 0.16, w: w - 0.85, h: 0.46, fontSize: 14, bold: true, color: C.text1, valign: 'middle', margin: 0, isTextBox: true });
    if (text) {
        slide.addText(text, { x: x + 0.18, y: y + 0.7, w: w - 0.36, h: h - 0.82, fontSize: 12, color: C.text2, valign: 'top', margin: 0, isTextBox: true });
    }
}

/** 大数字统计 */
function statBlock(slide, { x, y, w, value, unit, label, color }) {
    slide.addText([
        { text: String(value), options: { fontSize: 32, bold: true, color: color || C.accent1 } },
        { text: unit ? ' ' + unit : '', options: { fontSize: 14, bold: true, color: color || C.accent1 } },
    ], { x, y, w, h: 0.62, margin: 0, valign: 'bottom', isTextBox: true });
    slide.addText(label, { x, y: y + 0.64, w, h: 0.42, fontSize: 11, color: C.text2, margin: 0, valign: 'top', isTextBox: true });
}

// ---------------------------------------------------------------- 幻灯片
async function build() {
    // 1 封面 ---------------------------------------------------------
    section('封面');
    {
        const slide = pres.addSlide({ masterName: 'COVER', sectionTitle });
        slide.addText(INFO.projectName, { placeholder: 'title' });
        slide.addText('软件工程课程设计答辩', { placeholder: 'body' });
        slide.addText(INFO.projectNameEn + '  ·  校园闲置物品交易系统', { x: M, y: 0.95, w: 5.2, h: 0.35, fontSize: 13, color: 'D1D5DB', margin: 0, isTextBox: true });
        const rows = [['姓名', INFO.author], ['学号', INFO.studentId], ['班级', INFO.className], ['指导教师', INFO.teacher]];
        slide.addText(rows.map(([k, v], i) => ({
            text: `${k}：${v}`, options: { breakLine: i < rows.length - 1, paraSpaceAfter: 4 },
        })), { x: M, y: 3.1, w: 4.2, h: 1.25, fontSize: 14, color: 'E5E7EB', margin: 0, valign: 'top', isTextBox: true });
        slide.addText(`${INFO.school}  ${INFO.college}  ·  ${INFO.date}`, { x: M, y: 4.6, w: 5, h: 0.3, fontSize: 12, color: '9CA3AF', margin: 0, isTextBox: true });
        // 右侧系统截图
        const shot = 'docs/screenshots/01-home.png';
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.55, y: 1.05, w: 4.2, h: 2.85, rectRadius: 0.1, fill: { color: '374151' }, line: { color: '4B5563', width: 1 }, objectName: 'cover-frame' });
        slide.addImage({ path: path.join(ROOT, shot), x: 5.65, y: 1.15, w: 4.0, h: 2.5, altText: '系统首页截图' });
        slide.addText('系统首页', { x: 5.55, y: 3.95, w: 4.2, h: 0.3, fontSize: 11, color: '9CA3AF', align: 'center', margin: 0, isTextBox: true });
        slide.addNotes('各位老师好，我汇报的题目是“校园二手交易平台”。这是一个面向在校学生的闲置物品交易系统，'
            + '采用 Spring Boot + Vue3 前后端分离架构实现，完整经历了需求分析、设计、实现和测试四个阶段。下面我按目录依次介绍。');
    }

    // 2 目录 ---------------------------------------------------------
    section('目录');
    {
        const slide = contentSlide('CONTENTS', '汇报目录', '本次汇报分为六个部分：项目背景、需求分析、系统设计、系统实现、软件测试，最后是总结与展望。');
        const items = [
            ['01', '项目背景', '痛点与目标', 'FaLightbulb'],
            ['02', '需求分析', '角色、用例与业务流程', 'FaClipboardList'],
            ['03', '系统设计', '架构、数据库与关键设计', 'FaDiagramProject'],
            ['04', '系统实现', '技术栈、规模与界面', 'FaCode'],
            ['05', '软件测试', '策略、覆盖率与缺陷', 'FaVial'],
            ['06', '总结展望', '成果、收获与改进', 'FaFlagCheckered'],
        ];
        const cw = 2.85;
        const ch = 1.6;
        for (let i = 0; i < items.length; i++) {
            const [no, title, sub, ic] = items[i];
            const x = M + (i % 3) * (cw + 0.225);
            const y = 1.45 + Math.floor(i / 3) * (ch + 0.3);
            card(slide, x, y, cw, ch);
            slide.addText(no, { x: x + 0.25, y: y + 0.22, w: 1, h: 0.5, fontSize: 28, bold: true, color: C.accent1, margin: 0, isTextBox: true });
            await iconBadge(slide, ic, x + cw - 0.75, y + 0.22, 0.5, C.background2, 'F97316');
            slide.addText(title, { x: x + 0.25, y: y + 0.8, w: cw - 0.5, h: 0.38, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true });
            slide.addText(sub, { x: x + 0.25, y: y + 1.17, w: cw - 0.5, h: 0.3, fontSize: 12, color: C.text2, margin: 0, isTextBox: true });
        }
    }

    // 3 项目背景 -----------------------------------------------------
    section('项目背景');
    {
        const slide = contentSlide('01  项目背景', '校园闲置交易的痛点与平台目标',
            '先说背景。每到毕业季和开学季，校园里有大量教材、电子产品、生活用品需要转手，但现在主要靠 QQ 群、表白墙发布，'
            + '信息零散、难以检索，交易双方互不认识也缺乏信任，很多东西最后被丢弃。'
            + '因此我们的目标是做一个只服务本校学生的交易平台：商品集中展示、可以搜索筛选；商品上架前由管理员审核；'
            + '交易采用同校当面验货、线下交付的方式，平台只负责撮合和记录。');
        slide.addText('现状痛点', { x: M, y: 1.3, w: 4.2, h: 0.35, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true });
        const pains = [
            ['FaComments', '信息分散', 'QQ 群、表白墙刷屏，商品难以检索和比较'],
            ['FaUserShield', '缺乏信任', '互不认识，虚假信息、违规物品无人把关'],
            ['FaRecycle', '资源浪费', '毕业季大量教材和电器被丢弃，利用率低'],
        ];
        for (let i = 0; i < pains.length; i++) {
            const [ic, t, d] = pains[i];
            const y = 1.75 + i * 1.05;
            card(slide, M, y, 4.2, 0.9);
            await iconBadge(slide, ic, M + 0.2, y + 0.21, 0.48, C.text2);
            slide.addText(t, { x: M + 0.85, y: y + 0.1, w: 3.2, h: 0.35, fontSize: 14, bold: true, color: C.text1, margin: 0, isTextBox: true });
            slide.addText(d, { x: M + 0.85, y: y + 0.45, w: 3.2, h: 0.35, fontSize: 12, color: C.text2, margin: 0, isTextBox: true });
        }
        slide.addText('平台目标', { x: 5.1, y: 1.3, w: 4.4, h: 0.35, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true });
        card(slide, 5.1, 1.75, 4.4, 3.0, { fill: HEX.orangeTint, line: 'FED7AA' });
        const goals = [
            ['FaMagnifyingGlass', '集中展示', '分类浏览、关键词搜索、价格筛选'],
            ['FaClipboardCheck', '审核上架', '管理员审核通过才展示，违规可下架'],
            ['FaHandshake', '同校面交', '下单 → 卖家确认 → 当面验货 → 收货'],
            ['FaUsers', '三类角色', '游客浏览、学生买卖、管理员运营'],
        ];
        for (let i = 0; i < goals.length; i++) {
            const [ic, t, d] = goals[i];
            const y = 1.95 + i * 0.68;
            await iconBadge(slide, ic, 5.3, y, 0.44);
            slide.addText([
                { text: t, options: { bold: true, color: C.text1, fontSize: 14, breakLine: true } },
                { text: d, options: { color: C.text2, fontSize: 11 } },
            ], { x: 5.9, y: y - 0.06, w: 3.45, h: 0.56, margin: 0, valign: 'middle', isTextBox: true });
        }
    }

    // 4 功能模块 -----------------------------------------------------
    section('需求分析');
    {
        const slide = contentSlide('02  需求分析', '用户角色与功能模块划分',
            '需求分析阶段我们识别出三类用户：游客、注册用户和管理员，其中注册用户同时可以是买家和卖家。'
            + '按业务把系统划分为五个模块：用户模块负责注册登录和个人资料；商品模块负责发布、编辑、上下架和搜索；'
            + '交易模块负责下单、确认、收货和取消；互动模块包括收藏和留言；后台管理模块包括审核、用户管理、分类管理和数据统计。');
        framedImage(slide, 'docs/diagrams/modules.png', { x: M, y: 1.3, w: 9, h: 2.95 });
        const roles = [
            ['FaEye', '游客', '浏览、搜索、查看详情'],
            ['FaUserGraduate', '学生用户', '买家 + 卖家，发布与交易'],
            ['FaUserGear', '管理员', '审核、封禁、分类、统计'],
        ];
        for (let i = 0; i < roles.length; i++) {
            const [ic, t, d] = roles[i];
            const x = M + i * 3.05;
            card(slide, x, 4.4, 2.85, 0.68);
            await iconBadge(slide, ic, x + 0.14, 4.52, 0.44);
            slide.addText([
                { text: t, options: { bold: true, fontSize: 14, color: C.text1, breakLine: true } },
                { text: d, options: { fontSize: 11, color: C.text2 } },
            ], { x: x + 0.7, y: 4.43, w: 2.1, h: 0.62, margin: 0, valign: 'middle', isTextBox: true });
        }
    }

    // 5 用例图 -------------------------------------------------------
    {
        const slide = contentSlide('02  需求分析', '系统用例图',
            '这是系统的用例图。左边是游客和普通用户的公共功能和个人功能，中间是买家、卖家各自的用例，下方是管理员的后台用例。'
            + '其中“发布商品”包含“上传商品图片”，“浏览搜索商品”可以扩展“筛选与排序”。'
            + '每个用例在需求规格说明书中都有详细的用例描述，包括前置条件、基本流程和异常流程。');
        framedImage(slide, 'docs/diagrams/usecase.png', { x: M, y: 1.25, w: 4.3, h: 3.9 });
        const groups = [
            ['FaEye', '游客 / 公共', '浏览搜索、筛选排序、查看详情、注册登录'],
            ['FaStore', '卖家', '发布（含图片上传）、编辑、上下架、确认订单'],
            ['FaCartShopping', '买家', '收藏、留言、下单、确认收货、取消订单'],
            ['FaUserGear', '管理员', '审核、强制下架、封禁用户、分类管理、统计'],
        ];
        for (let i = 0; i < groups.length; i++) {
            const [ic, t, d] = groups[i];
            const y = 1.3 + i * 0.97;
            card(slide, 5.1, y, 4.4, 0.82);
            await iconBadge(slide, ic, 5.28, y + 0.19, 0.44);
            slide.addText([
                { text: t, options: { bold: true, fontSize: 14, color: C.text1, breakLine: true } },
                { text: d, options: { fontSize: 11, color: C.text2 } },
            ], { x: 5.85, y: y + 0.04, w: 3.55, h: 0.74, margin: 0, valign: 'middle', isTextBox: true });
        }
    }

    // 6 核心业务流程 -------------------------------------------------
    {
        const slide = contentSlide('02  需求分析', '核心业务流程：从发布到成交',
            '核心业务流程分六步：卖家发布商品后进入待审核；管理员审核通过才会上架；买家看中后下单，商品立即锁定为交易中；'
            + '卖家确认订单后双方可以看到对方的联系电话，约定时间地点当面验货；最后买家确认收货，订单完成、商品标记为已售出。'
            + '在完成之前，买卖双方都可以取消订单，商品会自动恢复在售。右边是对应的活动图，包含了不可购买、被抢先下单等分支。');
        const steps = [
            ['发布商品', '卖家填写信息、上传图片，进入“待审核”'],
            ['审核上架', '管理员审核通过 → 在售；驳回需填写原因'],
            ['买家下单', '商品锁定为“交易中”，他人不可再买'],
            ['卖家确认', '双方可见联系电话，约定面交时间地点'],
            ['当面交易', '线下验货付款，平台不涉及资金'],
            ['确认收货', '订单完成，商品变为“已售出”'],
        ];
        for (let i = 0; i < steps.length; i++) {
            const [t, d] = steps[i];
            const y = 1.3 + i * 0.64;
            slide.addShape(pres.shapes.OVAL, { x: M, y: y + 0.06, w: 0.42, h: 0.42, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: 'step-no' });
            slide.addText(String(i + 1), { x: M, y: y + 0.06, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
            if (i < steps.length - 1) {
                slide.addShape(pres.shapes.LINE, { x: M + 0.21, y: y + 0.5, w: 0, h: 0.18, line: { color: 'FDBA74', width: 2 }, objectName: 'step-line' });
            }
            slide.addText([
                { text: t + '  ', options: { bold: true, fontSize: 14, color: C.text1 } },
                { text: d, options: { fontSize: 12, color: C.text2 } },
            ], { x: M + 0.6, y: y + 0.03, w: 5.0, h: 0.48, margin: 0, valign: 'middle', isTextBox: true });
        }
        card(slide, 6.2, 1.3, 3.3, 3.8, { fill: HEX.orangeTint, line: 'FED7AA' });
        await iconBadge(slide, 'FaCodeBranch', 6.4, 1.5, 0.44);
        slide.addText('异常与分支处理', { x: 6.95, y: 1.5, w: 2.4, h: 0.44, fontSize: 14, bold: true, color: C.text1, margin: 0, valign: 'middle', isTextBox: true });
        const branches = [
            ['审核驳回', '填写原因，卖家修改后重新提交'],
            ['被他人抢先', '下单返回 409，提示已被下单'],
            ['不能自买', '卖家无法购买自己的商品'],
            ['取消订单', '完成前双方可取消，商品恢复在售'],
        ];
        slide.addText(branches.flatMap(([t, d], i) => [
            { text: t, options: { bold: true, fontSize: 13, color: C.text1, breakLine: true } },
            { text: d, options: { fontSize: 11, color: C.text2, breakLine: i < branches.length - 1, paraSpaceAfter: 8 } },
        ]), { x: 6.4, y: 2.1, w: 2.95, h: 2.85, margin: 0, valign: 'top', isTextBox: true });
    }

    // 7 总体架构 -----------------------------------------------------
    section('系统设计');
    {
        const slide = contentSlide('03  系统设计', '总体架构与技术选型',
            '系统采用前后端分离的 B/S 架构。前端是 Vue3 单页应用，用 Element Plus 组件库、Vue Router 路由、Axios 调用接口、ECharts 画统计图，'
            + '所有第三方库都放在本地，断网也能演示。后端是 Spring Boot 3.5 分层架构：拦截器做认证鉴权，Controller 接收请求，'
            + 'Service 实现业务规则，Repository 用 Spring Data JPA 访问数据库。数据库默认用内嵌 H2，零配置运行，改一个配置就能切换到 MySQL。'
            + `前后端通过 REST + JSON 通信，共 ${STATS.endpoints} 个接口。`);
        framedImage(slide, 'docs/diagrams/architecture.png', { x: M, y: 1.25, w: 4.1, h: 3.9 });
        const stacks = [
            ['FaDesktop', '前端', 'Vue 3 · Element Plus · Vue Router · Axios · ECharts'],
            ['FaServer', '后端', 'Spring Boot 3.5 · Spring MVC · Spring Data JPA'],
            ['FaLock', '安全', 'JWT 无状态认证 · BCrypt 加密 · 拦截器鉴权'],
            ['FaDatabase', '数据', 'H2 文件数据库（默认）· MySQL 8（可切换）'],
        ];
        for (let i = 0; i < stacks.length; i++) {
            const [ic, t, d] = stacks[i];
            const y = 1.3 + i * 0.86;
            card(slide, 4.9, y, 4.6, 0.74);
            await iconBadge(slide, ic, 5.05, y + 0.15, 0.44);
            slide.addText([
                { text: t, options: { bold: true, fontSize: 14, color: C.text1, breakLine: true } },
                { text: d, options: { fontSize: 11, color: C.text2 } },
            ], { x: 5.65, y: y + 0.04, w: 3.75, h: 0.66, margin: 0, valign: 'middle', isTextBox: true });
        }
        slide.addText(`REST 接口 ${STATS.endpoints} 个 · JDK 17+ · 单个 jar 一条命令启动`, { x: 4.9, y: 4.75, w: 4.6, h: 0.35, fontSize: 12, bold: true, color: C.accent1, margin: 0, valign: 'middle', isTextBox: true });
    }

    // 8 数据库设计 ---------------------------------------------------
    {
        const slide = contentSlide('03  系统设计', '数据库设计：7 张表',
            '数据库共 7 张表。users 存储用户和角色；category 是商品分类；goods 是核心的商品表，记录价格、成色、状态和浏览量；'
            + 'goods_image 保存商品的多张图片；favorite 是收藏表，用户和商品联合唯一；comment 是留言表，支持回复某个用户；'
            + 'trade_order 是订单表，下单时保存商品标题、图片和价格的快照，卖家之后修改商品也不会影响历史订单。');
        framedImage(slide, 'docs/diagrams/er.png', { x: M, y: 1.25, w: 3.75, h: 3.9 });
        const rows = [
            ['users', '用户', '用户名唯一、BCrypt 密码、角色、状态'],
            ['category', '分类', '名称唯一、图标、排序'],
            ['goods', '商品', '价格、成色、状态、浏览量、驳回原因'],
            ['goods_image', '商品图片', '一个商品最多 6 张，有序'],
            ['favorite', '收藏', '(user_id, goods_id) 联合唯一'],
            ['comment', '留言', '可回复指定用户'],
            ['trade_order', '订单', '订单号唯一，保存商品快照'],
        ];
        const head = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.accent1 }, fontSize: 12 } });
        const body = (t, bold) => ({ text: t, options: { fontSize: 12, bold: !!bold, color: C.text1 } });
        slide.addTable([
            [head('表名'), head('说明'), head('关键设计')],
            ...rows.map(([a, b, c]) => [body(a, true), body(b), body(c)]),
        ], {
            x: 4.55, y: 1.3, w: 4.95, colW: [1.25, 0.85, 2.85], rowH: 0.42,
            border: { type: 'solid', pt: 0.75, color: HEX.border }, fill: { color: C.background1 },
            fontFace: THEME.bodyFontFace, valign: 'middle', margin: 0.06,
        });
    }

    // 9 认证授权 -----------------------------------------------------
    {
        const slide = contentSlide('03  系统设计', '关键设计 ①：JWT 无状态认证与权限控制',
            '第一个关键设计是认证授权。用户登录时后端用 BCrypt 校验密码，成功后签发一个 JWT 令牌，令牌里只保存用户 ID。'
            + '之后每个请求在请求头携带 Bearer Token，由统一的拦截器解析令牌，并且每次都重新查询一次用户，'
            + '这样管理员封禁账号可以立即生效。接口默认需要登录，标注了 @PublicApi 的接口游客也能访问；'
            + '/api/admin 开头的接口只允许管理员访问，越权会返回 403。');
        const flow = [
            ['FaKey', '登录签发', 'BCrypt 校验密码，签发 JWT（仅含用户 ID）'],
            ['FaPaperPlane', '携带令牌', 'Axios 拦截器自动添加 Bearer Token'],
            ['FaShieldHalved', '统一拦截', 'AuthInterceptor 解析令牌并查库，封禁立即生效'],
            ['FaUserLock', '权限判定', '@PublicApi 游客可访问；/api/admin/** 仅管理员'],
        ];
        for (let i = 0; i < flow.length; i++) {
            const [ic, t, d] = flow[i];
            const y = 1.3 + i * 0.95;
            card(slide, M, y, 4.4, 0.82);
            await iconBadge(slide, ic, M + 0.18, y + 0.19, 0.44);
            slide.addText([
                { text: t, options: { bold: true, fontSize: 14, color: C.text1, breakLine: true } },
                { text: d, options: { fontSize: 11, color: C.text2 } },
            ], { x: M + 0.75, y: y + 0.04, w: 3.55, h: 0.74, margin: 0, valign: 'middle', isTextBox: true });
        }
        framedImage(slide, 'docs/diagrams/seq-login.png', { x: 5.1, y: 1.25, w: 4.4, h: 3.9 });
    }

    // 10 防超卖 ------------------------------------------------------
    {
        const slide = contentSlide('03  系统设计', '关键设计 ②：条件更新防止“超卖”',
            '第二个关键设计是防止超卖。二手商品只有一件，如果两个人同时下单，传统的“先查询再更新”会出现两个人都下单成功的问题。'
            + '我们的做法是把检查和修改合成一条带条件的 UPDATE 语句：只有当商品状态还是“在售”时才改为“交易中”，'
            + '数据库保证这一步是原子的。返回 1 行说明抢到了，返回 0 行说明已被别人抢先，直接返回 409。'
            + `我们专门写了并发测试：${STATS.buyers} 个买家线程同时抢同一件商品，重复 ${STATS.rounds} 轮，每轮都只有 1 人成功，其余 ${STATS.buyers - 1} 人收到 409。`);
        // 代码卡片
        card(slide, M, 1.3, 5.3, 2.55, { fill: HEX.code, line: '374151' });
        const codeLines = [
            ['// GoodsRepository：带条件的原子更新', '9CA3AF'],
            ['@Modifying', 'FDBA74'],
            ['@Query("update Goods g set g.status = :to', 'E5E7EB'],
            ['        where g.id = :id and g.status = :from")', 'E5E7EB'],
            ['int compareAndSetStatus(id, from, to);', 'E5E7EB'],
            ['', 'E5E7EB'],
            ['// OrderService#create', '9CA3AF'],
            ['if (compareAndSetStatus(id, ON_SALE, RESERVED) == 0)', 'E5E7EB'],
            ['    throw conflict("手慢了，商品已被其他同学下单");', '86EFAC'],
        ];
        slide.addText(codeLines.map(([t, c], i) => ({ text: t || ' ', options: { color: c, breakLine: i < codeLines.length - 1 } })), {
            x: M + 0.2, y: 1.45, w: 4.95, h: 2.3, fontFace: 'Courier New', fontSize: 11, margin: 0, valign: 'top', isTextBox: true,
        });
        const points = [
            '检查与修改合并为一条 SQL，由数据库保证原子性',
            '返回 0 行 → HTTP 409，前端提示“已被抢先下单”',
            '订单保存商品标题 / 图片 / 价格快照',
        ];
        bulletList(slide, points, { x: M, y: 4.0, w: 5.3, h: 1.1 }, 13);
        // 并发测试统计
        card(slide, 6.1, 1.3, 3.4, 3.8, { fill: HEX.orangeTint, line: 'FED7AA' });
        await iconBadge(slide, 'FaBolt', 6.35, 1.5, 0.48);
        slide.addText('并发测试 ConcurrentOrderTest', { x: 6.95, y: 1.5, w: 2.45, h: 0.48, fontSize: 12, bold: true, color: C.text1, margin: 0, valign: 'middle', isTextBox: true });
        statBlock(slide, { x: 6.35, y: 2.15, w: 3.0, value: STATS.buyers, unit: '个买家同时抢购', label: '同一件商品，线程池并发提交' });
        statBlock(slide, { x: 6.35, y: 3.1, w: 3.0, value: 1, unit: '人成功', label: `其余 ${STATS.buyers - 1} 人返回 409 Conflict`, color: C.accent3 });
        statBlock(slide, { x: 6.35, y: 4.05, w: 3.0, value: STATS.rounds, unit: '轮重复全部通过', label: '每轮只产生 1 个有效订单' });
    }

    // 11 状态机 ------------------------------------------------------
    {
        const slide = contentSlide('03  系统设计', '商品与订单状态机',
            '商品和订单都用状态机来管理。商品有六种状态：待审核、在售、审核未通过、交易中、已售出、已下架，'
            + '每个状态允许哪些操作在 Service 层用枚举集合严格校验，比如交易中和已售出的商品不能编辑。'
            + '订单有四种状态：待卖家确认、待交易、已完成、已取消，订单状态的变化会联动商品状态：'
            + '下单时商品变为交易中，取消时恢复在售，确认收货时变为已售出。');
        const left = framedImage(slide, 'docs/diagrams/state-goods.png', { x: M, y: 1.25, w: 4.6, h: 3.55 });
        caption(slide, '商品状态图（6 种状态）', M, left.y + left.h + 0.12, 4.6);
        const right = framedImage(slide, 'docs/diagrams/state-order.png', { x: 5.4, y: 1.25, w: 4.1, h: 3.55 });
        caption(slide, '订单状态图（4 种状态，联动商品状态）', 5.4, right.y + right.h + 0.12, 4.1);
    }

    // 12 项目结构与规模 ----------------------------------------------
    section('系统实现');
    {
        const slide = contentSlide('04  系统实现', '项目结构与开发规模',
            `实现阶段，后端共 ${STATS.javaFiles} 个 Java 源文件约 ${STATS.javaLines} 行，按 controller、service、repository、entity、dto、security 等包分层；`
            + `前端 ${STATS.jsFiles} 个 JS 模块约 ${STATS.jsLines} 行（含样式）；测试代码 ${STATS.testFiles} 个文件约 ${STATS.testLines} 行。`
            + '项目首次启动会自动写入演示数据，包括 6 个用户、7 个分类、18 件商品和若干订单，方便直接体验。');
        card(slide, M, 1.3, 4.3, 3.8, { fill: HEX.code, line: '374151' });
        const tree = [
            ['campus-market/', 'FDBA74'],
            ['├─ src/main/java/com/campus/market', 'E5E7EB'],
            ['│   ├─ controller   REST 接口（含 admin）', 'D1D5DB'],
            ['│   ├─ service      业务规则', 'D1D5DB'],
            ['│   ├─ repository   Spring Data JPA', 'D1D5DB'],
            ['│   ├─ entity / dto 实体与数据传输对象', 'D1D5DB'],
            ['│   ├─ security     JWT + 拦截器', 'D1D5DB'],
            ['│   └─ init         演示数据', 'D1D5DB'],
            ['├─ src/main/resources/static  Vue3 前端', 'E5E7EB'],
            ['├─ src/test/java   单元 / 集成 / 并发测试', 'E5E7EB'],
            ['├─ e2e             端到端系统测试', 'E5E7EB'],
            ['└─ docs            文档、设计图、截图', 'E5E7EB'],
        ];
        slide.addText(tree.map(([t, c], i) => ({ text: t, options: { color: c, breakLine: i < tree.length - 1 } })), {
            x: M + 0.2, y: 1.45, w: 4.0, h: 3.55, fontFace: 'Courier New', fontSize: 10.5, margin: 0, valign: 'top', isTextBox: true,
        });
        const stats = [
            [STATS.javaLines, '行', `后端 Java（${STATS.javaFiles} 个文件）`, 'FaJava'],
            [STATS.jsLines, '行', `前端代码（${STATS.jsFiles} 个模块）`, 'FaVuejs'],
            [STATS.testLines, '行', `测试代码（${STATS.testFiles} 个文件）`, 'FaVial'],
            [STATS.endpoints, '个', 'REST 接口', 'FaPlug'],
            [STATS.diagrams, '张', 'UML / 架构 / E-R 设计图', 'FaDiagramProject'],
            [20, '个', '前端页面与子页面', 'FaWindowMaximize'],
        ];
        for (let i = 0; i < stats.length; i++) {
            const [v, u, l, ic] = stats[i];
            const x = 5.1 + (i % 2) * 2.25;
            const y = 1.3 + Math.floor(i / 2) * 1.3;
            card(slide, x, y, 2.1, 1.15);
            await iconBadge(slide, ic, x + 1.55, y + 0.15, 0.38, C.background2, 'F97316');
            statBlock(slide, { x: x + 0.18, y: y + 0.05, w: 1.9, value: v, unit: u, label: l });
        }
    }

    // 13–17 界面展示 -------------------------------------------------
    const uiSlides = [
        {
            title: '界面展示 ①：首页浏览与搜索',
            shots: [['docs/screenshots/01-home.png', '首页：分类导航、排序、价格筛选'], ['docs/screenshots/03-search.png', '关键词搜索结果']],
            points: ['游客无需登录即可浏览', '标题 / 描述模糊搜索', '最新、最热、价格排序'],
            notes: '首页顶部是搜索框和发布入口，下面是分类导航、排序方式和价格区间筛选，商品以卡片形式展示价格、成色、卖家和浏览量。右边是关键词搜索的结果页。',
        },
        {
            title: '界面展示 ②：商品详情与下单',
            shots: [['docs/screenshots/04-detail.png', '商品详情：图片、价格、卖家、留言'], ['docs/screenshots/13-buy-dialog.png', '下单确认：给卖家留言']],
            points: ['收藏、留言与回复', '交易中商品不可再下单', '平台不涉及线上支付'],
            notes: '商品详情页展示大图、价格和原价、成色、交易地点、浏览和收藏数，下方是留言区，买家可以咨询，卖家可以回复。点击“我想要”弹出下单确认框，可以给卖家留言约定时间。',
        },
        {
            title: '界面展示 ③：发布闲置与我的发布',
            shots: [['docs/screenshots/07-publish.png', '发布商品：图片上传与表单校验'], ['docs/screenshots/08-my-goods.png', '我的发布：按状态管理']],
            points: ['最多 6 张图片，校验文件头', '前后端双重表单校验', '编辑后需重新审核'],
            notes: '发布页支持最多 6 张图片上传，前后端双重校验图片格式和大小，表单有必填和格式校验。发布后进入“我发布的”，可以按状态筛选，看到审核结果和驳回原因，并进行编辑、下架、重新上架。',
        },
        {
            title: '界面展示 ④：订单流转',
            shots: [['docs/screenshots/14-sold-orders.png', '我卖出的：确认订单后显示买家联系方式'], ['docs/screenshots/15-bought-orders.png', '我买到的：确认收货']],
            points: ['订单保存商品快照', '双方可见联系电话', '取消后商品自动恢复在售'],
            notes: '订单分为“我卖出的”和“我买到的”。卖家确认订单后，双方都能看到对方的联系电话，线下交易完成后由买家确认收货。每个订单都显示订单号、商品快照和买家留言。',
        },
        {
            title: '界面展示 ⑤：管理后台',
            shots: [['docs/screenshots/09-admin-dashboard.png', '数据概览：统计卡片与 ECharts 图表'], ['docs/screenshots/10-admin-audit.png', '商品审核：通过 / 驳回']],
            points: ['近 7 天下单趋势', '违规商品强制下架', '封禁用户、管理分类'],
            notes: '管理后台的数据概览页用统计卡片和 ECharts 展示用户数、商品数、成交额、近 7 天下单趋势、分类分布和商品状态。商品审核页按提交时间排列待审核商品，可以查看详情后通过或驳回。另外还有商品管理、用户封禁和分类管理页面。',
        },
    ];
    for (let k = 0; k < uiSlides.length; k++) {
        const ui = uiSlides[k];
        const slide = contentSlide('04  系统实现', ui.title, ui.notes);
        const bigW = 5.95;
        const sideW = 2.75;
        const bigX = k % 2 === 0 ? M : M + sideW + 0.3;
        const sideX = k % 2 === 0 ? M + bigW + 0.3 : M;
        const [bigFile, bigText] = ui.shots[0];
        const big = framedImage(slide, bigFile, { x: bigX, y: 1.3, w: bigW, h: 3.45 }, { top: true });
        caption(slide, bigText, bigX, big.y + big.h + 0.14, bigW);
        const [smallFile, smallText] = ui.shots[1];
        const small = framedImage(slide, smallFile, { x: sideX, y: 1.3, w: sideW, h: 1.8 }, { top: true });
        caption(slide, smallText, sideX, small.y + small.h + 0.12, sideW);
        bulletList(slide, ui.points, { x: sideX, y: small.y + small.h + 0.55, w: sideW, h: 1.6 }, 12);
    }

    // 18 测试策略 ----------------------------------------------------
    section('软件测试');
    {
        const unit = SUMMARY.byType['单元测试'] || 0;
        const integ = SUMMARY.byType['接口集成测试'] || 0;
        const conc = SUMMARY.byType['并发测试'] || 0;
        const slide = contentSlide('05  软件测试', '测试策略：三层测试金字塔',
            `测试按金字塔分三层。底层是 ${unit} 个单元测试，用 Mockito 隔离数据库，覆盖每个 Service 的业务规则和异常分支；`
            + `中间是 ${integ} 个接口集成测试和 ${conc} 轮并发测试，用 MockMvc 加真实的 H2 数据库，验证鉴权、参数校验和完整交易流程；`
            + `顶层是 ${E2E.total} 个端到端系统测试，用 Playwright 驱动真实浏览器模拟用户操作。`
            + `自动化测试共 ${SUMMARY.total} 次执行，全部通过，系统测试 ${E2E.passed}/${E2E.total} 通过。`);
        // 金字塔
        const levels = [
            { w: 2.5, label: '端到端系统测试', n: `${E2E.total} 个`, tool: 'Playwright', color: C.accent1 },
            { w: 3.6, label: '接口集成 + 并发测试', n: `${integ} + ${conc} 个`, tool: 'SpringBootTest · MockMvc · H2', color: 'FB923C' },
            { w: 4.7, label: '单元测试', n: `${unit} 个`, tool: 'JUnit 5 · Mockito', color: 'FDBA74' },
        ];
        const cx = M + 2.45;
        for (let i = 0; i < levels.length; i++) {
            const lv = levels[i];
            const y = 1.35 + i * 1.22;
            slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx - lv.w / 2, y, w: lv.w, h: 1.05, rectRadius: 0.1, fill: { color: lv.color }, line: { color: lv.color, width: 0 }, objectName: 'pyramid-' + i });
            slide.addText([
                { text: lv.label, options: { bold: true, fontSize: 14, color: i === 2 ? C.text1 : C.background1, breakLine: true } },
                { text: lv.n + ' · ' + lv.tool, options: { fontSize: 11, color: i === 2 ? C.text2 : 'FFF7ED' } },
            ], { x: cx - lv.w / 2, y, w: lv.w, h: 1.05, align: 'center', valign: 'middle', margin: 0.05, isTextBox: true });
        }
        // 大数字
        const stats = [
            [SUMMARY.total, '次', '自动化测试执行', C.accent1],
            [SUMMARY.passRate.toFixed(0) + '%', '', '通过率（0 失败）', C.accent3],
            [COV.line.toFixed(1) + '%', '', `行覆盖率（业务层 ${serviceCov.line}%）`, C.accent1],
            [COV.branch.toFixed(1) + '%', '', '分支覆盖率', C.accent1],
            [`${E2E.passed}/${E2E.total}`, '', '系统测试用例通过', C.accent3],
        ];
        card(slide, 5.6, 1.35, 3.9, 3.7);
        for (let i = 0; i < stats.length; i++) {
            const [v, u, l, c] = stats[i];
            const x = 5.85 + (i % 2) * 1.85;
            const y = 1.45 + Math.floor(i / 2) * 1.18;
            statBlock(slide, { x, y, w: 1.75, value: v, unit: u, label: l, color: c });
        }
    }

    // 19 覆盖率 ------------------------------------------------------
    {
        const pkgs = COV.byPackage.filter((p) => !['init', '(root)'].includes(p.package))
            .sort((a, b) => b.line - a.line);
        const slide = contentSlide('05  软件测试', '覆盖率分析（JaCoCo）',
            `JaCoCo 统计的整体行覆盖率是 ${COV.line}%，分支覆盖率 ${COV.branch}%，方法覆盖率 ${COV.method}%。`
            + `左图是各个包的行覆盖率，核心的 service 包达到 ${serviceCov.line}%。`
            + `整体数字被 init 包拉低了：它只负责写入演示数据，在测试环境中是关闭的；去掉它之后行覆盖率为 ${COV.lineExcludingInit}%。`);
        card(slide, M, 1.3, 5.4, 3.8);
        slide.addChart(pres.charts.BAR, [{ name: '行覆盖率', labels: pkgs.map((p) => p.package), values: pkgs.map((p) => p.line) }], {
            x: M + 0.1, y: 1.35, w: 5.2, h: 3.7, barDir: 'bar',
            chartColors: [THEME.colors.accent1], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0"%"',
            dataLabelFontSize: 10, dataLabelColor: THEME.colors.dk2, dataLabelFontFace: '+mn-lt',
            valAxisMaxVal: 110, valAxisMinVal: 0, valAxisHidden: true, valGridLine: { style: 'none' },
            catAxisLabelColor: THEME.colors.dk2, catAxisLabelFontSize: 11, catAxisLabelFontFace: '+mn-lt', catGridLine: { style: 'none' },
            catAxisOrientation: 'maxMin', showLegend: false,
            showTitle: true, title: '各包行覆盖率（%）', titleFontSize: 12, titleColor: THEME.colors.dk1, titleFontFace: '+mn-lt',
            barGapWidthPct: 60,
        });
        const callouts = [
            [COV.line.toFixed(1) + '%', '整体行覆盖率', `${COV.linesCovered}/${COV.linesTotal} 行`],
            [COV.branch.toFixed(1) + '%', '分支覆盖率', '覆盖主要异常分支'],
            [COV.method.toFixed(1) + '%', '方法覆盖率', ''],
            [COV.lineExcludingInit.toFixed(1) + '%', '不含 init 包', '演示数据初始化未参与测试'],
        ];
        for (let i = 0; i < callouts.length; i++) {
            const [v, l, d] = callouts[i];
            const y = 1.3 + i * 0.97;
            card(slide, 6.15, y, 3.35, 0.85);
            slide.addText(v, { x: 6.3, y: y + 0.08, w: 1.35, h: 0.7, fontSize: 22, bold: true, color: C.accent1, margin: 0, valign: 'middle', isTextBox: true });
            slide.addText([
                { text: l, options: { bold: true, fontSize: 12, color: C.text1, breakLine: !!d } },
                ...(d ? [{ text: d, options: { fontSize: 10, color: C.text2 } }] : []),
            ], { x: 7.7, y: y + 0.08, w: 1.75, h: 0.7, margin: 0, valign: 'middle', isTextBox: true });
        }
    }

    // 20 缺陷 --------------------------------------------------------
    {
        const slide = contentSlide('05  软件测试', `缺陷跟踪：发现 ${DEFECTS.length} 个，全部修复`,
            `开发和测试过程中一共记录了 ${DEFECTS.length} 个缺陷，覆盖构建、接口、后端逻辑、前端界面和测试脚本，都已经修复并通过回归测试。`
            + '比较典型的是浏览量统计：最初的实现会修改商品实体，可能顺带刷新商品的更新时间，我们改成数据库原子递增，并把该列设为不可通过实体更新。');
        const head = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.accent1 }, fontSize: 12 } });
        const cell = (t, opts = {}) => ({ text: t, options: { fontSize: 11, color: C.text1, ...opts } });
        slide.addTable([
            [head('编号'), head('缺陷描述'), head('发现阶段'), head('修复措施'), head('状态')],
            ...DEFECTS.map((d) => [cell(d.id, { bold: true }), cell(d.desc), cell(d.stage), cell(d.fix), cell('已修复', { color: '059669', bold: true })]),
        ], {
            x: M, y: 1.3, w: 9, colW: [0.9, 3.3, 1.0, 3.0, 0.8], rowH: 0.45,
            border: { type: 'solid', pt: 0.75, color: HEX.border }, fill: { color: C.background1 },
            fontFace: THEME.bodyFontFace, valign: 'middle', margin: 0.06,
        });
    }

    // 21 项目进度 ----------------------------------------------------
    section('总结展望');
    {
        const slide = contentSlide('06  总结展望', '项目进度安排',
            '项目从 9 月 18 日开始，历时约 6 周：第一周需求分析并评审，第二周完成概要和详细设计，'
            + '随后前后端并行编码约两周半，测试和编码后期重叠进行，最后半周整理文档、准备答辩。四个里程碑分别是需求评审、设计评审、系统提测和项目验收。');
        framedImage(slide, 'docs/diagrams/gantt.png', { x: M, y: 1.3, w: 9, h: 3.85 });
    }

    // 22 总结与展望 --------------------------------------------------
    {
        const slide = contentSlide('06  总结展望', '总结与展望',
            '总结一下：我们按软件工程流程完成了需求、设计、实现和测试，交付了一个功能完整、可以一键运行的系统，以及配套的五份文档。'
            + '通过这个项目，我们实践了分层架构、RESTful 接口设计、并发控制和自动化测试。'
            + '不足之处在于目前只支持线下交易，后续计划接入在线支付和担保交易、增加买卖双方即时聊天和消息通知、'
            + '根据浏览和收藏做个性化推荐，并使用 Docker 部署到云服务器。');
        slide.addText('完成情况', { x: M, y: 1.3, w: 4.3, h: 0.35, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true });
        const done = [
            ['功能完整', `5 大模块全部实现，${STATS.endpoints} 个 REST 接口`],
            ['测试充分', `自动化 ${SUMMARY.total} 次 + 系统测试 ${E2E.total} 个，全部通过`],
            ['文档齐全', '计划、需求、设计、实施、测试 5 份文档'],
            ['部署简单', 'H2 零配置，可切换 MySQL，单 jar 启动'],
        ];
        for (let i = 0; i < done.length; i++) {
            const [t, d] = done[i];
            const y = 1.75 + i * 0.82;
            card(slide, M, y, 4.3, 0.7);
            await iconBadge(slide, 'FaCheck', M + 0.15, y + 0.14, 0.42, C.accent3);
            slide.addText([
                { text: t, options: { bold: true, fontSize: 13, color: C.text1, breakLine: true } },
                { text: d, options: { fontSize: 11, color: C.text2 } },
            ], { x: M + 0.7, y: y + 0.04, w: 3.5, h: 0.62, margin: 0, valign: 'middle', isTextBox: true });
        }
        slide.addText('改进方向', { x: 5.2, y: 1.3, w: 4.3, h: 0.35, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true });
        const future = [
            ['FaCreditCard', '在线支付', '担保交易'],
            ['FaComments', '即时聊天', 'WebSocket'],
            ['FaBell', '消息通知', '订单状态提醒'],
            ['FaWandMagicSparkles', '智能推荐', '基于浏览 / 收藏'],
            ['FaCloud', '云端部署', 'Docker 容器化'],
            ['FaMobileScreen', '移动端', '小程序 / H5'],
        ];
        for (let i = 0; i < future.length; i++) {
            const [ic, t, d] = future[i];
            const x = 5.2 + (i % 2) * 2.2;
            const y = 1.75 + Math.floor(i / 2) * 1.1;
            card(slide, x, y, 2.05, 0.95, { fill: HEX.orangeTint, line: 'FED7AA' });
            await iconBadge(slide, ic, x + 0.15, y + 0.24, 0.46);
            slide.addText([
                { text: t, options: { bold: true, fontSize: 13, color: C.text1, breakLine: true } },
                { text: d, options: { fontSize: 11, color: C.text2 } },
            ], { x: x + 0.7, y: y + 0.08, w: 1.3, h: 0.8, margin: 0, valign: 'middle', isTextBox: true });
        }
    }

    // 23 致谢 --------------------------------------------------------
    {
        const slide = pres.addSlide({ masterName: 'CLOSING', sectionTitle });
        slide.addText('感谢聆听，敬请指正', { placeholder: 'title' });
        slide.addText('Q & A', { placeholder: 'body' });
        slide.addText(`演示账号：管理员 admin / admin123   ·   学生 zhangsan / 123456`, { x: M, y: 3.55, w: 9, h: 0.35, fontSize: 13, color: 'D1D5DB', align: 'center', margin: 0, isTextBox: true });
        slide.addText(`项目地址：${INFO.repo}`, { x: M, y: 3.95, w: 9, h: 0.35, fontSize: 12, color: '9CA3AF', align: 'center', margin: 0, isTextBox: true });
        slide.addNotes('我的汇报到这里结束，谢谢各位老师。现场可以用演示账号登录系统进行演示，欢迎老师提问。');
    }

    await pres.writeFile({ fileName: OUT });
    await applyTheme(OUT, THEME);
    console.log('已生成', path.relative(ROOT, OUT));
}

build().catch((e) => {
    console.error(e);
    process.exit(1);
});
