import React, { memo } from 'react';

const CustomersQuickStats = memo(function CustomersQuickStats({
    totalCount,
    vipCount,
    overdueCount,
    overdueThreshold,
    filteredCount
}) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>إجمالي العملاء</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{totalCount}</div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>عملاء VIP</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
                    {vipCount}
                </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#fef2f2', borderRadius: '8px', textAlign: 'center', border: '1px solid #fee2e2' }}>
                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '5px' }}>🔴 عملاء متأخرين</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
                    {overdueCount}
                </div>
                <div style={{ fontSize: '10px', color: '#ef4444' }}>مضى {overdueThreshold} يوم</div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>نتائج البحث</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#374151' }}>{filteredCount}</div>
            </div>
        </div>
    );
});

export default CustomersQuickStats;
