// 格式化与常量
export const CONDITIONS = [
    { value: 'NEW', label: '全新' },
    { value: 'LIKE_NEW', label: '几乎全新' },
    { value: 'LIGHTLY_USED', label: '轻微使用痕迹' },
    { value: 'USED', label: '明显使用痕迹' },
];

export const GOODS_STATUS = [
    { value: 'PENDING', label: '待审核', type: 'warning' },
    { value: 'ON_SALE', label: '在售', type: 'success' },
    { value: 'RESERVED', label: '交易中', type: 'primary' },
    { value: 'SOLD', label: '已售出', type: 'info' },
    { value: 'REJECTED', label: '审核未通过', type: 'danger' },
    { value: 'OFF_SHELF', label: '已下架', type: 'info' },
];

export const ORDER_STATUS = [
    { value: 'PENDING', label: '待卖家确认', type: 'warning' },
    { value: 'CONFIRMED', label: '待交易', type: 'primary' },
    { value: 'COMPLETED', label: '已完成', type: 'success' },
    { value: 'CANCELLED', label: '已取消', type: 'info' },
];

export function goodsStatusType(status) {
    return GOODS_STATUS.find((s) => s.value === status)?.type || 'info';
}

export function orderStatusType(status) {
    return ORDER_STATUS.find((s) => s.value === status)?.type || 'info';
}

/** 价格：整数不显示小数位 */
export function formatPrice(value) {
    if (value == null || value === '') {
        return '';
    }
    const n = Number(value);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function parseTime(text) {
    return text ? new Date(String(text).replace(' ', 'T')) : null;
}

/** 相对时间，例如“3 分钟前”“2 天前” */
export function timeAgo(text) {
    const date = parseTime(text);
    if (!date || isNaN(date)) {
        return '';
    }
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' 分钟前';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' 小时前';
    if (seconds < 86400 * 30) return Math.floor(seconds / 86400) + ' 天前';
    return String(text).slice(0, 10);
}

export function formatTime(text) {
    return text ? String(text).slice(0, 16) : '';
}

const AVATAR_COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B'];

export function avatarColor(id) {
    return AVATAR_COLORS[Number(id || 0) % AVATAR_COLORS.length];
}

export function avatarText(nickname) {
    return (nickname || '?').slice(0, 1);
}

/** 确认对话框：点“确定”返回 true，取消或关闭返回 false */
export async function confirmAction(message, title = '提示') {
    try {
        await ElementPlus.ElMessageBox.confirm(message, title, {
            type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消',
        });
        return true;
    } catch (e) {
        return false;
    }
}

/** 输入对话框：返回输入的文本，取消时返回 null */
export async function promptText(message, title, options = {}) {
    try {
        const { value } = await ElementPlus.ElMessageBox.prompt(message, title, {
            confirmButtonText: '确定', cancelButtonText: '取消', ...options,
        });
        return value ?? '';
    } catch (e) {
        return null;
    }
}
