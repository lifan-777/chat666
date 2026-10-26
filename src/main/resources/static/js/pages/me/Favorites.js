import { api } from '../../api.js';
import GoodsCard from '../../components/GoodsCard.js';

const { ref, reactive, onMounted } = Vue;
const { ElMessage } = ElementPlus;

export default {
    name: 'FavoritesPage',
    components: { GoodsCard },
    setup() {
        const page = ref(1);
        const loading = ref(false);
        const result = reactive({ records: [], total: 0 });

        async function load() {
            loading.value = true;
            try {
                const data = await api.favorites({ page: page.value, size: 12 });
                result.records = data.records;
                result.total = data.total;
            } finally {
                loading.value = false;
            }
        }

        async function remove(goods) {
            await api.removeFavorite(goods.id);
            ElMessage.success('已取消收藏');
            load();
        }

        onMounted(load);
        return { page, loading, result, load, remove };
    },
    template: `
    <div class="panel">
      <h3 class="panel-title">我的收藏</h3>
      <div v-loading="loading">
        <div class="goods-grid" v-if="result.records.length">
          <div v-for="g in result.records" :key="g.id">
            <goods-card :goods="g" />
            <el-button link type="danger" size="small" style="margin-top: 6px" @click="remove(g)">取消收藏</el-button>
          </div>
        </div>
        <el-empty v-else-if="!loading" description="还没有收藏任何商品" />
      </div>
      <div class="pager" v-if="result.total > 12">
        <el-pagination background layout="prev, pager, next" :total="result.total" :page-size="12"
                       v-model:current-page="page" @current-change="load" />
      </div>
    </div>`,
};
