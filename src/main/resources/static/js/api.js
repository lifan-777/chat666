// 后端接口封装：统一处理 Token、错误提示和登录过期
import { store, clearAuth } from './store.js';

const { ElMessage } = ElementPlus;

const http = axios.create({ baseURL: '/api', timeout: 15000 });

http.interceptors.request.use((config) => {
    if (store.token) {
        config.headers.Authorization = 'Bearer ' + store.token;
    }
    return config;
});

http.interceptors.response.use(
    (response) => response.data.data,
    (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.message || '网络异常，请稍后重试';
        if (status === 401 && !error.config?.url?.startsWith('/auth/login')) {
            const expired = !!store.token;
            clearAuth();
            ElMessage.warning(expired ? '登录已过期，请重新登录' : '请先登录');
            const redirect = encodeURIComponent(location.hash.replace(/^#/, '') || '/');
            location.hash = '#/login?redirect=' + redirect;
        } else {
            ElMessage.error(message);
        }
        return Promise.reject(error);
    },
);

export const uploadUrl = '/api/files/images';

export function authHeaders() {
    return store.token ? { Authorization: 'Bearer ' + store.token } : {};
}

export const api = {
    // 认证与个人信息
    login: (data) => http.post('/auth/login', data),
    register: (data) => http.post('/auth/register', data),
    me: () => http.get('/auth/me'),
    updateProfile: (data) => http.put('/users/me', data),
    changePassword: (data) => http.put('/users/me/password', data),

    // 分类与商品
    categories: () => http.get('/categories'),
    searchGoods: (params) => http.get('/goods', { params }),
    goodsDetail: (id) => http.get(`/goods/${id}`),
    myGoods: (params) => http.get('/goods/mine', { params }),
    publishGoods: (data) => http.post('/goods', data),
    updateGoods: (id, data) => http.put(`/goods/${id}`, data),
    offShelf: (id) => http.post(`/goods/${id}/off-shelf`),
    onShelf: (id) => http.post(`/goods/${id}/on-shelf`),

    // 留言
    comments: (goodsId) => http.get(`/goods/${goodsId}/comments`),
    addComment: (goodsId, data) => http.post(`/goods/${goodsId}/comments`, data),
    deleteComment: (id) => http.delete(`/comments/${id}`),

    // 收藏
    favorites: (params) => http.get('/favorites', { params }),
    addFavorite: (goodsId) => http.post(`/favorites/${goodsId}`),
    removeFavorite: (goodsId) => http.delete(`/favorites/${goodsId}`),

    // 订单
    createOrder: (data) => http.post('/orders', data),
    orders: (params) => http.get('/orders', { params }),
    confirmOrder: (id) => http.post(`/orders/${id}/confirm`),
    completeOrder: (id) => http.post(`/orders/${id}/complete`),
    cancelOrder: (id, reason) => http.post(`/orders/${id}/cancel`, { reason }),

    // 管理后台
    adminStats: () => http.get('/admin/stats'),
    adminGoods: (params) => http.get('/admin/goods', { params }),
    auditGoods: (id, data) => http.post(`/admin/goods/${id}/audit`, data),
    forceOffShelf: (id, reason) => http.post(`/admin/goods/${id}/off-shelf`, { reason }),
    adminUsers: (params) => http.get('/admin/users', { params }),
    updateUserStatus: (id, status) => http.put(`/admin/users/${id}/status`, { status }),
    createCategory: (data) => http.post('/admin/categories', data),
    updateCategory: (id, data) => http.put(`/admin/categories/${id}`, data),
    deleteCategory: (id) => http.delete(`/admin/categories/${id}`),
};
