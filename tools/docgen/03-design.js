/**
 * 生成《软件设计说明书》（概要设计 + 详细设计）：docs/03-软件设计说明书.docx
 * 运行：node tools/docgen/03-design.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { Paragraph, ShadingType, TextRun } = require('docx');
const L = require('./lib');

const { h1, h2, h3, p, bullets, steps, figure, table, kvTable } = L;

/** 代码块：与 lib.code 相同的样式，但字号改为 8 磅，减少长代码行折行 */
function code(lines) {
    const list = Array.isArray(lines) ? lines : String(lines).split('\n');
    const font = { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: '宋体', cs: 'Consolas' };
    return list.map((line, i) => new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'F5F5F5', color: 'auto' },
        spacing: { line: 240, before: i === 0 ? 120 : 0, after: i === list.length - 1 ? 120 : 0 },
        indent: { left: 200, right: 200 },
        children: [new TextRun({ text: line.length ? line : ' ', font, size: 16 })],
    }));
}

/**
 * 截图去掉底部空白：页面内容较少时截图下方是大片背景色和页脚。
 * PNG 每行的过滤只依赖上方的行，所以保留前 N 行的原始数据即可完成裁剪，无需重新编码像素。
 * 返回裁剪后临时文件的路径；无法处理或不需要裁剪时返回原路径。
 */
