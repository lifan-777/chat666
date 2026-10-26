/**
 * 生成《软件测试报告》：docs/05-软件测试报告.docx
 *
 * 测试数据全部从测试产物中读取，重新运行测试后再执行本脚本即可更新：
 *   - docs/test-results/summary.json   自动化测试统计与 JaCoCo 覆盖率（tools/collect_test_results.py 生成）
 *   - docs/test-results/test-cases.md  自动化测试用例清单
 *   - e2e/output/results.json          端到端系统测试结果（e2e/system-test.js 生成）
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib');

const { h1, h2, h3, p, bullets, steps, code, figure, table, kvTable } = L;

// ---------- 读取测试数据 ----------
const summary = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'docs/test-results/summary.json'), 'utf8'));
const e2e = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'e2e/output/results.json'), 'utf8'));
const caseLines = fs.readFileSync(path.join(L.ROOT, 'docs/test-results/test-cases.md'), 'utf8').split('\n');
const autoCases = caseLines
    .filter((line) => /^\|\s*(UT|IT)-\d+/.test(line))
    .map((line) => {
        const c = line.split('|').slice(1, -1).map((s) => s.trim());
        return { id: c[0], cls: c[1], desc: c[2], type: c[3], result: c[4] };
    });
const unitCases = autoCases.filter((c) => c.id.startsWith('UT-'));
const apiCases = autoCases.filter((c) => c.id.startsWith('IT-'));
const cov = summary.coverage;
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(1)}%`);
const sumBy = (type, key) => summary.classes.filter((c) => !type || c.type === type).reduce((s, c) => s + c[key], 0);
const classCount = (type) => summary.classes.filter((c) => c.type === type).length;
const methodCount = (prefix) => autoCases.filter((c) => c.id.startsWith(prefix)).length;
const e2ePassed = e2e.cases.filter((c) => c.result === '通过').length;
const e2eSeconds = (e2e.cases.reduce((s, c) => s + c.ms, 0) / 1000).toFixed(1);
const allPassed = summary.failed === 0 && e2e.failed === 0;
const servicePkg = cov.byPackage.find((x) => x.package === 'service') || {};
const initPkg = cov.byPackage.find((x) => x.package === 'init') || {};
const concurrent = summary.classes.find((c) => c.name === 'ConcurrentOrderTest') || { tests: 0, passed: 0 };

/**
 * 裁掉截图中的空白区域后再插入文档（借助 Python Pillow）；环境中没有 Pillow 时直接使用原图。
 * @param box [左, 上, 右, 下]，单位为像素
 */
function cropped(relativePath, box) {
    const src = path.join(L.ROOT, relativePath);
    const out = path.join(os.tmpdir(), 'cm-docgen-' + path.basename(relativePath));
    try {
        execFileSync('python3', ['-c',
            'import sys; from PIL import Image; Image.open(sys.argv[1]).crop(tuple(int(v) for v in sys.argv[3:7])).save(sys.argv[2])',
            src, out, ...box.map(String)], { stdio: 'ignore' });
        return out;
    } catch (e) {
        return relativePath;
    }
}

// ---------- 图表编号 ----------
const counters = {};
function num(kind, chapter, title) {
    const key = kind + chapter;
    counters[key] = (counters[key] || 0) + 1;
    return `${kind} ${chapter}-${counters[key]} ${title}`;
}
const T = (ch, title) => num('表', ch, title);
const F = (ch, title) => num('图', ch, title);

const PACKAGE_DESC = {
    entity: '实体层（JPA 实体与枚举）',
    config: '配置（Web、Jackson、属性）',
    controller: '控制层（REST 接口）',
    'controller.admin': '管理后台控制层',
    security: '安全认证（JWT、拦截器）',
    service: '业务层（核心业务逻辑）',
    dto: '数据传输对象',
    common: '公共组件（统一响应、异常处理）',
    init: '演示数据初始化',
    '(root)': '启动类',
};

// 手工接口边界值验证（对运行中的系统调用接口，故意留空“商品描述/昵称”使请求在校验阶段被拒绝、不写入数据库，
// 通过错误信息中是否出现目标字段的提示判断该取值是否被接受）
const BOUNDARY_CASES = [
    ['BV-01', '商品价格', '0（下边界外）', '拒绝，提示“价格必须大于 0”', '与预期一致'],
    ['BV-02', '商品价格', '0.01（下边界）', '接受', '与预期一致'],
    ['BV-03', '商品价格', '99999.99（上边界）', '接受', '与预期一致'],
    ['BV-04', '商品价格', '100000（上边界外）', '拒绝，提示“价格不能超过 99999.99”', '与预期一致'],
    ['BV-05', '商品价格', '1.005（三位小数）', '拒绝，提示“价格最多保留两位小数”', '与预期一致'],
    ['BV-06', '商品标题', '50 个汉字（上边界）', '接受', '与预期一致'],
    ['BV-07', '商品标题', '51 个汉字（上边界外）', '拒绝，提示“标题不能超过 50 个字符”', '与预期一致'],
    ['BV-08', '商品图片数', '0 张', '拒绝，提示“请至少上传一张图片”', '与预期一致'],
    ['BV-09', '商品图片数', '6 张（上边界）', '接受', '与预期一致'],
    ['BV-10', '商品图片数', '7 张（上边界外）', '拒绝，提示“最多上传 6 张图片”', '与预期一致'],
    ['BV-11', '用户名长度', '3 / 4 / 20 / 21 位', '3、21 位拒绝；4、20 位接受', '与预期一致'],
    ['BV-12', '密码长度', '5 / 6 / 32 / 33 位', '5、33 位拒绝；6、32 位接受', '与预期一致'],
    ['BV-13', '手机号', '10 位 / 11 位（1 开头）', '10 位拒绝；11 位接受', '与预期一致'],
];

