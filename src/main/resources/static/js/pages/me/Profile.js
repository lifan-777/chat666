import { api } from '../../api.js';
import { store, setUser, clearAuth } from '../../store.js';
import { formatTime } from '../../utils.js';

const { ref, reactive } = Vue;
const { useRouter } = VueRouter;
const { ElMessage } = ElementPlus;

export default {
    name: 'ProfilePage',
    setup() {
        const router = useRouter();
        const profileRef = ref(null);
        const passwordRef = ref(null);
        const profile = reactive({ nickname: store.user?.nickname || '', phone: store.user?.phone || '' });
        const password = reactive({ oldPassword: '', newPassword: '', confirm: '' });

        const profileRules = {
            nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }, { max: 20, message: '昵称不能超过 20 个字', trigger: 'blur' }],
            phone: [{ pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }],
        };
        const passwordRules = {
            oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
            newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }, { min: 6, max: 32, message: '密码长度为 6-32 位', trigger: 'blur' }],
            confirm: [{
                validator: (rule, value, callback) => (value === password.newPassword ? callback() : callback(new Error('两次输入的密码不一致'))),
                trigger: 'blur',
            }],
        };

        async function saveProfile() {
            await profileRef.value.validate();
            setUser(await api.updateProfile(profile));
            ElMessage.success('资料已更新');
        }

        async function savePassword() {
            await passwordRef.value.validate();
            await api.changePassword({ oldPassword: password.oldPassword, newPassword: password.newPassword });
            ElMessage.success('密码已修改，请重新登录');
            clearAuth();
            router.push('/login');
        }

        return { store, profileRef, passwordRef, profile, password, profileRules, passwordRules, saveProfile, savePassword, formatTime };
    },
    template: `
    <div>
      <div class="panel">
        <h3 class="panel-title">基本资料</h3>
        <el-form ref="profileRef" :model="profile" :rules="profileRules" label-width="90px" style="max-width: 460px">
          <el-form-item label="用户名"><el-input :model-value="store.user?.username" disabled /></el-form-item>
          <el-form-item label="角色"><el-tag>{{ store.user?.roleText }}</el-tag></el-form-item>
          <el-form-item label="注册时间">{{ formatTime(store.user?.createdAt) }}</el-form-item>
          <el-form-item label="昵称" prop="nickname"><el-input v-model="profile.nickname" /></el-form-item>
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="profile.phone" placeholder="交易时对方可见" />
          </el-form-item>
          <el-form-item><el-button type="primary" @click="saveProfile">保存资料</el-button></el-form-item>
        </el-form>
      </div>
      <div class="panel">
        <h3 class="panel-title">修改密码</h3>
        <el-form ref="passwordRef" :model="password" :rules="passwordRules" label-width="90px" style="max-width: 460px">
          <el-form-item label="原密码" prop="oldPassword"><el-input v-model="password.oldPassword" type="password" show-password /></el-form-item>
          <el-form-item label="新密码" prop="newPassword"><el-input v-model="password.newPassword" type="password" show-password /></el-form-item>
          <el-form-item label="确认新密码" prop="confirm"><el-input v-model="password.confirm" type="password" show-password /></el-form-item>
          <el-form-item><el-button type="primary" @click="savePassword">修改密码</el-button></el-form-item>
        </el-form>
      </div>
    </div>`,
};
