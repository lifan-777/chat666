import { api } from '../api.js';
import GoodsCard from '../components/GoodsCard.js';

const { ref, reactive, watch, onMounted } = Vue;
const { useRoute, useRouter } = VueRouter;

const SORTS = [
    { value: 'newest', label: '最新发布' },
    { value: 'hot', label: '最多浏览' },
    { value: 'price_asc', label: '价格从低到高' },
    { value: 'price_desc', label: '价格从高到低' },
];

export default {
    name: 'HomePage',
    components: { GoodsCard },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const categories = ref([]);
        const loading = ref(false);
        const result = reactive({ records: [], total: 0 });
        const filter = reactive({ minPrice: undefined, maxPrice: undefined });

        const toNumber = (v) => (v === undefined || v === '' ? undefined : Number(v));

        function currentQuery() {
            const q = route.query;
            return {
                keyword: q.keyword || undefined,
                categoryId: toNumber(q.categoryId),
                sort: q.sort || 'newest',
                minPrice: toNumber(q.minPrice),
                maxPrice: toNumber(q.maxPrice),
                page: toNumber(q.page) || 1,
                size: 12,
            };
        }

        async function load() {
            const query = currentQuery();
            filter.minPrice = query.minPrice;
            filter.maxPrice = query.maxPrice;
            loading.value = true;
            try {
                const data = await api.searchGoods(query);
                result.records = data.records;
                result.total = data.total;
            } finally {
                loading.value = false;
            }
        }

        function update(patch) {
            const query = { ...route.query, ...patch };
            if (!('page' in patch)) {
                delete query.page;
            }
            Object.keys(query).forEach((k) => (query[k] === undefined || query[k] === null || query[k] === '') && delete query[k]);
            router.push({ path: '/', query });
        }

        function applyPrice() {
            update({ minPrice: filter.minPrice, maxPrice: filter.maxPrice });
        }

        function resetAll() {
            router.push({ path: '/' });
        }

        onMounted(async () => {
            categories.value = await api.categories();
        });
        watch(() => route.query, () => route.path === '/' && load(), { immediate: true });

        return { SORTS, categories, loading, result, filter, currentQuery, update, applyPrice, resetAll };
    },
    template: `
    <div class="container">
      <section class="hero">
        <div>
          <h1>让闲置在校园里流动起来</h1>
          <p>教材、数码、生活好物 —— 同校面交，安全放心</p>
        </div>
        <div class="hero-stats">
          <div><b>{{ result.total }}</b>件在售好物</div>
          <div><b>{{ categories.length }}</b>个分类</div>
        </div>
      </section>

      <div class="category-bar">
        <span class="category-chip" :class="{ active: !currentQuery().categoryId }" @click="update({ categoryId: undefined })">
          <el-icon><Grid /></el-icon>全部
        </span>
        <span v-for="c in categories" :key="c.id" class="category-chip"
              :class="{ active: currentQuery().categoryId === c.id }" @click="update({ categoryId: c.id })">
          <el-icon><component :is="c.icon || 'Goods'" /></el-icon>{{ c.name }}
        </span>
      </div>

      <div class="filter-bar">
        <el-radio-group :model-value="currentQuery().sort" @change="v => update({ sort: v })">
          <el-radio-button v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</el-radio-button>
        </el-radio-group>
        <div class="price-range">
          <span class="muted">价格</span>
          <el-input-number v-model="filter.minPrice" :min="0" :controls="false" placeholder="最低" />
          <span>-</span>
          <el-input-number v-model="filter.maxPrice" :min="0" :controls="false" placeholder="最高" />
          <el-button @click="applyPrice">确定</el-button>
        </div>
      </div>

      <el-alert v-if="currentQuery().keyword" type="info" :closable="false" show-icon style="margin-bottom: 16px">
        <template #title>
          “{{ currentQuery().keyword }}” 的搜索结果，共 {{ result.total }} 件
          <el-link type="primary" style="margin-left: 8px" @click="resetAll">清除筛选</el-link>
        </template>
      </el-alert>

      <div v-loading="loading">
        <div v-if="result.records.length" class="goods-grid">
          <goods-card v-for="g in result.records" :key="g.id" :goods="g" />
        </div>
        <el-empty v-else-if="!loading" description="暂时没有符合条件的商品">
          <el-button type="primary" @click="$router.push('/publish')">发布一件闲置</el-button>
        </el-empty>
      </div>

      <div class="pager" v-if="result.total > 12">
        <el-pagination background layout="prev, pager, next, total" :total="result.total" :page-size="12"
                       :current-page="currentQuery().page" @current-change="p => update({ page: p })" />
      </div>
    </div>`,
};
