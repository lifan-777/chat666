/**
 * 生成《软件实施与部署说明书》：docs/04-软件实施与部署说明书.docx
 * 代码片段直接从源文件中截取，保证文档与代码一致。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Paragraph, TextRun } = require('docx');
const L = require('./lib');

const { h1, h2, h3, p, bullets, steps, code, figure, table, kvTable } = L;
const ROOT = L.ROOT;

// ---------- 工具函数 ----------

/** 从源文件截取片段：从包含 start 的行开始，到其后第一个包含 end 的行结束（含），并去掉公共缩进 */
function snippet(file, start, end, { skipFrom } = {}) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
    const from = lines.findIndex((l) => l.includes(start));
    if (from < 0) throw new Error(`${file} 中找不到：${start}`);
    let to = lines.findIndex((l, i) => i > from && l.includes(end));
    if (to < 0) throw new Error(`${file} 中找不到结束标记：${end}`);
    let picked = lines.slice(from, to + 1);
    if (skipFrom) {
        // 省略中间部分，用注释代替
        const cut = picked.findIndex((l) => l.includes(skipFrom.start));
        const resume = picked.findIndex((l, i) => i > cut && l.includes(skipFrom.end));
        if (cut >= 0 && resume > cut) {
            const indent = picked[cut].match(/^\s*/)[0];
            picked = [...picked.slice(0, cut), indent + skipFrom.note, ...picked.slice(resume)];
        }
    }
    const indent = Math.min(...picked.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length));
    return picked.map((l) => l.slice(indent).replace(/\s+$/, ''));
}

function codeBlock(title, lines) {
    return [
        new Paragraph({
            spacing: { before: 120, after: 40 },
            keepNext: true,
            children: [new TextRun({ text: title, size: 18, color: '6B7280', font: { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: '黑体' } })],
        }),
        ...code(lines),
    ];
}

function count(cmd) {
    return execSync(cmd, { cwd: ROOT, shell: '/bin/bash' }).toString().trim();
}

function linesOf(glob) {
    const n = count(`files=$(find ${glob} 2>/dev/null); [ -z "$files" ] && echo 0 || cat $files | wc -l`);
    return Number(n);
}

function filesOf(glob) {
    return Number(count(`find ${glob} 2>/dev/null | wc -l`));
}

/**
 * 截图自动裁剪：截图是 1440×900 的整屏，内容较少的页面下方是大片灰色背景和页脚。
 * 检测页脚上边框（整行 #E5E7EB）后，向上跳过纯背景色（#F5F6F8）的行，裁掉空白部分。
 * 需要 Python + Pillow；不可用时直接使用原图。
 */
const CROP_DIR = path.join(require('os').tmpdir(), 'campus-docgen-crops');
const CROP_SCRIPT = `
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()
def ratio(y, color):
    return sum(1 for x in range(0, w, 4) if px[x, y] == color) / len(range(0, w, 4))
footer = next((y for y in range(h - 1, 300, -1) if ratio(y, (229, 231, 235)) > 0.98), None)
if footer is None:
    im.save(dst); sys.exit()
y = footer - 1
while y > 300 and ratio(y, (245, 246, 248)) > 0.995:
    y -= 1
im.crop((0, 0, w, min(h, y + 24))).save(dst)
`;

function cropped(file) {
    const out = path.join(CROP_DIR, path.basename(file));
    try {
        fs.mkdirSync(CROP_DIR, { recursive: true });
        execSync(`python3 -c "$CROP" "${path.join(ROOT, file)}" "${out}"`, { env: { ...process.env, CROP: CROP_SCRIPT }, stdio: 'pipe' });
        return out;
    } catch (e) {
        return file;
    }
}

const shot = (name) => cropped(name.includes('/') ? name : `docs/screenshots/${name}.png`);
const diagram = (name) => `docs/diagrams/${name}.png`;

// ---------- 代码规模（实时统计） ----------
const JAVA_MAIN = 'src/main/java -name "*.java"';
const JAVA_TEST = 'src/test/java -name "*.java"';
const stats = {
    mainFiles: filesOf(JAVA_MAIN),
    mainLines: linesOf(JAVA_MAIN),
    testFiles: filesOf(JAVA_TEST),
    testLines: linesOf(JAVA_TEST),
    testClasses: filesOf('src/test/java -name "*Test.java"'),
    jsFiles: filesOf('src/main/resources/static/js -name "*.js"'),
    jsLines: linesOf('src/main/resources/static/js -name "*.js"'),
    cssLines: linesOf('src/main/resources/static/css -name "*.css"'),
    htmlLines: linesOf('src/main/resources/static -maxdepth 1 -name "*.html"'),
    ymlLines: linesOf('src/main/resources -maxdepth 1 -name "*.yml"'),
    e2eLines: linesOf('e2e -maxdepth 1 -name "*.js"'),
    apis: Number(count('grep -rhoE "@(Get|Post|Put|Delete)Mapping" src/main/java/com/campus/market/controller | wc -l')),
    adminApis: Number(count('grep -rhoE "@(Get|Post|Put|Delete)Mapping" src/main/java/com/campus/market/controller/admin | wc -l')),
};
const pkgStats = ['common', 'config', 'security', 'controller', 'dto', 'entity', 'repository', 'service', 'init']
    .map((pkg) => ({
        pkg,
        files: filesOf(`src/main/java/com/campus/market/${pkg} -name "*.java"`),
        lines: linesOf(`src/main/java/com/campus/market/${pkg} -name "*.java"`),
    }));

let testSummary = { total: 0, passed: 0, testCaseCount: 0, coverage: {} };
try {
    testSummary = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/test-results/summary.json'), 'utf8'));
} catch (e) {
    // 尚未运行测试时使用默认值
}
let e2e = { total: 0, passed: 0 };
try {
    e2e = JSON.parse(fs.readFileSync(path.join(ROOT, 'e2e/output/results.json'), 'utf8'));
} catch (e) {
    // 尚未运行系统测试
}

// ---------- 正文 ----------
const body = [];

