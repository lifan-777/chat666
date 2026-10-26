import { formatPrice, goodsStatusType, timeAgo } from '../utils.js';

export default {
    name: 'GoodsCard',
    props: {
        goods: { type: Object, required: true },
    },
    setup() {
        return { formatPrice, goodsStatusType, timeAgo };
    },
    template: `
    <div class="goods-card" @click="$router.push('/goods/' + goods.id)">
      <div class="cover">
        <img :src="goods.coverImage" :alt="goods.title" loading="lazy">
        <el-tag v-if="goods.status !== 'ON_SALE'" class="status-badge" :type="goodsStatusType(goods.status)" effect="dark" size="small">
          {{ goods.statusText }}
        </el-tag>
      </div>
      <div class="body">
        <div class="title">{{ goods.title }}</div>
        <div>
          <span class="price"><small>¥</small>{{ formatPrice(goods.price) }}</span>
          <span v-if="goods.originalPrice" class="origin-price">¥{{ formatPrice(goods.originalPrice) }}</span>
        </div>
        <div><el-tag size="small" type="info" effect="plain">{{ goods.conditionText }}</el-tag></div>
        <div class="meta">
          <span><el-icon><User /></el-icon>{{ goods.seller?.nickname }}</span>
          <span><el-icon><View /></el-icon>{{ goods.viewCount }} · {{ timeAgo(goods.createdAt) }}</span>
        </div>
      </div>
    </div>`,
};
