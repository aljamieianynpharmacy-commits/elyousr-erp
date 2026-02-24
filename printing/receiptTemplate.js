/**
 * Payment Receipt Print Template
 * Returns pure HTML string for printing
 */

import { CustomerLedgerService } from '../src/services/customerLedgerService';

export const generateReceiptHTML = (payment, customer) => {
  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال دفع رقم ${payment.id}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      padding: 20px; 
      direction: rtl; 
      max-width: 600px; 
      margin: 0 auto; 
    }
    .header { 
      text-align: center; 
      border: 2px solid #000; 
      padding: 20px; 
      margin-bottom: 20px; 
    }
    .header h1 { margin: 0 0 10px 0; font-size: 24px; }
    .header h2 { margin: 0; font-size: 18px; color: #333; }
    .content { 
      border: 1px solid #000; 
      padding: 20px; 
    }
    .row { 
      display: flex; 
      justify-content: space-between; 
      margin: 10px 0; 
      padding: 10px; 
      border-bottom: 1px dashed #ccc; 
    }
    .row:last-child { border-bottom: none; }
    .amount { 
      font-size: 24px; 
      font-weight: bold; 
      color: #10b981; 
      text-align: center; 
      margin: 20px 0; 
      padding: 15px; 
      background: #f0fdf4; 
      border-radius: 8px; 
    }
    .amount span { 
      font-size: 14px; 
      color: #6b7280; 
      display: block;
      margin-top: 5px;
    }
    .footer { 
      text-align: center; 
      margin-top: 30px; 
    }
    .signature { 
      margin-top: 50px; 
      font-size: 14px;
    }
    .print-button {
      padding: 12px 30px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      margin: 10px;
    }
    .print-button:hover {
      background: #059669;
    }
    @media print { 
      body { padding: 10px; }
      .print-button { display: none; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚡ ERP SYSTEM</h1>
    <h2>إيصال دفع / سند قبض</h2>
  </div>
  
  <div class="content">
    <div class="row">
      <strong>رقم الإيصال:</strong>
      <span>${payment.id}</span>
    </div>
    
    <div class="row">
      <strong>التاريخ:</strong>
      <span>${new Date(payment.createdAt).toLocaleDateString('ar-EG')} - ${new Date(payment.createdAt).toLocaleTimeString('ar-EG')}</span>
    </div>
    
    <div class="row">
      <strong>استلمنا من السيد/ة:</strong>
      <span>${customer?.name || '-'}</span>
    </div>
    
    <div class="row">
      <strong>الهاتف:</strong>
      <span>${customer?.phone || '-'}</span>
    </div>
    
    <div class="amount">
      المبلغ المستلم: ${payment.amount.toFixed(2)} ج.م
      <span>(${CustomerLedgerService.numberToArabicWords(payment.amount)} جنيهاً مصرياً)</span>
    </div>
    
    ${payment.notes ? `
      <div class="row">
        <strong>ملاحظات:</strong>
        <span>${payment.notes}</span>
      </div>
    ` : ''}
    
    <div class="row">
      <strong>الرصيد المتبقي:</strong>
      <span style="color: ${(customer?.balance || 0) > 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">
        ${(customer?.balance || 0).toFixed(2)} ج.م
      </span>
    </div>
  </div>
  
  <div class="footer">
    <p class="signature">التوقيع: _________________</p>
    <p style="font-size: 12px; color: #6b7280;">تم الطباعة في: ${new Date().toLocaleString('ar-EG')}</p>
    <div class="no-print">
      <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint()}else{window.print()}">🖨️ طباعة الإيصال</button>
    </div>
  </div>
  
  <script>
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.triggerPrint) {
          window.electronAPI.triggerPrint();
        } else {
          window.print();
        }
      }
    });
  </script>
</body>
</html>
  `.trim();
};