// 1 引言
body.push(
    h1('1 引言'),
    h2('1.1 编写目的'),
    p('本文档是“校园二手交易平台”（Campus Market）项目软件实施阶段的说明文档，记录系统的编码实现方式、构建与部署方法以及面向最终用户的操作说明。文档的目标是让任何一位具备 Java Web 基础的读者，能够依据本文档在新的计算机上独立完成项目的构建、部署和运行，并能够理解关键功能在代码中的实现位置，为后续维护和扩展提供依据。'),
    p('本文档的编码实现部分与《软件设计说明书》（CM-SDD-001）相互对应：设计说明书回答“系统应该如何设计”，本文档回答“设计是如何落实到代码中的、系统如何交付使用”。文中所有代码片段均直接摘自项目源代码，配置项和命令均已在开发环境中实际验证。'),
    h2('1.2 适用读者'),
    table({
        caption: '表 1-1 文档读者与阅读重点',
        headers: ['读者', '关注内容', '建议阅读章节'],
        widths: [1.3, 3, 1.6],
        rows: [
            ['开发与维护人员', '项目结构、编码规范、关键代码实现、维护方法', '第 3、4、7 章'],
            ['部署与运维人员', '运行环境、构建打包、启动参数、数据库切换、故障排查', '第 2、5 章'],
            ['最终用户（学生）', '注册登录、发布商品、购买、收藏、留言等操作', '第 6.1、6.2 节'],
            ['平台管理员', '数据概览、商品审核、用户管理、分类管理', '第 6.3 节'],
            ['课程指导教师', '实施过程是否完整、实现是否与设计一致', '全文'],
        ],
    }),
    h2('1.3 术语与缩略语'),
    table({
        caption: '表 1-2 术语与缩略语',
        headers: ['术语', '说明'],
        widths: [1.4, 4.6],
        rows: [
            ['SPA', 'Single Page Application，单页应用。前端只加载一次 index.html，页面切换由 Vue Router 在浏览器内完成'],
            ['REST API', '基于 HTTP 的资源式接口，本系统所有接口以 /api 开头，请求和响应均为 JSON'],
            ['JWT', 'JSON Web Token，登录成功后服务器签发的令牌，前端在请求头 Authorization: Bearer <token> 中携带'],
            ['JPA', 'Java Persistence API，本系统通过 Spring Data JPA（Hibernate 实现）访问数据库'],
            ['H2', '纯 Java 编写的嵌入式数据库，默认以文件方式保存在 ./data 目录，无需单独安装'],
            ['Profile', 'Spring Boot 的配置环境，启用 mysql profile 后改为连接 MySQL 数据库'],
            ['CAS 条件更新', 'Compare-And-Set，带条件的 UPDATE 语句，仅当商品当前状态为“在售”时才更新为“交易中”，用于防止超卖'],
            ['E2E 测试', 'End-to-End 端到端测试，用真实浏览器模拟用户操作，验证完整业务流程'],
        ],
    }),
    h2('1.4 参考资料'),
    bullets([
        '《校园二手交易平台 软件需求规格说明书》CM-SRS-001',
        '《校园二手交易平台 软件设计说明书》CM-SDD-001',
        '《校园二手交易平台 软件测试报告》CM-STR-001',
        'GB/T 8567-2006《计算机软件文档编制规范》',
        'Spring Boot 3.5 官方参考文档；Vue 3、Element Plus 官方文档',
    ]),
);

// 2 开发环境
body.push(
    h1('2 开发环境与工具'),
    h2('2.1 软硬件环境'),
    p('项目采用前后端同仓、单体部署的方式开发。后端使用 Spring Boot 3.5（要求 JDK 17 及以上），前端使用 Vue 3 与 Element Plus，第三方前端库以静态文件形式随后端一起打包。开发与验证所用环境如表 2-1 所示。'),
    table({
        caption: '表 2-1 开发环境与工具',
        headers: ['类别', '名称及版本', '用途'],
        widths: [1.2, 2.4, 3.2],
        rows: [
            ['操作系统', 'Windows 10/11、macOS 或 Linux（开发验证使用 Ubuntu 24.04）', '开发与运行，跨平台'],
            ['JDK', 'JDK 17 及以上（开发验证使用 OpenJDK 21）', '编译和运行后端，Spring Boot 3 最低要求 JDK 17'],
            ['构建工具', 'Apache Maven 3.9.x', '依赖管理、编译、测试、打包'],
            ['后端框架', 'Spring Boot 3.5.16（Web、Data JPA、Validation）', 'REST 接口、数据访问、参数校验'],
            ['安全组件', 'jjwt 0.13.0、spring-security-crypto（BCrypt）', 'JWT 令牌签发与校验、密码加密'],
            ['数据库', 'H2 2.x（默认，嵌入式）/ MySQL 8.x（可选）', '业务数据持久化'],
            ['前端框架', 'Vue 3.5、Vue Router 4.6、Element Plus 2.14、Axios 1.x、ECharts 5.6', '页面、路由、UI 组件、HTTP 请求、统计图表'],
            ['IDE', 'IntelliJ IDEA 2024+ 或 VS Code（Extension Pack for Java）', '代码编写与调试'],
            ['版本控制', 'Git 2.x + GitHub', '源码管理与协作'],
            ['浏览器', 'Chrome / Edge 最新版', '运行与调试前端页面'],
            ['测试工具', 'JUnit 5、Mockito、Spring MockMvc、JaCoCo 0.8.13、Playwright', '单元测试、接口测试、覆盖率统计、端到端测试'],
            ['文档工具', 'Node.js 18+（docx 库）、LibreOffice、PlantUML + Graphviz', '生成 Word 文档、刷新目录、绘制 UML 图'],
        ],
    }),
    h2('2.2 主要依赖说明'),
    p('后端依赖在 pom.xml 中声明，版本统一由 spring-boot-starter-parent 管理，仅 jjwt 与 JaCoCo 插件单独指定版本。关键依赖如下：'),
    codeBlock('pom.xml（节选）', snippet('pom.xml', '<dependencies>', '<artifactId>spring-security-crypto</artifactId>')
        .concat(['    </dependency>', '    <!-- 其余：jjwt、h2、mysql-connector-j、spring-boot-starter-test …… -->', '</dependencies>'])),
    bullets([
        '**spring-boot-starter-web**：内嵌 Tomcat，提供 Spring MVC 与 JSON 序列化能力。',
        '**spring-boot-starter-data-jpa**：基于 Hibernate 的 ORM，Repository 接口自动生成实现。',
        '**spring-boot-starter-validation**：基于 Jakarta Bean Validation 的请求参数校验。',
        '**spring-security-crypto**：只引入 BCrypt 密码加密，不引入完整的 Spring Security 过滤器链，认证与鉴权由自定义拦截器完成，结构更简单、便于讲解。',
        '**jjwt**：签发和解析 HS256 签名的 JWT。',
        '**h2 / mysql-connector-j**：两种数据库驱动都在运行时类路径中，通过 Profile 切换。',
    ]),
);

