import { api } from '../../api.js';
import { GOODS_STATUS, confirmAction, formatPrice, formatTime, goodsStatusType } from '../../utils.js';

const { ref, reactive, onMounted } = Vue;
const { ElMessage } = ElementPlus;

export default {
    name: 'MyGoodsPage',
    setup() {
        const status = ref('');
        const page = ref(1);
        const loading = ref(false);
        const result = reactive({ records: [], total: 0 });

        async function load() {
            loading.value = true;
            try {
                const data = await api.myGoods({ status: status.value || undefined, page: page.value, size: 10 });
                result.records = data.records;
                result.total = data.total;
            } finally {
                loading.value = false;
            }
        }

        function changeStatus() {
            page.value = 1;
            load();
        }

        async function offShelf(row) {
            if (!await confirmAction(`确定下架「${row.title}」吗？`)) return;
            await api.offShelf(row.id);
            ElMessage.success('已下架');
            load();
        }

        async function onShelf(row) {
            await api.onShelf(row.id);
            ElMessage.success('已重新提交审核');
            load();
        }

        onMounted(load);

        return {
            GOODS_STATUS, status, page, loading, result, load, changeStatus, offShelf, onShelf,
            formatPrice, formatTime, goodsStatusType,
        };
    },
    template: `
    <div class="panel">
      <h3 class="panel-title">我发布的</h3>
      <el-tabs v-model="status" @tab-change="changeStatus">
        <el-tab-pane label="全部" name="" />
        <el-tab-pane v-for="s in GOODS_STATUS" :key="s.value" :label="s.label" :name="s.value" />
      </el-tabs>
      <el-table :data="result.records" v-loading="loading" empty-text="还没有发布过商品">
        <el-table-column label="商品" min-width="260">
          <template #default="{ row }">
            <div class="goods-cell">
              <img class="thumb" :src="row.coverImage" style="cursor: pointer" @click="$router.push('/goods/' + row.id)">
              <div>
                <el-link @click="$router.push('/goods/' + row.id)">{{ row.title }}</el-link>
                <div class="muted" style="font-size: 12px">{{ row.categoryName }} · {{ row.viewCount }} 次浏览</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="价格" width="100">
          <template #default="{ row }"><span class="price">¥{{ formatPrice(row.price) }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="200">
          <template #default="{ row }">
            <el-tag :type="goodsStatusType(row.status)">{{ row.statusText }}</el-tag>
            <div v-if="row.rejectReason" style="color: var(--el-color-danger); font-size: 12px; margin-top: 4px">{{ row.rejectReason }}</div>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="row.status === 'RESERVED' || row.status === 'SOLD'"
                       @click="$router.push('/goods/' + row.id + '/edit')">编辑</el-button>
            <el-button v-if="['ON_SALE', 'PENDING', 'REJECTED'].includes(row.status)" link type="warning" @click="offShelf(row)">下架</el-button>
            <el-button v-if="row.status === 'OFF_SHELF'" link type="success" @click="onShelf(row)">重新上架</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="result.total > 10">
        <el-pagination background layout="prev, pager, next" :total="result.total" :page-size="10"
                       v-model:current-page="page" @current-change="load" />
      </div>
    </div>`,
};
