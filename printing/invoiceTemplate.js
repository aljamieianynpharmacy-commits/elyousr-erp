import {
  getCompanyPrintSettings,
  getDefaultInvoicePrintLayout,
  normalizeInvoicePrintLayout
} from '../src/utils/appSettings';
import { generateInvoiceA4HTML } from './invoiceA4Template';
import { generateInvoiceReceipt80HTML } from './invoiceReceipt80Template';

export const INVOICE_PRINT_LAYOUTS = Object.freeze({
  RECEIPT_80: 'receipt80',
  A4: 'a4'
});

export const resolveInvoicePrintLayout = (layout) => normalizeInvoicePrintLayout(
  layout || getDefaultInvoicePrintLayout()
);

export const generateInvoiceHTML = (sale, customer, options = {}) => {
  const company = options.company || getCompanyPrintSettings();
  const layout = resolveInvoicePrintLayout(options.layout);

  if (layout === INVOICE_PRINT_LAYOUTS.A4) {
    return generateInvoiceA4HTML({ sale, customer, company });
  }

  return generateInvoiceReceipt80HTML({ sale, customer, company });
};

export { generateInvoiceA4HTML, generateInvoiceReceipt80HTML };