// 3 项目结构
body.push(
    h1('3 项目结构说明'),
    h2('3.1 总体结构'),
    p('项目是一个标准的 Maven 工程，前端静态资源放在 src/main/resources/static 下，与后端一起打包为一个可执行 jar。系统的分层架构如图 3-1 所示：浏览器中的 Vue 单页应用通过 REST/JSON 接口访问后端，后端按“拦截器 → 控制层 → 业务层 → 数据访问层”分层处理请求。'),
    figure(diagram('architecture'), '图 3-1 系统架构图', { widthCm: 13.5, maxHeightCm: 14 }),
    p('仓库根目录结构如下（省略 target、data、uploads 等运行时生成的目录）：'),
    code([
        'chat666/',
        '├── pom.xml                         Maven 构建配置',
        '├── README.md                       项目说明',
        '├── src/main/java/com/campus/market/',
        '│   ├── CampusMarketApplication.java  启动类',
        '│   ├── common/        统一响应、分页结果、业务异常、全局异常处理',
        '│   ├── config/        Web 配置、Jackson 配置、自定义配置属性',
        '│   ├── security/      JWT、登录拦截器、@PublicApi、当前用户上下文',
        '│   ├── controller/    REST 控制器（admin/ 子包为管理后台接口）',
        '│   ├── dto/           请求与响应对象（Java record）',
        '│   ├── entity/        JPA 实体与枚举',
        '│   ├── repository/    Spring Data JPA 仓库接口',
        '│   ├── service/       业务逻辑',
        '│   └── init/          演示数据初始化',
        '├── src/main/resources/',
        '│   ├── application.yml           默认配置（H2）',
        '│   ├── application-mysql.yml     MySQL 配置',
        '│   └── static/                   前端单页应用',
        '├── src/test/java/                单元测试、接口测试、并发测试',
        '├── e2e/system-test.js            端到端系统测试（Playwright）',
        '├── docs/                         文档、设计图、截图、测试结果',
        '└── tools/                        文档生成、UML 渲染、演示图片生成脚本',
    ]),
    h2('3.2 后端包结构与职责'),
    table({
        caption: '表 3-1 后端各包职责与规模',
        headers: ['包名', '主要类', '职责', '文件数', '代码行'],
        widths: [1.2, 2.6, 2.6, 0.7, 0.7],
        center: [3, 4],
        rows: [
            ['common', 'ApiResponse、PageResult、BusinessException、GlobalExceptionHandler', '统一响应结构与异常处理', ...num('common')],
            ['config', 'WebConfig、JacksonConfig、AppProperties', '注册拦截器、上传目录映射、BCrypt Bean、时间格式', ...num('config')],
            ['security', 'JwtTokenProvider、AuthInterceptor、PublicApi、UserContext', '令牌签发校验、登录与权限拦截', ...num('security')],
            ['controller', 'AuthController、GoodsController、OrderController 等 9 个 + admin 子包 3 个', '接收 HTTP 请求、参数校验、调用业务层', ...num('controller')],
            ['dto', 'GoodsRequest、GoodsVO、OrderVO、StatsVO 等 22 个 record', '接口入参与出参，避免直接暴露实体', ...num('dto')],
            ['entity', 'User、Category、Goods、Favorite、Comment、TradeOrder 及 5 个枚举', '数据库表映射与状态定义', ...num('entity')],
            ['repository', 'UserRepository、GoodsRepository、TradeOrderRepository 等', '数据访问，含自定义 JPQL 与条件更新', ...num('repository')],
            ['service', 'UserService、GoodsService、OrderService、StatsService 等 8 个', '核心业务规则与事务控制', ...num('service')],
            ['init', 'DataInitializer', '首次启动写入演示数据', ...num('init')],
        ],
    }),
    h2('3.3 前端目录结构'),
    p('前端采用“无构建步骤”的方式组织：Vue、Element Plus 等库使用官方提供的浏览器版本（global build），业务代码使用浏览器原生支持的 ES Module（import/export）拆分为多个文件。这样既保留了组件化开发方式，又不需要安装 Node.js 和执行 npm build，后端打包后即可直接运行。'),
    table({
        caption: '表 3-2 前端目录说明',
        headers: ['路径', '说明'],
        widths: [2.4, 4.6],
        rows: [
            ['static/index.html', '单页入口，按顺序加载第三方库与 js/main.js'],
            ['static/css/app.css', '全局样式，覆盖 Element Plus 主题色为橙色 #F97316，含窄屏适配'],
            ['static/js/main.js', '应用入口：路由表、路由守卫、全局注册图标组件、挂载应用'],
            ['static/js/api.js', 'Axios 实例与全部接口函数，统一处理 Token、错误提示和登录过期'],
            ['static/js/store.js', '全局登录状态（reactive），持久化到 localStorage'],
            ['static/js/utils.js', '状态常量、价格与时间格式化、确认框封装'],
            ['static/js/components/', '公共组件：AppHeader（顶部导航）、GoodsCard（商品卡片）、UserAvatar（头像）'],
            ['static/js/pages/', '页面组件：Home、GoodsDetail、Publish、Login、Register'],
            ['static/js/pages/me/', '个人中心：UserCenter 布局、MyGoods、Orders、Favorites、Profile'],
            ['static/js/pages/admin/', '管理后台：AdminLayout 布局、Dashboard、Audit、GoodsManage、Users、Categories'],
            ['static/lib/', '第三方库本地副本（见表 3-3）'],
            ['static/demo-images/', '演示数据使用的商品图片（由 tools/gen_demo_images.py 生成）'],
        ],
    }),
    table({
        caption: '表 3-3 本地化的第三方前端库',
        headers: ['文件', '库及版本', '作用'],
        widths: [2.6, 2, 2.4],
        rows: [
            ['vue.global.prod.js', 'Vue 3.5.44', '响应式视图框架（含模板编译器）'],
            ['vue-router.global.prod.js', 'Vue Router 4.6.4', 'Hash 模式前端路由'],
            ['element-plus.full.min.js / .css', 'Element Plus 2.14.7', 'UI 组件库'],
            ['element-plus-zh-cn.min.js', 'Element Plus 中文语言包', '分页、日期等组件中文化'],
            ['element-plus-icons.min.js', '@element-plus/icons-vue 2.3.2', '图标组件'],
            ['axios.min.js', 'Axios 1.20.0', 'HTTP 请求'],
            ['echarts.min.js', 'Apache ECharts 5.6.0', '管理后台统计图表'],
        ],
    }),
    p('第三方库没有使用 CDN 而是放在本地，原因有三点：一是答辩演示现场可能没有外网，本地化后断网也能正常运行；二是避免 CDN 服务不稳定或被墙导致页面空白；三是版本固定，不会因 CDN 上的版本更新而引入不兼容问题。'),
);

function num(pkg) {
    const s = pkgStats.find((x) => x.pkg === pkg);
    return [String(s.files), String(s.lines)];
}

