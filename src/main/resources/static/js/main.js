// 应用入口：路由、全局组件与路由守卫
import { api } from './api.js';
import { store, setUser, isAdmin } from './store.js';
import AppHeader from './components/AppHeader.js';
import Home from './pages/Home.js';
import GoodsDetail from './pages/GoodsDetail.js';
import Publish from './pages/Publish.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import UserCenter from './pages/me/UserCenter.js';
import MyGoods from './pages/me/MyGoods.js';
import Orders from './pages/me/Orders.js';
import Favorites from './pages/me/Favorites.js';
import Profile from './pages/me/Profile.js';
import AdminLayout from './pages/admin/AdminLayout.js';
import Dashboard from './pages/admin/Dashboard.js';
import Audit from './pages/admin/Audit.js';
import GoodsManage from './pages/admin/GoodsManage.js';
import Users from './pages/admin/Users.js';
import Categories from './pages/admin/Categories.js';

const { ElMessage } = ElementPlus;

const routes = [
    { path: '/', component: Home, meta: { title: '首页' } },
    { path: '/goods/:id', component: GoodsDetail, meta: { title: '商品详情' } },
    { path: '/goods/:id/edit', component: Publish, meta: { title: '编辑商品', auth: true } },
    { path: '/publish', component: Publish, meta: { title: '发布闲置', auth: true } },
    { path: '/login', component: Login, meta: { title: '登录' } },
    { path: '/register', component: Register, meta: { title: '注册' } },
    {
        path: '/me',
        component: UserCenter,
        meta: { auth: true },
        redirect: '/me/goods',
        children: [
            { path: 'goods', component: MyGoods, meta: { title: '我发布的', auth: true } },
            { path: 'bought', component: Orders, props: { role: 'buyer' }, meta: { title: '我买到的', auth: true } },
            { path: 'sold', component: Orders, props: { role: 'seller' }, meta: { title: '我卖出的', auth: true } },
            { path: 'favorites', component: Favorites, meta: { title: '我的收藏', auth: true } },
            { path: 'profile', component: Profile, meta: { title: '个人资料', auth: true } },
        ],
    },
    {
        path: '/admin',
        component: AdminLayout,
        meta: { auth: true, admin: true },
        redirect: '/admin/dashboard',
        children: [
            { path: 'dashboard', component: Dashboard, meta: { title: '数据概览', auth: true, admin: true } },
            { path: 'audit', component: Audit, meta: { title: '商品审核', auth: true, admin: true } },
            { path: 'goods', component: GoodsManage, meta: { title: '商品管理', auth: true, admin: true } },
            { path: 'users', component: Users, meta: { title: '用户管理', auth: true, admin: true } },
            { path: 'categories', component: Categories, meta: { title: '分类管理', auth: true, admin: true } },
        ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
    if (to.meta.auth && !store.token) {
        ElMessage.warning('请先登录');
        return { path: '/login', query: { redirect: to.fullPath } };
    }
    if (to.meta.admin && !isAdmin()) {
        ElMessage.error('需要管理员权限');
        return '/';
    }
    return true;
});

router.afterEach((to) => {
    document.title = (to.meta.title ? to.meta.title + ' - ' : '') + '校园二手交易平台';
});

const App = {
    components: { AppHeader },
    template: `
    <app-header />
    <main class="app-main"><router-view /></main>
    <footer class="app-footer">校园二手交易平台 · 软件工程课程设计 · 同校面交，安全放心</footer>`,
};

const app = Vue.createApp(App);
app.use(router);
app.use(ElementPlus, { locale: ElementPlusLocaleZhCn });
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(name, component);
}
// 接口错误已在 api.js 中统一提示，这里只记录非接口类异常
app.config.errorHandler = (err) => {
    if (!err?.isAxiosError) {
        console.error(err);
    }
};

// 有 Token 时刷新一次用户信息（例如角色、昵称在其他地方被修改过）
if (store.token) {
    api.me().then(setUser).catch(() => {});
}

app.mount('#app');
