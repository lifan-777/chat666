import { api } from '../api.js';
import { setAuth } from '../store.js';

const { ref, reactive } = Vue;
const { useRoute, useRouter } = VueRouter;
const { ElMessage } = ElementPlus;

export default {
    name: 'LoginPage',
    setup() {
        const route = useRoute();
        const router = useRouter();
        const formRef = ref(null);
        const loading = ref(false);
        const form = reactive({ username: '', password: '' });
        const rules = {
            username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
            password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
        };

        async function submit() {
            await formRef.value.validate();
            loading.value = true;
            try {
                const data = await api.login(form);
                setAuth(data.token, data.user);
                ElMessage.success('欢迎回来，' + data.user.nickname);
                router.replace(route.query.redirect || (data.user.role === 'ADMIN' ? '/admin' : '/'));
            } finally {
                loading.value = false;
            }
        }

        function fill(username, password) {
            form.username = username;
            form.password = password;
        }

        return { formRef, form, rules, loading, submit, fill };
    },
    template: `
    <div class="container auth-page">
      <div class="auth-card">
        <h2>登录校园闲置</h2>
        <div class="sub">同校面交 · 安全放心</div>
        <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="submit">
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="用户名" :prefix-icon="'User'" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="密码" show-password :prefix-icon="'Lock'" />
          </el-form-item>
          <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">登录</el-button>
        </el-form>
        <div style="margin-top: 16px; text-align: center">
          还没有账号？<el-link type="primary" @click="$router.push('/register')">立即注册</el-link>
        </div>
        <el-divider>演示账号</el-divider>
        <div class="demo-accounts">
          <el-link @click="fill('zhangsan', '123456')">张三 zhangsan / 123456</el-link><br>
          <el-link @click="fill('lisi', '123456')">李四 lisi / 123456</el-link><br>
          <el-link @click="fill('admin', 'admin123')">管理员 admin / admin123</el-link>
        </div>
      </div>
    </div>`,
};
