import { api } from '../../api.js';
import { formatPrice, formatTime, promptText } from '../../utils.js';

const { ref, reactive, inject, onMounted } = Vue;
const { ElMessage } = ElementPlus;

export default {
    name: 'AdminAudit',
    setup() {
        const refreshPending = inject('refreshPending');
        const page = ref(1);
        const loading = ref(false);
        const result = reactive({ records: [], total: 0 });
        const drawer = reactive({ visible: false, goods: null });

        async function load() {
            loading.value = true;
            try {
                const data = await api.adminGoods({ status: 'PENDING', page: page.value, size: 10 });
                result.records = data.records;
                result.total = data.total;
            } finally {
                loading.value = false;
            }
        }

        async function afterAudit() {
            drawer.visible = false;
            await load();
            refreshPending();
        }

        async function approve(goods) {
            await api.auditGoods(goods.id, { approved: true });
            ElMessage.success(`「${goods.title}」已审核通过并上架`);
            afterAudit();
        }

        async function reject(goods) {
            const reason = await promptText('请填写驳回原因，卖家会看到该原因', '驳回商品', {
                inputPlaceholder: '例如：图片与描述不符',
                inputValidator: (v) => (v && v.trim() ? true : '驳回原因不能为空'),
                inputMaxlength: 200,
            });
            if (reason === null) return;
            await api.auditGoods(goods.id, { approved: false, reason });
            ElMessage.success('已驳回');
            afterAudit();
        }

        function view(goods) {
            drawer.goods = goods;
            drawer.visible = true;
        }

        onMounted(load);
        return { page, loading, result, drawer, load, approve, reject, view, formatPrice, formatTime };
    },
    template: `
    <div class="panel">
      <h3 class="panel-title">商品审核 <el-tag type="warning" round>{{ result.total }} 件待审核</el-tag></h3>
      <el-table :data="result.records" v-loading="loading" empty-text="太棒了，没有待审核的商品">
        <el-table-column label="商品" min-width="240">
          <template #default="{ row }">
            <div class="goods-cell">
              <img class="thumb" :src="row.coverImage">
              <el-link @click="view(row)">{{ row.title }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分类" prop="categoryName" width="100" />
        <el-table-column label="价格" width="90">
          <template #default="{ row }"><span class="price">¥{{ formatPrice(row.price) }}</span></template>
        </el-table-column>
        <el-table-column label="卖家" width="90">
          <template #default="{ row }">{{ row.seller.nickname }}</template>
        </el-table-column>
        <el-table-column label="提交时间" width="140">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="view(row)">详情</el-button>
            <el-button link type="success" @click="approve(row)">通过</el-button>
            <el-button link type="danger" @click="reject(row)">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="result.total > 10">
        <el-pagination background layout="prev, pager, next" :total="result.total" :page-size="10"
                       v-model:current-page="page" @current-change="load" />
      </div>

      <el-drawer v-model="drawer.visible" title="商品详情" size="480px">
        <template v-if="drawer.goods">
          <el-carousel height="300px" indicator-position="outside" :autoplay="false">
            <el-carousel-item v-for="img in drawer.goods.images" :key="img">
              <el-image :src="img" fit="contain" style="width: 100%; height: 100%" />
            </el-carousel-item>
          </el-carousel>
          <el-descriptions :column="1" border style="margin-top: 12px">
            <el-descriptions-item label="标题">{{ drawer.goods.title }}</el-descriptions-item>
            <el-descriptions-item label="价格">¥{{ formatPrice(drawer.goods.price) }}
              <span v-if="drawer.goods.originalPrice" class="origin-price">¥{{ formatPrice(drawer.goods.originalPrice) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="分类">{{ drawer.goods.categoryName }}</el-descriptions-item>
            <el-descriptions-item label="成色">{{ drawer.goods.conditionText }}</el-descriptions-item>
            <el-descriptions-item label="交易地点">{{ drawer.goods.tradeLocation }}</el-descriptions-item>
            <el-descriptions-item label="卖家">{{ drawer.goods.seller.nickname }}</el-descriptions-item>
            <el-descriptions-item label="描述"><div class="description" style="font-size: 14px">{{ drawer.goods.description }}</div></el-descriptions-item>
          </el-descriptions>
          <div style="margin-top: 20px; display: flex; gap: 12px">
            <el-button type="success" @click="approve(drawer.goods)">审核通过</el-button>
            <el-button type="danger" plain @click="reject(drawer.goods)">驳回</el-button>
          </div>
        </template>
      </el-drawer>
    </div>`,
};
