# 校园二手交易平台（Campus Market）

软件工程课程设计项目：一个面向在校学生的二手闲置交易平台。同学可以发布闲置物品、搜索浏览、收藏留言、下单后线下当面交易；管理员负责商品审核、违规处理、用户与分类管理，并查看平台数据统计。

![首页](docs/screenshots/01-home.png)

## 功能概览

| 角色 | 功能 |
|---|---|
| 游客 | 浏览首页、按分类筛选、关键词搜索、价格区间与排序、查看商品详情和留言 |
| 普通用户 | 注册登录；发布商品（多图上传）、编辑、下架、重新上架；收藏；留言与回复；下单、确认订单（卖家）、确认收货（买家）、取消订单；修改资料和密码 |
| 管理员 | 数据概览（统计卡片 + ECharts 图表）、商品审核（通过 / 驳回并填写原因）、强制下架违规商品、封禁 / 解封用户、分类管理 |

核心业务规则：

- 新发布或编辑过的商品必须经管理员审核通过后才会公开展示。
- 下单使用数据库条件更新（`UPDATE … WHERE status = 'ON_SALE'`）锁定商品，同一商品只会被一个买家成功下单，防止“超卖”。
- 订单流程：待卖家确认 → 待交易 → 已完成；完成前买卖双方都可取消，取消后商品自动恢复在售。
- 平台不涉及在线支付，卖家确认后双方可看到对方手机号，线下当面验货交易。

## 技术栈

| 层次 | 技术 |
|---|---|
| 后端 | Java 17、Spring Boot 3.5、Spring Data JPA（Hibernate）、Bean Validation、JWT（jjwt）、BCrypt |
| 数据库 | H2（默认，文件型，零配置）/ MySQL 8（`mysql` profile） |
| 前端 | Vue 3、Vue Router 4、Element Plus、Axios、ECharts（全部本地化在 `static/lib`，断网可用） |
| 测试 | JUnit 5、Mockito、MockMvc、JaCoCo、Playwright（端到端系统测试） |

## 快速开始

环境要求：JDK 17 及以上、Maven 3.8 及以上。

```bash
mvn clean package
java -jar target/campus-market-1.0.0.jar
```

浏览器访问 <http://localhost:8080>。首次启动会自动写入演示数据：

| 账号 | 密码 | 说明 |
|---|---|---|
| admin | admin123 | 管理员 |
| zhangsan / lisi / wangwu / zhaoliu | 123456 | 普通用户 |
| spam2026 | 123456 | 已被封禁的示例账号 |

数据保存在 `./data`（数据库）和 `./uploads`（上传的图片），删除这两个目录后重启即可恢复初始演示数据。

### 切换到 MySQL

```sql
CREATE DATABASE campus_market DEFAULT CHARACTER SET utf8mb4;
```

```bash
MYSQL_USER=root MYSQL_PASSWORD=你的密码 java -jar target/campus-market-1.0.0.jar --spring.profiles.active=mysql
```

还可以通过 `MYSQL_HOST`、`MYSQL_PORT` 指定数据库地址，生产环境请通过 `APP_JWT_SECRET` 设置 JWT 密钥。

## 测试

```bash
mvn test                                   # 单元测试 + 接口集成测试 + 并发测试，生成 JaCoCo 覆盖率报告 target/site/jacoco
python3 tools/collect_test_results.py      # 汇总测试结果到 docs/test-results
node e2e/system-test.js                    # 端到端系统测试（需先用全新数据启动应用，并安装 playwright）
```

## 项目文档

| 文档 | 说明 |
|---|---|
| [01-项目开发计划书](docs/01-项目开发计划书.docx) | 任务分解、进度安排、风险管理 |
| [02-软件需求规格说明书](docs/02-软件需求规格说明书.docx) | 用例模型、功能与非功能需求、数据需求 |
| [03-软件设计说明书](docs/03-软件设计说明书.docx) | 架构、数据库、接口、详细设计 |
| [04-软件实施与部署说明书](docs/04-软件实施与部署说明书.docx) | 编码实现、构建部署、用户操作手册 |
| [05-软件测试报告](docs/05-软件测试报告.docx) | 测试计划、用例、结果、覆盖率、缺陷 |
| [06-答辩演示](docs/06-答辩演示.pptx) | 期末检查答辩 PPT |

UML 与设计图源文件在 `docs/diagrams`（PlantUML），页面截图在 `docs/screenshots`。
文档由 `tools/docgen` 下的脚本生成：先在 `tools/docgen/project-info.json` 中填写姓名、学号等信息，再运行 `bash tools/docgen/build-all.sh` 重新生成。

## 目录结构

```
├── pom.xml
├── src/main/java/com/campus/market
│   ├── common        统一响应、分页、业务异常、全局异常处理
│   ├── config        Web / Jackson 配置、自定义配置项
│   ├── security      JWT、登录拦截器、当前用户上下文
│   ├── entity        JPA 实体与枚举
│   ├── repository    Spring Data 仓库
│   ├── dto           请求 / 响应对象
│   ├── service       业务逻辑
│   ├── controller    REST 接口（admin 子包为管理后台接口）
│   └── init          演示数据初始化
├── src/main/resources
│   ├── application.yml / application-mysql.yml
│   └── static        前端单页应用（index.html、js、css、lib、demo-images）
├── src/test          单元测试、接口集成测试、并发测试
├── e2e               Playwright 端到端系统测试
├── docs              文档、设计图、截图、测试结果
└── tools             文档 / 图片 / 测试结果生成脚本
```
