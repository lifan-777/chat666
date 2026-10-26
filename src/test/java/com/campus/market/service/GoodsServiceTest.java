package com.campus.market.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.campus.market.TestFixtures;
import com.campus.market.common.BusinessException;
import com.campus.market.dto.AuditRequest;
import com.campus.market.dto.GoodsVO;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.User;
import com.campus.market.repository.FavoriteRepository;
import com.campus.market.repository.GoodsRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("商品服务 GoodsService 单元测试")
class GoodsServiceTest {

    @Mock
    private GoodsRepository goodsRepository;
    @Mock
    private FavoriteRepository favoriteRepository;
    @Mock
    private CategoryService categoryService;
    @InjectMocks
    private GoodsService goodsService;

    private User seller;
    private User other;

    @BeforeEach
    void setUp() {
        seller = TestFixtures.user(1, "seller");
        other = TestFixtures.user(2, "other");
    }

    private Goods stub(GoodsStatus status) {
        Goods goods = TestFixtures.goods(10, seller, status);
        when(goodsRepository.findById(10L)).thenReturn(Optional.of(goods));
        return goods;
    }

    @Test
    @DisplayName("发布商品后状态为“待审核”，卖家为当前用户")
    void publishPending() {
        when(categoryService.getEntity(1L)).thenReturn(TestFixtures.category(1, "生活用品"));
        when(goodsRepository.save(any(Goods.class))).thenAnswer(inv -> inv.getArgument(0));

        GoodsVO vo = goodsService.publish(seller, TestFixtures.goodsRequest(1));

        assertThat(vo.status()).isEqualTo(GoodsStatus.PENDING);
        assertThat(vo.seller().id()).isEqualTo(1L);
        assertThat(vo.title()).isEqualTo("二手台灯");
        assertThat(vo.coverImage()).isEqualTo("/uploads/lamp.jpg");
    }

    @Test
    @DisplayName("编辑被驳回的商品后重新进入待审核，并清空驳回原因")
    void updateResetsToPending() {
        Goods goods = stub(GoodsStatus.REJECTED);
        goods.setRejectReason("图片不清晰");
        when(categoryService.getEntity(1L)).thenReturn(TestFixtures.category(1, "生活用品"));

        GoodsVO vo = goodsService.update(seller, 10L, TestFixtures.goodsRequest(1));

        assertThat(vo.status()).isEqualTo(GoodsStatus.PENDING);
        assertThat(goods.getRejectReason()).isNull();
        assertThat(goods.getTitle()).isEqualTo("二手台灯");
    }

