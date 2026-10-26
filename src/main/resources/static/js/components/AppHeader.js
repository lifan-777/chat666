import { store, clearAuth, isAdmin } from '../store.js';
import UserAvatar from './UserAvatar.js';

const { ref, watch } = Vue;
const { useRouter, useRoute } = VueRouter;
const { ElMessage } = ElementPlus;

export default {
    name: 'AppHeader',
    components: { UserAvatar },
    setup() {
        const router = useRouter();
        const route = useRoute();
        const keyword = ref(route.query.keyword || '');

        watch(() => route.query.keyword, (value) => {
            keyword.value = value || '';
        });

        function search() {
            const query = keyword.value.trim() ? { keyword: keyword.value.trim() } : {};
            router.push({ path: '/', query });
        }

        function onCommand(command) {
            if (command === 'logout') {
                clearAuth();
                ElMessage.success('已退出登录');
                router.push('/');
            } else {
                router.push(command);
            }
        }

        return { store, keyword, search, onCommand, isAdmin };
    },
    template: `
    <header class="app-header">
      <div class="container inner">
        <router-link to="/" class="logo">
          <img src="/favicon.svg" alt="logo">
          <span>校园闲置</span>
        </router-link>
        <el-input v-model="keyword" class="header-search" placeholder="搜索教材、数码、生活好物…"
                  clearable @keyup.enter="search" @clear="search">
          <template #append>
            <el-button @click="search"><el-icon><Search /></el-icon></el-button>
          </template>
        </el-input>
        <nav class="header-nav">
          <el-button type="primary" @click="$router.push('/publish')">
            <el-icon><Plus /></el-icon>&nbsp;发布闲置
          </el-button>
          <template v-if="store.token && store.user">
            <el-button v-if="isAdmin()" text @click="$router.push('/admin')">
              <el-icon><Odometer /></el-icon>&nbsp;管理后台
            </el-button>
            <el-dropdown @command="onCommand">
              <span class="user-trigger">
                <user-avatar :user="store.user" :size="32" />
                <span>{{ store.user.nickname }}</span>
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="/me/goods">我发布的</el-dropdown-item>
                  <el-dropdown-item command="/me/bought">我买到的</el-dropdown-item>
                  <el-dropdown-item command="/me/sold">我卖出的</el-dropdown-item>
                  <el-dropdown-item command="/me/favorites">我的收藏</el-dropdown-item>
                  <el-dropdown-item command="/me/profile">个人资料</el-dropdown-item>
                  <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <el-button text @click="$router.push('/login')">登录</el-button>
            <el-button @click="$router.push('/register')">注册</el-button>
          </template>
        </nav>
      </div>
    </header>`,
};
