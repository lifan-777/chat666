package com.campus.market.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.campus.market.TestFixtures;
import com.campus.market.common.BusinessException;
import com.campus.market.dto.CategoryRequest;
import com.campus.market.dto.CategoryVO;
import com.campus.market.entity.Category;
import com.campus.market.repository.CategoryRepository;
import com.campus.market.repository.GoodsRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("分类服务 CategoryService 单元测试")
class CategoryServiceTest {

    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private GoodsRepository goodsRepository;
    @InjectMocks
    private CategoryService categoryService;

    @Test
    @DisplayName("分类列表附带每个分类的商品数量，无商品的分类数量为 0")
    void listWithCounts() {
        when(goodsRepository.countGroupByCategory()).thenReturn(List.<Object[]>of(new Object[]{1L, 5L}));
        when(categoryRepository.findAllByOrderBySortOrderAscIdAsc())
                .thenReturn(List.of(TestFixtures.category(1, "数码"), TestFixtures.category(2, "书籍")));

        List<CategoryVO> list = categoryService.listAll();

        assertThat(list).extracting(CategoryVO::goodsCount).containsExactly(5L, 0L);
    }

    @Test
    @DisplayName("新增分类成功，排序值为空时默认为 0")
    void createSuccess() {
        when(categoryRepository.existsByName("乐器")).thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));

        CategoryVO vo = categoryService.create(new CategoryRequest(" 乐器 ", "Headset", null));

        assertThat(vo.name()).isEqualTo("乐器");
        assertThat(vo.sortOrder()).isZero();
    }

    @Test
    @DisplayName("新增分类失败：名称重复返回 409")
    void createDuplicate() {
        when(categoryRepository.existsByName("数码")).thenReturn(true);

        assertThatThrownBy(() -> categoryService.create(new CategoryRequest("数码", null, 1)))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("修改分类失败：与其他分类重名返回 409")
    void updateDuplicate() {
        when(categoryRepository.findById(2L)).thenReturn(Optional.of(TestFixtures.category(2, "书籍")));
        when(categoryRepository.existsByNameAndIdNot("数码", 2L)).thenReturn(true);

        assertThatThrownBy(() -> categoryService.update(2L, new CategoryRequest("数码", null, 1)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("分类名称已存在");
    }

    @Test
    @DisplayName("删除分类失败：分类下仍有商品返回 409")
    void deleteWithGoods() {
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(TestFixtures.category(1, "数码")));
        when(goodsRepository.existsByCategoryId(1L)).thenReturn(true);

        assertThatThrownBy(() -> categoryService.delete(1L))
                .isInstanceOf(BusinessException.class)
                .hasMessage("该分类下仍有商品，无法删除");
        verify(categoryRepository, never()).delete(any());
    }

    @Test
    @DisplayName("删除没有商品的分类成功")
    void deleteSuccess() {
        Category category = TestFixtures.category(3, "其他");
        when(categoryRepository.findById(3L)).thenReturn(Optional.of(category));
        when(goodsRepository.existsByCategoryId(3L)).thenReturn(false);

        categoryService.delete(3L);

        verify(categoryRepository).delete(category);
    }
}