// 4 编码实现
body.push(
    h1('4 编码实现'),
    h2('4.1 编码规范'),
    p('项目在编码阶段遵循统一的规范，保证不同模块的代码风格一致、便于阅读和评审。主要约定如表 4-1 所示。'),
    table({
        caption: '表 4-1 编码规范要点',
        headers: ['方面', '约定'],
        widths: [1.3, 5.7],
        rows: [
            ['命名', '类名大驼峰（GoodsService），方法与变量小驼峰（compareAndSetStatus），常量全大写下划线（MAX_SIZE）；数据库表名小写下划线（trade_order），用户表命名为 users 以避开 SQL 关键字 user'],
            ['分层', 'Controller 只做参数接收与校验、取当前用户、调用 Service；业务规则全部写在 Service；数据访问只通过 Repository；Controller 之间不互相调用'],
            ['数据传输', '接口入参与出参使用 DTO（Java record），不直接返回 JPA 实体，避免泄露密码等字段和懒加载问题；状态字段同时返回枚举值和中文文本（如 status / statusText）'],
            ['统一响应', '所有接口返回 { code, message, data }，code 为 0 表示成功，失败时 code 与 HTTP 状态码一致（400/401/403/404/409/500）'],
            ['异常处理', '业务错误统一抛出 BusinessException（携带 HTTP 状态和中文提示），由 GlobalExceptionHandler 转换为 JSON；Controller 中不写 try-catch'],
            ['参数校验', '在 DTO 字段上使用 @NotBlank、@Size、@DecimalMin、@Pattern 等注解，提示信息使用中文；Controller 方法参数加 @Valid'],
            ['事务', 'Service 类上标注 @Transactional，只读查询方法标注 @Transactional(readOnly = true)'],
            ['注释', '类与关键方法写 Javadoc 说明“做什么、为什么”；状态流转等复杂规则在枚举注释中画出转换关系'],
            ['前端', 'ES Module 拆分文件，一个页面一个组件；接口调用集中在 api.js；常量与格式化函数集中在 utils.js；使用组合式 API（setup）'],
            ['版本控制', 'Git 管理源码，提交信息说明本次改动目的；运行时目录 data/、uploads/、target/ 在 .gitignore 中忽略'],
        ],
    }),

    h2('4.2 后端关键实现'),
    h3('4.2.1 统一响应与全局异常处理'),
    p('所有接口的返回值都包装为 ApiResponse 记录类型。业务代码中只需抛出 BusinessException，GlobalExceptionHandler 会捕获并转换为对应 HTTP 状态码和统一结构；参数校验失败时，会把所有字段的中文提示用分号拼接后返回，前端直接展示即可。'),
    codeBlock('common/ApiResponse.java', snippet('src/main/java/com/campus/market/common/ApiResponse.java',
        'public record ApiResponse', 'return new ApiResponse<>(code, message, null);').concat(['    }', '}'])),
    codeBlock('common/GlobalExceptionHandler.java（节选）', snippet('src/main/java/com/campus/market/common/GlobalExceptionHandler.java',
        '@ExceptionHandler(BusinessException.class)', 'return build(HttpStatus.BAD_REQUEST, message);').concat(['}'])),
    p('例如，未登录访问需要身份的接口时返回 HTTP 401 和 {"code":401,"message":"请先登录","data":null}；发布商品时价格为负数，返回 HTTP 400 和“价格必须大于 0”。'),

    h3('4.2.2 JWT 认证拦截器与 @PublicApi'),
    p('系统没有使用完整的 Spring Security，而是用一个 HandlerInterceptor 实现认证与鉴权，逻辑集中在一个类中，便于理解和测试。拦截器注册在 /api/** 路径上，处理规则为：(1) 从请求头解析 Bearer 令牌并查询用户；(2) 未标注 @PublicApi 的接口必须登录；(3) /api/admin/** 只允许管理员访问；(4) 被封禁的账号直接返回 403。令牌中只保存用户 ID，每次请求都重新查询用户，因此封禁或改角色可以立即生效。'),
    codeBlock('security/AuthInterceptor.java（节选）', snippet('src/main/java/com/campus/market/security/AuthInterceptor.java',
        'public boolean preHandle', 'UserContext.set(user);').concat(['    return true;', '}'])),
    p('游客可访问的接口（首页搜索、商品详情、分类列表、留言列表、注册、登录）在方法上标注 @PublicApi。若请求携带了有效令牌，公开接口同样能拿到当前用户，从而返回“是否已收藏”等个性化信息。令牌的签发与解析由 JwtTokenProvider 完成，使用 HS256 算法，默认有效期 168 小时（7 天）：'),
    codeBlock('security/JwtTokenProvider.java（节选）', snippet('src/main/java/com/campus/market/security/JwtTokenProvider.java', 'public String createToken', 'return Optional.empty();').concat(['    }', '}'])),

    h3('4.2.3 商品搜索的动态查询'),
    p('首页搜索支持关键词、分类、价格区间、排序方式的任意组合。GoodsService 使用 Spring Data JPA 的 Specification 按条件动态拼接查询，只有非空的条件才加入 WHERE 子句，并始终限定状态为“在售”。排序参数 sort 取值 newest / hot / price_asc / price_desc，分页参数从 1 开始，每页最多 50 条。'),
    codeBlock('service/GoodsService.java（search 方法）', snippet('src/main/java/com/campus/market/service/GoodsService.java',
        'public PageResult<GoodsVO> search(GoodsQuery query)', 'return PageResult.of(goodsRepository.findAll(spec, pageable), GoodsVO::from);').concat(['}'])),

    h3('4.2.4 订单条件更新防止超卖'),
    p('二手商品通常只有一件，如果两个买家几乎同时点击“我想要”，必须保证只有一人下单成功。实现上没有使用悲观锁，而是在 GoodsRepository 中定义一条带条件的 UPDATE 语句：只有当商品当前状态仍为 ON_SALE 时才会把状态改为 RESERVED，并返回受影响的行数。数据库对单行 UPDATE 加行锁并保证原子性，因此并发请求中只有第一个能返回 1，其余返回 0，业务层据此返回 409“手慢了，商品已被其他同学下单”。'),
    codeBlock('repository/GoodsRepository.java（节选）', snippet('src/main/java/com/campus/market/repository/GoodsRepository.java',
        '@Modifying(flushAutomatically = true, clearAutomatically = true)', 'int compareAndSetStatus')),
    codeBlock('service/OrderService.java（create 方法节选）', snippet('src/main/java/com/campus/market/service/OrderService.java',
        'public OrderVO create(User buyer, CreateOrderRequest request)', 'return OrderVO.from(orderRepository.save(order));', {
            skipFrom: { start: 'order.setBuyer(buyer);', end: 'order.setStatus(OrderStatus.PENDING);', note: '// …… 设置买家、卖家，保存商品标题、图片、价格快照 ……' },
        }).concat(['}'])),
    p('该机制由并发测试 ConcurrentOrderTest 验证：10 个买家线程同时抢购同一件商品，重复 5 轮，每轮均只有 1 人成功，其余 9 人收到 409，商品只产生 1 个有效订单。订单中保存商品标题、封面图和价格的快照，卖家之后修改商品信息不会影响已生成的订单记录。'),

    h3('4.2.5 图片上传与魔数校验'),
    p('图片上传接口 POST /api/files/images 需要登录，单个文件不超过 5MB（同时在 application.yml 的 multipart 配置和 FileService 中限制）。为防止用户把脚本等非图片文件改扩展名后上传，FileService 除检查扩展名外，还读取文件头的前 12 个字节，按“魔数”判断是否真的是 JPEG、PNG、GIF 或 WEBP 图片，不信任客户端声明的 Content-Type。文件按月份分目录保存，文件名使用随机 UUID，避免重名覆盖和路径穿越。'),
    codeBlock('service/FileService.java（节选）', snippet('src/main/java/com/campus/market/service/FileService.java',
        'static boolean looksLikeImage(byte[] head)', '&& head[8] == \'W\'').concat(['}'])),
    p('保存后的文件通过 WebConfig 中注册的资源映射对外访问：URL 前缀 /uploads/** 映射到配置项 app.upload-dir 指定的目录（默认 ./uploads）。'),

    h3('4.2.6 演示数据初始化'),
    p('为方便首次体验和答辩演示，DataInitializer 实现了 ApplicationRunner 接口，在应用启动完成后检查用户表：若为空且配置 app.seed-demo-data 为 true，就在一个事务中写入 6 个用户（含 1 个管理员和 1 个已封禁账号）、7 个分类、18 件商品（覆盖全部 6 种商品状态）、6 个订单（覆盖全部 4 种订单状态，分布在最近 7 天，便于展示统计趋势图）、7 条留言和 6 条收藏。数据库非空时不会重复写入。测试环境中该开关为 false，保证测试数据隔离。'),
    codeBlock('init/DataInitializer.java（节选）', snippet('src/main/java/com/campus/market/init/DataInitializer.java', '@Transactional', 'log.info(').concat(['}'])),

    h3('4.2.7 JSON 时间格式'),
    p('Spring Boot 的 spring.jackson.date-format 配置只对 java.util.Date 生效，实体中使用的 LocalDateTime 默认会被序列化为带纳秒的 ISO 格式（如 2026-10-26T10:06:20.828401396），不便于前端展示。开发过程中发现该问题后，增加了 JacksonConfig，统一把 LocalDateTime 格式化为“yyyy-MM-dd HH:mm:ss”。'),
    codeBlock('config/JacksonConfig.java（节选）', snippet('src/main/java/com/campus/market/config/JacksonConfig.java', 'private static final DateTimeFormatter DATE_TIME', '.deserializerByType').concat(['}'])),

    h2('4.3 前端关键实现'),
    h3('4.3.1 Axios 拦截器统一处理令牌与错误'),
    p('所有接口调用都通过 api.js 中创建的 Axios 实例发出。请求拦截器自动在请求头加入令牌；响应拦截器把 { code, message, data } 结构“拆包”，页面代码直接拿到 data。出错时统一弹出后端返回的中文提示；遇到 401 时清除本地登录状态并跳转到登录页，同时带上 redirect 参数，登录后自动回到原页面。'),
    codeBlock('static/js/api.js（节选）', snippet('src/main/resources/static/js/api.js', 'const http = axios.create', 'return Promise.reject(error);').concat(['    },', ');'])),

    h3('4.3.2 路由与路由守卫'),
    p('前端使用 Hash 模式路由（URL 形如 http://localhost:8080/#/goods/1），这样无论访问哪个页面，服务器都只需返回同一个 index.html，不需要额外配置。路由元信息 meta.auth 表示需要登录，meta.admin 表示需要管理员权限，全局前置守卫在进入页面前进行检查。需要注意，前端守卫只是改善体验，真正的权限控制由后端拦截器保证。'),
    codeBlock('static/js/main.js（节选）', snippet('src/main/resources/static/js/main.js', 'router.beforeEach((to) => {', '});')),

    h3('4.3.3 组件化页面'),
    p('页面按功能拆分为组件，公共部分抽取为可复用组件。例如商品卡片 GoodsCard 在首页、我的收藏中复用，通过 props 接收商品数据；非在售状态时在封面左上角显示状态角标。每个页面组件都采用“setup 中定义数据和方法 + template 模板”的写法，模板中直接使用 Element Plus 组件。'),
    codeBlock('static/js/components/GoodsCard.js（节选）', snippet('src/main/resources/static/js/components/GoodsCard.js', 'export default {', '<div class="title">{{ goods.title }}</div>').concat(['    ……', '  </div>`,', '};'])),

    h3('4.3.4 ECharts 统计图表'),
    p('管理后台的数据概览页调用 /api/admin/stats 获取统计数据后，用 ECharts 绘制三张图：近 7 天下单趋势折线图、商品分类分布环形图、商品状态统计条形图。后端 StatsService 会为没有订单的日期补 0，保证折线图横轴始终是连续的 7 天。组件卸载时调用 dispose() 释放图表实例，并移除窗口 resize 监听，避免内存泄漏。'),
    codeBlock('static/js/pages/admin/Dashboard.js（折线图）', snippet('src/main/resources/static/js/pages/admin/Dashboard.js', 'const line = echarts.init(trendChart.value);', '});')),

    h3('4.3.5 图片上传组件'),
    p('发布页使用 Element Plus 的 el-upload 组件（照片墙模式），选择图片后立即上传到 /api/files/images，最多 6 张，第一张作为封面。上传前在浏览器端先检查类型和大小，减少无效请求；上传请求同样需要携带令牌，因此通过 headers 属性传入。提交表单时，从文件列表中取出服务器返回的 URL 组成 images 数组。'),
    codeBlock('static/js/pages/Publish.js（节选）', snippet('src/main/resources/static/js/pages/Publish.js', 'function beforeUpload(file) {', 'return true;').concat(['}'])),
    code(snippet('src/main/resources/static/js/pages/Publish.js', '<el-upload v-model:file-list="fileList"', '</el-upload>')),

    h2('4.4 代码规模统计'),
    p('代码规模使用 find 与 wc -l 命令对仓库实际统计（含注释和空行，不含第三方库与自动生成文件），结果如表 4-2 所示。'),
    table({
        caption: '表 4-2 代码规模统计',
        headers: ['类别', '范围', '文件数', '代码行数'],
        widths: [1.6, 3.4, 1, 1],
        center: [2, 3],
        rows: [
            ['后端主代码', 'src/main/java（Java）', String(stats.mainFiles), String(stats.mainLines)],
            ['后端测试代码', `src/test/java（Java，其中测试类 ${stats.testClasses} 个）`, String(stats.testFiles), String(stats.testLines)],
            ['前端脚本', 'static/js（ES Module）', String(stats.jsFiles), String(stats.jsLines)],
            ['前端样式与入口', 'static/css/app.css、static/index.html', '2', String(stats.cssLines + stats.htmlLines)],
            ['配置文件', 'application.yml、application-mysql.yml', '2', String(stats.ymlLines)],
            ['端到端测试', 'e2e/system-test.js', '1', String(stats.e2eLines)],
            ['合计', '', String(stats.mainFiles + stats.testFiles + stats.jsFiles + 5 + 1),
                String(stats.mainLines + stats.testLines + stats.jsLines + stats.cssLines + stats.htmlLines + stats.ymlLines + stats.e2eLines)],
        ],
    }),
    p(`后端共实现 REST 接口 ${stats.apis} 个（含管理后台 ${stats.adminApis} 个），自动化测试共 ${testSummary.testCaseCount || '—'} 个测试方法、${testSummary.total || '—'} 次执行全部通过，行覆盖率 ${testSummary.coverage?.line ?? '—'}%；端到端系统测试 ${e2e.total || '—'} 个用例全部通过。测试的详细情况见《软件测试报告》。`),
);

