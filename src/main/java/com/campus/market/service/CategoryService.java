package com.campus.market.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campus.market.common.BusinessException;
import com.campus.market.dto.CategoryRequest;
import com.campus.market.dto.CategoryVO;
import com.campus.market.entity.Category;
import com.campus.market.repository.CategoryRepository;
import com.campus.market.repository.GoodsRepository;

/**
 * 商品分类管理。
 */
@Service
@Transactional
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final GoodsRepository goodsRepository;

    public CategoryService(CategoryRepository categoryRepository, GoodsRepository goodsRepository) {
        this.categoryRepository = categoryRepository;
        this.goodsRepository = goodsRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryVO> listAll() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : goodsRepository.countGroupByCategory()) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return categoryRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(c -> CategoryVO.from(c, counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    public CategoryVO create(CategoryRequest request) {
        String name = request.name().trim();
        if (categoryRepository.existsByName(name)) {
            throw BusinessException.conflict("分类名称已存在");
        }
        Category category = new Category();
        apply(category, request);
        return CategoryVO.from(categoryRepository.save(category), 0);
    }

    public CategoryVO update(Long id, CategoryRequest request) {
        Category category = getEntity(id);
        if (categoryRepository.existsByNameAndIdNot(request.name().trim(), id)) {
            throw BusinessException.conflict("分类名称已存在");
        }
        apply(category, request);
        return CategoryVO.from(category, 0);
    }

    public void delete(Long id) {
        Category category = getEntity(id);
        if (goodsRepository.existsByCategoryId(id)) {
            throw BusinessException.conflict("该分类下仍有商品，无法删除");
        }
        categoryRepository.delete(category);
    }

    @Transactional(readOnly = true)
    public Category getEntity(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("分类不存在"));
    }

    private void apply(Category category, CategoryRequest request) {
        category.setName(request.name().trim());
        category.setIcon(request.icon());
        category.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
    }
}
