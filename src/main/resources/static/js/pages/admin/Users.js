import { api } from '../../api.js';
import { confirmAction, formatTime } from '../../utils.js';

const { ref, reactive, onMounted } = Vue;
const { ElMessage } = ElementPlus;

export default {
    name: 'AdminUsers',
    setup() {
        const keyword = ref('');
        const page = ref(1);
        const loading = ref(false);
        const result = reactive({ records: [], total: 0 });

        async function load() {
            loading.value = true;
            try {
                const data = await api.adminUsers({ keyword: keyword.value || undefined, page: page.value, size: 10 });
                result.records = data.records;
                result.total = data.total;
            } finally {
                loading.value = false;
            }
        }

        function search() {
            page.value = 1;
            load();
        }

        async function toggle(user) {
            const ban = user.status === 'NORMAL';
            const message = ban
                ? `封禁后「${user.nickname}」将无法登录和交易，确定封禁吗？`
                : `确定解封「${user.nickname}」吗？`;
            if (!await confirmAction(message)) return;
            await api.updateUserStatus(user.id, ban ? 'BANNED' : 'NORMAL');
            ElMessage.success(ban ? '已封禁' : '已解封');
            load();
        }

        onMounted(load);
        return { keyword, page, loading, result, load, search, toggle, formatTime };
    },
    template: `
    <div class="panel">
      <h3 class="panel-title">用户管理</h3>
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="用户名 / 昵称" clearable style="width: 240px" @keyup.enter="search" @clear="search" />
        <el-button type="primary" @click="search"><el-icon><Search /></el-icon>&nbsp;查询</el-button>
      </div>
      <el-table :data="result.records" v-loading="loading">
        <el-table-column label="ID" prop="id" width="60" />
        <el-table-column label="用户名" prop="username" min-width="110" />
        <el-table-column label="昵称" prop="nickname" min-width="100" />
        <el-table-column label="手机号" prop="phone" width="130" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }"><el-tag :type="row.role === 'ADMIN' ? 'danger' : 'info'" effect="plain">{{ row.roleText }}</el-tag></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><el-tag :type="row.status === 'NORMAL' ? 'success' : 'danger'">{{ row.statusText }}</el-tag></template>
        </el-table-column>
        <el-table-column label="注册时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <template v-if="row.role !== 'ADMIN'">
              <el-button v-if="row.status === 'NORMAL'" link type="danger" @click="toggle(row)">封禁</el-button>
              <el-button v-else link type="success" @click="toggle(row)">解封</el-button>
            </template>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination background layout="total, prev, pager, next" :total="result.total" :page-size="10"
                       v-model:current-page="page" @current-change="load" />
      </div>
    </div>`,
};