    @ParameterizedTest(name = "状态为 {0} 的商品不能编辑")
    @EnumSource(value = GoodsStatus.class, names = {"RESERVED", "SOLD"})
    @DisplayName("交易中或已售出的商品不能编辑")
    void cannotEditReservedOrSold(GoodsStatus status) {
        stub(status);

        assertThatThrownBy(() -> goodsService.update(seller, 10L, TestFixtures.goodsRequest(1)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("交易中或已售出的商品不能编辑");
    }

    @Test
    @DisplayName("非本人不能编辑或下架他人商品（403）")
    void notOwnerForbidden() {
        stub(GoodsStatus.ON_SALE);

        assertThatThrownBy(() -> goodsService.update(other, 10L, TestFixtures.goodsRequest(1)))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        assertThatThrownBy(() -> goodsService.offShelf(other, 10L))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("在售商品可以下架，下架后可重新上架（进入待审核）")
    void offShelfAndReShelf() {
        Goods goods = stub(GoodsStatus.ON_SALE);

        assertThat(goodsService.offShelf(seller, 10L).status()).isEqualTo(GoodsStatus.OFF_SHELF);
        assertThat(goodsService.reShelf(seller, 10L).status()).isEqualTo(GoodsStatus.PENDING);
        assertThat(goods.getStatus()).isEqualTo(GoodsStatus.PENDING);
    }

    @Test
    @DisplayName("交易中的商品不能下架")
    void cannotOffShelfReserved() {
        stub(GoodsStatus.RESERVED);

        assertThatThrownBy(() -> goodsService.offShelf(seller, 10L))
                .isInstanceOf(BusinessException.class)
                .hasMessage("当前状态的商品不能下架");
    }

    @Test
    @DisplayName("只有已下架的商品可以重新上架")
    void reShelfRequiresOffShelf() {
        stub(GoodsStatus.ON_SALE);

        assertThatThrownBy(() -> goodsService.reShelf(seller, 10L))
                .isInstanceOf(BusinessException.class)
                .hasMessage("只有已下架的商品可以重新上架");
    }

    @Test
    @DisplayName("审核通过：待审核 → 在售")
    void auditApprove() {
        Goods goods = stub(GoodsStatus.PENDING);

        GoodsVO vo = goodsService.audit(10L, new AuditRequest(true, null));

        assertThat(vo.status()).isEqualTo(GoodsStatus.ON_SALE);
        assertThat(goods.getRejectReason()).isNull();
    }

    @Test
    @DisplayName("审核驳回：记录驳回原因，状态变为审核未通过")
    void auditReject() {
        Goods goods = stub(GoodsStatus.PENDING);

        goodsService.audit(10L, new AuditRequest(false, " 图片与描述不符 "));

        assertThat(goods.getStatus()).isEqualTo(GoodsStatus.REJECTED);
        assertThat(goods.getRejectReason()).isEqualTo("图片与描述不符");
    }

    @Test
    @DisplayName("审核驳回时必须填写原因")
    void auditRejectRequiresReason() {
        stub(GoodsStatus.PENDING);

        assertThatThrownBy(() -> goodsService.audit(10L, new AuditRequest(false, "  ")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("驳回时必须填写原因");
    }

    @Test
    @DisplayName("非待审核状态的商品不能重复审核")
    void auditOnlyPending() {
        stub(GoodsStatus.ON_SALE);

        assertThatThrownBy(() -> goodsService.audit(10L, new AuditRequest(true, null)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("该商品不是待审核状态");
    }

    @Test
    @DisplayName("管理员强制下架：记录下架原因")
    void forceOffShelf() {
        Goods goods = stub(GoodsStatus.ON_SALE);

        goodsService.forceOffShelf(10L, "违禁物品");

        assertThat(goods.getStatus()).isEqualTo(GoodsStatus.OFF_SHELF);
        assertThat(goods.getRejectReason()).isEqualTo("管理员下架：违禁物品");
    }

    @Test
    @DisplayName("管理员不能强制下架交易中的商品")
    void forceOffShelfReservedFails() {
        stub(GoodsStatus.RESERVED);

        assertThatThrownBy(() -> goodsService.forceOffShelf(10L, "违规"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("正在交易中");
    }

    @Test
    @DisplayName("商品详情：待审核商品对其他用户和游客不可见（404）")
    void detailHiddenForOthers() {
        stub(GoodsStatus.PENDING);

        assertThatThrownBy(() -> goodsService.detail(10L, other))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
        assertThatThrownBy(() -> goodsService.detail(10L, null))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("商品详情：卖家本人和管理员可以查看待审核商品")
    void detailVisibleForOwnerAndAdmin() {
        stub(GoodsStatus.PENDING);

        assertThat(goodsService.detail(10L, seller).status()).isEqualTo(GoodsStatus.PENDING);
        assertThat(goodsService.detail(10L, TestFixtures.admin(99)).status()).isEqualTo(GoodsStatus.PENDING);
    }

    @Test
    @DisplayName("商品详情：他人浏览时浏览量 +1，并返回收藏状态")
    void detailIncreasesViewCountForOthers() {
        stub(GoodsStatus.ON_SALE);
        when(favoriteRepository.existsByUserIdAndGoodsId(2L, 10L)).thenReturn(true);
        when(favoriteRepository.countByGoodsId(10L)).thenReturn(3L);

        GoodsVO vo = goodsService.detail(10L, other);

        verify(goodsRepository).increaseViewCount(10L);
        assertThat(vo.viewCount()).isEqualTo(11);
        assertThat(vo.favorited()).isTrue();
        assertThat(vo.favoriteCount()).isEqualTo(3L);
    }

    @Test
    @DisplayName("商品详情：卖家浏览自己的商品不增加浏览量")
    void detailOwnerDoesNotIncreaseViewCount() {
        stub(GoodsStatus.ON_SALE);

        GoodsVO vo = goodsService.detail(10L, seller);

        verify(goodsRepository, never()).increaseViewCount(anyLong());
        assertThat(vo.viewCount()).isEqualTo(10);
    }

    @Test
    @DisplayName("查询不存在的商品返回 404")
    void goodsNotFound() {
        when(goodsRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> goodsService.getEntity(404L))
                .isInstanceOf(BusinessException.class)
                .hasMessage("商品不存在");
    }
}
