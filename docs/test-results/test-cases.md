# 自动化测试用例清单

共 103 个测试用例（参数化/重复测试按执行次数计共 108 次执行），通过 108，失败 0，跳过 0，总耗时约 35.9 秒。

代码覆盖率（JaCoCo）：行 84.2%，分支 80.1%，指令 81.0%，方法 93.3%；不含演示数据初始化（init 包，测试环境关闭）时行 97.2%，分支 84.0%。

| 编号 | 测试类 | 用例描述 | 类型 | 结果 |
| --- | --- | --- | --- | --- |
| UT-01 | UserServiceTest | 注册成功：密码加密保存，默认普通用户、状态正常 | 单元测试 | 通过 |
| UT-02 | UserServiceTest | 注册成功时数据库中不保存明文密码 | 单元测试 | 通过 |
| UT-03 | UserServiceTest | 注册失败：用户名已存在返回 409 | 单元测试 | 通过 |
| UT-04 | UserServiceTest | 登录成功：返回可解析的 Token 和用户信息 | 单元测试 | 通过 |
| UT-05 | UserServiceTest | 登录失败：密码错误返回 401 | 单元测试 | 通过 |
| UT-06 | UserServiceTest | 登录失败：用户不存在返回 401（与密码错误提示一致，防止枚举用户名） | 单元测试 | 通过 |
| UT-07 | UserServiceTest | 登录失败：被封禁用户返回 403 | 单元测试 | 通过 |
| UT-08 | UserServiceTest | 修改资料：昵称去除首尾空格，空手机号保存为 null | 单元测试 | 通过 |
| UT-09 | UserServiceTest | 修改密码成功：新密码生效 | 单元测试 | 通过 |
| UT-10 | UserServiceTest | 修改密码失败：原密码错误返回 400 | 单元测试 | 通过 |
| UT-11 | UserServiceTest | 管理员封禁与解封普通用户 | 单元测试 | 通过 |
| UT-12 | UserServiceTest | 不能封禁管理员账号 | 单元测试 | 通过 |
| UT-13 | UserServiceTest | 查询不存在的用户返回 404 | 单元测试 | 通过 |
| UT-14 | GoodsServiceTest | 发布商品后状态为“待审核”，卖家为当前用户 | 单元测试 | 通过 |
| UT-15 | GoodsServiceTest | 编辑被驳回的商品后重新进入待审核，并清空驳回原因 | 单元测试 | 通过 |
| UT-16 | GoodsServiceTest | 交易中或已售出的商品不能编辑 | 单元测试 | 通过（2/2 次） |
| UT-17 | GoodsServiceTest | 非本人不能编辑或下架他人商品（403） | 单元测试 | 通过 |
| UT-18 | GoodsServiceTest | 在售商品可以下架，下架后可重新上架（进入待审核） | 单元测试 | 通过 |
| UT-19 | GoodsServiceTest | 交易中的商品不能下架 | 单元测试 | 通过 |
| UT-20 | GoodsServiceTest | 只有已下架的商品可以重新上架 | 单元测试 | 通过 |
| UT-21 | GoodsServiceTest | 审核通过：待审核 → 在售 | 单元测试 | 通过 |
| UT-22 | GoodsServiceTest | 审核驳回：记录驳回原因，状态变为审核未通过 | 单元测试 | 通过 |
| UT-23 | GoodsServiceTest | 审核驳回时必须填写原因 | 单元测试 | 通过 |
| UT-24 | GoodsServiceTest | 非待审核状态的商品不能重复审核 | 单元测试 | 通过 |
| UT-25 | GoodsServiceTest | 管理员强制下架：记录下架原因 | 单元测试 | 通过 |
| UT-26 | GoodsServiceTest | 管理员不能强制下架交易中的商品 | 单元测试 | 通过 |
| UT-27 | GoodsServiceTest | 商品详情：待审核商品对其他用户和游客不可见（404） | 单元测试 | 通过 |
| UT-28 | GoodsServiceTest | 商品详情：卖家本人和管理员可以查看待审核商品 | 单元测试 | 通过 |
| UT-29 | GoodsServiceTest | 商品详情：他人浏览时浏览量 +1，并返回收藏状态 | 单元测试 | 通过 |
| UT-30 | GoodsServiceTest | 商品详情：卖家浏览自己的商品不增加浏览量 | 单元测试 | 通过 |
| UT-31 | GoodsServiceTest | 查询不存在的商品返回 404 | 单元测试 | 通过 |
| UT-32 | OrderServiceTest | 下单成功：商品被锁定为交易中，订单保存标题、图片、价格快照 | 单元测试 | 通过 |
| UT-33 | OrderServiceTest | 不能购买自己发布的商品 | 单元测试 | 通过 |
| UT-34 | OrderServiceTest | 商品不是在售状态时下单失败（409） | 单元测试 | 通过 |
| UT-35 | OrderServiceTest | 并发下单：条件更新影响 0 行时提示已被他人下单（409），不生成订单 | 单元测试 | 通过 |
| UT-36 | OrderServiceTest | 卖家确认订单：待卖家确认 → 待交易 | 单元测试 | 通过 |
| UT-37 | OrderServiceTest | 只有卖家可以确认订单（买家确认返回 403） | 单元测试 | 通过 |
| UT-38 | OrderServiceTest | 已确认的订单不能重复确认 | 单元测试 | 通过 |
| UT-39 | OrderServiceTest | 买家确认收货：订单完成，商品变为已售出 | 单元测试 | 通过 |
| UT-40 | OrderServiceTest | 只有买家可以确认收货（卖家操作返回 403） | 单元测试 | 通过 |
| UT-41 | OrderServiceTest | 卖家确认前买家不能确认收货 | 单元测试 | 通过 |
| UT-42 | OrderServiceTest | 买家取消订单：记录原因，商品恢复在售 | 单元测试 | 通过 |
| UT-43 | OrderServiceTest | 卖家取消已确认的订单，未填原因时只记录取消方 | 单元测试 | 通过 |
| UT-44 | OrderServiceTest | 已完成的订单不能取消 | 单元测试 | 通过 |
| UT-45 | OrderServiceTest | 与订单无关的用户不能取消或查看订单（403） | 单元测试 | 通过 |
| UT-46 | OrderServiceTest | 管理员和交易双方可以查看订单详情 | 单元测试 | 通过 |
| UT-47 | OrderServiceTest | 订单不存在返回 404 | 单元测试 | 通过 |
| UT-48 | CategoryServiceTest | 分类列表附带每个分类的商品数量，无商品的分类数量为 0 | 单元测试 | 通过 |
| UT-49 | CategoryServiceTest | 新增分类成功，排序值为空时默认为 0 | 单元测试 | 通过 |
| UT-50 | CategoryServiceTest | 新增分类失败：名称重复返回 409 | 单元测试 | 通过 |
| UT-51 | CategoryServiceTest | 修改分类失败：与其他分类重名返回 409 | 单元测试 | 通过 |
| UT-52 | CategoryServiceTest | 删除分类失败：分类下仍有商品返回 409 | 单元测试 | 通过 |
| UT-53 | CategoryServiceTest | 删除没有商品的分类成功 | 单元测试 | 通过 |
| UT-54 | FavoriteServiceTest | 收藏商品成功 | 单元测试 | 通过 |
| UT-55 | FavoriteServiceTest | 重复收藏是幂等操作，不会产生重复记录 | 单元测试 | 通过 |
| UT-56 | FavoriteServiceTest | 不能收藏自己发布的商品 | 单元测试 | 通过 |
| UT-57 | FavoriteServiceTest | 取消收藏：未收藏时调用不报错 | 单元测试 | 通过 |
| UT-58 | CommentServiceTest | 发表留言并回复指定用户 | 单元测试 | 通过 |
| UT-59 | CommentServiceTest | 留言作者可以删除自己的留言 | 单元测试 | 通过 |
| UT-60 | CommentServiceTest | 商品卖家可以删除自己商品下的留言 | 单元测试 | 通过 |
| UT-61 | CommentServiceTest | 管理员可以删除任意留言 | 单元测试 | 通过 |
| UT-62 | CommentServiceTest | 其他用户不能删除留言（403） | 单元测试 | 通过 |
| UT-63 | FileServiceTest | 根据文件头识别 JPEG / PNG / GIF / WEBP 图片 | 单元测试 | 通过 |
| UT-64 | FileServiceTest | 上传合法 PNG：保存到按月份划分的目录，返回 /uploads 开头的地址 | 单元测试 | 通过 |
| UT-65 | FileServiceTest | 拒绝扩展名伪装成 .jpg 的文本文件 | 单元测试 | 通过 |
| UT-66 | FileServiceTest | 拒绝不支持的扩展名（如 .exe） | 单元测试 | 通过 |
| UT-67 | FileServiceTest | 拒绝空文件 | 单元测试 | 通过 |
| UT-68 | FileServiceTest | 拒绝超过 5MB 的图片 | 单元测试 | 通过 |
| UT-69 | StatsServiceTest | 近 7 天下单趋势：按天统计，没有订单的日期补 0 | 单元测试 | 通过 |
| UT-70 | StatsServiceTest | 数据概览：汇总用户、商品、订单数量与成交额，状态分布覆盖全部状态 | 单元测试 | 通过 |
| UT-71 | JwtTokenProviderTest | 签发的令牌可以解析出用户 ID | 单元测试 | 通过 |
| UT-72 | JwtTokenProviderTest | 被篡改的令牌解析失败 | 单元测试 | 通过 |
| UT-73 | JwtTokenProviderTest | 使用其他密钥签发的令牌解析失败 | 单元测试 | 通过 |
| UT-74 | JwtTokenProviderTest | 已过期的令牌解析失败 | 单元测试 | 通过 |
| UT-75 | JwtTokenProviderTest | 格式错误的令牌解析失败而不是抛出异常 | 单元测试 | 通过 |
| IT-01 | AuthApiTest | 注册 → 登录 → 获取当前用户信息 | 接口集成测试 | 通过 |
| IT-02 | AuthApiTest | 重复注册同一用户名返回 409 | 接口集成测试 | 通过 |
| IT-03 | AuthApiTest | 未登录访问受保护接口返回 401 | 接口集成测试 | 通过 |
| IT-04 | AuthApiTest | 伪造的 Token 视为未登录，返回 401 | 接口集成测试 | 通过 |
| IT-05 | AuthApiTest | 公开接口无需登录即可访问 | 接口集成测试 | 通过 |
| IT-06 | AuthApiTest | 注册参数校验失败返回 400 和中文提示 | 接口集成测试 | 通过 |
| IT-07 | AuthApiTest | 请求体不是合法 JSON 时返回 400 | 接口集成测试 | 通过 |
| IT-08 | AuthApiTest | 密码错误登录返回 401 | 接口集成测试 | 通过 |
| IT-09 | AuthApiTest | 账号被封禁后，已签发的 Token 立即失效（403）且无法再登录 | 接口集成测试 | 通过 |
| IT-10 | AuthApiTest | 修改个人资料和密码，修改密码后需使用新密码登录 | 接口集成测试 | 通过 |
| IT-11 | TradeFlowIntegrationTest | 发布 → 审核 → 搜索 → 下单 → 卖家确认 → 买家确认收货，商品售出且成交额增加 | 接口集成测试 | 通过 |
| IT-12 | TradeFlowIntegrationTest | 取消订单后商品恢复在售，可以被其他同学再次购买 | 接口集成测试 | 通过 |
| IT-13 | TradeFlowIntegrationTest | 卖家不能购买自己的商品，也不能收藏自己的商品 | 接口集成测试 | 通过 |
| IT-14 | TradeFlowIntegrationTest | 被驳回的商品修改后重新进入待审核；下架后可重新上架 | 接口集成测试 | 通过 |
| IT-15 | TradeFlowIntegrationTest | 留言删除权限：他人不能删除，作者可以删除；取消收藏 | 接口集成测试 | 通过 |
| IT-16 | TradeFlowIntegrationTest | 商品搜索：按价格区间筛选并按价格升序排序 | 接口集成测试 | 通过 |
| IT-17 | TradeFlowIntegrationTest | 发布商品参数校验：价格为负、缺少图片时返回 400 | 接口集成测试 | 通过 |
| IT-18 | AdminApiTest | 普通用户访问管理接口返回 403 | 接口集成测试 | 通过 |
| IT-19 | AdminApiTest | 未登录访问管理接口返回 401 | 接口集成测试 | 通过 |
| IT-20 | AdminApiTest | 管理员查看数据概览：包含 7 天趋势和全部商品状态 | 接口集成测试 | 通过 |
| IT-21 | AdminApiTest | 管理员按关键词查询用户，并封禁、解封用户 | 接口集成测试 | 通过 |
| IT-22 | AdminApiTest | 分类管理：新增、重名校验、修改、删除 | 接口集成测试 | 通过 |
| IT-23 | AdminApiTest | 分类下有商品时不能删除 | 接口集成测试 | 通过 |
| IT-24 | AdminApiTest | 管理员查询待审核商品并强制下架违规商品 | 接口集成测试 | 通过 |
| IT-25 | FileUploadApiTest | 上传合法 PNG 图片成功，返回的地址可以直接访问 | 接口集成测试 | 通过 |
| IT-26 | FileUploadApiTest | 上传伪装成 .jpg 的文本文件返回 400 | 接口集成测试 | 通过 |
| IT-27 | FileUploadApiTest | 未登录不能上传图片 | 接口集成测试 | 通过 |
| IT-28 | ConcurrentOrderTest | 10 个买家同时抢购同一件商品，只有 1 人下单成功，其余返回 409（重复 5 轮） | 并发测试 | 通过（5/5 次） |