// 5 构建与部署
body.push(
    h1('5 构建与部署'),
    h2('5.1 获取源码与构建'),
    p('在已安装 JDK 17+ 和 Maven 3.9 的机器上执行以下命令，即可完成依赖下载、编译、运行全部测试并打包。首次构建需要联网下载依赖，之后可离线构建。'),
    code([
        'git clone https://github.com/lifan-777/chat666.git',
        'cd chat666',
        '',
        '# 编译、运行全部测试并打包（约 1 分钟）',
        'mvn clean package',
        '',
        '# 只打包、跳过测试',
        'mvn clean package -DskipTests',
    ]),
    p('构建成功后在 target 目录下生成可执行 jar：target/campus-market-1.0.0.jar（约 60MB，内含 Tomcat、全部依赖和前端静态资源）。运行测试时 JaCoCo 会同时在 target/site/jacoco/index.html 生成覆盖率报告。'),
    h2('5.2 快速启动（默认 H2 数据库）'),
    p('默认配置使用文件型 H2 数据库，无需安装任何数据库，直接启动即可：'),
    code([
        'java -jar target/campus-market-1.0.0.jar',
        '',
        '# 开发时也可以不打包，直接用 Maven 启动',
        'mvn spring-boot:run',
    ]),
    p('看到日志“Started CampusMarketApplication”后，用浏览器访问 http://localhost:8080 即可进入首页。首次启动时数据库为空，系统会自动写入演示数据并在日志中打印账号信息。演示账号如表 5-1 所示。'),
    table({
        caption: '表 5-1 演示账号',
        headers: ['用户名', '密码', '昵称', '角色 / 状态', '演示数据说明'],
        widths: [1.2, 1, 1, 1.3, 3.2],
        center: [1, 2, 3],
        rows: [
            ['admin', 'admin123', '平台管理员', '管理员', '进入管理后台审核商品、管理用户和分类'],
            ['zhangsan', '123456', '张三', '普通用户', '发布了 iPad、显示器等，有待确认、待交易的卖出订单'],
            ['lisi', '123456', '李四', '普通用户', '发布了鼠标、教材等，买过《算法导论》'],
            ['wangwu', '123456', '王五', '普通用户', '发布了耳机、自行车，有一件商品审核未通过'],
            ['zhaoliu', '123456', '赵六', '普通用户', '发布了计算器、羽绒服等'],
            ['spam2026', '123456', '低价代购', '已封禁', '用于演示封禁账号无法登录'],
        ],
    }),
    p('如需修改端口，可在启动命令后追加参数，例如 java -jar target/campus-market-1.0.0.jar --server.port=9090。'),
    h2('5.3 切换到 MySQL 数据库'),
    p('正式部署时建议使用 MySQL 8。表结构由 Hibernate 根据实体自动创建（ddl-auto: update），只需要提前创建空数据库：'),
    code([
        "CREATE DATABASE campus_market DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;",
    ]),
    p('然后激活 mysql profile 启动。数据库地址、账号等通过环境变量传入，未设置时使用括号中的默认值：'),
    code([
        '# Linux / macOS',
        'export MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=你的密码',
        'export APP_JWT_SECRET=请替换为至少32位的随机字符串',
        'java -jar target/campus-market-1.0.0.jar --spring.profiles.active=mysql',
        '',
        ':: Windows（cmd）',
        'set MYSQL_PASSWORD=你的密码',
        'java -jar target\\campus-market-1.0.0.jar --spring.profiles.active=mysql',
    ]),
    table({
        caption: '表 5-2 环境变量',
        headers: ['环境变量', '默认值', '说明'],
        widths: [1.8, 1.6, 3.6],
        rows: [
            ['MYSQL_HOST', 'localhost', 'MySQL 服务器地址（仅 mysql profile）'],
            ['MYSQL_PORT', '3306', 'MySQL 端口'],
            ['MYSQL_USER', 'root', '数据库用户名'],
            ['MYSQL_PASSWORD', 'root', '数据库密码'],
            ['APP_JWT_SECRET', '内置演示密钥', 'JWT 签名密钥，HS256 要求至少 32 字节；生产环境必须修改，否则他人可伪造令牌'],
        ],
    }),
    h2('5.4 配置项说明'),
    p('主要配置集中在 src/main/resources/application.yml 中，说明如表 5-3 所示。所有配置都可以通过命令行参数（--key=value）或同名环境变量覆盖，无需修改 jar 包。'),
    table({
        caption: '表 5-3 application.yml 主要配置项',
        headers: ['配置项', '默认值', '说明'],
        widths: [2.6, 2.2, 2.6],
        rows: [
            ['server.port', '8080', 'HTTP 端口'],
            ['spring.datasource.url', 'jdbc:h2:file:./data/campus-market;MODE=MySQL;…', 'H2 文件数据库，MySQL 兼容模式，数据保存在 ./data'],
            ['spring.jpa.hibernate.ddl-auto', 'update', '启动时根据实体自动创建 / 更新表结构'],
            ['spring.jpa.open-in-view', 'false', '关闭视图层懒加载，避免在 Controller 中触发额外查询'],
            ['hibernate.default_batch_fetch_size', '50', '批量加载关联数据（如商品图片），减少 N+1 查询'],
            ['spring.h2.console.enabled / path', 'true，/h2-console', 'H2 控制台，可在浏览器中查看数据（mysql profile 下关闭）'],
            ['spring.servlet.multipart.max-file-size', '5MB', '单个上传文件大小上限'],
            ['spring.servlet.multipart.max-request-size', '20MB', '单次请求总大小上限'],
            ['spring.jackson.time-zone', 'Asia/Shanghai', 'JSON 时间时区'],
            ['app.jwt.secret', '${APP_JWT_SECRET:…}', 'JWT 签名密钥'],
            ['app.jwt.expire-hours', '168', '令牌有效期（小时），即 7 天'],
            ['app.upload-dir', './uploads', '上传图片保存目录，对外映射为 /uploads/**'],
            ['app.seed-demo-data', 'true', '数据库为空时是否写入演示数据'],
        ],
    }),
    p('H2 控制台的登录信息：JDBC URL 填写 jdbc:h2:file:./data/campus-market;MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE，用户名 sa，密码为空。'),
    h2('5.5 部署结构'),
    p('系统以单个 jar 部署在任意安装了 JDK 17+ 的服务器上，内嵌 Tomcat 监听 8080 端口，同时提供前端静态页面和 /api 接口，因此不需要单独部署 Nginx 或前端服务器。部署结构如图 5-1 所示。'),
    figure(diagram('deployment'), '图 5-1 系统部署图', { widthCm: 15 }),
    p('若需要在 Linux 服务器上长期运行，可使用 nohup 后台启动并把日志输出到文件，或编写 systemd 服务：'),
    code([
        'nohup java -Xms256m -Xmx512m -jar campus-market-1.0.0.jar \\',
        '      --spring.profiles.active=mysql > app.log 2>&1 &',
    ]),
    h2('5.6 常见问题排查'),
    table({
        caption: '表 5-4 常见问题与解决方法',
        headers: ['现象', '可能原因', '解决方法'],
        widths: [2, 2.2, 3.2],
        rows: [
            ['启动报 “Port 8080 was already in use”', '8080 端口被其他程序占用', '关闭占用程序（Windows：netstat -ano | findstr 8080；Linux：lsof -i:8080），或加 --server.port=9090'],
            ['启动报 “UnsupportedClassVersionError”', 'JDK 版本低于 17', '执行 java -version 检查，安装 JDK 17 或更高版本并配置 JAVA_HOME'],
            ['mvn 下载依赖很慢或失败', '访问 Maven 中央仓库网络不佳', '在 ~/.m2/settings.xml 中配置国内镜像（如阿里云镜像）后重试'],
            ['页面空白或样式错乱', '浏览器缓存了旧版本静态文件', '按 Ctrl + F5 强制刷新；确认访问的是 http://localhost:8080 而不是直接打开 html 文件'],
            ['上传图片提示“只支持 jpg、png…”或“不是有效的图片”', '文件扩展名不对，或文件内容并非图片', '使用真实的 jpg / png / gif / webp 图片，单张不超过 5MB'],
            ['上传后图片无法显示', '运行目录变化导致 uploads 相对路径改变', '在同一目录下启动，或用 --app.upload-dir=/绝对路径/uploads 指定固定目录'],
            ['登录提示“账号已被封禁”', '管理员封禁了该账号', '使用管理员账号在“用户管理”中解封'],
            ['忘记密码 / 演示数据被改乱', '系统未提供找回密码功能', '停止程序后删除 data 目录（及 uploads 目录）重新启动，系统会重新写入演示数据'],
            ['MySQL 启动报 “Access denied” 或连接失败', '账号密码或地址错误、数据库未创建', '检查环境变量 MYSQL_*，确认已执行建库语句，MySQL 允许该账号远程连接'],
            ['操作时提示“登录已过期，请重新登录”', '令牌超过 7 天有效期，或服务器更换了 JWT 密钥', '重新登录即可'],
        ],
    }),
    h2('5.7 数据备份与重置'),
    p('默认 H2 模式下，所有业务数据保存在启动目录下的 data/campus-market.mv.db 文件中，用户上传的图片保存在 uploads/ 目录中（按年月分子目录）。演示用的商品图片在 jar 包内部（/demo-images/），不需要备份。'),
    bullets([
        '**备份**：停止应用后，复制 data/ 和 uploads/ 两个目录即可；恢复时把它们放回启动目录。',
        '**重置为演示数据**：停止应用，删除 data/ 和 uploads/ 目录后重新启动，系统检测到数据库为空会自动写入演示数据。',
        '**MySQL 模式**：使用 mysqldump -u root -p campus_market > backup.sql 备份数据库，同时备份 uploads/ 目录。',
    ]),
);

