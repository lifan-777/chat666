package com.campus.market.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.campus.market.TestFixtures;
import com.campus.market.dto.StatsVO;
import com.campus.market.dto.StatsVO.NameValue;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.OrderStatus;
import com.campus.market.repository.CategoryRepository;
import com.campus.market.repository.GoodsRepository;
import com.campus.market.repository.TradeOrderRepository;
import com.campus.market.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("统计服务 StatsService 单元测试")
class StatsServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private GoodsRepository goodsRepository;
    @Mock
    private TradeOrderRepository orderRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @InjectMocks
    private StatsService statsService;

    @Test
    @DisplayName("近 7 天下单趋势：按天统计，没有订单的日期补 0")
    void orderTrendFillsZero() {
        LocalDate today = LocalDate.of(2026, 10, 26);
        when(orderRepository.findCreatedTimesSince(any())).thenReturn(List.of(
                LocalDateTime.of(2026, 10, 20, 9, 0),
                LocalDateTime.of(2026, 10, 26, 8, 0),
                LocalDateTime.of(2026, 10, 26, 20, 30)));

        List<NameValue> trend = statsService.orderTrend(today);

        assertThat(trend).hasSize(7);
        assertThat(trend).extracting(NameValue::name)
                .containsExactly("10-20", "10-21", "10-22", "10-23", "10-24", "10-25", "10-26");
        assertThat(trend).extracting(NameValue::value).containsExactly(1L, 0L, 0L, 0L, 0L, 0L, 2L);
    }

    @Test
    @DisplayName("数据概览：汇总用户、商品、订单数量与成交额，状态分布覆盖全部状态")
    void overview() {
        when(userRepository.count()).thenReturn(6L);
        when(goodsRepository.count()).thenReturn(18L);
        when(goodsRepository.countByStatus(GoodsStatus.ON_SALE)).thenReturn(10L);
        when(goodsRepository.countByStatus(GoodsStatus.PENDING)).thenReturn(2L);
        when(orderRepository.count()).thenReturn(7L);
        when(orderRepository.countByStatus(OrderStatus.COMPLETED)).thenReturn(2L);
        when(orderRepository.sumPriceByStatus(OrderStatus.COMPLETED)).thenReturn(new BigDecimal("75.00"));
        when(goodsRepository.countGroupByCategory()).thenReturn(List.<Object[]>of(new Object[]{1L, 6L}));
        when(goodsRepository.countGroupByStatus()).thenReturn(List.<Object[]>of(new Object[]{GoodsStatus.ON_SALE, 10L}));
        when(categoryRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of(TestFixtures.category(1, "数码")));
        when(orderRepository.findCreatedTimesSince(any())).thenReturn(List.of());

        StatsVO stats = statsService.overview();

        assertThat(stats.userCount()).isEqualTo(6);
        assertThat(stats.pendingCount()).isEqualTo(2);
        assertThat(stats.turnover()).isEqualByComparingTo("75");
        assertThat(stats.categoryDistribution()).containsExactly(new NameValue("数码", 6));
        assertThat(stats.statusDistribution()).hasSize(GoodsStatus.values().length)
                .contains(new NameValue("在售", 10), new NameValue("已售出", 0));
        assertThat(stats.orderTrend()).hasSize(7);
    }
}
