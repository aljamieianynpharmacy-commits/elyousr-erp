const POS_ALLOWED_PAYMENT_CODES = new Set([
  'CASH',
  'VODAFONE_CASH',
  'INSTAPAY'
]);

const PAYMENT_CODE_ALIASES = {
  cash: 'CASH',
  نقدي: 'CASH',
  كاش: 'CASH',
  vodafonecash: 'VODAFONE_CASH',
  فودافونكاش: 'VODAFONE_CASH',
  instapay: 'INSTAPAY',
  انستاباي: 'INSTAPAY'
};

const normalizeAliasKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

export const normalizePaymentMethodCode = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const byAlias = PAYMENT_CODE_ALIASES[normalizeAliasKey(trimmed)];
  if (byAlias) return byAlias;

  return trimmed
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
};

export const filterPosPaymentMethods = (methods) => {
  if (!Array.isArray(methods)) return [];

  return methods.filter((method) => {
    const code = normalizePaymentMethodCode(method?.code || method?.name);
    return POS_ALLOWED_PAYMENT_CODES.has(code);
  });
};

