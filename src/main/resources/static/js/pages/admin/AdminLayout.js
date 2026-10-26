import { api } from '../../api.js';

const { ref, provide, onMounted } = Vue;

export default {
    name: 'AdminLayout',
    setup() {
        const pendingCount = ref(0);

        async function refreshPending() {
            const data = await api.adminGoods({ status: 'PENDING', page: 1, size: 1 });
            pendingCount.value = data.total;
        }

        // 子页面审核完成后调用，刷新菜单上的待审核数量
        provide('refreshPending', refreshPending);
        onMounted(refreshPending);

        return { pendingCount };
    },
    template: `
    <div class="container side-layout">
      <aside class="side-menu">
        <div class="profile">
          <el-icon :size="40" color="var(--el-color-primary)"><Odometer /></el-icon>
          <div class="name">管理后台</div>
        </div>
        <el-menu :default-active="$route.path" router>
          <el-menu-item index="/admin/dashboard"><el-icon><DataAnalysis /></el-icon>数据概览</el-menu-item>
          <el-menu-item index="/admin/audit">
            <el-icon><Checked /></el-icon>商品审核
            <el-badge v-if="pendingCount" :value="pendingCount" style="margin-left: 8px" />
          </el-menu-item>
          <el-menu-item index="/admin/goods"><el-icon><Goods /></el-icon>商品管理</el-menu-item>
          <el-menu-item index="/admin/users"><el-icon><User /></el-icon>用户管理</el-menu-item>
          <el-menu-item index="/admin/categories"><el-icon><Menu /></el-icon>分类管理</el-menu-item>
        </el-menu>
      </aside>
      <section>
        <router-view />
      </section>
    </div>`,
};
