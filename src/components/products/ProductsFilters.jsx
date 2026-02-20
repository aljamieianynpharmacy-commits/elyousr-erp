import React from 'react';
import { SORT_PRESETS } from '../../utils/productUtils';

const ProductsFilters = React.memo(({
    searchTerm,
    onSearchChange,
    categoryFilter,
    onCategoryFilterChange,
    stockFilter,
    onStockFilterChange,
    sortPreset,
    onSortPresetChange,
    categories,
    refreshing,
    searchLoading,
    onRefresh
}) => (
    <section className="products-filters">
        <label className="products-search">
            <span className="products-search-emoji">🔍</span>
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="ابحث بالاسم أو الكود أو الباركود"
            />
            {searchTerm ? (
                <button
                    type="button"
                    className="products-search-clear"
                    onClick={() => onSearchChange('')}
                    aria-label="مسح البحث"
                >
                    ✕
                </button>
            ) : null}
        </label>

        <select value={categoryFilter} onChange={(e) => onCategoryFilterChange(e.target.value)}>
            <option value="">كل الفئات</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon || '📦'} {c.name}</option>)}
        </select>

        <select value={stockFilter} onChange={(e) => onStockFilterChange(e.target.value)}>
            <option value="all">كل الحالات</option>
            <option value="available">متاح</option>
            <option value="low">منخفض</option>
            <option value="out">نافد</option>
        </select>

        <select value={sortPreset} onChange={(e) => onSortPresetChange(e.target.value)}>
            {SORT_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <button type="button" className="products-btn products-btn-light" onClick={onRefresh} disabled={refreshing || searchLoading}>
            <span className={refreshing || searchLoading ? 'spin' : ''}>🔄</span> تحديث
        </button>
    </section>
));

ProductsFilters.displayName = 'ProductsFilters';
export default ProductsFilters;