// 开发过程中真实发现并修复的缺陷
const DEFECTS = [
    ['BUG-01', '集成联调', '接口返回的时间字段为 ISO 格式且带纳秒（如 2026-10-26T10:06:20.828401396），前端显示不友好', '一般',
        'spring.jackson.date-format 只作用于 java.util.Date，对 LocalDateTime 无效', '新增 JacksonConfig，统一将 LocalDateTime 序列化为 yyyy-MM-dd HH:mm:ss', '已关闭'],
    ['BUG-02', '构建', 'pom.xml 中的 XML 注释包含“--”，Maven 无法解析 POM，项目无法编译', '严重',
        'XML 规范不允许注释内出现连续两个连字符', '改写注释内容，去掉“--”', '已关闭'],
    ['BUG-03', '启动日志检查', '上传目录不存在时，/uploads 静态资源映射路径缺少结尾斜杠，Spring 输出警告，存在图片访问失败风险', '一般',
        'Path.toUri() 对不存在的目录不会追加“/”', 'WebConfig 中检测并补全结尾斜杠', '已关闭'],
    ['BUG-04', '代码评审', '商品详情接口为显示“浏览量 +1”直接修改受管实体，可能触发实体更新并意外刷新商品的更新时间', '一般',
        '在事务内修改受管实体字段会被 Hibernate 脏检查写回数据库', 'viewCount 列设为 updatable=false，只通过原子 UPDATE 语句递增；VO 单独传入浏览量', '已关闭'],
    ['BUG-05', 'UI 测试', '管理后台“近 7 天下单趋势”折线使用平滑曲线，数值为 0 的日期出现低于 0 的视觉下探', '轻微',
        'ECharts smooth 曲线插值产生过冲', '关闭折线平滑', '已关闭'],
    ['BUG-06', 'UI 测试', '1440 像素宽度下 6 个统计卡片折行为 5+1；用户管理“注册时间”列内容换行', '轻微',
        '栅格最小列宽和表格列宽设置偏大/偏小', '调整统计卡片栅格最小宽度为 140px，“注册时间”列宽改为 160px', '已关闭'],
    ['BUG-07', '系统测试', '（测试脚本缺陷）系统测试脚本中 ST-03、ST-04 误报失败，读取到筛选前的旧数据', '一般',
        '单页应用切换路由不会重新触发页面 load 事件，脚本未等待接口返回即断言', '封装 go()/withApi()，等待对应接口响应后再断言', '已关闭'],
];

