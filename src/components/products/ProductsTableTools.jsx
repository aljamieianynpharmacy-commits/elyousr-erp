import React, { useRef, useState, useEffect } from 'react';
import { GRID_COLUMNS } from '../../utils/productUtils';

const ProductsTableTools = React.memo(({
    allVisibleSelected,
    onToggleVisible,
    displayedCount,
    selectedCount,
    visibleColumnKeys,
    onToggleColumnVisibility,
    showSearchRow,
    onToggleSearchRow
}) => {
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const columnsMenuRef = useRef(null);

    useEffect(() => {
        const onClickOutside = (event) => {
            if (!columnsMenuRef.current) return;
            if (!columnsMenuRef.current.contains(event.target)) {
                setShowColumnMenu(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    return (
        <div className="products-table-tools">
            <label className="check-control">
                <input type="checkbox" checked={allVisibleSelected} onChange={onToggleVisible} /> تحديد الكل
            </label>
            <span>الظاهر: {displayedCount}</span>
            <span>المحدد: {selectedCount}</span>
            <div className="columns-control" ref={columnsMenuRef}>
                <button
                    type="button"
                    className="products-btn products-btn-light columns-trigger"
                    onClick={() => setShowColumnMenu((prev) => !prev)}
                >
                    <span>الأعمدة</span>
                    <span>▼</span>
                </button>
                {showColumnMenu ? (
                    <div className="columns-menu">
                        <label className="column-option">
                            <input
                                type="checkbox"
                                checked={showSearchRow}
                                onChange={() => {
                                    onToggleSearchRow();
                                    setShowColumnMenu(false);
                                }}
                            />
                            <span style={{ marginRight: '2px' }}>🔍</span>
                            <span>بحث متقدم</span>
                        </label>
                        <div className="columns-menu-divider" />
                        {GRID_COLUMNS.filter((column) => !column.required).map((column) => (
                            <label key={column.key} className="column-option">
                                <input
                                    type="checkbox"
                                    checked={visibleColumnKeys.includes(column.key)}
                                    onChange={() => onToggleColumnVisibility(column.key)}
                                />
                                <span>{column.label}</span>
                            </label>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
});

ProductsTableTools.displayName = 'ProductsTableTools';
export default ProductsTableTools;
