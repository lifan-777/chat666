import { api } from '../../api.js';
import { formatPrice } from '../../utils.js';

const { ref, onMounted, onBeforeUnmount, nextTick } = Vue;

const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B'];

export default {
    name: 'AdminDashboard',
    setup() {
        const stats = ref(null);
        const categoryChart = ref(null);
        const trendChart = ref(null);
        const statusChart = ref(null);
        const charts = [];

        function render() {
            const s = stats.value;
            const pie = echarts.init(categoryChart.value);
            pie.setOption({
                color: COLORS,
                tooltip: { trigger: 'item', formatter: '{b}：{c} 件（{d}%）' },
                series: [{
                    type: 'pie', radius: ['42%', '70%'], center: ['50%', '50%'],
                    itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 },
                    label: { formatter: '{b}\n{c} 件' },
                    data: s.categoryDistribution.filter((d) => d.value > 0),
                }],
            });

            const line = echarts.init(trendChart.value);
            line.setOption({
                color: ['#F97316'],
                tooltip: { trigger: 'axis' },
                grid: { left: 40, right: 20, top: 30, bottom: 30 },
                xAxis: { type: 'category', data: s.orderTrend.map((d) => d.name), boundaryGap: false },
                yAxis: { type: 'value', minInterval: 1 },
                series: [{
                    name: '下单数', type: 'line', symbolSize: 8,
                    areaStyle: { color: 'rgba(249, 115, 22, 0.15)' },
                    data: s.orderTrend.map((d) => d.value),
                }],
            });

            const bar = echarts.init(statusChart.value);
            bar.setOption({
                tooltip: { trigger: 'axis' },
                grid: { left: 80, right: 30, top: 10, bottom: 20 },
                xAxis: { type: 'value', minInterval: 1 },
                yAxis: { type: 'category', data: s.statusDistribution.map((d) => d.name), inverse: true },
                series: [{
                    type: 'bar', barWidth: 16,
                    itemStyle: { borderRadius: [0, 6, 6, 0], color: (p) => COLORS[p.dataIndex % COLORS.length] },
                    label: { show: true, position: 'right' },
                    data: s.statusDistribution.map((d) => d.value),
                }],
            });
            charts.push(pie, line, bar);
        }

        function resize() {
            charts.forEach((c) => c.resize());
        }

        onMounted(async () => {
            stats.value = await api.adminStats();
            await nextTick();
            render();
            window.addEventListener('resize', resize);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('resize', resize);
            charts.forEach((c) => c.dispose());
        });

        return { stats, categoryChart, trendChart, statusChart, formatPrice };
    },
    template: `
    <div v-loading="!stats">
      <div class="stat-grid" v-if="stats">
        <div class="stat-card"><span class="label"><el-icon><User /></el-icon>注册用户</span><span class="value">{{ stats.userCount }}</span></div>
        <div class="stat-card"><span class="label"><el-icon><Goods /></el-icon>商品总数</span><span class="value">{{ stats.goodsCount }}</span></div>
        <div class="stat-card"><span class="label"><el-icon><Sell /></el-icon>在售商品</span><span class="value">{{ stats.onSaleCount }}</span></div>
        <div class="stat-card" style="cursor: pointer" @click="$router.push('/admin/audit')">
          <span class="label"><el-icon><Checked /></el-icon>待审核</span>
          <span class="value" style="color: var(--el-color-warning)">{{ stats.pendingCount }}</span>
        </div>
        <div class="stat-card"><span class="label"><el-icon><Tickets /></el-icon>订单总数</span><span class="value">{{ stats.orderCount }}</span></div>
        <div class="stat-card"><span class="label"><el-icon><Wallet /></el-icon>累计成交额</span><span class="value price">¥{{ formatPrice(stats.turnover) }}</span></div>
      </div>
      <div class="chart-grid">
        <div class="panel">
          <h3 class="panel-title">近 7 天下单趋势</h3>
          <div ref="trendChart" class="chart"></div>
        </div>
        <div class="panel" style="margin-top: 0">
          <h3 class="panel-title">商品分类分布</h3>
          <div ref="categoryChart" class="chart"></div>
        </div>
      </div>
      <div class="panel" style="margin-top: 16px">
        <h3 class="panel-title">商品状态统计</h3>
        <div ref="statusChart" class="chart" style="height: 240px"></div>
      </div>
    </div>`,
};
