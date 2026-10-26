package com.campus.market.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.campus.market.entity.Category;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findAllByOrderBySortOrderAscIdAsc();

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);
}
