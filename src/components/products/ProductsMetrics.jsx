import React from 'react';

const ProductsMetrics = React.memo(({ metrics }) => (
    <section className="products-metrics">
        <article className="products-metric-card tone-main">
            <div className="icon-wrap">📦</div>
            <div><h3>إجمالي الأصناف</h3><strong>{metrics.productsCount}</strong></div>
        </article>
        <article className="products-metric-card tone-blue">
            <div className="icon-wrap">🧩</div>
            <div><h3>متغيرات الصفحة</h3><strong>{metrics.variantsCount}</strong></div>
        </article>
        <article className="products-metric-card tone-green">
            <div className="icon-wrap">🏪</div>
            <div><h3>إجمالي المخزون</h3><strong>{metrics.stockTotal}</strong></div>
        </article>
        <article className="products-metric-card tone-amber">
            <div className="icon-wrap">⚠️</div>
            <div><h3>منخفض/نافد</h3><strong>{metrics.lowStockCount}</strong></div>
        </article>
    </section>
));

ProductsMetrics.displayName = 'ProductsMetrics';
export default ProductsMetrics;
