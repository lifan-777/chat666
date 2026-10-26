package com.campus.market.service;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.http.HttpStatus;

import com.campus.market.TestFixtures;
import com.campus.market.common.BusinessException;
import com.campus.market.dto.CommentRequest;
import com.campus.market.dto.CommentVO;
import com.campus.market.entity.Comment;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.User;
import com.campus.market.repository.CommentRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("留言服务 CommentService 单元测试")
class CommentServiceTest {

    @Mock
    private CommentRepository commentRepository;
    @Mock
    private GoodsService goodsService;
    @Mock
    private UserService userService;
    @InjectMocks
    private CommentService commentService;

    private User seller;
    private User author;
    private Comment comment;

    @BeforeEach
    void setUp() {
        seller = TestFixtures.user(1, "seller");
        author = TestFixtures.user(2, "author");
        Goods goods = TestFixtures.goods(10, seller, GoodsStatus.ON_SALE);
        comment = new Comment();
        comment.setId(50L);
        comment.setGoods(goods);
        comment.setUser(author);
        comment.setContent("还在吗？");
    }

    @Test
    @DisplayName("发表留言并回复指定用户")
    void addReply() {
        when(goodsService.getEntity(10L)).thenReturn(comment.getGoods());
        when(userService.getEntity(2L)).thenReturn(author);
        when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));

        CommentVO vo = commentService.add(seller, 10L, new CommentRequest("  在的  ", 2L));

        assertThat(vo.content()).isEqualTo("在的");
        assertThat(vo.replyTo().id()).isEqualTo(2L);
        assertThat(vo.user().id()).isEqualTo(1L);
    }

    @Test
    @DisplayName("留言作者可以删除自己的留言")
    void authorCanDelete() {
        when(commentRepository.findById(50L)).thenReturn(Optional.of(comment));

        commentService.delete(author, 50L);

        verify(commentRepository).delete(comment);
    }

    @Test
    @DisplayName("商品卖家可以删除自己商品下的留言")
    void sellerCanDelete() {
        when(commentRepository.findById(50L)).thenReturn(Optional.of(comment));

        commentService.delete(seller, 50L);

        verify(commentRepository).delete(comment);
    }

    @Test
    @DisplayName("管理员可以删除任意留言")
    void adminCanDelete() {
        when(commentRepository.findById(50L)).thenReturn(Optional.of(comment));

        commentService.delete(TestFixtures.admin(9), 50L);

        verify(commentRepository).delete(comment);
    }

    @Test
    @DisplayName("其他用户不能删除留言（403）")
    void othersCannotDelete() {
        when(commentRepository.findById(50L)).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> commentService.delete(TestFixtures.user(3, "other"), 50L))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        verify(commentRepository, never()).delete(any());
    }
}