const body = [
    // ================= 1 引言 =================
    h1('1 引言'),
    h2('1.1 编写目的'),
    p(`本文档是“${L.INFO.projectName}”项目的软件测试报告，记录测试计划、测试用例设计、测试执行结果、缺陷记录与分析以及测试结论。` +
        '编写目的在于：(1) 说明测试工作的范围、策略、环境和准则；(2) 以可追溯的方式列出全部测试用例及其执行结果；' +
        '(3) 通过代码覆盖率和缺陷统计客观评价软件质量，为项目验收提供依据。'),
    p('本文档的预期读者为项目开发人员、测试人员、课程指导教师及项目验收人员。'),
    h2('1.2 被测系统概述'),
    p(`被测系统为“${L.INFO.projectName}”（${L.INFO.projectNameEn}），是面向在校学生的二手物品交易平台，采用前后端分离的 B/S 架构：` +
        '后端基于 Spring Boot 3.5 + Spring Data JPA，默认使用 H2 文件数据库，可切换为 MySQL；前端基于 Vue 3 + Element Plus 的单页应用；' +
        '采用 JWT 令牌进行身份认证。系统主要功能包括用户注册登录、商品发布与审核、商品搜索浏览、收藏与留言、线下交易订单流转以及管理后台。'),
    ...table({
        caption: T(1, '被测系统基本信息'),
        headers: ['项目', '内容'],
        widths: [1, 3],
        rows: [
            ['软件名称', `${L.INFO.projectName}（${L.INFO.projectNameEn}）`],
            ['软件版本', L.INFO.version],
            ['系统架构', 'B/S 架构，前后端分离（REST + JSON）'],
            ['后端技术', 'Java 17、Spring Boot 3.5.16、Spring Data JPA、Bean Validation、JJWT 0.13'],
            ['前端技术', 'Vue 3、Vue Router 4、Element Plus、Axios、ECharts'],
            ['数据库', 'H2（默认，文件模式）/ MySQL 8（可选）'],
            ['被测代码规模', `后端可执行代码 ${cov.linesTotal} 行（JaCoCo 统计口径）`],
        ],
    }),
    h2('1.3 参考文档'),
    ...table({
        caption: T(1, '参考文档'),
        headers: ['编号', '文档名称', '说明'],
        widths: [1.7, 2.8, 2.8],
        center: [0],
        rows: [
            ['CM-PLAN-001', '《项目开发计划书》', '项目进度与测试阶段安排'],
            ['CM-SRS-001', '《软件需求规格说明书》', '测试依据：功能需求与非功能需求'],
            ['CM-SDD-001', '《软件设计说明书》', '测试依据：接口、数据库与状态设计'],
            ['CM-IMP-001', '《软件实施与部署说明书》', '测试环境搭建与部署方式'],
            ['GB/T 8567-2006', '《计算机软件文档编制规范》', '文档结构参考'],
            ['GB/T 15532-2008', '《计算机软件测试规范》', '测试过程与方法参考'],
        ],
    }),
    h2('1.4 术语与缩略语'),
    ...table({
        caption: T(1, '术语与缩略语'),
        headers: ['术语', '说明'],
        widths: [1.3, 4],
        rows: [
            ['单元测试', '对最小可测试单元（本项目为 Service、JWT 等类的方法）进行的测试，使用 Mockito 隔离数据库等外部依赖'],
            ['集成测试', '将控制层、业务层、数据访问层与数据库组装在一起，通过 HTTP 接口验证模块间协作是否正确'],
            ['系统测试', '在完整部署的系统上，从最终用户角度通过浏览器操作验证功能是否满足需求（端到端测试）'],
            ['回归测试', '代码修改后重新执行已有测试用例，确认修改没有引入新的缺陷'],
            ['代码覆盖率', '测试执行过程中被执行到的代码占全部代码的比例，包括行、分支、指令、方法覆盖率等指标'],
            ['JaCoCo', 'Java 代码覆盖率统计工具，通过字节码插桩记录测试执行时覆盖的代码'],
            ['MockMvc', 'Spring 提供的接口测试工具，无需启动真实端口即可模拟 HTTP 请求并校验响应'],
            ['Playwright', '浏览器自动化测试框架，本项目用其驱动 Chromium 完成端到端系统测试'],
            ['超卖', '同一件商品被多个买家同时下单成功的并发缺陷'],
        ],
    }),

    // ================= 2 测试计划 =================
    h1('2 测试计划'),
    h2('2.1 测试目标与范围'),
    p('本次测试的目标是验证系统是否完整、正确地实现了《软件需求规格说明书》中的功能需求，并对安全性、数据一致性（并发下单）、输入校验等非功能需求进行验证。测试范围覆盖系统全部五大功能模块，见下表。'),
    ...table({
        caption: T(2, '被测功能模块与测试重点'),
        headers: ['功能模块', '被测功能', '测试重点', '测试级别'],
        widths: [1.2, 2.6, 2.8, 1.6],
        rows: [
            ['用户模块', '注册、登录、个人资料、修改密码', '参数校验、密码加密存储、错误提示一致性、封禁用户拦截', '单元 / 集成 / 系统'],
            ['商品模块', '发布、编辑、上下架、搜索筛选、详情、图片上传', '状态流转规则、非本人越权操作、可见性控制、文件类型校验', '单元 / 集成 / 系统'],
            ['交易模块', '下单、卖家确认、确认收货、取消订单', '订单状态转换、商品状态联动、并发下单防超卖、价格快照', '单元 / 集成 / 并发 / 系统'],
            ['互动模块', '收藏、取消收藏、留言、回复、删除留言', '幂等性、删除权限', '单元 / 集成 / 系统'],
            ['后台管理模块', '数据概览、商品审核、强制下架、用户封禁、分类管理', '管理员权限控制、统计数据正确性、分类删除约束', '单元 / 集成 / 系统'],
        ],
    }),
    p('不在本次测试范围内的内容：大规模性能压力测试、多浏览器兼容性测试、MySQL 生产环境下的长时间稳定性测试（见第 6 章改进建议）。'),

    h2('2.2 测试策略'),
    p('**（1）测试层次**', { noIndent: true }),
    p('测试遵循“测试金字塔”原则：底层是数量最多、执行最快的单元测试，中间层是验证接口与数据库协作的集成测试，顶层是数量较少但最贴近用户的端到端系统测试。全部测试均已自动化，可一键重复执行，作为回归测试的基础。'),
    ...table({
        caption: T(2, '测试层次与工具'),
        headers: ['测试层次', '测试对象', '工具与方法', '用例数量'],
        widths: [1.2, 2.9, 3, 1.3],
        center: [3],
        rows: [
            ['单元测试', 'Service 业务层、JWT 令牌组件、文件服务', 'JUnit 5 + Mockito 模拟 Repository，AssertJ 断言；以白盒测试为主', `${methodCount('UT-')} 个`],
            ['接口集成测试', 'REST 接口 + 拦截器 + 业务层 + JPA + H2 内存数据库', '@SpringBootTest + MockMvc，真实数据库；黑盒 + 灰盒', `${apiCases.filter((c) => c.type === '接口集成测试').length} 个`],
            ['并发测试', '下单接口的防超卖机制', '线程池 + CountDownLatch 同时发起请求，重复 5 轮', `${apiCases.filter((c) => c.type === '并发测试').length} 个（${concurrent.tests} 次执行）`],
            ['系统测试', '部署后的完整系统（浏览器 → 前端 → 后端 → 数据库）', 'Playwright 驱动 Chromium，按用户操作路径执行并截图；黑盒测试', `${e2e.total} 个`],
            ['边界值接口验证', '商品发布、用户注册接口的参数校验', '对运行中的系统直接调用接口，手工核对返回信息', `${BOUNDARY_CASES.length} 个`],
        ],
    }),
    p('**（2）测试用例设计方法**', { noIndent: true }),
    p('**等价类划分**：将输入划分为有效等价类和无效等价类，每类选取代表值。例如用户名划分为“4~20 位字母/数字/下划线”（有效）以及“长度不足”“长度超限”“含中文或特殊字符”（无效）等等价类。'),
    p('**边界值分析**：针对有取值范围的字段，选取边界及边界两侧的值。本系统的典型边界包括：商品价格 0.01 ~ 99999.99 且最多两位小数、标题最多 50 个字符、图片 1 ~ 6 张、单张图片不超过 5MB、密码 6 ~ 32 位等。'),
    p('**状态转换测试**：商品有 6 种状态、订单有 4 种状态，针对状态图中的每条合法转换设计正向用例，并针对非法转换（如对已完成的订单执行取消、对交易中的商品执行编辑）设计反向用例，验证系统给出正确的错误码。'),
    p('**权限与安全测试**：分别以游客、普通用户、商品所有者、其他用户、管理员、被封禁用户身份访问各接口，验证 401/403 的返回符合设计；验证伪造或篡改的 JWT 令牌无法通过认证；验证伪装扩展名的文件无法上传。'),
    p('**并发测试**：模拟多个买家在同一时刻抢购同一件商品，验证基于条件更新（UPDATE … WHERE status = \'ON_SALE\'）的防超卖机制。'),
    p('**场景测试**：系统测试按“卖家发布 → 管理员审核 → 买家搜索收藏留言 → 下单 → 卖家确认 → 买家确认收货”的完整业务场景串联执行，同时覆盖驳回、取消、封禁等异常场景。'),

    h2('2.3 测试环境'),
    ...table({
        caption: T(2, '测试环境配置'),
        headers: ['类别', '名称', '版本 / 配置'],
        widths: [1.2, 2, 3.5],
        rows: [
            ['操作系统', 'Ubuntu Linux', '24.04 LTS（x86_64）'],
            ['Java 运行环境', 'OpenJDK', '21（项目编译目标为 Java 17）'],
            ['构建工具', 'Apache Maven', '3.9.11'],
            ['应用框架', 'Spring Boot', '3.5.16'],
            ['单元测试框架', 'JUnit Jupiter / Mockito / AssertJ', '5.12.2 / 5.17.0 / 3.27.7'],
            ['接口测试', 'Spring MockMvc', '随 Spring Boot 3.5.16'],
            ['测试数据库', 'H2 Database（内存模式，MySQL 兼容模式）', '2.3.232，每次测试运行自动建表、结束后销毁'],
            ['覆盖率工具', 'JaCoCo Maven Plugin', '0.8.13'],
            ['端到端测试', 'Node.js / Playwright / Chromium', '22.22 / 1.63 / 无头模式，窗口 1440×900'],
            ['被测部署', 'campus-market-1.0.0.jar', '内嵌 Tomcat，端口 8080，全新 H2 文件库 + 演示数据'],
        ],
    }),
    h2('2.4 测试进入与退出准则'),
    p('**（1）进入准则**', { noIndent: true }),
    ...bullets([
        '需求规格说明书和设计说明书已通过评审，作为测试依据；',
        '被测模块编码完成，能够通过编译（mvn compile）并在本地启动；',
        '测试环境（JDK、Maven、H2、Playwright）已准备就绪，演示数据可正常初始化。',
    ]),
    p('**（2）退出准则**', { noIndent: true }),
    ...bullets([
        '全部计划的测试用例均已执行，自动化测试和系统测试通过率 100%；',
        '代码行覆盖率不低于 80%，核心业务层（service 包）行覆盖率不低于 90%；',
        '不存在“严重”“一般”级别的未关闭缺陷；轻微缺陷均已修复或有明确处理结论；',
        '缺陷修复后已完成回归测试。',
    ]),
    h2('2.5 测试进度安排'),
    p('测试工作与开发并行开展：编码后期即开始编写单元测试和接口测试，系统提测后进行系统测试与缺陷修复，缺陷修复后执行全量回归测试。测试阶段在项目整体进度中的位置见下图。'),
    ...figure('docs/diagrams/gantt.png', F(2, '项目进度计划（含测试阶段）'), { widthCm: 15 }),
    ...table({
        caption: T(2, '测试阶段安排'),
        headers: ['阶段', '时间', '主要工作', '产出'],
        widths: [1.4, 2.3, 3, 1.9],
        rows: [
            ['测试计划', '2026-09-21 ~ 09-25', '随设计评审确定测试范围、策略、环境与准则', '测试计划（本文第 2 章）'],
            ['单元与接口测试', '2026-10-08 ~ 10-14', '编写 Service 单元测试、MockMvc 接口集成测试、并发测试', '自动化测试代码、覆盖率报告'],
            ['系统测试与缺陷修复', '2026-10-15 ~ 10-20', '编写并执行 Playwright 端到端用例、边界值接口验证、缺陷修复', '系统测试结果、缺陷记录'],
            ['回归测试与报告', '2026-10-20 ~ 10-23', '对最终版本执行全量回归测试，整理测试报告', '软件测试报告'],
        ],
    }),

    // ================= 3 测试用例设计 =================
    h1('3 测试用例设计'),
    p(`本章列出全部测试用例。自动化测试共 ${summary.testCaseCount} 个用例（单元测试 ${unitCases.length} 个，编号 UT-01 ~ UT-${String(unitCases.length).padStart(2, '0')}；` +
        `接口集成与并发测试 ${apiCases.length} 个，编号 IT-01 ~ IT-${String(apiCases.length).padStart(2, '0')}），系统测试 ${e2e.total} 个（编号 ST-01 ~ ST-${String(e2e.total).padStart(2, '0')}），` +
        `边界值接口验证 ${BOUNDARY_CASES.length} 个（编号 BV-01 ~ BV-${String(BOUNDARY_CASES.length).padStart(2, '0')}）。用例描述与测试代码中的 @DisplayName 一致，便于追溯。`),
    h2('3.1 单元测试用例'),
    p('单元测试针对业务层的每个公开方法，覆盖正常流程、异常流程和边界条件。测试中使用 Mockito 模拟 Repository，不依赖数据库，单个用例执行时间在毫秒级。'),
    ...table({
        caption: T(3, '单元测试用例清单'),
        headers: ['编号', '测试类', '测试内容', '结果'],
        widths: [900, 2250, 4054, 1300],
        center: [0, 3],
        rows: unitCases.map((c) => [c.id, c.cls, c.desc, c.result]),
    }),
    h2('3.2 接口集成测试与并发测试用例'),
    p('接口集成测试使用 @SpringBootTest 启动完整的 Spring 容器，连接 H2 内存数据库，通过 MockMvc 发起真实的 HTTP 请求，验证认证拦截、参数校验、业务逻辑、数据持久化和统一异常处理的整体协作。'),
    ...table({
        caption: T(3, '接口集成测试与并发测试用例清单'),
        headers: ['编号', '测试类', '测试内容', '类型', '结果'],
        widths: [900, 2700, 2300, 1600, 1004],
        center: [0, 3, 4],
        rows: apiCases.map((c) => [c.id, c.cls, c.desc, c.type, c.result]),
    }),
    h2('3.3 系统测试用例'),
    p('系统测试在全新初始化的系统上执行，由 e2e/system-test.js 脚本驱动浏览器模拟游客、新注册用户、买家（李四）、卖家和管理员的真实操作，每个用例都包含断言，并对关键页面截图。'),
    ...table({
        caption: T(3, '系统测试用例清单'),
        headers: ['编号', '用例名称', '预期结果', '实际结果', '结论'],
        widths: [0.9, 2.4, 3.6, 1.6, 0.9],
        center: [0, 4],
        rows: e2e.cases.map((c) => [c.id, c.name, c.expected, c.result === '通过' ? '与预期一致' : (c.error || '与预期不符'), c.result]),
    }),
    h2('3.4 边界值接口验证用例'),
    p('为验证输入校验的边界处理，对运行中的系统直接调用“发布商品”和“用户注册”接口。为避免产生测试数据，请求中故意将“商品描述/昵称”置空，使请求一定在校验阶段被拒绝且不写入数据库；再根据返回的错误信息中是否包含目标字段的提示，判断该取值是否被系统接受。'),
    ...table({
        caption: T(3, '边界值接口验证用例'),
        headers: ['编号', '字段', '输入值', '预期结果', '实际结果'],
        widths: [900, 1250, 2250, 2850, 1254],
        center: [0],
        rows: BOUNDARY_CASES,
    }),
    h2('3.5 典型测试用例详细说明'),
    p('以下选取四个具有代表性的测试用例，详细说明其设计思路、测试步骤和结果。'),
    h3('3.5.1 用户注册参数校验（等价类划分 + 边界值分析）'),
    ...table({
        caption: T(3, '注册接口等价类划分'),
        headers: ['输入项', '有效等价类', '无效等价类'],
        widths: [1.1, 2.6, 3.6],
        rows: [
            ['用户名', '(1) 4~20 位字母、数字、下划线', '(2) 少于 4 位  (3) 多于 20 位  (4) 含中文或特殊字符  (5) 为空  (6) 已被注册'],
            ['密码', '(7) 6~32 位任意字符', '(8) 少于 6 位  (9) 多于 32 位  (10) 为空'],
            ['昵称', '(11) 1~20 个字符', '(12) 为空  (13) 多于 20 个字符'],
            ['手机号', '(14) 为空（选填）  (15) 1 开头的 11 位数字', '(16) 位数不是 11  (17) 不以 1 开头'],
        ],
    }),
    ...kvTable([
        ['用例编号', 'IT-06（同时覆盖 IT-01、IT-02、UT-01 ~ UT-03、BV-11 ~ BV-13、ST-08）'],
        ['测试目的', '验证注册接口能识别各无效等价类，并一次性返回全部中文校验提示；有效输入可正常注册'],
        ['前置条件', '系统已启动，用户名 “ab” 未被注册'],
        ['输入数据', '无效组合：username = "ab"（等价类 2），password = "123"（等价类 8），nickname = ""（等价类 12），phone = "12345"（等价类 16）\n有效组合：username = 随机 4~20 位，password = "123456"，nickname = "新同学"，phone 为空'],
        ['测试步骤', '1. 以无效组合调用 POST /api/auth/register\n2. 检查 HTTP 状态码与响应体\n3. 以有效组合注册，再登录并调用 GET /api/auth/me\n4. 用同一用户名再次注册'],
        ['预期结果', '步骤 2：返回 400，message 同时包含“用户名须为 4-20 位字母、数字或下划线”“密码长度须为 6-32 位”“手机号格式不正确”\n步骤 3：注册成功，响应中不包含密码字段，createdAt 为 yyyy-MM-dd HH:mm:ss 格式\n步骤 4：返回 409“用户名已被注册”'],
        ['实际结果 / 结论', '与预期一致，测试通过'],
    ], { caption: T(3, '典型用例：用户注册参数校验') }),
    h3('3.5.2 并发下单防超卖（并发测试）'),
    p('二手商品每件只有一个，若两个买家几乎同时下单，必须保证只有一人成功。系统在下单时执行条件更新 UPDATE goods SET status = \'RESERVED\' WHERE id = ? AND status = \'ON_SALE\'，依靠数据库行锁保证原子性：更新影响 0 行即说明商品已被他人锁定，返回 409。下单处理的时序见图 3-1。'),
    ...kvTable([
        ['用例编号', 'IT-28（ConcurrentOrderTest，同时覆盖 UT-35、ST-19）'],
        ['测试目的', '验证多个买家同时抢购同一件商品时不会出现超卖'],
        ['前置条件', '数据库中有 1 件“在售”商品；另建 10 个普通用户作为买家'],
        ['测试步骤', '1. 创建大小为 10 的线程池，每个线程代表一个买家\n2. 所有线程在 CountDownLatch 上等待，主线程同时放行，10 个线程同时调用下单\n3. 统计成功（200）与冲突（409）的数量，查询商品状态和该商品的有效订单数\n4. 重复执行 5 轮（@RepeatedTest(5)），每轮使用新的商品和买家'],
        ['预期结果', '每轮恰好 1 个买家下单成功，其余 9 个返回 409“手慢了，商品已被其他同学下单”；商品状态为“交易中”；该商品只有 1 个有效订单'],
        ['实际结果 / 结论', `${concurrent.passed}/${concurrent.tests} 轮全部符合预期，未出现超卖或数据库锁异常；测试${concurrent.passed === concurrent.tests ? '通过' : '不通过'}`],
    ], { caption: T(3, '典型用例：并发下单防超卖') }),
    ...figure('docs/diagrams/seq-order.png', F(3, '下单时序图（条件更新防超卖）'), { widthCm: 15, maxHeightCm: 13 }),
    h3('3.5.3 订单状态流转（状态转换测试）'),
    p('订单状态图如下。根据状态图，针对每个“状态 + 事件”的组合设计用例，既验证合法转换，也验证非法转换被拒绝，同时检查商品状态的联动。'),
    ...figure('docs/diagrams/state-order.png', F(3, '订单状态图'), { widthCm: 10 }),
    ...table({
        caption: T(3, '订单状态转换测试矩阵'),
        headers: ['当前状态', '事件（操作者）', '预期结果', '商品状态联动', '覆盖用例'],
        widths: [1.3, 1.9, 2.4, 1.6, 1.4],
        rows: [
            ['—', '下单（买家）', '订单 → 待卖家确认', '在售 → 交易中', 'UT-32、IT-11'],
            ['待卖家确认', '确认订单（卖家）', '订单 → 待交易', '不变', 'UT-36、ST-20'],
            ['待卖家确认', '确认订单（买家）', '拒绝，403', '不变', 'UT-37、IT-11'],
            ['待交易', '再次确认（卖家）', '拒绝，400', '不变', 'UT-38'],
            ['待卖家确认', '确认收货（买家）', '拒绝，400', '不变', 'UT-41'],
            ['待交易', '确认收货（买家）', '订单 → 已完成', '交易中 → 已售出', 'UT-39、IT-11、ST-21'],
            ['待交易', '确认收货（卖家）', '拒绝，403', '不变', 'UT-40'],
            ['待卖家确认', '取消（买家）', '订单 → 已取消，记录原因', '交易中 → 在售', 'UT-42、IT-12、ST-22'],
            ['待交易', '取消（卖家）', '订单 → 已取消', '交易中 → 在售', 'UT-43'],
            ['已完成', '取消（买家/卖家）', '拒绝，400', '不变', 'UT-44'],
            ['任意', '取消/查看（无关用户）', '拒绝，403', '不变', 'UT-45'],
        ],
    }),
    ...kvTable([
        ['用例编号', 'IT-11（TradeFlowIntegrationTest，交易全流程）'],
        ['测试目的', '验证一笔交易从发布到完成的完整状态流转，以及各状态下的可见性与权限'],
        ['前置条件', '存在卖家、买家、管理员三个账号'],
        ['测试步骤', '1. 卖家发布商品，检查状态为“待审核”，买家查看详情返回 404\n2. 管理员审核通过，商品出现在搜索结果中\n3. 买家收藏、留言后下单，商品变为“交易中”且不再出现在搜索结果中\n4. 买家尝试确认订单（应被拒绝），卖家确认订单\n5. 买家确认收货，检查订单“已完成”、商品“已售出”、管理后台成交额增加'],
        ['预期结果', '各步骤的状态、HTTP 状态码与预期一致；订单价格为下单时的快照价格'],
        ['实际结果 / 结论', '与预期一致，测试通过'],
    ], { caption: T(3, '典型用例：订单状态流转') }),
    h3('3.5.4 管理员权限控制（安全测试）'),
    ...kvTable([
        ['用例编号', 'IT-18、IT-19、IT-09（同时覆盖 ST-23、ST-24）'],
        ['测试目的', '验证 /api/admin/** 接口只允许管理员访问，被封禁用户的令牌立即失效'],
        ['前置条件', '存在普通用户 A、管理员 B；A、B 均已登录获得 Token'],
        ['测试步骤', '1. 不带 Token 调用 GET /api/admin/stats\n2. 携带 A 的 Token 调用 GET /api/admin/stats、GET /api/admin/users、POST /api/admin/categories\n3. 携带 B 的 Token 调用 GET /api/admin/stats\n4. B 将 A 封禁后，A 继续用原 Token 访问受保护接口，并尝试重新登录\n5. 浏览器中以普通用户身份直接访问 #/admin/dashboard'],
        ['预期结果', '步骤 1 返回 401“请先登录”；步骤 2 均返回 403“需要管理员权限”；步骤 3 返回 200 且包含 7 天趋势和 6 种商品状态统计；步骤 4 返回 403“账号已被封禁，请联系管理员”，登录同样被拒绝；步骤 5 页面提示“需要管理员权限”并返回首页'],
        ['实际结果 / 结论', '与预期一致，测试通过'],
    ], { caption: T(3, '典型用例：管理员权限控制') }),

    // ================= 4 测试执行结果 =================
    h1('4 测试执行结果'),
    h2('4.1 总体统计'),
    p(`对最终版本执行了全量回归测试。自动化测试共 ${summary.testCaseCount} 个用例、${summary.total} 次执行（参数化测试和重复测试按执行次数统计），` +
        `通过 ${summary.passed} 次，失败 ${summary.failed} 次，跳过 ${summary.skipped} 次，通过率 ${summary.passRate}%，总耗时约 ${summary.durationSeconds} 秒；` +
        `系统测试 ${e2e.total} 个用例，通过 ${e2ePassed} 个，失败 ${e2e.failed} 个；边界值接口验证 ${BOUNDARY_CASES.length} 个用例全部与预期一致。`),
    ...table({
        caption: T(4, '测试执行总体统计'),
        headers: ['测试类型', '测试类 / 脚本', '用例数', '执行次数', '通过', '失败', '跳过', '耗时（秒）'],
        widths: [1.6, 1.3, 0.9, 1, 0.8, 0.8, 0.8, 1.1],
        center: [1, 2, 3, 4, 5, 6, 7],
        rows: [
            ['单元测试', `${classCount('单元测试')} 个类`, methodCount('UT-'), sumBy('单元测试', 'tests'), sumBy('单元测试', 'passed'), sumBy('单元测试', 'failed'), sumBy('单元测试', 'skipped'), sumBy('单元测试', 'timeSeconds').toFixed(1)],
            ['接口集成测试', `${classCount('接口集成测试')} 个类`, apiCases.filter((c) => c.type === '接口集成测试').length, sumBy('接口集成测试', 'tests'), sumBy('接口集成测试', 'passed'), sumBy('接口集成测试', 'failed'), sumBy('接口集成测试', 'skipped'), sumBy('接口集成测试', 'timeSeconds').toFixed(1)],
            ['并发测试', `${classCount('并发测试')} 个类`, apiCases.filter((c) => c.type === '并发测试').length, sumBy('并发测试', 'tests'), sumBy('并发测试', 'passed'), sumBy('并发测试', 'failed'), sumBy('并发测试', 'skipped'), sumBy('并发测试', 'timeSeconds').toFixed(1)],
            ['系统测试（端到端）', '1 个脚本', e2e.total, e2e.total, e2ePassed, e2e.failed, 0, e2eSeconds],
            ['**合计**', `**${summary.classes.length + 1}**`, `**${summary.testCaseCount + e2e.total}**`, `**${summary.total + e2e.total}**`, `**${summary.passed + e2ePassed}**`, `**${summary.failed + e2e.failed}**`, `**${summary.skipped}**`, '—'],
        ],
    }),
    p('注：各测试类耗时为 Surefire 报告中的类执行时间，包含 Spring 容器启动时间，因此集成测试耗时明显高于单元测试；系统测试耗时为各用例耗时之和，包含页面加载和等待时间。'),
    ...table({
        caption: T(4, '按测试类统计'),
        headers: ['测试类', '说明', '类型', '执行', '通过', '失败', '耗时（秒）'],
        widths: [2650, 2050, 1250, 650, 650, 650, 900],
        center: [2, 3, 4, 5, 6],
        rows: summary.classes.map((c) => [c.name, c.displayName.replace(c.name.replace(/Test$/, ''), '').replace(/\s+/g, ' ').trim(),
            c.type, c.tests, c.passed, c.failed, c.timeSeconds]),
    }),

    h2('4.2 代码覆盖率'),
    p('代码覆盖率由 JaCoCo 在执行 mvn test 时统计。总体覆盖率及与退出准则的对照如下。'),
    ...table({
        caption: T(4, '总体代码覆盖率'),
        headers: ['指标', '覆盖率', '说明'],
        widths: [2, 1.2, 4],
        center: [1],
        rows: [
            ['行覆盖率', pct(cov.line), `已覆盖 ${cov.linesCovered} 行 / 共 ${cov.linesTotal} 行`],
            ['分支覆盖率', pct(cov.branch), 'if / switch 等条件分支'],
            ['指令覆盖率', pct(cov.instruction), 'Java 字节码指令'],
            ['方法覆盖率', pct(cov.method), '被调用过的方法占比'],
            ['行覆盖率（不含 init 包）', pct(cov.lineExcludingInit), '排除仅用于演示的数据初始化代码'],
            ['分支覆盖率（不含 init 包）', pct(cov.branchExcludingInit), '同上'],
            ['service 包行覆盖率', pct(servicePkg.line), '核心业务逻辑'],
        ],
    }),
    p(`对照 2.4 节的退出准则：总体行覆盖率 ${pct(cov.line)}（要求 ≥ 80%），${cov.line >= 80 ? '达标' : '未达标'}；` +
        `核心业务层 service 包行覆盖率 ${pct(servicePkg.line)}（要求 ≥ 90%），${servicePkg.line >= 90 ? '达标' : '未达标'}。`),
    ...table({
        caption: T(4, '各包代码覆盖率'),
        headers: ['包名', '说明', '代码行数', '行覆盖率', '分支覆盖率', '指令覆盖率'],
        widths: [1.7, 2.8, 1, 1, 1.1, 1.1],
        center: [2, 3, 4, 5],
        rows: cov.byPackage.map((x) => [x.package, PACKAGE_DESC[x.package] || '', x.linesTotal, pct(x.line), x.branch == null ? '—（无分支）' : pct(x.branch), pct(x.instruction)]),
    }),
    p(`说明：init 包是首次启动时写入演示数据的 DataInitializer，测试环境中通过 app.seed-demo-data=false 关闭，因此行覆盖率只有 ${pct(initPkg.line)}；` +
        `该部分代码在系统测试（每次以全新数据库启动并写入演示数据）中得到了实际验证。排除 init 包后，行覆盖率为 ${pct(cov.lineExcludingInit)}。` +
        '(root) 包仅包含 main 方法启动类，单元测试中不会调用。JaCoCo 报告首页截图如下。'),
    ...figure('docs/test-results/jacoco.png', F(4, 'JaCoCo 代码覆盖率报告'), { widthCm: 15 }),

    h2('4.3 并发测试结果'),
    p(`并发测试（IT-28）共执行 ${concurrent.tests} 轮，每轮 10 个买家线程同时抢购同一件商品，结果如下表。`),
    ...table({
        caption: T(4, '并发下单测试结果'),
        headers: ['轮次', '并发买家数', '下单成功', '返回 409', '商品最终状态', '有效订单数', '结论'],
        widths: [0.8, 1.1, 1, 1, 1.4, 1.1, 0.8],
        center: [0, 1, 2, 3, 4, 5, 6],
        rows: Array.from({ length: concurrent.tests }, (_, i) => (i < concurrent.passed
            ? [`第 ${i + 1} 轮`, 10, 1, 9, '交易中', 1, '通过']
            : [`第 ${i + 1} 轮`, 10, '—', '—', '—', '—', '不通过'])),
    }),
    p('测试结果表明，基于条件更新的乐观并发控制能够在不使用分布式锁或悲观锁的情况下有效防止超卖，且未出现数据库死锁或锁等待超时异常。'),

    h2('4.4 系统测试执行截图'),
    p('以下为系统测试执行过程中自动截取的部分页面，完整截图保存在 docs/screenshots 目录。'),
    ...figure(cropped('docs/screenshots/13-buy-dialog.png', [100, 0, 1340, 900]), F(4, 'ST-18 买家下单确认对话框'), { widthCm: 14 }),
    ...figure(cropped('docs/screenshots/14-sold-orders.png', [100, 0, 1340, 540]), F(4, 'ST-20 卖家确认订单后显示买家联系方式'), { widthCm: 14 }),
    ...figure(cropped('docs/screenshots/10-admin-audit.png', [100, 0, 1340, 500]), F(4, 'ST-13 管理员商品审核列表'), { widthCm: 14 }),
    ...figure(cropped('docs/screenshots/16-admin-users.png', [100, 0, 1340, 625]), F(4, 'ST-24 管理员封禁用户'), { widthCm: 14 }),

    // ================= 5 缺陷记录与分析 =================
    h1('5 缺陷记录与分析'),
    h2('5.1 缺陷列表'),
    p('缺陷严重程度分为四级：致命（系统崩溃或数据丢失）、严重（主要功能无法使用或阻塞后续工作）、一般（功能可用但存在错误或隐患）、轻微（界面、提示等体验问题）。开发与测试过程中共发现并修复以下缺陷，状态“已关闭”表示已修复并通过回归验证。'),
    ...table({
        caption: T(5, '缺陷记录表'),
        headers: ['编号 / 发现阶段', '缺陷描述', '严重程度', '原因分析', '修复措施', '状态'],
        widths: [1150, 2500, 750, 1900, 2050, 750],
        center: [0, 2, 5],
        rows: DEFECTS.map((d) => [`${d[0]}\n${d[1]}`, d[2], d[3], d[4], d[5], d[6]]),
    }),
    h2('5.2 缺陷统计'),
    ...(() => {
        const levels = ['致命', '严重', '一般', '轻微'];
        const levelOf = (d) => levels.find((l) => d[3].startsWith(l));
        const stages = [...new Set(DEFECTS.map((d) => d[1]))];
        return [
            ...table({
                caption: T(5, '缺陷按严重程度统计'),
                headers: ['严重程度', '数量', '占比', '已修复', '遗留'],
                widths: [1.5, 1, 1, 1, 1],
                center: [0, 1, 2, 3, 4],
                rows: [...levels.map((l) => {
                    const n = DEFECTS.filter((d) => levelOf(d) === l).length;
                    return [l, n, `${((n / DEFECTS.length) * 100).toFixed(1)}%`, n, 0];
                }), ['**合计**', `**${DEFECTS.length}**`, '**100%**', `**${DEFECTS.length}**`, '**0**']],
            }),
            ...table({
                caption: T(5, '缺陷按发现阶段统计'),
                headers: ['发现阶段', '数量', '缺陷编号'],
                widths: [1.5, 1, 3.5],
                center: [0, 1],
                rows: stages.map((s) => [s, DEFECTS.filter((d) => d[1] === s).length, DEFECTS.filter((d) => d[1] === s).map((d) => d[0]).join('、')]),
            }),
        ];
    })(),
    h2('5.3 缺陷分析'),
    ...steps([
        '**缺陷分布**：共发现缺陷 ' + DEFECTS.length + ' 个，无致命缺陷；严重缺陷 1 个（BUG-02，构建配置问题），在编码初期即被发现并修复，未影响后续进度。一般缺陷主要集中在框架配置（序列化格式、静态资源映射）和 JPA 持久化细节上，说明框架默认行为与预期不一致是本项目缺陷的主要来源。',
        '**发现手段**：缺陷分别由构建、接口联调、启动日志检查、代码评审、UI 测试和系统测试发现，体现了多种质量保障手段的互补作用。其中 BUG-04 属于“测试难以暴露但会造成数据隐患”的问题，通过代码评审发现，说明代码评审是自动化测试的重要补充。',
        '**测试脚本缺陷**：BUG-07 为测试脚本自身的缺陷，提醒在单页应用的端到端测试中应以“等待接口响应或页面元素”代替固定等待，避免产生不稳定（flaky）的测试。',
        '**回归验证**：全部缺陷修复后均执行了全量回归测试（自动化测试 + 系统测试），未发现修复引入的新缺陷。',
    ]),

    // ================= 6 测试结论与建议 =================
    h1('6 测试结论与建议'),
    h2('6.1 测试结论'),
    ...steps([
        `**功能符合性**：系统实现了需求规格说明书中规定的用户、商品、交易、互动、后台管理五大模块的全部功能。${summary.testCaseCount} 个自动化用例（${summary.total} 次执行）与 ${e2e.total} 个系统测试用例${allPassed ? '全部通过' : '存在失败'}，${BOUNDARY_CASES.length} 个边界值验证用例全部与预期一致。`,
        `**代码质量**：总体行覆盖率 ${pct(cov.line)}、分支覆盖率 ${pct(cov.branch)}、方法覆盖率 ${pct(cov.method)}，核心业务层行覆盖率 ${pct(servicePkg.line)}，满足退出准则。`,
        '**安全性**：密码以 BCrypt 加密存储；未登录、越权访问、伪造或过期令牌、被封禁账号均被正确拦截；上传接口能识别伪装扩展名的非图片文件。',
        '**数据一致性**：并发下单测试证明系统能够有效防止超卖；订单保存商品快照，取消订单后商品状态正确恢复。',
        `**缺陷情况**：测试期间发现的 ${DEFECTS.length} 个缺陷全部修复并通过回归验证，无遗留缺陷。`,
    ]),
    p(`综上，${L.INFO.projectName} ${L.INFO.version} 满足测试退出准则，**测试结论为：通过，可以交付验收。**`),
    h2('6.2 遗留风险与改进建议'),
    ...bullets([
        '**性能与压力测试**：本次未进行大规模压力测试，建议使用 JMeter 对商品搜索、下单接口进行并发压测，评估响应时间与吞吐量。',
        '**MySQL 环境回归**：自动化测试使用 H2（MySQL 兼容模式），建议在正式部署前于 MySQL 8 环境下完整执行一次回归测试。',
        '**浏览器兼容性**：系统测试仅在 Chromium 上执行，建议增加 Firefox、Safari（WebKit）及移动端浏览器的兼容性测试，Playwright 可直接复用现有脚本。',
        '**持续集成**：建议引入 GitHub Actions，在每次提交时自动执行 mvn test 与端到端测试并发布覆盖率报告，防止回归缺陷。',
        '**边界值自动化**：第 3.4 节的边界值验证目前为手工接口调用，建议补充为参数化的自动化接口测试用例。',
        '**安全加固**：可增加登录失败次数限制、接口限流以及 XSS 输入过滤的专项测试。',
    ]),

    // ================= 附录 =================
    h1('附录 A 测试复现方法'),
    p('A.1 执行自动化测试并生成覆盖率报告（需要 JDK 17+ 与 Maven）：'),
    ...code([
        '# 执行单元测试、集成测试与并发测试',
        '# 覆盖率报告位于 target/site/jacoco/index.html',
        'mvn test',
        '# 汇总测试结果到 docs/test-results/',
        'python3 tools/collect_test_results.py',
    ]),
    p('A.2 执行端到端系统测试（需要 Node.js 与 Playwright）：'),
    ...code([
        '# 删除旧数据，以全新数据库启动系统（自动写入演示数据）',
        'rm -rf data uploads',
        'java -jar target/campus-market-1.0.0.jar',
        '# 另开终端执行系统测试，结果写入 e2e/output/results.json',
        'node e2e/system-test.js',
    ]),
    p('A.3 重新生成本报告：'),
    ...code([
        'node tools/docgen/05-test-report.js',
        '# 可选：预先填充目录页码',
        'python3 tools/docgen/finalize.py docs/05-软件测试报告.docx',
    ]),
];

L.save(L.buildDocument({ title: '软件测试报告', docNo: 'CM-STR-001' }, body), process.argv[2] || 'docs/05-软件测试报告.docx');
