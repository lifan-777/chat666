import { store } from '../../store.js';
import UserAvatar from '../../components/UserAvatar.js';

export default {
    name: 'UserCenterLayout',
    components: { UserAvatar },
    setup() {
        return { store };
    },
    template: `
    <div class="container side-layout">
      <aside class="side-menu">
        <div class="profile" v-if="store.user">
          <user-avatar :user="store.user" :size="64" />
          <div class="name">{{ store.user.nickname }}</div>
          <div class="muted" style="font-size: 12px">@{{ store.user.username }}</div>
        </div>
        <el-menu :default-active="$route.path" router>
          <el-menu-item index="/me/goods"><el-icon><Goods /></el-icon>我发布的</el-menu-item>
          <el-menu-item index="/me/bought"><el-icon><ShoppingBag /></el-icon>我买到的</el-menu-item>
          <el-menu-item index="/me/sold"><el-icon><Sell /></el-icon>我卖出的</el-menu-item>
          <el-menu-item index="/me/favorites"><el-icon><Star /></el-icon>我的收藏</el-menu-item>
          <el-menu-item index="/me/profile"><el-icon><Setting /></el-icon>个人资料</el-menu-item>
        </el-menu>
      </aside>
      <section>
        <router-view />
      </section>
    </div>`,
};
