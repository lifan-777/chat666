package com.campus.market.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.campus.market.TestFixtures;
import com.campus.market.common.BusinessException;
import com.campus.market.entity.Favorite;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.User;
import com.campus.market.repository.FavoriteRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("收藏服务 FavoriteService 单元测试")
class FavoriteServiceTest {

    @Mock
    private FavoriteRepository favoriteRepository;
    @Mock
    private GoodsService goodsService;
    @InjectMocks
    private FavoriteService favoriteService;

    private User seller;
    private User user;
    private Goods goods;

    @BeforeEach
    void setUp() {
        seller = TestFixtures.user(1, "seller");
        user = TestFixtures.user(2, "user");
        goods = TestFixtures.goods(10, seller, GoodsStatus.ON_SALE);
        when(goodsService.getEntity(10L)).thenReturn(goods);
    }

    @Test
    @DisplayName("收藏商品成功")
    void addFavorite() {
        when(favoriteRepository.existsByUserIdAndGoodsId(2L, 10L)).thenReturn(false);

        favoriteService.add(user, 10L);

        verify(favoriteRepository).save(any(Favorite.class));
    }

    @Test
    @DisplayName("重复收藏是幂等操作，不会产生重复记录")
    void addFavoriteIdempotent() {
        when(favoriteRepository.existsByUserIdAndGoodsId(2L, 10L)).thenReturn(true);

        favoriteService.add(user, 10L);

        verify(favoriteRepository, never()).save(any());
    }

    @Test
    @DisplayName("不能收藏自己发布的商品")
    void cannotFavoriteOwnGoods() {
        assertThatThrownBy(() -> favoriteService.add(seller, 10L))
                .isInstanceOf(BusinessException.class)
                .hasMessage("不能收藏自己发布的商品");
    }

    @Test
    @DisplayName("取消收藏：未收藏时调用不报错")
    void removeNotFavoritedIsNoop() {
        org.mockito.Mockito.reset(goodsService);
        when(favoriteRepository.findByUserIdAndGoodsId(2L, 10L)).thenReturn(Optional.empty());

        favoriteService.remove(user, 10L);

        verify(favoriteRepository, never()).delete(any());
    }
}
