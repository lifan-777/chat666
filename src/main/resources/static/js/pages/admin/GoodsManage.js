import { api } from '../../api.js';
import { GOODS_STATUS, formatPrice, formatTime, goodsStatusType, promptText } from '../../utils.js';

const { ref, reactive, inject, onMounted } = Vue;
const { ElMessage } = ElementPlus;

export default {
    name: 'AdminGoodsManage',
    setup() {
        const refreshPending = inject('refreshPending');
        const filter = reactive({ status: '', keyword: '' });
        const page = ref(1);
        const loading = ref(false);
        const result = reactive({ records: [], total: 0 });

        async function load() {
            loading.value = true;
            try {
                const data = await api.adminGoods({
                    status: filter.status || undefined, keyword: filter.keyword || undefined, page: page.value, size: 10,
                });
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

        async function offShelf(goods) {
            const reason = await promptText(`强制下架「${goods.title}」，请填写原因`, '违规下架', {
                inputPlaceholder: '例如：涉嫌违规物品', inputMaxlength: 200,
            });
            if (reason === null) return;
            await api.forceOffShelf(goods.id, reason);
            ElMessage.success('已下架');
            load();
            refreshPending();
        }

        onMounted(load);
        return { GOODS_STATUS, filter, page, loading, result, load, search, offShelf, formatPrice, formatTime, goodsStatusType };
    },
    template: `
    <div class="panel">
      <h3 class="panel-title">商品管理</h3>
      <div class="toolbar">
        <el-select v-model="filter.status" placeholder="全部状态" clearable style="width: 150px" @change="search">
          <el-option v-for="s in GOODS_STATUS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-input v-model="filter.keyword" placeholder="按标题搜索" clearable style="width: 220px"
                  @keyup.enter="search" @clear="search" />
        <el-button type="primary" @click="search"><el-icon><Search /></el-icon>&nbsp;查询</el-button>
      </div>
      <el-table :data="result.records" v-loading="loading">
        <el-table-column label="ID" prop="id" width="60" />
        <el-table-column label="商品" min-width="220">
          <template #default="{ row }">
            <div class="goods-cell">
              <img class="thumb" :src="row.coverImage">
              <el-link @click="$router.push('/goods/' + row.id)">{{ row.title }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="价格" width="90">
          <template #default="{ row }">¥{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column label="卖家" width="80">
          <template #default="{ row }">{{ row.seller.nickname }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><el-tag :type="goodsStatusType(row.status)">{{ row.statusText }}</el-tag></template>
        </el-table-column>
        <el-table-column label="浏览" prop="viewCount" width="70" />
        <el-table-column label="更新时间" width="140">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'ON_SALE' || row.status === 'PENDING'" link type="danger" @click="offShelf(row)">强制下架</el-button>
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
