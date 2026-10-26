package com.campus.market.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campus.market.dto.StatsVO;
import com.campus.market.dto.StatsVO.NameValue;
import com.campus.market.entity.Category;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.OrderStatus;
import com.campus.market.repository.CategoryRepository;
import com.campus.market.repository.GoodsRepository;
import com.campus.market.repository.TradeOrderRepository;
import com.campus.market.repository.UserRepository;

/**
 * 管理后台的数据统计。
 */
@Service
@Transactional(readOnly = true)
public class StatsService {

    static final int TREND_DAYS = 7;
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("MM-dd");

    private final UserRepository userRepository;
    private final GoodsRepository goodsRepository;
    private final TradeOrderRepository orderRepository;
    private final CategoryRepository categoryRepository;

    public StatsService(UserRepository userRepository, GoodsRepository goodsRepository,
                        TradeOrderRepository orderRepository, CategoryRepository categoryRepository) {
        this.userRepository = userRepository;
        this.goodsRepository = goodsRepository;
        this.orderRepository = orderRepository;
        this.categoryRepository = categoryRepository;
    }

    public StatsVO overview() {
        return new StatsVO(
                userRepository.count(),
                goodsRepository.count(),
                goodsRepository.countByStatus(GoodsStatus.ON_SALE),
                goodsRepository.countByStatus(GoodsStatus.PENDING),
                orderRepository.count(),
                orderRepository.countByStatus(OrderStatus.COMPLETED),
                orderRepository.sumPriceByStatus(OrderStatus.COMPLETED),
                categoryDistribution(),
                statusDistribution(),
                orderTrend(LocalDate.now()));
    }

    private List<NameValue> categoryDistribution() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : goodsRepository.countGroupByCategory()) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        List<NameValue> result = new ArrayList<>();
        for (Category c : categoryRepository.findAllByOrderBySortOrderAscIdAsc()) {
            result.add(new NameValue(c.getName(), counts.getOrDefault(c.getId(), 0L)));
        }
        return result;
    }

    private List<NameValue> statusDistribution() {
        Map<GoodsStatus, Long> counts = new HashMap<>();
        for (Object[] row : goodsRepository.countGroupByStatus()) {
            counts.put((GoodsStatus) row[0], (Long) row[1]);
        }
        List<NameValue> result = new ArrayList<>();
        for (GoodsStatus status : GoodsStatus.values()) {
            result.add(new NameValue(status.getLabel(), counts.getOrDefault(status, 0L)));
        }
        return result;
    }

    /** 最近 7 天（含今天）每天的下单数量，没有订单的日期补 0 */
    List<NameValue> orderTrend(LocalDate today) {
        LocalDate start = today.minusDays(TREND_DAYS - 1L);
        Map<LocalDate, Long> perDay = new LinkedHashMap<>();
        for (int i = 0; i < TREND_DAYS; i++) {
            perDay.put(start.plusDays(i), 0L);
        }
        for (LocalDateTime createdAt : orderRepository.findCreatedTimesSince(start.atStartOfDay())) {
            perDay.computeIfPresent(createdAt.toLocalDate(), (day, n) -> n + 1);
        }
        return perDay.entrySet().stream()
                .map(e -> new NameValue(e.getKey().format(DAY_LABEL), e.getValue()))
                .toList();
    }
}
