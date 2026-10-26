// 全局登录状态，持久化到 localStorage
const { reactive } = Vue;

const TOKEN_KEY = 'cm_token';
const USER_KEY = 'cm_user';

function read(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function write(key, value) {
    try {
        if (value == null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value);
        }
    } catch (e) {
        // 隐私模式等情况下 localStorage 不可用，忽略即可
    }
}

function parseUser() {
    try {
        return JSON.parse(read(USER_KEY) || 'null');
    } catch (e) {
        return null;
    }
}

export const store = reactive({
    token: read(TOKEN_KEY) || '',
    user: parseUser(),
});

export function setAuth(token, user) {
    store.token = token;
    store.user = user;
    write(TOKEN_KEY, token);
    write(USER_KEY, JSON.stringify(user));
}

export function setUser(user) {
    store.user = user;
    write(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
    store.token = '';
    store.user = null;
    write(TOKEN_KEY, null);
    write(USER_KEY, null);
}

export function isLoggedIn() {
    return !!store.token;
}

export function isAdmin() {
    return store.user?.role === 'ADMIN';
}
