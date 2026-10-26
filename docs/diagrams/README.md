# 设计图清单

本目录存放《校园二手交易平台》软件文档与答辩 PPT 使用的全部设计图。每张图都有 PlantUML 源文件（`.puml`）和渲染好的 PNG（150 dpi），内容与 `src/` 中的代码一致。共用样式在 `style.iuml`（白底、深灰线条、橙色 #F97316 强调色、文泉驿正黑中文字体）。

## 重新渲染

需要 Java 17+、Graphviz（`dot`）和 PlantUML jar（[Maven Central 下载](https://repo.maven.apache.org/maven2/net/sourceforge/plantuml/plantuml/)）：

```bash
PLANTUML_JAR=/path/to/plantuml.jar tools/render_diagrams.sh            # 渲染全部
PLANTUML_JAR=/path/to/plantuml.jar tools/render_diagrams.sh er gantt   # 只渲染指定图
```

## 图片一览

| 文件 | 图名 | 说明 | 建议放在 |
|------|------|------|----------|
| `usecase.png` | 系统用例图 | 游客、普通用户、卖家、买家、管理员五类参与者及其用例，按公共 / 个人 / 卖家 / 买家 / 后台管理分包 | 需求规格说明书：功能需求 |
| `modules.png` | 功能模块结构图 | 平台划分为用户、商品、交易、互动、后台管理五大模块及各自的子功能 | 需求规格说明书 / 设计说明书：模块划分 |
| `architecture.png` | 系统架构图 | 浏览器 SPA（Vue3 + Element Plus + Router + Axios + ECharts）通过 REST/JSON 访问 Spring Boot 分层后端（拦截器 → Controller → Service → Repository → H2/MySQL） | 设计说明书：总体架构 |
| `deployment.png` | 部署图 | 单个可执行 jar（内嵌 Tomcat :8080）部署在 JDK 17+ 服务器上，默认使用 H2 文件库，可切换 MySQL 8，图片保存在 uploads 目录 | 设计说明书：运行环境；实施与部署说明书 |
| `class.png` | 实体类图（领域模型） | BaseEntity 及六个实体类的属性、关联与多重性，五个枚举的取值与中文含义 | 设计说明书：类设计 |
| `class-service.png` | 核心业务类图 | 控制层、业务层、数据访问层主要类及方法，以及 AuthInterceptor、JwtTokenProvider、UserContext 等安全组件的依赖关系 | 设计说明书：详细设计 |
| `er.png` | 数据库 E-R 图 | users、category、goods、goods_image、favorite、comment、trade_order 七张表的字段、类型、主外键、唯一约束及 1:N 关系（鸦爪表示法） | 设计说明书：数据库设计 |
| `seq-login.png` | 登录与鉴权时序图 | 登录时校验 BCrypt 密码并签发 JWT；后续请求由拦截器解析令牌、查询用户、检查封禁和管理员权限 | 设计说明书：关键流程 |
| `seq-audit.png` | 商品发布与审核时序图 | 卖家上传图片并发布商品（PENDING）→ 管理员审核通过（ON_SALE）或驳回（REJECTED，带原因）→ 卖家查看结果 | 设计说明书：关键流程 |
| `seq-order.png` | 下单时序图 | 买家下单经拦截器校验后，OrderService 用条件更新 `UPDATE … WHERE status='ON_SALE'` 锁定商品，返回 0 行即 409 防止超卖，成功则保存订单快照 | 设计说明书：关键流程；PPT 技术亮点 |
| `state-goods.png` | 商品状态图 | 待审核、在售、审核未通过、交易中、已售出、已下架六种状态及触发事件（发布、审核、下单、取消、收货、下架、重新上架、编辑） | 设计说明书：状态设计 |
| `state-order.png` | 订单状态图 | 待卖家确认 → 待交易 → 已完成，未完成前买卖双方均可取消，并说明对商品状态的联动 | 设计说明书：状态设计 |
| `activity-trade.png` | 交易流程活动图 | 买家 / 系统 / 卖家三条泳道的完整交易流程，含不可购买、被抢先下单、卖家拒绝、交易失败等分支 | 需求规格说明书：业务流程 |
| `gantt.png` | 项目进度甘特图 | 2026-09-14 起约 6 周：需求 → 设计 → 前后端并行编码 → 测试（与编码后期重叠）→ 文档与答辩准备，含需求评审、设计评审、系统提测、项目验收四个里程碑 | 项目开发计划书：进度安排 |

## 插图提示

- 时序图（`seq-*.png`）宽度约 2300–2700 像素，插入 Word 时建议设为页面全宽，或单独放一页横向排版。
- 甘特图左侧自带“开始 / 结束 / 持续时间”三列，可直接作为进度表使用。
- 用例图、类图、E-R 图接近正方形，Word 中设为约 15 cm 宽即可清晰显示。