// 6 用户操作手册
body.push(
    h1('6 用户操作手册'),
    p('本章按用户角色说明系统的使用方法。系统有三类用户：游客（未登录）、普通用户（同一账号既可以作为买家购买，也可以作为卖家发布商品）、管理员。完整的交易流程为：卖家发布商品 → 管理员审核通过 → 买家下单 → 卖家确认订单 → 双方线下当面交易 → 买家确认收货。平台不涉及线上支付。'),
    h2('6.1 游客功能'),
    h3('6.1.1 浏览首页'),
    p('在浏览器中打开 http://localhost:8080 即进入首页。首页顶部为导航栏（Logo、搜索框、发布闲置、登录/注册），下方为宣传横幅（显示在售商品数量与分类数量）、分类栏、排序与价格筛选栏，以及商品卡片列表。每张卡片显示商品图片、标题、价格、原价、成色、卖家、浏览量和发布时间，点击卡片进入商品详情。'),
    figure(shot('01-home'), '图 6-1 首页', { widthCm: 14 }),
    h3('6.1.2 分类筛选'),
    steps(['在首页分类栏中点击某个分类（如“书籍教材”），被选中的分类高亮显示；', '商品列表只显示该分类下的在售商品；', '点击“全部”取消分类筛选。']),
    figure(shot('02-category'), '图 6-2 按分类筛选', { widthCm: 14 }),
    h3('6.1.3 搜索与排序'),
    steps([
        '在顶部搜索框输入关键词（如“耳机”），按回车或点击放大镜按钮；',
        '系统在商品标题和描述中查找，列表上方显示“‘耳机’ 的搜索结果，共 N 件”，点击“清除筛选”可恢复；',
        '在排序栏选择“最新发布 / 最多浏览 / 价格从低到高 / 价格从高到低”改变排序；',
        '在右侧价格区间输入最低价和最高价，点击“确定”按价格筛选。',
    ]),
    figure(shot('03-search'), '图 6-3 关键词搜索结果', { widthCm: 14 }),
    h3('6.1.4 查看商品详情'),
    p('商品详情页左侧为商品图片（多图时可切换缩略图，点击大图可全屏预览），右侧为标题、价格、状态、分类、成色、交易地点、发布时间、浏览与收藏数、卖家信息和操作按钮，下方为商品描述与留言区。游客点击“我想要”或“收藏”时，系统会提示先登录并跳转到登录页，登录后自动返回该商品。'),
    figure(shot('04-detail'), '图 6-4 商品详情页（买家视角）', { widthCm: 14 }),
    h2('6.2 普通用户功能'),
    h3('6.2.1 注册'),
    steps([
        '点击导航栏右上角“注册”；',
        '填写用户名（4–20 位字母、数字或下划线）、昵称、手机号（选填，交易时对方可见）、密码（6–32 位）和确认密码；',
        '点击“注册”，注册成功后系统自动登录并返回首页。',
    ]),
    figure(shot('06-register'), '图 6-5 注册页面', { widthCm: 14 }),
    h3('6.2.2 登录与退出'),
    steps([
        '点击导航栏“登录”，输入用户名和密码后点击“登录”（登录页下方列出了演示账号，点击即可自动填入）；',
        '用户名或密码错误时提示“用户名或密码错误”，账号被封禁时提示“账号已被封禁，请联系管理员”；',
        '登录后导航栏显示头像和昵称，鼠标移到昵称上可进入“我发布的 / 我买到的 / 我卖出的 / 我的收藏 / 个人资料”，或点击“退出登录”。',
    ]),
    figure(shot('05-login'), '图 6-6 登录页面', { widthCm: 14 }),
    h3('6.2.3 发布商品'),
    steps([
        '点击导航栏“发布闲置”；',
        '点击“+”上传商品图片（最多 6 张，第一张为封面，支持 jpg/png/gif/webp，单张不超过 5MB）；',
        '填写标题、选择分类和成色、填写价格（原价选填）、交易地点（可从常用地点中选择）和商品描述；',
        '点击“立即发布”。必填项为空时表单会给出红色提示；发布成功后跳转到“我发布的”，商品状态为“待审核”，管理员审核通过后才会在首页展示。',
    ]),
    figure(shot('07-publish'), '图 6-7 发布商品', { widthCm: 14 }),
    h3('6.2.4 管理我的发布'),
    p('在“个人中心 → 我发布的”中可以按状态（全部、待审核、在售、交易中、已售出、审核未通过、已下架）查看自己发布的商品。审核未通过或被管理员下架的商品会在状态下方显示原因。操作说明如下：'),
    bullets([
        '**编辑**：修改商品信息，保存后需要重新审核；交易中和已售出的商品不能编辑。',
        '**下架**：待审核、在售、审核未通过的商品可以下架，下架后其他用户看不到该商品。',
        '**重新上架**：已下架的商品可以重新上架，重新上架后进入待审核状态。',
    ]),
    figure(shot('08-my-goods'), '图 6-8 我发布的商品', { widthCm: 14 }),
    p('卖家查看自己发布的商品详情时，操作区显示“编辑商品”和“下架”按钮（图 6-9）；编辑页面会回填原有信息（图 6-10）。'),
    figure(shot('extra-seller-detail'), '图 6-9 商品详情页（卖家视角）', { widthCm: 14 }),
    figure(shot('20-edit-goods'), '图 6-10 编辑商品', { widthCm: 14 }),
    h3('6.2.5 收藏商品'),
    steps([
        '在商品详情页点击“收藏”，按钮变为“已收藏”，收藏人数加 1；再次点击取消收藏；',
        '在“个人中心 → 我的收藏”中查看所有收藏的商品，已售出的商品会显示状态角标，点击“取消收藏”可移除。',
    ]),
    figure(shot('12-favorites'), '图 6-11 我的收藏', { widthCm: 14 }),
    h3('6.2.6 留言与回复'),
    steps([
        '在商品详情页底部的留言区输入内容（不超过 300 字），点击“发表留言”；',
        '点击某条留言下的“回复”，输入框上方出现“回复 @某某”标签，发表后该留言显示“回复 @某某”；卖家的留言带有“卖家”标识；',
        '留言作者、商品卖家和管理员可以删除留言。',
    ]),
    figure(shot('extra-comments'), '图 6-12 留言与回复', { widthCm: 14 }),
    h3('6.2.7 下单购买'),
    steps([
        '在“在售”商品的详情页点击“我想要”；',
        '在“确认购买”对话框中可以给卖家留言（如方便交易的时间），点击“确认下单”；',
        '下单成功后商品变为“交易中”，其他用户无法再购买；页面跳转到“我买到的”，订单状态为“待卖家确认”。',
    ]),
    p('不能购买自己发布的商品；如果多人同时下单同一件商品，只有一人能成功，其他人会看到“手慢了，商品已被其他同学下单”。'),
    figure(shot('13-buy-dialog'), '图 6-13 确认购买对话框', { widthCm: 14 }),
    h3('6.2.8 卖家确认订单'),
    steps([
        '卖家进入“个人中心 → 我卖出的”，查看“待卖家确认”的订单，可以看到买家昵称、联系电话和买家留言；',
        '点击“确认订单”并确认，订单状态变为“待交易”；',
        '双方按约定的时间和地点当面验货、交易。',
    ]),
    figure(shot('14-sold-orders'), '图 6-14 我卖出的订单', { widthCm: 14 }),
    h3('6.2.9 买家确认收货'),
    steps([
        '买家进入“个人中心 → 我买到的”，在“待交易”的订单上点击“确认收货”；',
        '确认后订单状态变为“已完成”，商品状态变为“已售出”。',
    ]),
    figure(shot('15-bought-orders'), '图 6-15 我买到的订单', { widthCm: 14 }),
    h3('6.2.10 取消订单'),
    p('在订单完成之前（待卖家确认、待交易状态），买家和卖家都可以点击“取消订单”，并在弹出框中填写取消原因（选填）。取消后订单状态变为“已取消”并显示由哪一方取消及原因，商品自动恢复为“在售”，其他同学可以继续购买。'),
    h3('6.2.11 个人资料与修改密码'),
    steps([
        '进入“个人中心 → 个人资料”，可以修改昵称和手机号，点击“保存资料”后导航栏昵称同步更新；',
        '在“修改密码”中输入原密码、新密码和确认新密码，修改成功后需要重新登录。',
    ]),
    figure(shot('19-profile'), '图 6-16 个人资料', { widthCm: 14 }),
    h2('6.3 管理员功能'),
    p('使用管理员账号登录后，导航栏会出现“管理后台”入口。管理后台左侧为菜单（数据概览、商品审核、商品管理、用户管理、分类管理），“商品审核”菜单上的红色数字为待审核商品数量。普通用户访问管理后台会被拒绝并提示“需要管理员权限”。'),
    h3('6.3.1 数据概览'),
    p('数据概览页上方显示注册用户、商品总数、在售商品、待审核、订单总数、累计成交额六项指标（点击“待审核”卡片可直接进入审核页面），下方为近 7 天下单趋势、商品分类分布和商品状态统计三张图表。'),
    figure(shot('09-admin-dashboard'), '图 6-17 数据概览', { widthCm: 14 }),
    h3('6.3.2 商品审核'),
    steps([
        '进入“商品审核”，列表按提交时间先后列出全部待审核商品；',
        '点击“详情”打开右侧抽屉，查看商品图片（可左右切换）、价格、分类、成色、交易地点、卖家和描述；',
        '内容合规时点击“通过”（或抽屉中的“审核通过”），商品立即上架到首页；',
        '内容不合规时点击“驳回”，在弹出框中填写驳回原因（必填），卖家会在“我发布的”中看到该原因，修改后可重新提交。',
    ]),
    figure(shot('10-admin-audit'), '图 6-18 待审核商品列表', { widthCm: 14 }),
    figure(shot('11-admin-audit-drawer'), '图 6-19 审核详情抽屉', { widthCm: 14 }),
    h3('6.3.3 商品管理与强制下架'),
    p('“商品管理”可以按状态和标题关键词查询平台上的全部商品。对在售或待审核的违规商品点击“强制下架”，填写原因后商品状态变为“已下架”，卖家会看到“管理员下架：原因”。正在交易中的商品不能强制下架，需要等交易结束后再处理。'),
    figure(shot('17-admin-goods'), '图 6-20 商品管理', { widthCm: 14 }),
    h3('6.3.4 用户管理'),
    p('“用户管理”可以按用户名或昵称搜索用户，列表显示用户名、昵称、手机号、角色、状态和注册时间。点击“封禁”并确认后，该用户无法登录，已登录的会话也会立即失效；点击“解封”恢复正常。管理员账号不能被封禁。'),
    figure(shot('16-admin-users'), '图 6-21 用户管理', { widthCm: 14 }),
    h3('6.3.5 分类管理'),
    steps([
        '进入“分类管理”，列表显示分类图标、名称、排序值和商品数量；',
        '点击“新增分类”，填写名称、选择图标、设置排序值（数字越小越靠前）后保存，首页分类栏立即显示新分类；',
        '点击“编辑”修改分类；点击“删除”删除分类，分类下仍有商品时不允许删除。',
    ]),
    figure(shot('18-admin-categories'), '图 6-22 分类管理', { widthCm: 14 }),
);