function cropScreenshot(file) {
    const full = path.join(L.ROOT, file);
    const buf = fs.readFileSync(full);
    let pos = 8;
    let ihdr;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') ihdr = Buffer.from(data);
        if (type === 'IDAT') idat.push(data);
        pos += 12 + len;
    }
    const width = ihdr.readUInt32BE(0);
    const height = ihdr.readUInt32BE(4);
    const colorType = ihdr[9];
    if (ihdr[8] !== 8 || ihdr[12] !== 0 || ![2, 6].includes(colorType)) return file;
    const bpp = colorType === 6 ? 4 : 3;
    const stride = width * bpp;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const pixels = Buffer.alloc(height * stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const cur = pixels.subarray(y * stride, (y + 1) * stride);
        const prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= bpp ? prev[x - bpp] : 0;
            let v = src[x];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const pp = a + b - c;
                const pa = Math.abs(pp - a);
                const pb = Math.abs(pp - b);
                const pc = Math.abs(pp - c);
                v += pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
            }
            cur[x] = v & 255;
        }
    }
    // 页面背景色 #F5F6F8；页脚高 72px。从页脚上方向上找到最后一行非背景内容
    const isBackground = (y) => {
        for (let x = 0; x < width; x++) {
            const i = y * stride + x * bpp;
            if (pixels[i] !== 0xf5 || pixels[i + 1] !== 0xf6 || pixels[i + 2] !== 0xf8) return false;
        }
        return true;
    };
    let bottom = height - 74;
    while (bottom > 0 && isBackground(bottom)) bottom--;
    if (bottom > height - 74 - 100) return file;          // 内容基本占满，不裁剪
    const newHeight = bottom + 24;
    const newIhdr = Buffer.from(ihdr);
    newIhdr.writeUInt32BE(newHeight, 4);
    const chunk = (type, data) => {
        const head = Buffer.alloc(8);
        head.writeUInt32BE(data.length, 0);
        head.write(type, 4, 'ascii');
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, 0);
        return Buffer.concat([head, data, crc]);
    };
    const out = Buffer.concat([
        buf.subarray(0, 8),
        chunk('IHDR', newIhdr),
        chunk('IDAT', zlib.deflateSync(raw.subarray(0, newHeight * (stride + 1)))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
    const target = path.join(process.env.DOCGEN_TMP || os.tmpdir(), 'cm-design-' + path.basename(file));
    fs.writeFileSync(target, out);
    return target;
}

const shot = (name, title) => figure(cropScreenshot(`docs/screenshots/${name}.png`), title, { widthCm: 15 });

/**
 * 从源码中截取代码片段，保证文档中的代码与实际一致。
 * opts.end：截到第一个包含该文本的行；opts.close：截到与起始行缩进相同、内容等于该文本的行（如方法结尾的 "}"）。
 */
function snippet(file, start, opts) {
    const lines = fs.readFileSync(path.join(L.ROOT, file), 'utf8').split('\n');
    const from = lines.findIndex((l) => l.includes(start));
    if (from < 0) throw new Error(`在 ${file} 中找不到：${start}`);
    const startIndent = lines[from].match(/^ */)[0].length;
    const to = lines.findIndex((l, i) => i > from && (opts.end
        ? l.includes(opts.end)
        : l.trim() === opts.close && l.match(/^ */)[0].length === startIndent));
    if (to < 0) throw new Error(`在 ${file} 中找不到片段结尾`);
    const picked = lines.slice(from, to + 1);
    const indent = Math.min(...picked.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return code(picked.map((l) => l.slice(indent)));
}

const body = [
    // ======================================================== 1 引言
    h1('1 引言'),
    h2('1.1 编写目的'),
    p('本文档是“校园二手交易平台”（Campus Market）的软件设计说明书，包含概要设计与详细设计两部分。文档依据《软件需求规格说明书》（CM-SRS-001）确定的功能与非功能需求，描述系统的总体架构、模块划分、数据库设计、接口设计、关键业务流程的详细设计、界面设计及安全设计，作为编码实现、测试和后期维护的依据。'),
    p('本文档的预期读者为项目开发人员、测试人员、课程指导教师及后续维护人员。'),
    h2('1.2 项目背景与范围'),
    p('高校学生每学期都会产生大量闲置物品，如教材、数码产品、生活用品和运动器材。现有的交流群、表白墙等渠道信息分散、无法检索，也缺少对交易过程的跟踪和对违规信息的管理。本系统面向在校师生，提供闲置商品的发布、审核、检索、收藏、留言咨询、下单与交易状态跟踪，以及面向管理员的审核与运营后台。'),
    p('系统采用**线下当面交易**模式：平台负责撮合与记录交易过程，不涉及在线支付。本说明书覆盖系统全部功能模块，即用户、商品、交易、互动（收藏与留言）和后台管理五个模块。'),
    h2('1.3 术语与缩略语'),
    table({
        caption: '表 1-1 术语与缩略语',
        headers: ['术语', '说明'],
        widths: [1.3, 5],
        rows: [
            ['SPA', 'Single Page Application，单页应用。前端只有一个 index.html，由 Vue Router 在浏览器端切换页面'],
            ['REST', '基于 HTTP 的资源式接口风格，本系统接口统一以 /api 为前缀，返回 JSON'],
            ['JWT', 'JSON Web Token，登录成功后签发的令牌，前端在请求头 Authorization: Bearer <token> 中携带'],
            ['JPA', 'Java Persistence API，本系统使用 Spring Data JPA + Hibernate 实现对象关系映射'],
            ['DTO / VO', '数据传输对象 / 视图对象。请求体（如 GoodsRequest）与响应体（如 GoodsVO）均用 Java record 定义'],
            ['条件更新（CAS）', 'Compare-And-Set，带“当前状态”条件的 UPDATE 语句，只有状态符合预期时才更新成功，用于防止超卖'],
            ['超卖', '同一件商品被多个买家同时下单成功的错误情况'],
            ['BCrypt', '带随机盐的单向密码哈希算法，用于存储用户密码'],
            ['H2', '纯 Java 编写的嵌入式关系数据库，本系统默认使用文件模式，零配置即可运行'],
        ],
    }),
    h2('1.4 参考资料'),
    bullets([
        'GB/T 8567-2006《计算机软件文档编制规范》',
        'GB/T 9385-2008《计算机软件需求规格说明规范》',
        '《校园二手交易平台 项目开发计划书》（CM-PLAN-001）',
        '《校园二手交易平台 软件需求规格说明书》（CM-SRS-001）',
        'Spring Boot 3.5 Reference Documentation；Spring Data JPA Reference Documentation',
        'Vue.js 3 官方文档；Element Plus 官方文档',
        'RFC 7519 JSON Web Token (JWT)',
    ]),

    // ======================================================== 2 总体设计
    h1('2 总体设计'),
    h2('2.1 设计原则与目标'),
    p('结合课程设计的规模与答辩演示需求，系统设计遵循以下原则：'),
    bullets([
        '**分层解耦**：前后端分离，后端按“控制层—业务层—持久层”分层，层与层之间只通过接口和 DTO 交互，业务规则集中在 Service 层。',
        '**开箱即用**：默认使用文件型 H2 数据库，前端依赖库全部放在本地，打包为一个可执行 jar，一条命令即可启动，断网也能演示。',
        '**安全可靠**：密码 BCrypt 加密，JWT 无状态认证，接口级权限控制；关键交易操作使用条件更新防止并发超卖；上传文件校验文件头。',
        '**可测试**：业务逻辑不依赖 Web 容器，Service 通过构造器注入依赖，便于用 Mockito 做单元测试，用 MockMvc 做接口测试。',
        '**可扩展**：通过 Spring Profile 切换 MySQL；分类、状态等可配置或以枚举集中定义，便于后续增加支付、消息通知等功能。',
    ]),
    h2('2.2 系统架构'),
    p('系统采用 B/S 结构的前后端分离架构，如图 2-1 所示。浏览器端是基于 Vue 3 的单页应用，通过 Axios 以 REST/JSON 方式调用后端接口；后端是 Spring Boot 应用，由内嵌 Tomcat 提供 HTTP 服务，同时托管前端静态资源。请求先经过认证拦截器（AuthInterceptor）完成令牌解析与权限校验，再依次进入 Controller、Service、Repository，最终通过 Hibernate 访问 H2 或 MySQL 数据库；商品图片保存在服务器本地 uploads 目录。'),
    figure('docs/diagrams/architecture.png', '图 2-1 系统架构图', { widthCm: 13.5, maxHeightCm: 14 }),
    p('各层的组成与职责见表 2-1。'),
    table({
        caption: '表 2-1 系统分层与职责',
        headers: ['层次', '主要组成', '职责'],
        widths: [1.3, 2.8, 3.6],
        rows: [
            ['表示层（前端）', 'index.html、js/pages/*、js/components/*、api.js、store.js', '页面渲染与交互、表单校验、路由与路由守卫、调用 REST 接口、统一错误提示'],
            ['接入与安全层', 'AuthInterceptor、JwtTokenProvider、UserContext、@PublicApi、WebConfig', '解析 JWT、校验登录与管理员权限、拦截封禁账号、保存当前用户；映射 /uploads 静态资源'],
            ['控制层', '11 个 Controller（含 admin 子包 3 个）', '接收请求、参数绑定与 @Valid 校验、调用业务层、包装统一响应 ApiResponse'],
            ['业务层', 'UserService、GoodsService、OrderService 等 8 个 Service', '实现业务规则与状态流转，通过 @Transactional 控制事务'],
            ['持久层', '6 个 Repository 接口 + 7 个实体类', '对象关系映射；方法名派生查询、JPQL、Specification 动态查询、条件更新'],
            ['数据层', 'H2 文件数据库（默认）/ MySQL 8；uploads 目录', '持久化业务数据与图片文件'],
            ['横切组件', 'GlobalExceptionHandler、JacksonConfig、DataInitializer', '统一异常处理、日期序列化格式、首次启动写入演示数据'],
        ],
    }),
    h2('2.3 技术选型'),
    p('技术选型以“主流、稳定、易于部署和演示”为原则，具体版本以 pom.xml 及 static/lib 目录中的实际文件为准，见表 2-2。'),
    table({
        caption: '表 2-2 技术选型',
        headers: ['类别', '技术 / 框架', '版本', '用途'],
        widths: [1.2, 2.2, 1, 3.4],
        center: [2],
        rows: [
            ['开发语言', 'Java', '17（兼容 21）', '后端开发语言'],
            ['后端框架', 'Spring Boot', '3.5.16', 'Web、依赖注入、自动配置、内嵌 Tomcat'],
            ['持久层', 'Spring Data JPA / Hibernate', '随 Boot 管理', 'ORM 映射、分页、动态查询'],
            ['参数校验', 'Jakarta Bean Validation', '随 Boot 管理', '请求体字段校验（@NotBlank、@Size 等）'],
            ['认证', 'jjwt', '0.13.0', 'JWT 令牌签发与校验（HMAC-SHA）'],
            ['密码加密', 'spring-security-crypto', '随 Boot 管理', '仅使用 BCryptPasswordEncoder'],
            ['数据库', 'H2 / MySQL', '2.3 / 8.x', '默认 H2 文件库；mysql profile 切换 MySQL'],
            ['前端框架', 'Vue', '3.5.44', '组件化单页应用（全局构建版，无需打包）'],
            ['前端路由', 'Vue Router', '4.6.4', 'Hash 模式路由与路由守卫'],
            ['UI 组件库', 'Element Plus', '2.14.7', '表单、表格、对话框等组件，中文语言包'],
            ['HTTP 客户端', 'Axios', '1.20.0', '调用后端接口、请求/响应拦截器'],
            ['图表', 'ECharts', '5.6.0', '管理后台统计图表'],
            ['构建工具', 'Maven', '3.9', '依赖管理、编译、测试、打包'],
            ['测试', 'JUnit 5、Mockito、MockMvc、Playwright', '—', '单元测试、接口测试、端到端系统测试'],
            ['覆盖率', 'JaCoCo', '0.8.13', '测试覆盖率统计'],
        ],
    }),
    h2('2.4 功能模块划分'),
    p('按照需求规格说明书，系统划分为用户、商品、交易、互动、后台管理五个功能模块，模块结构如图 2-2 所示。'),
    figure('docs/diagrams/modules.png', '图 2-2 功能模块结构图', { widthCm: 15 }),
    p('各模块与前后端代码的对应关系见表 2-3，便于开发和维护时快速定位代码。'),
    table({
        caption: '表 2-3 功能模块与代码对应关系',
        headers: ['模块', '后端类', '前端页面'],
        widths: [1.1, 4, 2.4],
        rows: [
            ['用户模块', 'AuthController、UserController、UserService、UserRepository、User、JwtTokenProvider', 'Login.js、Register.js、me/Profile.js'],
            ['商品模块', 'GoodsController、CategoryController、FileController、GoodsService、CategoryService、FileService、GoodsRepository、CategoryRepository、Goods、Category', 'Home.js、GoodsDetail.js、Publish.js、me/MyGoods.js'],
            ['交易模块', 'OrderController、OrderService、TradeOrderRepository、TradeOrder', 'me/Orders.js（我买到的 / 我卖出的）、GoodsDetail.js（下单）'],
            ['互动模块', 'FavoriteController、CommentController、FavoriteService、CommentService、Favorite、Comment', 'GoodsDetail.js（收藏、留言）、me/Favorites.js'],
            ['后台管理模块', 'AdminController、AdminGoodsController、AdminCategoryController、StatsService', 'admin/Dashboard.js、Audit.js、GoodsManage.js、Users.js、Categories.js'],
        ],
    }),
    h2('2.5 部署设计'),
    p('系统打包为单个可执行 jar（campus-market-1.0.0.jar），内嵌 Tomcat 监听 8080 端口，前端静态资源随 jar 一起发布，无需单独部署 Web 服务器。默认使用 ./data 目录下的 H2 文件数据库；生产环境可通过激活 mysql profile 连接 MySQL 8。上传的图片保存在 ./uploads 目录，并通过 /uploads/** 路径对外访问。部署结构如图 2-3 所示。'),
    figure('docs/diagrams/deployment.png', '图 2-3 系统部署图', { widthCm: 15 }),
    p('运行环境要求：服务器安装 JDK 17 及以上版本；客户端使用 Chrome、Edge、Firefox 等现代浏览器。'),
    h2('2.6 项目目录结构'),
    p('项目采用 Maven 标准目录结构，前端代码位于 src/main/resources/static，随后端一起打包：'),
    code([
        'chat666/',
        '├── pom.xml                         Maven 构建配置（依赖、JaCoCo 插件）',
        '├── src/main/java/com/campus/market/',
        '│   ├── CampusMarketApplication.java 启动类',
        '│   ├── common/        统一响应、分页结果、业务异常、全局异常处理',
        '│   ├── config/        配置属性、Web 配置、Jackson 配置',
        '│   ├── security/      JWT、认证拦截器、用户上下文、@PublicApi',
        '│   ├── entity/        BaseEntity、6 个实体、5 个枚举',
        '│   ├── repository/    6 个 Spring Data JPA 接口',
        '│   ├── dto/           22 个请求 / 响应 record',
        '│   ├── service/       8 个业务类',
        '│   ├── controller/    8 个控制器，admin/ 下 3 个后台控制器',
        '│   └── init/          DataInitializer 演示数据',
        '├── src/main/resources/',
        '│   ├── application.yml、application-mysql.yml',
        '│   └── static/                     前端单页应用',
        '│       ├── index.html、favicon.svg、css/app.css',
        '│       ├── lib/                    第三方库（本地化）',
        '│       ├── demo-images/            演示商品图片',
        '│       └── js/                     main.js、api.js、store.js、utils.js、',
        '│                                   components/、pages/（me/、admin/）',
        '├── src/test/java/                  单元测试、接口集成测试、并发测试',
        '├── e2e/system-test.js              浏览器端到端系统测试',
        '├── docs/                           文档、设计图、截图、测试结果',
        '└── tools/                          文档、设计图、演示图片生成脚本',
    ]),

    // ======================================================== 3 数据库设计
    h1('3 数据库设计'),
    h2('3.1 概念结构设计'),
    p('根据需求分析，系统的核心实体有用户、分类、商品、收藏、留言、订单六个，另有商品图片作为商品的多值属性单独成表。实体之间的关系如下：'),
    bullets([
        '一个用户可以发布多件商品（1:N）；一个分类下有多件商品（1:N）；一件商品有 1~6 张图片（1:N）。',
        '用户与商品之间的“收藏”是多对多关系，用 favorite 表拆分为两个 1:N，并用 (user_id, goods_id) 联合唯一约束保证不重复收藏。',
        '一件商品有多条留言，每条留言属于一个用户，可选地“回复”另一个用户。',
        '一个订单对应一件商品、一个买家、一个卖家；同一件商品可能因取消而产生多条订单记录，但同一时刻最多只有一条进行中的订单。',
    ]),
    figure('docs/diagrams/er.png', '图 3-1 数据库 E-R 图', { widthCm: 15, maxHeightCm: 15.5 }),
    h2('3.2 逻辑与物理结构设计'),
    p('表结构由 JPA 实体注解生成（spring.jpa.hibernate.ddl-auto=update），命名采用 Spring Boot 默认策略，即驼峰属性名转为下划线列名。所有业务表继承 BaseEntity，拥有自增主键 id 以及 created_at、updated_at 两个时间字段，时间由 @PrePersist / @PreUpdate 回调自动维护。枚举字段按名称存储（@Enumerated(EnumType.STRING)），在 H2（MySQL 模式）和 MySQL 中生成原生 ENUM 类型，可读性好且不受枚举顺序调整影响。金额统一使用 DECIMAL(10,2)，避免浮点误差。'),
    p('说明：下表中的类型以 H2 为准，在 MySQL 中 TIMESTAMP 对应 DATETIME(6)，其余类型一致。'),
    table({
        caption: '表 3-1 用户表 users',
        headers: ['字段名', '类型', '约束', '说明'],
        widths: [1.6, 2, 1.8, 3],
        rows: [
            ['id', 'BIGINT', 'PK，自增', '用户编号'],
            ['username', 'VARCHAR(20)', 'NOT NULL，UNIQUE', '登录用户名，4~20 位字母、数字或下划线'],
            ['password', 'VARCHAR(100)', 'NOT NULL', 'BCrypt 哈希后的密码（60 个字符）'],
            ['nickname', 'VARCHAR(20)', 'NOT NULL', '昵称，交易中展示给对方'],
            ['phone', 'VARCHAR(20)', '可空', '手机号，只对本人、管理员和交易对方可见'],
            ['role', 'ENUM', 'NOT NULL', '角色 USER / ADMIN，默认 USER'],
            ['status', 'ENUM', 'NOT NULL', '账号状态 NORMAL / BANNED，默认 NORMAL'],
            ['created_at', 'TIMESTAMP', 'NOT NULL', '注册时间'],
            ['updated_at', 'TIMESTAMP', 'NOT NULL', '最后修改时间'],
        ],
    }),
    table({
        caption: '表 3-2 分类表 category',
        headers: ['字段名', '类型', '约束', '说明'],
        widths: [1.6, 2, 1.8, 3],
        rows: [
            ['id', 'BIGINT', 'PK，自增', '分类编号'],
            ['name', 'VARCHAR(20)', 'NOT NULL，UNIQUE', '分类名称，如“数码电子”'],
            ['icon', 'VARCHAR(30)', '可空', 'Element Plus 图标名，如 Iphone、Reading'],
            ['sort_order', 'INT', 'NOT NULL', '排序值，越小越靠前，默认 0'],
            ['created_at / updated_at', 'TIMESTAMP', 'NOT NULL', '创建 / 修改时间'],
        ],
    }),
    table({
        caption: '表 3-3 商品表 goods',
        headers: ['字段名', '类型', '约束', '说明'],
        widths: [1.6, 2, 1.8, 3],
        rows: [
            ['id', 'BIGINT', 'PK，自增', '商品编号'],
            ['title', 'VARCHAR(50)', 'NOT NULL', '商品标题'],
            ['description', 'VARCHAR(2000)', 'NOT NULL', '商品描述'],
            ['price', 'DECIMAL(10,2)', 'NOT NULL', '售价，0.01~99999.99'],
            ['original_price', 'DECIMAL(10,2)', '可空', '原价，用于展示折扣'],
            ['category_id', 'BIGINT', 'NOT NULL，FK → category.id', '所属分类'],
            ['seller_id', 'BIGINT', 'NOT NULL，FK → users.id', '卖家'],
            ['condition_level', 'ENUM', 'NOT NULL', '成色，取值见表 3-9'],
            ['trade_location', 'VARCHAR(50)', 'NOT NULL', '交易地点，如“东区宿舍楼下”'],
            ['status', 'ENUM', 'NOT NULL', '商品状态，取值见表 3-9，发布后为 PENDING'],
            ['reject_reason', 'VARCHAR(200)', '可空', '审核驳回或管理员强制下架的原因'],
            ['view_count', 'INT', 'NOT NULL', '浏览量，默认 0；实体更新时不写入，只能原子递增'],
            ['created_at / updated_at', 'TIMESTAMP', 'NOT NULL', '发布 / 修改时间'],
        ],
    }),
    table({
        caption: '表 3-4 商品图片表 goods_image',
        headers: ['字段名', '类型', '约束', '说明'],
        widths: [1.6, 2, 1.8, 3],
        rows: [
            ['goods_id', 'BIGINT', 'PK（联合），FK → goods.id', '所属商品'],
            ['sort_order', 'INT', 'PK（联合）', '图片顺序，0 为封面（@OrderColumn 维护）'],
            ['url', 'VARCHAR(255)', 'NOT NULL', '图片访问地址，如 /uploads/202610/xxx.jpg'],
        ],
    }),
    table({
        caption: '表 3-5 收藏表 favorite',
        headers: ['字段名', '类型', '约束', '说明'],
        widths: [1.6, 2, 1.8, 3],
        rows: [
            ['id', 'BIGINT', 'PK，自增', '收藏记录编号'],
            ['user_id', 'BIGINT', 'NOT NULL，FK → users.id', '收藏人'],
            ['goods_id', 'BIGINT', 'NOT NULL，FK → goods.id', '被收藏的商品'],
            ['created_at / updated_at', 'TIMESTAMP', 'NOT NULL', '收藏时间'],
            ['（表级约束）', '—', 'UNIQUE(user_id, goods_id)', '同一用户对同一商品只能收藏一次'],
        ],
    }),
    table({
        caption: '表 3-6 留言表 comment',
        headers: ['字段名', '类型', '约束', '说明'],
        widths: [1.6, 2, 1.8, 3],
        rows: [
            ['id', 'BIGINT', 'PK，自增', '留言编号'],
            ['goods_id', 'BIGINT', 'NOT NULL，FK → goods.id', '所属商品'],
            ['user_id', 'BIGINT', 'NOT NULL，FK → users.id', '留言人'],
            ['reply_to_user_id', 'BIGINT', '可空，FK → users.id', '被回复的用户，为空表示直接留言'],
            ['content', 'VARCHAR(300)', 'NOT NULL', '留言内容'],
            ['created_at / updated_at', 'TIMESTAMP', 'NOT NULL', '留言时间'],
        ],
    }),
    table({
        caption: '表 3-7 订单表 trade_order',
        headers: ['字段名', '类型', '约束', '说明'],
        widths: [1.6, 2, 1.8, 3],
        rows: [
            ['id', 'BIGINT', 'PK，自增', '订单编号'],
            ['order_no', 'VARCHAR(32)', 'NOT NULL，UNIQUE', '业务订单号：yyyyMMddHHmmss + 6 位随机数'],
            ['goods_id', 'BIGINT', 'NOT NULL，FK → goods.id', '交易的商品'],
            ['buyer_id', 'BIGINT', 'NOT NULL，FK → users.id', '买家'],
            ['seller_id', 'BIGINT', 'NOT NULL，FK → users.id', '卖家'],
            ['goods_title', 'VARCHAR(50)', 'NOT NULL', '下单时的商品标题（快照）'],
            ['goods_image', 'VARCHAR(255)', '可空', '下单时的封面图（快照）'],
            ['price', 'DECIMAL(10,2)', 'NOT NULL', '成交价（快照）'],
            ['status', 'ENUM', 'NOT NULL', '订单状态，取值见表 3-9，下单后为 PENDING'],
            ['buyer_remark', 'VARCHAR(200)', '可空', '买家留言，如约定的交易时间'],
            ['cancel_reason', 'VARCHAR(200)', '可空', '取消原因，带“买家取消/卖家取消”前缀'],
            ['confirmed_at', 'TIMESTAMP', '可空', '卖家确认时间'],
            ['completed_at', 'TIMESTAMP', '可空', '买家确认收货时间'],
            ['cancelled_at', 'TIMESTAMP', '可空', '取消时间'],
            ['created_at / updated_at', 'TIMESTAMP', 'NOT NULL', '下单 / 修改时间'],
        ],
    }),
    h2('3.3 索引与完整性约束'),
    p('除主键索引外，系统依靠唯一约束保证业务规则，依靠外键保证引用完整性，见表 3-8。外键列由数据库自动建立索引，满足“按卖家查商品”“按买家/卖家查订单”“按商品查留言”等常用查询。'),
    table({
        caption: '表 3-8 唯一约束与外键',
        headers: ['表', '约束类型', '字段', '作用'],
        widths: [1.4, 1.2, 2.2, 3.2],
        rows: [
            ['users', 'UNIQUE', 'username', '用户名不能重复（注册时先查询，冲突返回 409）'],
            ['category', 'UNIQUE', 'name', '分类名称不能重复'],
            ['favorite', 'UNIQUE', '(user_id, goods_id)', '防止重复收藏'],
            ['trade_order', 'UNIQUE', 'order_no', '订单号全局唯一'],
            ['goods', 'FOREIGN KEY', 'category_id、seller_id', '分类、卖家必须存在；有商品的分类不允许删除'],
            ['goods_image', 'FOREIGN KEY', 'goods_id', '图片随商品存在'],
            ['favorite / comment', 'FOREIGN KEY', 'user_id、goods_id、reply_to_user_id', '收藏、留言关联的用户和商品必须存在'],
            ['trade_order', 'FOREIGN KEY', 'goods_id、buyer_id、seller_id', '订单关联的商品与买卖双方必须存在'],
        ],
    }),
    h2('3.4 枚举值设计'),
    p('状态类字段统一用 Java 枚举定义，每个枚举值带中文标签（getLabel()），接口同时返回枚举名和中文文本（如 status 与 statusText），前端无需维护重复的映射。'),
    table({
        caption: '表 3-9 枚举值说明',
        headers: ['枚举', '取值', '中文含义'],
        widths: [1.6, 2, 3],
        rows: [
            ['GoodsStatus\n商品状态', 'PENDING / ON_SALE / REJECTED / RESERVED / SOLD / OFF_SHELF', '待审核 / 在售 / 审核未通过 / 交易中 / 已售出 / 已下架'],
            ['OrderStatus\n订单状态', 'PENDING / CONFIRMED / COMPLETED / CANCELLED', '待卖家确认 / 待交易 / 已完成 / 已取消'],
            ['ConditionLevel\n成色', 'NEW / LIKE_NEW / LIGHTLY_USED / USED', '全新 / 几乎全新 / 轻微使用痕迹 / 明显使用痕迹'],
            ['Role\n角色', 'USER / ADMIN', '普通用户 / 管理员'],
            ['UserStatus\n账号状态', 'NORMAL / BANNED', '正常 / 已封禁'],
        ],
    }),

    // ======================================================== 4 接口设计
    h1('4 接口设计'),
    h2('4.1 接口规范'),
    p('后端对外提供 REST 风格的 JSON 接口，统一以 /api 为前缀，遵循以下约定：'),
    bullets([
        '**资源与动作**：查询用 GET，创建用 POST，整体修改用 PUT，删除用 DELETE；状态变更类动作用 POST + 动词子路径，如 /api/orders/{id}/confirm。',
        '**统一响应**：所有接口返回 ApiResponse 结构 {"code", "message", "data"}，code 为 0 表示成功，否则等于 HTTP 状态码；分页数据统一为 PageResult {records, total, page, size}，page 从 1 开始，size 最大 50。',
        '**鉴权**：登录后在请求头携带 Authorization: Bearer <token>。未标注 @PublicApi 的接口必须登录，/api/admin/** 只允许管理员访问。',
        '**时间格式**：LocalDateTime 统一序列化为 yyyy-MM-dd HH:mm:ss（JacksonConfig）。',
        '**参数校验**：请求体使用 Bean Validation 注解校验，错误信息为中文，多个错误用“；”拼接返回。',
    ]),
    code([
        '// 成功响应示例',
        '{ "code": 0, "message": "success", "data": { ... } }',
        '// 失败响应示例（HTTP 状态码同为 409）',
        '{ "code": 409, "message": "手慢了，商品已被其他同学下单", "data": null }',
    ]),
    table({
        caption: '表 4-1 HTTP 状态码约定',
        headers: ['状态码', '含义', '典型场景'],
        widths: [1, 1.6, 5],
        center: [0],
        rows: [
            ['200', '成功', '请求处理成功，响应体 code = 0'],
            ['400', '请求参数错误', '字段校验失败、请求体格式错误、驳回时未填写原因、当前状态不允许该操作'],
            ['401', '未认证', '未登录、令牌无效或过期、用户名或密码错误'],
            ['403', '无权限', '账号被封禁、非管理员访问后台、操作他人的商品或订单'],
            ['404', '资源不存在', '商品、订单、分类、用户不存在；非公开商品对他人不可见'],
            ['405', '方法不允许', '使用了接口不支持的 HTTP 方法'],
            ['409', '冲突', '用户名已注册、分类重名、分类下仍有商品、商品不可购买或已被他人下单'],
            ['500', '服务器内部错误', '未预期的异常（记录日志，返回通用提示）'],
        ],
    }),
    h2('4.2 接口清单'),
    p('系统共提供 35 个业务接口，按控制器分组列于表 4-2。“权限”一列中，“公开”表示游客可访问（若携带令牌仍会识别当前用户），“登录”表示需要有效令牌，“管理员”表示需要 ADMIN 角色。'),
    table({
        caption: '表 4-2 接口清单',
        headers: ['序号', '方法', '路径', '说明', '权限'],
        widths: [0.6, 1.1, 3.1, 2.5, 0.9],
        center: [0, 1, 4],
        rows: [
            ['', '', '**AuthController**', '', ''],
            ['1', 'POST', '/api/auth/register', '用户注册', '公开'],
            ['2', 'POST', '/api/auth/login', '登录，返回 JWT 与用户信息', '公开'],
            ['3', 'GET', '/api/auth/me', '获取当前登录用户', '登录'],
            ['', '', '**UserController**', '', ''],
            ['4', 'PUT', '/api/users/me', '修改昵称、手机号', '登录'],
            ['5', 'PUT', '/api/users/me/password', '修改密码（校验原密码）', '登录'],
            ['', '', '**CategoryController**', '', ''],
            ['6', 'GET', '/api/categories', '分类列表（含商品数）', '公开'],
            ['', '', '**GoodsController**', '', ''],
            ['7', 'GET', '/api/goods', '搜索在售商品（关键词、分类、价格区间、排序、分页）', '公开'],
            ['8', 'GET', '/api/goods/{id}', '商品详情（浏览量 +1，返回是否已收藏）', '公开'],
            ['9', 'GET', '/api/goods/mine', '我发布的商品，可按状态筛选', '登录'],
            ['10', 'POST', '/api/goods', '发布商品（进入待审核）', '登录'],
            ['11', 'PUT', '/api/goods/{id}', '编辑本人商品（重新审核）', '登录'],
            ['12', 'POST', '/api/goods/{id}/off-shelf', '卖家下架商品', '登录'],
            ['13', 'POST', '/api/goods/{id}/on-shelf', '卖家重新上架（重新审核）', '登录'],
            ['', '', '**CommentController**', '', ''],
            ['14', 'GET', '/api/goods/{goodsId}/comments', '商品留言列表', '公开'],
            ['15', 'POST', '/api/goods/{goodsId}/comments', '发表留言 / 回复', '登录'],
            ['16', 'DELETE', '/api/comments/{id}', '删除留言（作者、卖家或管理员）', '登录'],
            ['', '', '**FavoriteController**', '', ''],
            ['17', 'GET', '/api/favorites', '我的收藏（分页）', '登录'],
            ['18', 'POST', '/api/favorites/{goodsId}', '收藏商品（幂等）', '登录'],
            ['19', 'DELETE', '/api/favorites/{goodsId}', '取消收藏（幂等）', '登录'],
            ['', '', '**OrderController**', '', ''],
            ['20', 'POST', '/api/orders', '下单', '登录'],
            ['21', 'GET', '/api/orders', '订单列表，role=buyer / seller，可按状态筛选', '登录'],
            ['22', 'GET', '/api/orders/{id}', '订单详情（买卖双方或管理员）', '登录'],
            ['23', 'POST', '/api/orders/{id}/confirm', '卖家确认订单', '登录'],
            ['24', 'POST', '/api/orders/{id}/complete', '买家确认收货', '登录'],
            ['25', 'POST', '/api/orders/{id}/cancel', '买家或卖家取消订单（可填原因）', '登录'],
            ['', '', '**FileController**', '', ''],
            ['26', 'POST', '/api/files/images', '上传商品图片（multipart，字段名 file）', '登录'],
            ['', '', '**AdminController**', '', ''],
            ['27', 'GET', '/api/admin/stats', '数据概览与统计图表数据', '管理员'],
            ['28', 'GET', '/api/admin/users', '用户列表，按用户名 / 昵称搜索', '管理员'],
            ['29', 'PUT', '/api/admin/users/{id}/status', '封禁 / 解封用户', '管理员'],
            ['', '', '**AdminGoodsController**', '', ''],
            ['30', 'GET', '/api/admin/goods', '全部商品，按状态、标题筛选', '管理员'],
            ['31', 'POST', '/api/admin/goods/{id}/audit', '审核商品（通过 / 驳回）', '管理员'],
            ['32', 'POST', '/api/admin/goods/{id}/off-shelf', '强制下架违规商品', '管理员'],
            ['', '', '**AdminCategoryController**', '', ''],
            ['33', 'POST', '/api/admin/categories', '新增分类', '管理员'],
            ['34', 'PUT', '/api/admin/categories/{id}', '修改分类', '管理员'],
            ['35', 'DELETE', '/api/admin/categories/{id}', '删除分类（分类下无商品时）', '管理员'],
        ],
    }),
    p('此外，/uploads/** 映射到服务器上传目录，/demo-images/** 为演示图片，/h2-console 为 H2 数据库控制台（仅默认 H2 配置下开启）。'),
    h2('4.3 关键接口说明'),
    h3('4.3.1 用户登录'),
    kvTable([
        ['接口', 'POST /api/auth/login（公开）'],
        ['请求参数', 'username：用户名，必填\npassword：密码，必填'],
        ['处理逻辑', '按用户名查询用户并用 BCrypt 比对密码；失败返回 401“用户名或密码错误”；账号被封禁返回 403；成功则签发有效期 168 小时的 JWT'],
        ['成功响应', 'data.token：JWT 令牌；data.user：UserVO（含角色、状态及中文文本）'],
    ], { caption: '表 4-3 登录接口' }),
    code([
        '// 请求',
        'POST /api/auth/login',
        '{ "username": "zhangsan", "password": "123456" }',
        '// 响应',
        '{',
        '  "code": 0, "message": "success",',
        '  "data": {',
        '    "token": "eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiIyIi…（省略）",',
        '    "user": {',
        '      "id": 2, "username": "zhangsan", "nickname": "张三",',
        '      "phone": "13800000001", "role": "USER", "roleText": "普通用户",',
        '      "status": "NORMAL", "statusText": "正常",',
        '      "createdAt": "2026-09-26 10:20:45"',
        '    }',
        '  }',
        '}',
    ]),
    h3('4.3.2 发布商品'),
    kvTable([
        ['接口', 'POST /api/goods（登录）'],
        ['请求参数', 'title：标题，必填，≤50 字\ndescription：描述，必填，≤2000 字\nprice：售价，0.01~99999.99，最多两位小数\noriginalPrice：原价，可选\ncategoryId：分类 ID，必填\nconditionLevel：成色枚举，必填\ntradeLocation：交易地点，必填，≤50 字\nimages：图片 URL 数组，1~6 张（先调用上传接口获得）'],
        ['处理逻辑', '校验分类存在，以当前用户为卖家保存商品，状态置为 PENDING，等待管理员审核'],
        ['成功响应', 'data：GoodsVO，status 为 "PENDING"，statusText 为“待审核”'],
        ['错误响应', '400：字段校验失败；401：未登录；404：分类不存在'],
    ], { caption: '表 4-4 发布商品接口' }),
    code([
        '// 请求',
        'POST /api/goods',
        '{',
        '  "title": "宿舍小冰箱 50L 九成新",',
        '  "description": "制冷正常，噪音小，适合宿舍放饮料水果。",',
        '  "price": 199, "originalPrice": 599,',
        '  "categoryId": 3, "conditionLevel": "LIKE_NEW",',
        '  "tradeLocation": "南区 5 号楼",',
        '  "images": ["/uploads/202610/3f2a9c…e1.jpg"]',
        '}',
        '// 校验失败响应（HTTP 400）',
        '{ "code": 400, "data": null,',
        '  "message": "标题不能为空；价格必须大于 0；请至少上传一张图片" }',
    ]),
    h3('4.3.3 搜索商品'),
    kvTable([
        ['接口', 'GET /api/goods（公开）'],
        ['请求参数', 'keyword：关键词，匹配标题或描述（不区分大小写），可选\ncategoryId：分类 ID，可选\nminPrice / maxPrice：价格区间，可选\nsort：newest（默认）/ hot / price_asc / price_desc\npage：页码，默认 1；size：每页条数，默认 12，最大 50'],
        ['处理逻辑', '使用 JPA Specification 动态拼接查询条件，只返回 ON_SALE 状态的商品'],
        ['成功响应', 'data：PageResult<GoodsVO>'],
    ], { caption: '表 4-5 搜索商品接口' }),
    code([
        '// 请求',
        'GET /api/goods?keyword=耳机&sort=price_asc&page=1&size=12',
        '// 响应',
        '{',
        '  "code": 0, "message": "success",',
        '  "data": {',
        '    "records": [ {',
        '      "id": 3, "title": "索尼 WH-1000XM4 降噪耳机",',
        '      "price": 850.00, "originalPrice": 2299.00,',
        '      "categoryId": 1, "categoryName": "数码电子",',
        '      "conditionLevel": "LIGHTLY_USED", "conditionText": "轻微使用痕迹",',
        '      "tradeLocation": "西区食堂门口",',
        '      "coverImage": "/demo-images/headphone.jpg",',
        '      "status": "ON_SALE", "statusText": "在售",',
        '      "seller": { "id": 4, "nickname": "王五" }, "viewCount": 205, …',
        '    } ],',
        '    "total": 1, "page": 1, "size": 12',
        '  }',
        '}',
    ]),
    h3('4.3.4 下单'),
    kvTable([
        ['接口', 'POST /api/orders（登录）'],
        ['请求参数', 'goodsId：商品 ID，必填\nremark：给卖家的留言，可选，≤200 字'],
        ['处理逻辑', '校验不是自己的商品、商品为在售状态；用条件更新把商品从 ON_SALE 改为 RESERVED，更新行数为 0 说明已被他人抢先下单；保存带商品快照的订单，状态为 PENDING'],
        ['成功响应', 'data：OrderVO，含订单号、商品快照、交易地点、买卖双方联系方式'],
        ['错误响应', '400：购买自己的商品；404：商品不存在；409：商品不可购买或已被他人下单'],
    ], { caption: '表 4-6 下单接口' }),
    code([
        '// 请求',
        'POST /api/orders',
        '{ "goodsId": 15, "remark": "周六上午 10 点南区 5 号楼楼下可以吗？" }',
        '// 响应',
        '{',
        '  "code": 0, "message": "success",',
        '  "data": {',
        '    "id": 9, "orderNo": "20261026101927325448", "goodsId": 15,',
        '    "goodsTitle": "宿舍小冰箱 50L 九成新", "price": 199.00,',
        '    "tradeLocation": "南区 5 号楼",',
        '    "status": "PENDING", "statusText": "待卖家确认",',
        '    "buyer": { "id": 3, "nickname": "李四", "phone": "13800000002" },',
        '    "seller": { "id": 7, "nickname": "新同学", "phone": "13900001111" }, …',
        '  }',
        '}',
        '// 商品已被他人抢先下单（HTTP 409）',
        '{ "code": 409, "message": "手慢了，商品已被其他同学下单", "data": null }',
    ]),
    h3('4.3.5 审核商品'),
    kvTable([
        ['接口', 'POST /api/admin/goods/{id}/audit（管理员）'],
        ['请求参数', 'approved：是否通过，必填\nreason：驳回原因，approved=false 时必填，≤200 字'],
        ['处理逻辑', '只有 PENDING 状态的商品可以审核；通过则改为 ON_SALE 并清空原因，驳回则改为 REJECTED 并记录原因，卖家可在“我发布的”中查看'],
        ['错误响应', '400：不是待审核状态或驳回未填原因；403：非管理员；404：商品不存在'],
    ], { caption: '表 4-7 审核商品接口' }),
    code([
        'POST /api/admin/goods/20/audit',
        '{ "approved": false, "reason": "商品描述与图片不符，请补充实物照片" }',
        '// 响应 data 为 GoodsVO：status = "REJECTED"，rejectReason 为上述原因',
    ]),
    h3('4.3.6 数据统计'),
    kvTable([
        ['接口', 'GET /api/admin/stats（管理员）'],
        ['响应字段', 'userCount、goodsCount、onSaleCount、pendingCount、orderCount、completedOrderCount：各项计数\nturnover：已完成订单成交总额\ncategoryDistribution：各分类商品数\nstatusDistribution：各状态商品数\norderTrend：近 7 天每日下单数（无订单的日期补 0）'],
    ], { caption: '表 4-8 数据统计接口' }),
    code([
        '{',
        '  "code": 0, "message": "success",',
        '  "data": {',
        '    "userCount": 7, "goodsCount": 20, "onSaleCount": 10,',
        '    "pendingCount": 2, "orderCount": 8, "completedOrderCount": 3,',
        '    "turnover": 274.00,',
        '    "categoryDistribution": [',
        '      { "name": "数码电子", "value": 6 }, { "name": "书籍教材", "value": 3 }, …',
        '    ],',
        '    "statusDistribution": [',
        '      { "name": "待审核", "value": 2 }, { "name": "在售", "value": 10 }, …',
        '    ],',
        '    "orderTrend": [',
        '      { "name": "10-20", "value": 1 }, …, { "name": "10-26", "value": 2 }',
        '    ]',
        '  }',
        '}',
    ]),

    // ======================================================== 5 详细设计
    h1('5 详细设计'),
    h2('5.1 类设计'),
    p('领域模型如图 5-1 所示。所有实体继承抽象类 BaseEntity，统一主键生成策略（IDENTITY）和创建/修改时间的维护；实体间的多对一关联使用 @ManyToOne，商品图片使用 @ElementCollection + @OrderColumn 保存有序的 URL 列表；状态与成色等字段使用枚举。'),
    figure('docs/diagrams/class.png', '图 5-1 实体类图', { widthCm: 14, maxHeightCm: 17 }),
    p('业务层与控制层的主要类及依赖关系如图 5-2 所示。Controller 只负责参数接收与结果包装，通过构造器注入调用 Service；Service 依赖 Repository 和其他 Service（例如 OrderService 依赖 GoodsService 获取商品），不直接依赖 Web 层的任何类，因此可以脱离 Spring 容器做单元测试。'),
    figure('docs/diagrams/class-service.png', '图 5-2 核心业务类图', { widthCm: 15 }),
    table({
        caption: '表 5-1 主要类职责',
        headers: ['类', '所在包', '职责'],
        widths: [2, 1.2, 4.6],
        rows: [
            ['UserService', 'service', '注册（用户名查重、BCrypt 加密）、登录签发令牌、修改资料与密码、管理员查询与封禁用户'],
            ['GoodsService', 'service', '商品发布、编辑、上下架、搜索（Specification）、详情可见性判断与浏览量统计、审核与强制下架'],
            ['OrderService', 'service', '下单（条件更新防超卖、订单快照）、卖家确认、买家确认收货、取消订单并恢复商品在售'],
            ['CategoryService', 'service', '分类列表（附商品数）、新增、修改、删除（重名与仍有商品时拒绝）'],
            ['FavoriteService / CommentService', 'service', '收藏与取消收藏（幂等）；留言、回复与删除权限判断'],
            ['FileService', 'service', '图片上传校验（扩展名、大小、文件头魔数）与保存'],
            ['StatsService', 'service', '后台概览统计、分类与状态分布、近 7 天下单趋势'],
            ['AuthInterceptor', 'security', '解析令牌、加载用户、登录 / 封禁 / 管理员权限校验，维护 UserContext'],
            ['JwtTokenProvider', 'security', '使用 HMAC-SHA 密钥签发和解析 JWT'],
            ['GlobalExceptionHandler', 'common', '把业务异常、校验异常等转换为统一的 ApiResponse'],
            ['DataInitializer', 'init', '首次启动时写入演示用户、分类、商品、订单、留言和收藏'],
            ['GoodsRepository', 'repository', '商品查询、Specification 动态查询、compareAndSetStatus 条件更新、浏览量原子递增、分组统计'],
        ],
    }),

    h2('5.2 认证与授权设计'),
    p('系统采用基于 JWT 的无状态认证，登录与后续请求的处理流程如图 5-3 所示。'),
    figure('docs/diagrams/seq-login.png', '图 5-3 登录与鉴权时序图', { widthCm: 15, maxHeightCm: 15 }),
    h3('5.2.1 令牌签发与校验'),
    p('JwtTokenProvider 使用配置项 app.jwt.secret 生成 HMAC 密钥，并显式指定 HS256 算法签名（若不指定，jjwt 会按密钥长度自动选用 HS384/HS512），令牌的 subject 只保存用户 ID，有效期由 app.jwt.expire-hours 配置（默认 168 小时）。解析时签名错误、格式错误或已过期均返回空，由拦截器按未登录处理。密钥可通过环境变量 APP_JWT_SECRET 覆盖，避免把生产密钥写进代码仓库。'),
    h3('5.2.2 登录拦截与权限控制'),
    p('WebConfig 将 AuthInterceptor 注册到 /api/** 路径。拦截器的处理规则如下：'),
    steps([
        '从请求头 Authorization: Bearer <token> 中解析用户 ID，并**每次都从数据库重新加载用户**，因此封禁、修改角色等操作可以立即生效，不必等令牌过期。',
        '若 Controller 方法或类上标注了 @PublicApi，则未登录也放行（游客可浏览商品）；若携带了有效令牌，仍会识别当前用户，用于返回“是否已收藏”等个性化信息。',
        '其他接口在未登录时抛出 401；账号状态为 BANNED 时抛出 403“账号已被封禁”。',
        '请求路径以 /api/admin 开头且当前用户不是管理员时抛出 403“需要管理员权限”。',
        '校验通过后把用户放入 UserContext（ThreadLocal），请求结束时在 afterCompletion 中清除，避免线程复用导致的数据串扰。',
    ]),
    snippet('src/main/java/com/campus/market/security/AuthInterceptor.java', 'public boolean preHandle', { close: '}' }),
    p('拦截器中抛出的 BusinessException 会被 DispatcherServlet 交给全局异常处理器，统一转换为 JSON 响应。资源级的权限（例如只能编辑自己的商品、只有卖家能确认订单）在 Service 层判断，见 5.3 和 5.4 节。'),

    h2('5.3 商品发布与审核设计'),
    p('为了保证平台信息质量，所有新发布或修改过的商品都要经过管理员审核才能公开展示，流程如图 5-4 所示。卖家先调用上传接口获得图片 URL，再提交商品信息；商品进入 PENDING 状态，只有卖家本人和管理员可以查看。管理员在“商品审核”页按提交先后顺序处理，通过后商品变为 ON_SALE 出现在首页，驳回则必须填写原因，卖家修改后可重新提交。'),
    figure('docs/diagrams/seq-audit.png', '图 5-4 商品发布与审核时序图', { widthCm: 15, maxHeightCm: 14 }),
    p('商品共有六种状态，状态转换如图 5-5 和表 5-2 所示。GoodsService 用 EnumSet 集中定义“可编辑状态”“可下架状态”“公开可见状态”，在每个操作入口先校验当前状态，不合法时返回 400。'),
    figure('docs/diagrams/state-goods.png', '图 5-5 商品状态图', { widthCm: 12, maxHeightCm: 13 }),
    table({
        caption: '表 5-2 商品状态转换规则',
        headers: ['当前状态', '事件', '操作者', '新状态', '实现方法'],
        widths: [2.2, 1.6, 1, 1.6, 2.4],
        rows: [
            ['—', '发布商品', '卖家', 'PENDING', 'GoodsService.publish'],
            ['PENDING', '审核通过', '管理员', 'ON_SALE', 'GoodsService.audit'],
            ['PENDING', '审核驳回（必填原因）', '管理员', 'REJECTED', 'GoodsService.audit'],
            ['PENDING / ON_SALE / REJECTED / OFF_SHELF', '编辑商品', '卖家', 'PENDING（清空原因）', 'GoodsService.update'],
            ['PENDING / ON_SALE / REJECTED', '主动下架', '卖家', 'OFF_SHELF', 'GoodsService.offShelf'],
            ['OFF_SHELF', '重新上架', '卖家', 'PENDING', 'GoodsService.reShelf'],
            ['PENDING / ON_SALE', '强制下架（记录原因）', '管理员', 'OFF_SHELF', 'GoodsService.forceOffShelf'],
            ['ON_SALE', '买家下单', '买家', 'RESERVED', 'OrderService.create'],
            ['RESERVED', '取消订单', '买家 / 卖家', 'ON_SALE', 'OrderService.cancel'],
            ['RESERVED', '确认收货', '买家', 'SOLD', 'OrderService.complete'],
        ],
    }),
    p('商品详情接口的可见性规则：ON_SALE、RESERVED、SOLD 三种状态对所有人可见；其余状态只对卖家本人和管理员可见，他人访问返回 404。浏览量只在非卖家本人查看时通过 `update Goods g set g.viewCount = g.viewCount + 1` 原子递增，view_count 列设置为 updatable = false，实体更新时不会覆盖并发累加的结果。'),

    h2('5.4 交易订单设计'),
    h3('5.4.1 交易流程'),
    p('平台采用“线上撮合、线下交易”的模式：买家下单后商品被锁定为“交易中”，卖家确认订单后双方可以在订单中看到对方的手机号，约定时间地点当面验货，买家确认收货后交易完成。完成前买卖双方都可以取消订单，取消后商品自动恢复在售。订单状态转换如图 5-6 所示。'),
    figure('docs/diagrams/state-order.png', '图 5-6 订单状态图', { widthCm: 10, maxHeightCm: 10 }),
    table({
        caption: '表 5-3 订单状态转换规则',
        headers: ['当前状态', '事件', '操作者', '新状态', '对商品的影响'],
        widths: [1.6, 1.4, 1.2, 1.4, 2.6],
        rows: [
            ['—', '下单', '买家', 'PENDING', 'ON_SALE → RESERVED（条件更新）'],
            ['PENDING', '确认订单', '卖家', 'CONFIRMED', '无'],
            ['CONFIRMED', '确认收货', '买家', 'COMPLETED', 'RESERVED → SOLD'],
            ['PENDING / CONFIRMED', '取消订单', '买家或卖家', 'CANCELLED', 'RESERVED → ON_SALE'],
            ['COMPLETED / CANCELLED', '任何操作', '—', '不变（返回 400）', '无'],
        ],
    }),
    h3('5.4.2 防止超卖的并发控制'),
    p('同一件热门商品可能被多个买家几乎同时点击“我想要”。如果采用“先查询状态、再更新状态”的写法，两个请求可能同时读到 ON_SALE，然后都下单成功，造成超卖。系统使用**带条件的原子更新**（Compare-And-Set）解决这个问题，下单时序如图 5-7 所示。'),
    figure('docs/diagrams/seq-order.png', '图 5-7 下单时序图', { widthCm: 15, maxHeightCm: 13 }),
    p('GoodsRepository 中的条件更新语句如下。UPDATE 语句在数据库中对目标行加行锁并重新判断 WHERE 条件，因此并发请求中只有第一个能把状态从 ON_SALE 改为 RESERVED，其余请求的受影响行数为 0。'),
    snippet('src/main/java/com/campus/market/repository/GoodsRepository.java', '@Modifying(flushAutomatically', { end: 'int compareAndSetStatus' }),
    p('OrderService.create 根据受影响行数判断是否抢到商品，抢到后才创建订单：'),
    snippet('src/main/java/com/campus/market/service/OrderService.java', 'public OrderVO create(User buyer', { close: '}' }),
    p('该方案不需要分布式锁或悲观锁，代码简单且性能好。测试中用 10 个线程同时对同一商品下单并重复 5 轮，每轮都只有 1 个请求成功、其余返回 409，验证了方案的正确性（见《软件测试报告》）。'),
    h3('5.4.3 订单快照'),
    p('订单表冗余保存了下单时的商品标题、封面图和价格（goods_title、goods_image、price）。这样即使卖家之后修改了商品信息，历史订单仍然显示交易时的真实内容，成交额统计也以快照价格为准。订单号由“下单时间（yyyyMMddHHmmss）+ 6 位随机数”组成，便于人工核对，并通过唯一约束保证不重复。'),
    p('订单列表中显示对方联系方式（UserContact 含手机号），而商品详情、留言等公开接口只返回 UserBrief（ID 与昵称），避免手机号对无关用户泄露。'),

    h2('5.5 文件上传设计'),
    p('商品图片通过 POST /api/files/images 单独上传，返回可访问的 URL，发布商品时提交 URL 列表。FileService 的校验与存储规则见表 5-4。'),
    table({
        caption: '表 5-4 图片上传校验与存储规则',
        headers: ['规则', '设计'],
        widths: [1.5, 5],
        rows: [
            ['登录要求', '上传接口需要登录，防止匿名滥用存储空间'],
            ['大小限制', '单个文件不超过 5MB（Service 校验，同时 spring.servlet.multipart.max-file-size=5MB）'],
            ['格式白名单', '扩展名只允许 jpg、jpeg、png、gif、webp'],
            ['内容校验', '读取文件前 12 个字节判断魔数（JPEG: FF D8 FF；PNG: 89 50 4E 47；GIF: GIF8；WEBP: RIFF....WEBP），不信任客户端声明的 Content-Type，伪装成图片的文本文件会被拒绝'],
            ['文件命名', '使用随机 UUID 作为文件名，避免重名覆盖，也杜绝了“../”路径穿越'],
            ['目录组织', '按月份分目录保存：uploads/yyyyMM/uuid.ext，便于清理和备份'],
            ['访问方式', 'WebConfig 把 /uploads/** 映射为上传目录的静态资源，返回值如 /uploads/202610/3f2a….jpg'],
        ],
    }),
    snippet('src/main/java/com/campus/market/service/FileService.java', 'static boolean looksLikeImage', { close: '}' }),

    h2('5.6 统计设计'),
    p('管理后台的数据概览由 StatsService 一次性计算返回：计数类指标使用 Repository 的 count / countByStatus；成交额使用 `select coalesce(sum(o.price), 0)` 汇总已完成订单；分类分布与状态分布分别使用 group by 查询，再与全部分类、全部状态合并，没有数据的项补 0，保证图表的类目完整。'),
    p('近 7 天下单趋势只查询起始日期之后的下单时间，在内存中按天累加，并预先为每一天放入 0，避免没有订单的日期在折线图中缺失：'),
    snippet('src/main/java/com/campus/market/service/StatsService.java', 'List<NameValue> orderTrend(LocalDate today)', { close: '}' }),

    h2('5.7 异常处理设计'),
    p('业务层发现不满足业务规则时抛出 BusinessException，并携带 HTTP 状态码与中文提示；GlobalExceptionHandler（@RestControllerAdvice）集中把各类异常转换为统一响应，映射关系见表 5-5。未预期的异常会记录完整日志，但只向前端返回通用提示，避免泄露内部实现细节。'),
    table({
        caption: '表 5-5 异常与响应映射',
        headers: ['异常类型', 'HTTP 状态码', '返回信息'],
        widths: [3.2, 1.2, 3.4],
        center: [1],
        rows: [
            ['BusinessException', '异常自带', '业务提示，如“不能购买自己发布的商品”'],
            ['MethodArgumentNotValidException', '400', '各字段校验信息用“；”拼接'],
            ['HttpMessageNotReadableException\nMissingServletRequestParameterException\nMethodArgumentTypeMismatchException', '400', '请求参数格式错误'],
            ['MaxUploadSizeExceededException', '400', '上传文件过大，单个文件不能超过 5MB'],
            ['HttpRequestMethodNotSupportedException', '405', '不支持的请求方法'],
            ['NoResourceFoundException', '404', '资源不存在'],
            ['Exception（其他）', '500', '服务器内部错误，请稍后重试（并记录错误日志）'],
        ],
    }),

    h2('5.8 前端设计'),
    h3('5.8.1 总体结构'),
    p('前端是不需要构建工具的 Vue 3 单页应用：index.html 依次加载本地的 Vue、Vue Router、Element Plus、Axios、ECharts 全局构建文件，再以 ES Module 方式加载 js/main.js。页面组件用 setup() 组合式 API 编写，模板以字符串形式内联在组件中，由 Vue 运行时编译。这种方式省去了 Node.js 构建步骤，前端代码随 jar 发布，部署和演示都非常简单。'),
    bullets([
        '**main.js**：创建应用，注册 Element Plus（中文语言包）与全部图标组件，定义路由表和路由守卫。',
        '**api.js**：封装 Axios 实例与全部接口函数，统一处理令牌、错误提示与登录过期。',
        '**store.js**：用 reactive 保存登录状态（token、user），并持久化到 localStorage。',
        '**utils.js**：状态与成色常量、价格与时间格式化、确认框与输入框封装。',
        '**components/**：可复用组件；**pages/**：页面组件，其中 me/ 为个人中心，admin/ 为管理后台。',
    ]),
    h3('5.8.2 路由与守卫'),
    p('路由采用 Hash 模式（如 #/goods/1），刷新页面时不需要服务器做路由回退配置。路由的 meta.auth 表示需要登录，meta.admin 表示需要管理员，路由表见表 5-6。'),
    table({
        caption: '表 5-6 前端路由表',
        headers: ['路径', '页面组件', '说明', '访问控制'],
        widths: [2.2, 2, 2.4, 1.4],
        rows: [
            ['/', 'Home', '首页：分类、筛选、排序、搜索、分页', '公开'],
            ['/goods/:id', 'GoodsDetail', '商品详情、收藏、下单、留言', '公开'],
            ['/publish', 'Publish', '发布闲置', 'auth'],
            ['/goods/:id/edit', 'Publish', '编辑商品（复用发布页）', 'auth'],
            ['/login、/register', 'Login、Register', '登录、注册', '公开'],
            ['/me/goods', 'MyGoods', '我发布的（按状态分页）', 'auth'],
            ['/me/bought、/me/sold', 'Orders（role 属性）', '我买到的 / 我卖出的', 'auth'],
            ['/me/favorites、/me/profile', 'Favorites、Profile', '我的收藏、个人资料与改密码', 'auth'],
            ['/admin/dashboard', 'Dashboard', '数据概览与图表', 'auth + admin'],
            ['/admin/audit、/admin/goods', 'Audit、GoodsManage', '商品审核、商品管理', 'auth + admin'],
            ['/admin/users、/admin/categories', 'Users、Categories', '用户管理、分类管理', 'auth + admin'],
        ],
    }),
    snippet('src/main/resources/static/js/main.js', 'router.beforeEach((to) => {', { close: '});' }),
    p('前端守卫只用于改善体验（及时跳转到登录页），真正的权限控制由后端拦截器保证，即使绕过前端直接调用接口也无法越权。'),
    h3('5.8.3 请求封装与错误处理'),
    p('api.js 中的 Axios 请求拦截器自动附加令牌；响应拦截器直接返回 data 字段，并统一处理错误：401 时清除本地登录状态并跳转登录页（带上 redirect 参数，登录后返回原页面），其他错误用 ElMessage 显示后端返回的中文提示。页面代码因此只需关注成功逻辑。'),
    snippet('src/main/resources/static/js/api.js', 'http.interceptors.response.use(', { close: ');' }),
    h3('5.8.4 组件划分'),
    table({
        caption: '表 5-7 前端组件与页面',
        headers: ['组件 / 页面', '文件', '说明'],
        widths: [1.6, 2.6, 3.6],
        rows: [
            ['AppHeader', 'components/AppHeader.js', '顶部导航：Logo、全局搜索、发布按钮、用户菜单、管理后台入口'],
            ['GoodsCard', 'components/GoodsCard.js', '商品卡片：封面、标题、价格与原价、成色、卖家、浏览量、非在售状态角标'],
            ['UserAvatar', 'components/UserAvatar.js', '以昵称首字和按用户 ID 取色生成头像'],
            ['UserCenter / AdminLayout', 'pages/me/、pages/admin/', '左侧菜单 + 右侧子路由的布局组件；AdminLayout 通过 provide 向子页面提供刷新待审核数量的方法'],
            ['Publish', 'pages/Publish.js', '发布与编辑共用，el-upload 上传图片、表单校验、交易地点自动补全'],
            ['Orders', 'pages/me/Orders.js', '通过 role 属性复用为“我买到的”和“我卖出的”，根据角色和状态显示操作按钮'],
            ['Dashboard', 'pages/admin/Dashboard.js', '统计卡片 + ECharts 折线图、环形图、条形图，组件卸载时销毁图表'],
        ],
    }),

    // ======================================================== 6 界面设计
    h1('6 界面设计'),
    h2('6.1 界面设计原则'),
    bullets([
        '**统一风格**：以橙色 #F97316 为主色（覆盖 Element Plus 主题变量），白色卡片 + 浅灰背景，圆角 12px，价格统一用醒目的红色。',
        '**信息层次清晰**：首页以大图卡片网格展示商品，关键信息（价格、成色、卖家、浏览量）一眼可见；详情页左图右文。',
        '**及时反馈**：所有操作都有成功 / 失败提示；危险操作（下架、取消订单、封禁）需要二次确认；驳回、取消等操作要求填写原因。',
        '**自适应**：商品网格按宽度自动换列（auto-fill，最小 220px），窄屏（<900px）下详情页、个人中心、后台变为单列布局。',
    ]),
    h2('6.2 主要界面'),
    p('首页（图 6-1）顶部为宣传横幅和在售数量，下方为分类标签、排序方式和价格区间筛选，商品以卡片网格展示，支持分页。'),
    shot('01-home', '图 6-1 首页'),
    p('商品详情页（图 6-2）展示图片、价格与原价、状态与成色标签、交易地点、浏览与收藏数、卖家信息，提供“我想要”和“收藏”按钮；卖家本人看到的是“编辑”“下架”按钮。页面下方是商品描述和留言区，支持回复指定用户。'),
    shot('04-detail', '图 6-2 商品详情页'),
    p('发布页（图 6-3）支持上传最多 6 张图片，表单字段带前端校验，并提示“发布后需审核”。'),
    shot('07-publish', '图 6-3 发布闲置页'),
    p('个人中心的订单页（图 6-4）以卡片形式展示订单号、状态、商品快照、对方联系方式和买家留言，并根据当前角色和订单状态显示“确认订单”“确认收货”“取消订单”等按钮。'),
    shot('15-bought-orders', '图 6-4 我买到的（订单列表）'),
    p('管理后台的数据概览（图 6-5）展示 6 项核心指标，以及近 7 天下单趋势、商品分类分布、商品状态统计三张图表；商品审核页（图 6-6）列出待审核商品，可查看详情抽屉后通过或驳回。'),
    shot('09-admin-dashboard', '图 6-5 管理后台数据概览'),
    shot('10-admin-audit', '图 6-6 商品审核页'),

    // ======================================================== 7 安全设计与其他设计
    h1('7 安全设计与其他设计'),
    h2('7.1 权限设计'),
    p('系统有游客、普通用户、管理员三类角色（买家与卖家都是普通用户，按其在具体商品或订单中的身份区分）。各角色的功能权限见表 7-1。'),
    table({
        caption: '表 7-1 权限矩阵',
        headers: ['功能', '游客', '普通用户', '管理员'],
        widths: [4, 1, 1.4, 1.2],
        center: [1, 2, 3],
        rows: [
            ['浏览、搜索在售商品，查看商品详情与留言', '√', '√', '√'],
            ['注册、登录', '√', '—', '—'],
            ['发布商品；编辑、下架、重新上架本人商品', '×', '√（仅本人）', '√（仅本人）'],
            ['查看待审核 / 驳回 / 下架状态的商品', '×', '仅本人商品', '√'],
            ['收藏商品、发表留言', '×', '√', '√'],
            ['删除留言', '×', '本人留言或本人商品下的留言', '√'],
            ['下单、取消订单', '×', '√（不能买自己的商品）', '√'],
            ['确认订单 / 确认收货', '×', '卖家 / 买家本人', '—'],
            ['修改个人资料、密码', '×', '√', '√'],
            ['审核商品、强制下架', '×', '×', '√'],
            ['封禁 / 解封用户（不能封禁管理员）', '×', '×', '√'],
            ['分类管理、数据统计', '×', '×', '√'],
        ],
    }),
    h2('7.2 安全措施'),
    table({
        caption: '表 7-2 安全措施',
        headers: ['安全风险', '措施'],
        widths: [1.6, 5],
        rows: [
            ['密码泄露', '使用 BCrypt（自带随机盐）存储密码，数据库中不保存明文；所有响应都不返回密码字段'],
            ['身份伪造', 'JWT 使用服务端密钥签名，篡改后校验失败；令牌有过期时间；密钥可通过环境变量配置'],
            ['越权访问', '拦截器统一校验登录与管理员身份；Service 层校验资源归属（如 getOwnedGoods）；封禁立即生效'],
            ['SQL 注入', '全部使用 Spring Data JPA 方法、JPQL 参数绑定和 Criteria API，不拼接 SQL 字符串'],
            ['XSS 跨站脚本', 'Vue 模板插值默认对 HTML 转义，前端没有使用 v-html 渲染用户输入'],
            ['恶意上传', '扩展名白名单 + 文件头魔数校验 + 大小限制 + UUID 重命名'],
            ['非法输入', '前端表单校验 + 后端 Bean Validation 双重校验，后端校验为准'],
            ['隐私泄露', '公开接口只返回昵称；手机号只在订单中对交易双方、在后台对管理员展示'],
            ['并发异常', '下单使用条件更新防止超卖；浏览量原子递增；收藏有唯一约束'],
        ],
    }),
    h2('7.3 性能设计'),
    bullets([
        '所有列表接口都分页，Pages.limit 把每页条数限制在 50 以内，防止一次查询过多数据。',
        '配置 hibernate.default_batch_fetch_size=50，批量加载商品图片等关联数据，减少 N+1 查询。',
        '关闭 spring.jpa.open-in-view，数据库连接只在 Service 事务内占用；VO 在事务内组装完成。',
        '只读查询标注 @Transactional(readOnly = true)，便于数据库与 Hibernate 优化。',
        '前端第三方库本地化并使用压缩版本，商品卡片图片使用 loading="lazy" 懒加载。',
    ]),
    h2('7.4 可维护性与可扩展性设计'),
    bullets([
        '**配置外置**：数据库、JWT 密钥、上传目录、是否写入演示数据均在 application.yml 中配置，并支持环境变量覆盖。',
        '**切换 MySQL**：启动时加参数 --spring.profiles.active=mysql 即可使用 application-mysql.yml，主机、端口、账号通过 MYSQL_HOST、MYSQL_PORT、MYSQL_USER、MYSQL_PASSWORD 环境变量配置，业务代码无需修改。',
        '**状态集中定义**：商品和订单状态以枚举集中定义，状态集合（可编辑、可下架、公开可见）用 EnumSet 常量表示，新增状态时修改点明确。',
        '**统一约定**：统一响应结构、统一异常处理、统一分页结构，新增接口只需编写 Controller 方法和 Service 逻辑。',
        '**扩展方向**：可在订单流程中增加在线支付状态；增加站内消息通知；在 Goods 上增加全文检索；增加学号认证等，均可在现有分层结构上增量实现。',
    ]),
];

L.save(L.buildDocument({ title: '软件设计说明书', docNo: 'CM-SDD-001' }, body), 'docs/03-软件设计说明书.docx');
