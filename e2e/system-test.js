/**
 * 系统测试（端到端）：用真实浏览器按用户操作走完整业务流程，并截图供文档使用。
 *
 * 运行前提：应用已用全新数据库启动（删除 ./data 目录后 java -jar 启动，会自动写入演示数据）。
 * 运行方式：node e2e/system-test.js  [BASE_URL，默认 http://localhost:8080]
 * 输出：e2e/output/results.json（用例结果），docs/screenshots/*.png（页面截图）
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const ROOT = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(ROOT, 'docs/screenshots');
const OUT_DIR = path.join(__dirname, 'output');
const IMAGE = path.join(ROOT, 'src/main/resources/static/demo-images/storage.jpg');
const STAMP = Date.now().toString().slice(-5);
const NEW_USER = { username: 'stu' + STAMP, nickname: '新同学' + STAMP.slice(-2), password: 'abc12345', phone: '13900001111' };
const NEW_GOODS = '宿舍小冰箱 50L 九成新 ' + STAMP;
const REJECT_GOODS = '测试驳回商品 ' + STAMP;

const results = [];
let page;

async function shot(name) {
    // 关闭消息提示，避免遮挡截图
    await page.evaluate(() => ElementPlus.ElMessage.closeAll());
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') });
}

async function step(id, name, expected, fn) {
    const started = Date.now();
    try {
        await fn();
        results.push({ id, name, expected, result: '通过', ms: Date.now() - started });
        console.log(`✔ ${id} ${name}`);
    } catch (e) {
        results.push({ id, name, expected, result: '失败', error: e.message.split('\n')[0], ms: Date.now() - started });
        console.log(`✘ ${id} ${name}\n   ${e.message.split('\n')[0]}`);
        await page.screenshot({ path: path.join(OUT_DIR, `fail-${id}.png`) }).catch(() => {});
    }
}

function assert(condition, message) {
    if (!condition) throw new Error('断言失败：' + message);
}

/** 跳转页面；apiPart 不为空时等待该接口返回（单页应用切换路由不会重新触发 load 事件） */
async function go(hashPath, apiPart) {
    const navigation = page.goto(`${BASE}/#${hashPath}`);
    if (apiPart) {
        await Promise.all([page.waitForResponse((r) => r.url().includes(apiPart)), navigation]);
    } else {
        await navigation;
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(250);
}

/** 执行操作并等待对应接口返回后再断言，避免读到旧数据 */
async function withApi(apiPart, action) {
    await Promise.all([page.waitForResponse((r) => r.url().includes(apiPart)), action()]);
    await page.waitForTimeout(250);
}

async function logout() {
    await page.evaluate(() => localStorage.clear());
    await go('/');
    await page.reload();
    await page.waitForLoadState('networkidle');
}

async function login(username, password) {
    await logout();
    await go('/login');
    await page.fill('.auth-card input[placeholder="用户名"]', username);
    await page.fill('.auth-card input[placeholder="密码"]', password);
    await page.click('.auth-card .el-button--primary');
    await page.waitForFunction(() => !location.hash.startsWith('#/login'), null, { timeout: 5000 });
    await page.waitForLoadState('networkidle');
}

async function confirmBox() {
    await page.click('.el-message-box__btns .el-button--primary');
    await page.waitForLoadState('networkidle');
}

async function lastMessage() {
    const msg = page.locator('.el-message').last();
    await msg.waitFor({ timeout: 5000 });
    return msg.innerText();
}

async function goodsIdByTitle(title) {
    return page.evaluate(async (t) => {
        const token = localStorage.getItem('cm_token');
        const res = await fetch('/api/admin/goods?keyword=' + encodeURIComponent(t), { headers: { Authorization: 'Bearer ' + token } });
        return (await res.json()).data.records[0]?.id;
    }, title);
}

async function fillGoodsForm(title, category) {
    await page.setInputFiles('.el-upload input[type=file]', IMAGE);
    await page.waitForSelector('.el-upload-list__item.is-success', { timeout: 8000 });
    await page.locator('.el-form-item', { hasText: '标题' }).locator('input').fill(title);
    await page.locator('.el-form-item', { hasText: '分类' }).locator('.el-select').click();
    await page.click(`.el-select-dropdown__item:has-text("${category}")`);
    await page.locator('.el-form-item', { hasText: '价格' }).locator('input').nth(0).fill('199');
    await page.locator('.el-form-item', { hasText: '价格' }).locator('input').nth(1).fill('599');
    await page.locator('.el-form-item', { hasText: '交易地点' }).locator('input').fill('南区 5 号楼');
    await page.locator('.el-form-item', { hasText: '商品描述' }).locator('textarea')
        .fill('毕业清仓，制冷正常，噪音小，适合宿舍放饮料水果。可以上门自提。');
}

(async () => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    await step('ST-01', '游客浏览首页', '展示在售商品卡片、分类栏和统计信息', async () => {
        await go('/', '/api/goods?');
        const cards = await page.locator('.goods-card').count();
        assert(cards > 0, '首页应显示商品');
        await shot('01-home');
    });

    await step('ST-02', '按分类筛选商品', '只显示所选分类的商品', async () => {
        await withApi('/api/goods?', () => page.click('.category-chip:has-text("书籍教材")'));
        assert(page.url().includes('categoryId='), 'URL 应包含分类参数');
        const titles = await page.locator('.goods-card .title').allInnerTexts();
        assert(titles.length > 0 && titles.every((t) => /数学|英语|算法|教材|书/.test(t)), '结果应全部为书籍：' + titles);
        await shot('02-category');
    });

    await step('ST-03', '关键词搜索', '结果标题或描述包含关键词，并显示结果数量', async () => {
        await page.fill('.header-search input', '耳机');
        await withApi('/api/goods?', () => page.press('.header-search input', 'Enter'));
        const titles = await page.locator('.goods-card .title').allInnerTexts();
        assert(titles.length > 0 && titles.every((t) => t.includes('耳机')), '搜索结果应包含“耳机”：' + titles);
        assert((await page.locator('.el-alert').innerText()).includes('搜索结果'), '应显示搜索提示');
        await shot('03-search');
    });

    await step('ST-04', '按价格从低到高排序', '商品价格依次递增', async () => {
        await go('/', '/api/goods?');
        await withApi('/api/goods?', () => page.click('.filter-bar label:has-text("价格从低到高")'));
        const prices = (await page.locator('.goods-card .price').allInnerTexts()).map((t) => Number(t.replace(/[^\d.]/g, '')));
        assert(prices.length > 1 && prices.every((p, i) => i === 0 || prices[i - 1] <= p), '价格应递增：' + prices);
    });

    await step('ST-05', '查看商品详情', '显示图片、价格、成色、卖家、描述和留言', async () => {
        await go('/goods/1');
        await page.waitForSelector('.detail-info h1');
        assert((await page.locator('.detail-info h1').innerText()).includes('iPad'), '标题应正确');
        assert(await page.locator('.comment-item').count() >= 1, '应显示留言');
        await shot('04-detail');
    });

    await step('ST-06', '游客点击“我想要”需先登录', '跳转到登录页并携带回跳地址', async () => {
        await page.click('.detail-actions .el-button--primary');
        await page.waitForFunction(() => location.hash.startsWith('#/login'));
        assert(page.url().includes('redirect='), '应携带 redirect 参数');
    });

    await step('ST-07', '登录失败提示', '输入错误密码时提示“用户名或密码错误”', async () => {
        await go('/login');
        await page.fill('.auth-card input[placeholder="用户名"]', 'zhangsan');
        await page.fill('.auth-card input[placeholder="密码"]', 'wrong-password');
        await page.click('.auth-card .el-button--primary');
        assert((await lastMessage()).includes('用户名或密码错误'), '应提示密码错误');
        await shot('05-login');
    });

    await step('ST-08', '注册新用户并自动登录', '注册成功后自动登录，导航栏显示昵称', async () => {
        await logout();
        await go('/register');
        const form = page.locator('.auth-card');
        await form.locator('.el-form-item', { hasText: '用户名' }).locator('input').fill(NEW_USER.username);
        await form.locator('.el-form-item', { hasText: '昵称' }).locator('input').fill(NEW_USER.nickname);
        await form.locator('.el-form-item', { hasText: '手机号' }).locator('input').fill(NEW_USER.phone);
        await form.locator('.el-form-item').filter({ hasText: /^密码/ }).locator('input').fill(NEW_USER.password);
        await form.locator('.el-form-item', { hasText: '确认密码' }).locator('input').fill(NEW_USER.password);
        await shot('06-register');
        await page.click('.auth-card .el-button--primary');
        await page.waitForFunction(() => location.hash === '#/');
        await page.waitForSelector('.user-trigger');
        assert((await page.locator('.user-trigger').innerText()).includes(NEW_USER.nickname), '导航栏应显示新昵称');
    });

    await step('ST-09', '发布商品（含图片上传）', '发布成功进入“我发布的”，状态为待审核', async () => {
        await go('/publish');
        await fillGoodsForm(NEW_GOODS, '生活用品');
        await shot('07-publish');
        await page.click('.form-page .el-button--primary.el-button--large');
        await page.waitForFunction(() => location.hash === '#/me/goods');
        await page.waitForSelector(`.el-table__row:has-text("${NEW_GOODS}")`);
        const row = await page.locator(`.el-table__row:has-text("${NEW_GOODS}")`).innerText();
        assert(row.includes('待审核'), '新商品应为待审核');
        await shot('08-my-goods');
    });

    await step('ST-10', '表单校验', '必填项为空时阻止提交并提示', async () => {
        await go('/publish');
        await page.click('.form-page .el-button--primary.el-button--large');
        await page.waitForSelector('.el-form-item__error');
        const errors = await page.locator('.el-form-item__error').allInnerTexts();
        assert(errors.some((e) => e.includes('请输入标题')), '应提示标题必填：' + errors);
    });

    await step('ST-11', '审核前商品不在首页展示', '搜索新商品标题无结果', async () => {
        await go('/?keyword=' + encodeURIComponent(NEW_GOODS), '/api/goods?');
        assert(await page.locator('.goods-card').count() === 0, '待审核商品不应出现在首页');
    });

    await step('ST-12', '管理员查看数据概览', '显示统计卡片和图表', async () => {
        await login('admin', 'admin123');
        await go('/admin/dashboard');
        await page.waitForSelector('.stat-card');
        await page.waitForTimeout(1200);
        assert(await page.locator('.stat-card').count() === 6, '应有 6 个统计卡片');
        assert(await page.locator('.chart canvas').count() === 3, '应渲染 3 个图表');
        await shot('09-admin-dashboard');
    });

    await step('ST-13', '管理员审核通过商品', '商品状态变为在售，待审核数量减少', async () => {
        await go('/admin/audit');
        await page.waitForSelector(`.el-table__row:has-text("${NEW_GOODS}")`);
        await shot('10-admin-audit');
        await page.locator(`.el-table__row:has-text("${NEW_GOODS}")`).locator('button:has-text("详情")').click();
        await page.waitForSelector('.el-drawer .el-descriptions');
        await shot('11-admin-audit-drawer');
        await page.click('.el-drawer button:has-text("审核通过")');
        assert((await lastMessage()).includes('已审核通过'), '应提示审核通过');
        await page.waitForTimeout(500);
        assert(await page.locator(`.el-table__row:has-text("${NEW_GOODS}")`).count() === 0, '审核后应从列表移除');
    });

    await step('ST-14', '管理员驳回商品并填写原因', '卖家在“我发布的”中看到驳回原因', async () => {
        await login(NEW_USER.username, NEW_USER.password);
        await go('/publish');
        await fillGoodsForm(REJECT_GOODS, '其他');
        await page.click('.form-page .el-button--primary.el-button--large');
        await page.waitForFunction(() => location.hash === '#/me/goods');
        await login('admin', 'admin123');
        await go('/admin/audit');
        await page.locator(`.el-table__row:has-text("${REJECT_GOODS}")`).locator('button:has-text("驳回")').click();
        await page.fill('.el-message-box__input input', '商品描述与图片不符，请补充实物照片');
        await confirmBox();
        await login(NEW_USER.username, NEW_USER.password);
        await go('/me/goods');
        const row = await page.locator(`.el-table__row:has-text("${REJECT_GOODS}")`).innerText();
        assert(row.includes('审核未通过') && row.includes('实物照片'), '应显示驳回状态和原因');
    });

    await step('ST-15', '审核通过后首页可搜索到商品', '搜索结果包含新商品', async () => {
        await go('/?keyword=' + encodeURIComponent(NEW_GOODS), '/api/goods?');
        await page.waitForSelector('.goods-card');
        assert((await page.locator('.goods-card .title').first().innerText()).includes('小冰箱'), '应能搜索到');
    });

    let newGoodsId;
    await step('ST-16', '买家收藏商品', '收藏后按钮变为“已收藏”，“我的收藏”中可见', async () => {
        await login('admin', 'admin123');
        newGoodsId = await goodsIdByTitle(NEW_GOODS);
        await login('lisi', '123456');
        await go('/goods/' + newGoodsId);
        await page.click('.detail-actions button:has-text("收藏")');
        await page.waitForSelector('.detail-actions button:has-text("已收藏")');
        await go('/me/favorites');
        await page.waitForSelector('.goods-card');
        assert((await page.locator('.goods-card .title').allInnerTexts()).some((t) => t.includes('小冰箱')), '收藏列表应包含商品');
        await shot('12-favorites');
    });

    await step('ST-17', '买家留言，卖家回复', '留言列表显示新留言及“回复 @”', async () => {
        await go('/goods/' + newGoodsId);
        await page.fill('#comment-input', '请问冰箱耗电大吗？周末可以看货吗？');
        await page.click('.comment-editor button:has-text("发表留言")');
        await page.waitForSelector('.comment-item:has-text("耗电")');
        await login(NEW_USER.username, NEW_USER.password);
        await go('/goods/' + newGoodsId);
        await page.locator('.comment-item:has-text("耗电")').locator('button:has-text("回复")').click();
        await page.fill('#comment-input', '一级能效，一天不到一度电，周末都在宿舍。');
        await page.click('.comment-editor button:has-text("发表留言")');
        await page.waitForSelector('.comment-item:has-text("回复 @李四")');
    });

    await step('ST-18', '买家下单', '订单状态为待卖家确认，商品变为交易中', async () => {
        await login('lisi', '123456');
        await go('/goods/' + newGoodsId);
        await page.click('.detail-actions button:has-text("我想要")');
        await page.fill('.el-dialog textarea', '周六上午 10 点南区 5 号楼楼下可以吗？');
        await shot('13-buy-dialog');
        await page.click('.el-dialog button:has-text("确认下单")');
        await page.waitForSelector('.el-message-box');
        await confirmBox();
        await page.waitForFunction(() => location.hash === '#/me/bought');
        await page.waitForSelector('.order-card');
        const card = await page.locator('.order-card').first().innerText();
        assert(card.includes('小冰箱') && card.includes('待卖家确认'), '新订单应为待卖家确认');
        await go('/goods/' + newGoodsId);
        assert((await page.locator('.detail-info .el-tag').first().innerText()).includes('交易中'), '商品应为交易中');
    });

    await step('ST-19', '其他买家不能重复购买交易中的商品', '“我想要”按钮不可用', async () => {
        await login('wangwu', '123456');
        await go('/goods/' + newGoodsId);
        assert(await page.locator('.detail-actions .el-button--primary').isDisabled(), '按钮应禁用');
    });

    await step('ST-20', '卖家确认订单', '订单状态变为待交易，显示买家联系方式', async () => {
        await login(NEW_USER.username, NEW_USER.password);
        await go('/me/sold');
        await page.waitForSelector('.order-card');
        await page.locator('.order-card').first().locator('button:has-text("确认订单")').click();
        await confirmBox();
        await page.waitForSelector('.order-card:has-text("待交易")');
        assert((await page.locator('.order-card').first().innerText()).includes('13800000002'), '应显示买家手机号');
        await shot('14-sold-orders');
    });

    await step('ST-21', '买家确认收货完成交易', '订单已完成，商品变为已售出', async () => {
        await login('lisi', '123456');
        await go('/me/bought');
        await page.locator('.order-card:has-text("小冰箱")').locator('button:has-text("确认收货")').click();
        await confirmBox();
        await page.waitForSelector('.order-card:has-text("已完成")');
        await shot('15-bought-orders');
        await go('/goods/' + newGoodsId);
        assert((await page.locator('.detail-info .el-tag').first().innerText()).includes('已售出'), '商品应为已售出');
    });

    await step('ST-22', '取消订单后商品恢复在售', '订单已取消，商品重新可购买', async () => {
        await go('/goods/3');
        await page.click('.detail-actions button:has-text("我想要")');
        await page.click('.el-dialog button:has-text("确认下单")');
        await page.waitForSelector('.el-message-box');
        await confirmBox();
        await page.waitForSelector('.order-card');
        await page.locator('.order-card').first().locator('button:has-text("取消订单")').click();
        await page.fill('.el-message-box__input input', '临时有事');
        await confirmBox();
        await page.waitForSelector('.order-card:has-text("已取消")');
        await go('/goods/3', '/api/goods/3');
        assert((await page.locator('.detail-info .el-tag').first().innerText()).includes('在售'), '商品应恢复在售');
    });

    await step('ST-23', '普通用户无法进入管理后台', '提示需要管理员权限并返回首页', async () => {
        await go('/admin/dashboard');
        await page.waitForFunction(() => location.hash === '#/');
        assert((await lastMessage()).includes('管理员权限'), '应提示需要管理员权限');
    });

    await step('ST-24', '管理员封禁用户后该用户无法登录', '封禁用户登录提示“账号已被封禁”，解封后恢复', async () => {
        await login('admin', 'admin123');
        await go('/admin/users');
        await page.locator('.el-table__row:has-text("zhaoliu")').locator('button:has-text("封禁")').click();
        await confirmBox();
        await page.waitForSelector('.el-table__row:has-text("zhaoliu"):has-text("已封禁")');
        await shot('16-admin-users');
        await logout();
        await go('/login');
        await page.fill('.auth-card input[placeholder="用户名"]', 'zhaoliu');
        await page.fill('.auth-card input[placeholder="密码"]', '123456');
        await page.click('.auth-card .el-button--primary');
        assert((await lastMessage()).includes('已被封禁'), '应提示账号已被封禁');
        await login('admin', 'admin123');
        await go('/admin/users');
        await page.locator('.el-table__row:has-text("zhaoliu")').locator('button:has-text("解封")').click();
        await confirmBox();
        await page.waitForSelector('.el-table__row:has-text("zhaoliu"):has-text("正常")');
    });

    await step('ST-25', '管理员强制下架违规商品', '商品状态变为已下架并记录原因', async () => {
        await go('/admin/goods');
        await page.waitForSelector('.el-table__row');
        await shot('17-admin-goods');
        await page.locator('.el-table__row:has-text("收纳箱")').locator('button:has-text("强制下架")').click();
        await page.fill('.el-message-box__input input', '疑似重复发布');
        await confirmBox();
        await page.waitForSelector('.el-table__row:has-text("收纳箱"):has-text("已下架")');
    });

    await step('ST-26', '分类管理：新增与删除分类', '新分类出现在列表中，空分类可删除', async () => {
        await go('/admin/categories');
        await page.click('button:has-text("新增分类")');
        await page.locator('.el-dialog .el-form-item', { hasText: '名称' }).locator('input').fill('乐器');
        await page.click('.el-dialog button:has-text("保存")');
        await page.waitForSelector('.el-table__row:has-text("乐器")');
        await shot('18-admin-categories');
        await page.locator('.el-table__row:has-text("乐器")').locator('button:has-text("删除")').click();
        await confirmBox();
        await page.waitForSelector('.el-table__row:has-text("乐器")', { state: 'detached' });
    });

    await step('ST-27', '修改个人资料', '保存后导航栏昵称同步更新', async () => {
        await login(NEW_USER.username, NEW_USER.password);
        await go('/me/profile');
        await page.locator('.el-form-item', { hasText: '昵称' }).locator('input').fill('小冰箱卖家');
        await page.click('button:has-text("保存资料")');
        await page.waitForSelector('.user-trigger:has-text("小冰箱卖家")');
        await shot('19-profile');
    });

    // 补充截图：卖家视角的商品详情、编辑页面
    await go('/goods/1');
    await login('zhangsan', '123456');
    await go('/goods/1/edit');
    await page.waitForSelector('.el-upload-list__item');
    await shot('20-edit-goods');

    await browser.close();

    const passed = results.filter((r) => r.result === '通过').length;
    const summary = { baseUrl: BASE, runAt: new Date().toISOString(), total: results.length, passed,
        failed: results.length - passed, pageErrors: consoleErrors, cases: results };
    fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(summary, null, 2));
    console.log(`\n系统测试完成：共 ${results.length} 个用例，通过 ${passed} 个，失败 ${results.length - passed} 个`);
    if (consoleErrors.length) console.log('页面脚本错误：', consoleErrors);
    process.exit(passed === results.length ? 0 : 1);
})();