// 7 维护说明
body.push(
    h1('7 维护说明'),
    h2('7.1 日志'),
    p('系统使用 Spring Boot 默认的 Logback 日志，输出到控制台。未处理的异常由 GlobalExceptionHandler 记录 ERROR 级别日志（含完整堆栈），并向前端返回“服务器内部错误，请稍后重试”，不会把内部信息暴露给用户。需要保存日志文件时，可在启动命令中加 --logging.file.name=app.log。'),
    h2('7.2 常用维护操作'),
    table({
        caption: '表 7-1 常用维护命令',
        headers: ['任务', '命令 / 方法'],
        widths: [2, 5],
        rows: [
            ['运行全部自动化测试', 'mvn test（单元测试、接口测试、并发测试；覆盖率报告在 target/site/jacoco/index.html）'],
            ['运行端到端系统测试', '删除 data 目录后启动应用，再执行 node e2e/system-test.js（需要 Node.js 18+ 和 Playwright：npm install playwright），结果写入 e2e/output/results.json，截图保存到 docs/screenshots'],
            ['汇总测试结果', 'python3 tools/collect_test_results.py（生成 docs/test-results/summary.json 与 test-cases.md）'],
            ['重新生成全部 Word 文档', '修改 tools/docgen/project-info.json 中的个人信息后执行 bash tools/docgen/build-all.sh（需要 Node.js 的 docx 库，LibreOffice 可选，用于预填目录页码）'],
            ['重新渲染 UML 图', 'PLANTUML_JAR=/path/plantuml.jar tools/render_diagrams.sh（需要 Graphviz），源文件为 docs/diagrams/*.puml'],
            ['重新生成演示商品图片', 'python3 tools/gen_demo_images.py（需要 Pillow），输出到 static/demo-images'],
            ['查看数据库数据', '访问 http://localhost:8080/h2-console（H2 模式）'],
        ],
    }),
    h2('7.3 扩展指引'),
    bullets([
        '**新增分类图标**：分类图标使用 Element Plus 图标名称。在 static/js/pages/admin/Categories.js 的 ICONS 数组中加入新的图标名（如 Watch），管理员即可在分类编辑框中选择。',
        '**新增业务接口**：在 dto 包中定义请求/响应 record → 在 service 中实现业务规则并抛出 BusinessException 表示错误 → 在 controller 中暴露接口；游客可访问的接口加 @PublicApi，管理接口放在 /api/admin 下即可自动获得权限控制 → 在 api.js 中增加对应函数。',
        '**修改商品或订单状态规则**：状态定义在 GoodsStatus、OrderStatus 枚举中，流转规则集中在 GoodsService 与 OrderService，修改后应同步更新单元测试和状态图。',
        '**更换数据库**：除 H2、MySQL 外，增加对应 JDBC 驱动依赖和一个新的 application-xxx.yml 即可，业务代码无需修改。',
    ]),
);

const doc = L.buildDocument({ title: '软件实施与部署说明书', docNo: 'CM-IMP-001' }, body);
L.save(doc, 'docs/04-软件实施与部署说明书.docx');
