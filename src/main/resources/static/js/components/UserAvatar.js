import { avatarColor, avatarText } from '../utils.js';

export default {
    name: 'UserAvatar',
    props: {
        user: { type: Object, default: null },
        size: { type: Number, default: 36 },
    },
    setup(props) {
        return {
            style: Vue.computed(() => ({ background: avatarColor(props.user?.id), fontSize: props.size * 0.45 + 'px' })),
            text: Vue.computed(() => avatarText(props.user?.nickname)),
        };
    },
    template: `<el-avatar :size="size" :style="style">{{ text }}</el-avatar>`,
};
