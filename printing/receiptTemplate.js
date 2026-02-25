import {
  getCompanyPrintSettings,
  getDefaultPaymentReceiptPrintLayout,
  normalizeInvoicePrintLayout
} from '../src/utils/appSettings';
import { generatePaymentReceiptA4HTML } from './paymentReceiptA4Template';
import { generatePaymentReceipt80HTML } from './paymentReceipt80Template';

export const PAYMENT_RECEIPT_PRINT_LAYOUTS = Object.freeze({
  RECEIPT_80: 'receipt80',
  A4: 'a4'
});

export const resolvePaymentReceiptPrintLayout = (layout) => normalizeInvoicePrintLayout(
  layout || getDefaultPaymentReceiptPrintLayout()
);

export const generateReceiptHTML = (payment, customer, options = {}) => {
  const company = options.company || getCompanyPrintSettings();
  const layout = resolvePaymentReceiptPrintLayout(options.layout);

  if (layout === PAYMENT_RECEIPT_PRINT_LAYOUTS.A4) {
    return generatePaymentReceiptA4HTML({ payment, customer, company });
  }

  return generatePaymentReceipt80HTML({ payment, customer, company });
};

export { generatePaymentReceiptA4HTML, generatePaymentReceipt80HTML };

