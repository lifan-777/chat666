import { api } from '../api.js';
import { store, isAdmin } from '../store.js';
import { confirmAction, formatPrice, formatTime, goodsStatusType, timeAgo } from '../utils.js';
import UserAvatar from '../components/UserAvatar.js';

const { ref, reactive, computed, watch } = Vue;
const { useRoute, useRouter } = VueRouter;
const { ElMessage, ElMessageBox } = ElementPlus;

export default {
    name: 'GoodsDetailPage',
    components: { UserAvatar },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const goods = ref(null);
        const comments = ref([]);
        const activeImage = ref(0);
        const loading = ref(false);
        const buyDialog = reactive({ visible: false, remark: '', submitting: false });
        const editor = reactive({ content: '', replyTo: null, submitting: false });

        const me = computed(() => store.user);
        const isOwner = computed(() => !!me.value && goods.value?.seller?.id === me.value.id);

        async function load() {
            const id = route.params.id;
            if (!id) return;
            loading.value = true;
            try {
                goods.value = await api.goodsDetail(id);
                activeImage.value = 0;
                comments.value = await api.comments(id);
            } catch (e) {
                goods.value = null;
            } finally {
                loading.value = false;
            }
        }

        function requireLogin() {
            if (!store.token) {
                router.push({ path: '/login', query: { redirect: route.fullPath } });
                return false;
            }
            return true;
        }

        async function toggleFavorite() {
            if (!requireLogin()) return;
            if (goods.value.favorited) {
                await api.removeFavorite(goods.value.id);
                goods.value.favorited = false;
                goods.value.favoriteCount--;
                ElMessage.success('已取消收藏');
            } else {
                await api.addFavorite(goods.value.id);
                goods.value.favorited = true;
                goods.value.favoriteCount++;
                ElMessage.success('收藏成功');
            }
        }

        function openBuy() {
            if (!requireLogin()) return;
            buyDialog.remark = '';
            buyDialog.visible = true;
        }

        async function submitOrder() {
            buyDialog.submitting = true;
            try {
                await api.createOrder({ goodsId: goods.value.id, remark: buyDialog.remark });
                buyDialog.visible = false;
                await ElMessageBox.alert('下单成功！卖家确认后即可在“我买到的”中查看对方联系方式，线下当面交易。',
                    '下单成功', { confirmButtonText: '查看订单', type: 'success' }).catch(() => {});
                router.push('/me/bought');
            } catch (e) {
                load();
            } finally {
                buyDialog.submitting = false;
            }
        }

        async function offShelf() {
            if (!await confirmAction('下架后其他同学将看不到该商品，确定下架吗？')) return;
            await api.offShelf(goods.value.id);
            ElMessage.success('已下架');
            load();
        }

        async function onShelf() {
            await api.onShelf(goods.value.id);
            ElMessage.success('已重新提交，等待管理员审核');
            load();
        }

        function reply(comment) {
            editor.replyTo = comment.user;
            document.getElementById('comment-input')?.focus();
        }

        async function submitComment() {
            if (!requireLogin()) return;
            if (!editor.content.trim()) {
                ElMessage.warning('请输入留言内容');
                return;
            }
            editor.submitting = true;
            try {
                await api.addComment(goods.value.id, { content: editor.content, replyToUserId: editor.replyTo?.id });
                editor.content = '';
                editor.replyTo = null;
                comments.value = await api.comments(goods.value.id);
                ElMessage.success('留言成功');
            } finally {
                editor.submitting = false;
            }
        }

        function canDelete(comment) {
            return !!me.value && (comment.user.id === me.value.id || isOwner.value || isAdmin());
        }

        async function removeComment(comment) {
            if (!await confirmAction('确定删除这条留言吗？')) return;
            await api.deleteComment(comment.id);
            comments.value = comments.value.filter((c) => c.id !== comment.id);
            ElMessage.success('已删除');
        }

        watch(() => route.params.id, load, { immediate: true });

        return {
            store, goods, comments, activeImage, loading, buyDialog, editor, isOwner,
            toggleFavorite, openBuy, submitOrder, offShelf, onShelf, reply, submitComment, canDelete, removeComment,
            formatPrice, formatTime, goodsStatusType, timeAgo,
        };
    },
    template: `
    <div class="container" v-loading="loading">
      <el-breadcrumb separator="/" style="margin-bottom: 16px">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-if="goods" :to="{ path: '/', query: { categoryId: goods.categoryId } }">{{ goods.categoryName }}</el-breadcrumb-item>
        <el-breadcrumb-item>商品详情</el-breadcrumb-item>
      </el-breadcrumb>

      <el-empty v-if="!goods && !loading" description="商品不存在或已下架">
        <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
      </el-empty>

      <template v-if="goods">
        <el-alert v-if="isOwner && goods.status === 'PENDING'" type="warning" show-icon :closable="false"
                  title="商品正在等待管理员审核，审核通过后其他同学才能看到" style="margin-bottom: 16px" />
        <el-alert v-if="goods.rejectReason && (goods.status === 'REJECTED' || goods.status === 'OFF_SHELF')" type="error" show-icon :closable="false"
                  :title="(goods.status === 'REJECTED' ? '审核未通过：' : '已下架：') + goods.rejectReason" style="margin-bottom: 16px" />

        <section class="panel detail-top">
          <div class="detail-gallery">
            <el-image class="main-image" :src="goods.images[activeImage]" fit="cover"
                      :preview-src-list="goods.images" :initial-index="activeImage" preview-teleported />
            <div class="thumbs" v-if="goods.images.length > 1">
              <img v-for="(img, i) in goods.images" :key="img" :src="img" :class="{ active: i === activeImage }"
                   @mouseenter="activeImage = i" @click="activeImage = i">
            </div>
          </div>

          <div class="detail-info">
            <h1>{{ goods.title }}</h1>
            <div class="price-box">
              <span class="price"><small>¥</small>{{ formatPrice(goods.price) }}</span>
              <span v-if="goods.originalPrice" class="origin-price">原价 ¥{{ formatPrice(goods.originalPrice) }}</span>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap">
              <el-tag :type="goodsStatusType(goods.status)" effect="dark">{{ goods.statusText }}</el-tag>
              <el-tag type="info" effect="plain">{{ goods.categoryName }}</el-tag>
              <el-tag type="warning" effect="plain">{{ goods.conditionText }}</el-tag>
            </div>
            <dl class="info-list">
              <dt>交易地点</dt><dd><el-icon><Location /></el-icon> {{ goods.tradeLocation }}</dd>
              <dt>发布时间</dt><dd>{{ formatTime(goods.createdAt) }}（{{ timeAgo(goods.createdAt) }}）</dd>
              <dt>浏览 / 收藏</dt><dd>{{ goods.viewCount }} 次浏览 · {{ goods.favoriteCount }} 人收藏</dd>
            </dl>
            <div class="seller-card">
              <user-avatar :user="goods.seller" :size="44" />
              <div>
                <div style="font-weight: 600">{{ goods.seller.nickname }}</div>
                <div class="muted" style="font-size: 12px">卖家 · 同校认证用户</div>
              </div>
            </div>

            <div class="detail-actions" v-if="isOwner">
              <el-button type="primary" :disabled="goods.status === 'RESERVED' || goods.status === 'SOLD'"
                         @click="$router.push('/goods/' + goods.id + '/edit')">
                <el-icon><Edit /></el-icon>&nbsp;编辑商品
              </el-button>
              <el-button v-if="['ON_SALE', 'PENDING', 'REJECTED'].includes(goods.status)" @click="offShelf">下架</el-button>
              <el-button v-if="goods.status === 'OFF_SHELF'" type="success" plain @click="onShelf">重新上架</el-button>
            </div>
            <div class="detail-actions" v-else>
              <el-button type="primary" size="large" :disabled="goods.status !== 'ON_SALE'" @click="openBuy">
                {{ goods.status === 'ON_SALE' ? '我想要' : goods.statusText }}
              </el-button>
              <el-button size="large" @click="toggleFavorite" :type="goods.favorited ? 'warning' : ''" :plain="goods.favorited">
                <el-icon><StarFilled v-if="goods.favorited" /><Star v-else /></el-icon>&nbsp;{{ goods.favorited ? '已收藏' : '收藏' }}
              </el-button>
            </div>
          </div>
        </section>

        <section class="panel">
          <h3 class="panel-title"><el-icon><Document /></el-icon>商品描述</h3>
          <p class="description">{{ goods.description }}</p>
        </section>

        <section class="panel">
          <h3 class="panel-title"><el-icon><ChatDotRound /></el-icon>留言咨询（{{ comments.length }}）</h3>
          <div v-for="c in comments" :key="c.id" class="comment-item">
            <user-avatar :user="c.user" :size="36" />
            <div class="content">
              <div class="head">
                <b>{{ c.user.nickname }}</b>
                <el-tag v-if="c.user.id === goods.seller.id" size="small" type="warning">卖家</el-tag>
                <span v-if="c.replyTo" class="muted">回复 @{{ c.replyTo.nickname }}</span>
                <span class="muted" style="margin-left: auto">{{ timeAgo(c.createdAt) }}</span>
              </div>
              <div>{{ c.content }}</div>
              <div class="ops">
                <el-button link type="primary" size="small" @click="reply(c)">回复</el-button>
                <el-button v-if="canDelete(c)" link type="danger" size="small" @click="removeComment(c)">删除</el-button>
              </div>
            </div>
          </div>
          <el-empty v-if="!comments.length" description="还没有人留言，快来问问卖家吧" :image-size="80" />

          <div class="comment-editor">
            <div v-if="editor.replyTo" class="reply-tip">
              <el-tag closable @close="editor.replyTo = null">回复 @{{ editor.replyTo.nickname }}</el-tag>
            </div>
            <el-input id="comment-input" v-model="editor.content" type="textarea" :rows="3" maxlength="300" show-word-limit
                      :placeholder="store.token ? '问问卖家商品细节、交易时间…' : '登录后才能留言'" />
            <div class="actions">
              <el-button type="primary" :loading="editor.submitting" @click="submitComment">发表留言</el-button>
            </div>
          </div>
        </section>
      </template>

      <el-dialog v-model="buyDialog.visible" title="确认购买" width="460px">
        <div v-if="goods" class="goods-cell" style="margin-bottom: 16px">
          <img class="thumb" :src="goods.coverImage">
          <div>
            <div>{{ goods.title }}</div>
            <div class="price" style="margin-top: 4px">¥{{ formatPrice(goods.price) }}</div>
          </div>
        </div>
        <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px"
                  title="平台不涉及线上支付，卖家确认后双方线下当面验货交易" />
        <el-input v-model="buyDialog.remark" type="textarea" :rows="3" maxlength="200" show-word-limit
                  placeholder="给卖家留言，例如方便交易的时间（选填）" />
        <template #footer>
          <el-button @click="buyDialog.visible = false">取消</el-button>
          <el-button type="primary" :loading="buyDialog.submitting" @click="submitOrder">确认下单</el-button>
        </template>
      </el-dialog>
    </div>`,
};
