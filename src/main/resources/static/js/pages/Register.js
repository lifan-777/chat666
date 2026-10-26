import { api } from '../api.js';
import { setAuth } from '../store.js';

const { ref, reactive } = Vue;
const { useRouter } = VueRouter;
const { ElMessage } = ElementPlus;

export default {
    name: 'RegisterPage',
    setup() {
        const router = useRouter();
        const formRef = ref(null);
        const loading = ref(false);
        const form = reactive({ username: '', nickname: '', phone: '', password: '', confirm: '' });

        const rules = {
            username: [
                { required: true, message: '请输入用户名', trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9_]{4,20}$/, message: '4-20 位字母、数字或下划线', trigger: 'blur' },
            ],
            nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }, { max: 20, message: '昵称不能超过 20 个字', trigger: 'blur' }],
            phone: [{ pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }],
            password: [
                { required: true, message: '请输入密码', trigger: 'blur' },
                { min: 6, max: 32, message: '密码长度为 6-32 位', trigger: 'blur' },
            ],
            confirm: [{
                validator: (rule, value, callback) => (value === form.password ? callback() : callback(new Error('两次输入的密码不一致'))),
                trigger: 'blur',
            }],
        };

        async function submit() {
            await formRef.value.validate();
            loading.value = true;
            try {
                const { confirm, ...payload } = form;
                await api.register(payload);
                const data = await api.login({ username: form.username, password: form.password });
                setAuth(data.token, data.user);
                ElMessage.success('注册成功，已自动登录');
                router.replace('/');
            } finally {
                loading.value = false;
            }
        }

        return { formRef, form, rules, loading, submit };
    },
    template: `
    <div class="container auth-page">
      <div class="auth-card">
        <h2>注册账号</h2>
        <div class="sub">加入校园闲置，让好物物尽其用</div>
        <el-form ref="formRef" :model="form" :rules="rules" size="large" label-position="top">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="4-20 位字母、数字或下划线" />
          </el-form-item>
          <el-form-item label="昵称" prop="nickname">
            <el-input v-model="form.nickname" placeholder="交易时展示给对方" />
          </el-form-item>
          <el-form-item label="手机号（选填，交易时对方可见）" prop="phone">
            <el-input v-model="form.phone" placeholder="11 位手机号" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" show-password placeholder="6-32 位" />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirm">
            <el-input v-model="form.confirm" type="password" show-password placeholder="再次输入密码" />
          </el-form-item>
          <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">注册</el-button>
        </el-form>
        <div style="margin-top: 16px; text-align: center">
          已有账号？<el-link type="primary" @click="$router.push('/login')">去登录</el-link>
        </div>
      </div>
    </div>`,
};
