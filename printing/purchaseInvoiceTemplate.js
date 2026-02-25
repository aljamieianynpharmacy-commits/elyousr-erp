import {
  getCompanyPrintSettings,
  getDefaultPurchaseInvoicePrintLayout,
  normalizeInvoicePrintLayout
} from '../src/utils/appSettings';
import { generatePurchaseInvoiceA4HTML } from './purchaseInvoiceA4Template';
import { generatePurchaseInvoiceReceipt80HTML } from './purchaseInvoiceReceipt80Template';

export const PURCHASE_INVOICE_PRINT_LAYOUTS = Object.freeze({
  RECEIPT_80: 'receipt80',
  A4: 'a4'
});

export const resolvePurchaseInvoicePrintLayout = (layout) => normalizeInvoicePrintLayout(
  layout || getDefaultPurchaseInvoicePrintLayout()
);

export const generatePurchaseInvoiceHTML = (purchase, options = {}) => {
  const company = options.company || getCompanyPrintSettings();
  const layout = resolvePurchaseInvoicePrintLayout(options.layout);

  if (layout === PURCHASE_INVOICE_PRINT_LAYOUTS.A4) {
    return generatePurchaseInvoiceA4HTML({ purchase, company });
  }

  return generatePurchaseInvoiceReceipt80HTML({ purchase, company });
};

export { generatePurchaseInvoiceA4HTML, generatePurchaseInvoiceReceipt80HTML };

