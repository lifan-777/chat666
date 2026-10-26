import { api } from '../../api.js';
import { ORDER_STATUS, confirmAction, formatPrice, formatTime, orderStatusType, promptText } from '../../utils.js';

const { ref, reactive, computed, watch } = Vue;
const { ElMessage } = ElementPlus;

/**
 * 订单列表，role = buyer（我买到的）或 seller（我卖出的）。
 */
export default {
    name: 'OrdersPage',
    props: {
        role: { type: String, required: true },
    },
    setup(props) {
        const status = ref('');
        const page = ref(1);
        const loading = ref(false);
        const result = reactive({ records: [], total: 0 });
        const isSeller = computed(() => props.role === 'seller');

        async function load() {
            loading.value = true;
            try {
                const data = await api.orders({ role: props.role, status: status.value || undefined, page: page.value, size: 10 });
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

        function counterpart(order) {
            return isSeller.value ? order.buyer : order.seller;
        }

        async function confirmOrder(order) {
            if (!await confirmAction('确认后请与买家约定时间地点当面交易，确定确认订单吗？')) return;
            await api.confirmOrder(order.id);
            ElMessage.success('已确认订单');
            load();
        }

        async function completeOrder(order) {
            if (!await confirmAction('请确认已当面验货并完成交易，确认收货后订单将完成。')) return;
            await api.completeOrder(order.id);
            ElMessage.success('交易完成');
            load();
        }

        async function cancelOrder(order) {
            const reason = await promptText('请填写取消原因（选填）', '取消订单', { inputPlaceholder: '例如：时间约不上', inputMaxlength: 200 });
            if (reason === null) return;
            await api.cancelOrder(order.id, reason);
            ElMessage.success('订单已取消，商品已恢复在售');
            load();
        }

        watch(() => props.role, () => {
            status.value = '';
            page.value = 1;
            load();
        }, { immediate: true });

        return {
            ORDER_STATUS, status, page, loading, result, isSeller, load, changeStatus, counterpart,
            confirmOrder, completeOrder, cancelOrder, formatPrice, formatTime, orderStatusType,
        };
    },
    template: `
    <div class="panel">
      <h3 class="panel-title">{{ isSeller ? '我卖出的' : '我买到的' }}</h3>
      <el-tabs v-model="status" @tab-change="changeStatus">
        <el-tab-pane label="全部" name="" />
        <el-tab-pane v-for="s in ORDER_STATUS" :key="s.value" :label="s.label" :name="s.value" />
      </el-tabs>
      <div v-loading="loading">
        <div v-for="o in result.records" :key="o.id" class="order-card">
          <div class="order-head">
            <span>订单号 {{ o.orderNo }} · 下单时间 {{ formatTime(o.createdAt) }}</span>
            <el-tag :type="orderStatusType(o.status)" effect="dark" size="small">{{ o.statusText }}</el-tag>
          </div>
          <div class="order-body">
            <img :src="o.goodsImage" @click="$router.push('/goods/' + o.goodsId)">
            <div class="order-main">
              <el-link style="justify-content: flex-start" @click="$router.push('/goods/' + o.goodsId)">{{ o.goodsTitle }}</el-link>
              <div><span class="price">¥{{ formatPrice(o.price) }}</span> <span class="muted">· 交易地点：{{ o.tradeLocation }}</span></div>
              <div class="muted" style="font-size: 13px">
                {{ isSeller ? '买家' : '卖家' }}：{{ counterpart(o).nickname }}
                <template v-if="o.status !== 'CANCELLED'">
                  · 联系电话：{{ counterpart(o).phone || '未填写' }}
                </template>
              </div>
              <div v-if="o.buyerRemark" style="font-size: 13px">买家留言：{{ o.buyerRemark }}</div>
              <div v-if="o.cancelReason" style="font-size: 13px; color: var(--el-color-danger)">{{ o.cancelReason }}</div>
            </div>
            <div class="order-ops">
              <template v-if="isSeller">
                <el-button v-if="o.status === 'PENDING'" type="primary" size="small" @click="confirmOrder(o)">确认订单</el-button>
              </template>
              <template v-else>
                <el-button v-if="o.status === 'CONFIRMED'" type="success" size="small" @click="completeOrder(o)">确认收货</el-button>
              </template>
              <el-button v-if="o.status === 'PENDING' || o.status === 'CONFIRMED'" size="small" @click="cancelOrder(o)">取消订单</el-button>
            </div>
          </div>
        </div>
        <el-empty v-if="!result.records.length && !loading" :description="isSeller ? '还没有人购买你的商品' : '还没有买过东西，去首页逛逛吧'" />
      </div>
      <div class="pager" v-if="result.total > 10">
        <el-pagination background layout="prev, pager, next" :total="result.total" :page-size="10"
                       v-model:current-page="page" @current-change="load" />
      </div>
    </div>`,
};
