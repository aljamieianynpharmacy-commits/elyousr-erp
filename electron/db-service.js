require('dotenv').config(); // Load .env file
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
const DEBUG_CUSTOMERS_QUERIES = process.env.DEBUG_CUSTOMERS_QUERIES === '1';
const ENABLE_PERF_LOGS = process.env.ENABLE_PERF_LOGS === '1';
const PERF_SLOW_QUERY_MS = Math.max(0, parseInt(process.env.PERF_SLOW_QUERY_MS || '250', 10) || 250);

const customerQueryLog = (...args) => {
    if (DEBUG_CUSTOMERS_QUERIES) {
        console.log(...args);
    }
};

const perfNow = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const startPerfTimer = (endpoint, params = {}) => {
    const startedAt = perfNow();
    return ({ rows = null, error = null } = {}) => {
        if (!ENABLE_PERF_LOGS) return;
        const durationMs = Number((perfNow() - startedAt).toFixed(2));
        if (!error && durationMs < PERF_SLOW_QUERY_MS) return;

        const payload = {
            endpoint,
            durationMs,
            rows,
            params
        };

        if (error) {
            console.warn('[PERF][ERROR]', payload, error?.message || error);
        } else {
            console.log('[PERF]', payload);
        }
    };
};

const parsePositiveInt = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toInteger = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeString = (value) => {
    const text = String(value ?? '').trim();
    return text || null;
};

const toMoney = (value, fallback = 0) => (
    Math.max(0, Number(toNumber(value, fallback).toFixed(2)))
);

const normalizeProductUnits = (units, baseSalePrice = 0, baseCostPrice = 0) => {
    if (!Array.isArray(units)) return [];

    return units
        .map((unit, index) => {
            const salePrice = toMoney(unit?.salePrice, baseSalePrice);
            const wholesalePrice = toMoney(Math.min(salePrice, toNumber(unit?.wholesalePrice, salePrice)), salePrice);
            const minSalePrice = toMoney(Math.min(salePrice, toNumber(unit?.minSalePrice, wholesalePrice)), wholesalePrice);
            const purchasePrice = toMoney(unit?.purchasePrice, baseCostPrice);

            return {
                unitName: normalizeString(unit?.unitName) || (index === 0 ? '\u0642\u0637\u0639\u0629' : null),
                conversionFactor: index === 0 ? 1 : Math.max(0.0001, toNumber(unit?.conversionFactor, 1)),
                salePrice,
                wholesalePrice,
                minSalePrice,
                purchasePrice,
                barcode: normalizeString(unit?.barcode)
            };
        })
        .filter((unit, index) => (
            index === 0
            || unit.unitName
            || unit.barcode
            || unit.salePrice > 0
            || unit.purchasePrice > 0
        ))
        .filter((unit) => unit.unitName);
};

const PRODUCT_CATEGORY_SELECT = {
    id: true,
    name: true,
    icon: true,
    color: true,
    description: true
};

const PRODUCT_INVENTORY_SELECT = {
    id: true,
    totalQuantity: true,
    minStock: true,
    maxStock: true,
    warehouseQty: true,
    displayQty: true,
    lastRestock: true,
    notes: true,
    updatedAt: true
};

const PRODUCT_UNIT_SELECT = {
    id: true,
    unitName: true,
    conversionFactor: true,
    salePrice: true,
    wholesalePrice: true,
    minSalePrice: true,
    purchasePrice: true,
    barcode: true,
    updatedAt: true
};

const PRODUCT_VARIANT_SELECT = {
    id: true,
    productSize: true,
    color: true,
    price: true,
    cost: true,
    quantity: true,
    barcode: true,
    updatedAt: true
};

const buildProductSelect = ({
    includeDescription = true,
    includeImage = true,
    includeCategory = true,
    includeInventory = true,
    includeProductUnits = true,
    includeVariants = true
} = {}) => ({
    id: true,
    name: true,
    ...(includeDescription ? { description: true } : {}),
    categoryId: true,
    brand: true,
    barcode: true,
    ...(includeImage ? { image: true } : {}),
    sku: true,
    basePrice: true,
    cost: true,
    isActive: true,
    type: true,
    createdAt: true,
    updatedAt: true,
    ...(includeCategory ? { category: { select: PRODUCT_CATEGORY_SELECT } } : {}),
    ...(includeInventory ? { inventory: { select: PRODUCT_INVENTORY_SELECT } } : {}),
    ...(includeProductUnits ? { productUnits: { select: PRODUCT_UNIT_SELECT } } : {}),
    ...(includeVariants ? { variants: { select: PRODUCT_VARIANT_SELECT } } : {})
});

const isPrismaDecimalLike = (value) => (
    value
    && typeof value === 'object'
    && typeof value.toNumber === 'function'
    && typeof value.toString === 'function'
    && Array.isArray(value.d)
    && typeof value.e === 'number'
    && typeof value.s === 'number'
);

const normalizeDecimalValues = (value, seen = new WeakMap()) => {
    if (value == null) return value;

    if (isPrismaDecimalLike(value)) {
        const asNumber = Number(value.toString());
        return Number.isFinite(asNumber) ? asNumber : value.toString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeDecimalValues(item, seen));
    }

    if (value instanceof Date || Buffer.isBuffer(value)) {
        return value;
    }

    if (typeof value === 'object') {
        if (seen.has(value)) return seen.get(value);

        const output = {};
        seen.set(value, output);
        Object.entries(value).forEach(([key, entry]) => {
            output[key] = normalizeDecimalValues(entry, seen);
        });
        return output;
    }

    return value;
};

const toValidDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
};

const pickEarlierDate = (a, b) => {
    const da = toValidDate(a);
    const db = toValidDate(b);
    if (da && db) return da < db ? da : db;
    return da || db || null;
};

const computeCustomerPaymentStatus = (firstActivityDate, lastPaymentDate, overdueThreshold) => {
    const start = toValidDate(firstActivityDate);
    const lastPayment = toValidDate(lastPaymentDate);
    const referenceDate = lastPayment || start;
    if (!referenceDate) {
        return { lastPaymentDays: 0, isOverdue: false };
    }
    const diffTime = Math.max(0, Date.now() - referenceDate.getTime());
    const lastPaymentDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
        lastPaymentDays,
        isOverdue: lastPaymentDays > overdueThreshold
    };
};

const isCreditSaleType = (saleType) => {
    const normalized = String(saleType || '').trim().toLowerCase();
    return (
        normalized === '\u0622\u062c\u0644' || // آجل
        normalized === '\u0627\u062c\u0644' || // اجل
        normalized === 'ø¢ø¬ù„' || // legacy mojibake value seen in some environments
        normalized === 'credit' ||
        normalized === 'deferred'
    );
};

const computeSaleOutstandingAmount = ({ total, discount = 0, paid = 0, saleType }) => {
    // `total` in POS payload is already net (after discounts), so do not subtract discount again.
    const netTotal = Math.max(0, toNumber(total));
    const paidAmount = Math.max(0, toNumber(paid));
    const remaining = Math.max(0, netTotal - paidAmount);

    if (remaining <= 0) return 0;
    if (isCreditSaleType(saleType)) return remaining;

    // Defensive fallback: if paid amount is missing/incorrect but there is remaining, keep receivable consistent.
    return remaining;
};

const parsePaymentDateInput = (value) => {
    if (!value) return new Date();

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsed = new Date(`${value}T00:00:00Z`);
        return Number.isFinite(parsed.getTime()) ? parsed : new Date();
    }

    const parsed = toValidDate(value);
    return parsed || new Date();
};

const PAYMENT_METHOD_CODE_ALIASES = {
    cash: 'CASH',
    نقدي: 'CASH',
    credit: 'CREDIT',
    deferred: 'CREDIT',
    اجل: 'CREDIT',
    آجل: 'CREDIT',
    visa: 'VISA',
    mastercard: 'MASTERCARD',
    banktransfer: 'BANK_TRANSFER',
    bank_transfer: 'BANK_TRANSFER',
    vodafonecash: 'VODAFONE_CASH',
    vodafone_cash: 'VODAFONE_CASH',
    فودافون: 'VODAFONE_CASH',
    فودافونكاش: 'VODAFONE_CASH',
    instapay: 'INSTAPAY',
    انستاباي: 'INSTAPAY',
    insta: 'INSTAPAY'
};

const normalizePaymentMethodLookup = (rawValue) => {
    const numeric = parsePositiveInt(rawValue);
    if (numeric) {
        return { id: numeric, rawName: null, code: null };
    }

    const rawName = String(rawValue || '').trim();
    if (!rawName) {
        return { id: null, rawName: null, code: null };
    }

    const normalizedKey = rawName
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[-_]/g, '');

    const aliasCode = PAYMENT_METHOD_CODE_ALIASES[normalizedKey];
    const fallbackCode = rawName
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');

    return {
        id: null,
        rawName,
        code: aliasCode || fallbackCode
    };
};

const resolvePaymentMethodId = async (txOrClient, rawValue, fallbackId = 1) => {
    const { id, rawName, code } = normalizePaymentMethodLookup(rawValue);

    if (id) {
        const byId = await txOrClient.paymentMethod.findFirst({
            where: { id, isActive: true },
            select: { id: true }
        });
        if (byId?.id) return byId.id;
    }

    if (rawName || code) {
        const filters = [];
        if (code) {
            filters.push({ code: { equals: code, mode: 'insensitive' } });
        }
        if (rawName) {
            filters.push({ name: { equals: rawName, mode: 'insensitive' } });
        }

        if (filters.length > 0) {
            const byCodeOrName = await txOrClient.paymentMethod.findFirst({
                where: {
                    isActive: true,
                    OR: filters
                },
                select: { id: true }
            });
            if (byCodeOrName?.id) return byCodeOrName.id;
        }
    }

    const fallbackNumeric = parsePositiveInt(fallbackId);
    if (fallbackNumeric) {
        const fallbackMethod = await txOrClient.paymentMethod.findFirst({
            where: { id: fallbackNumeric, isActive: true },
            select: { id: true }
        });
        if (fallbackMethod?.id) return fallbackMethod.id;
    }

    const firstActive = await txOrClient.paymentMethod.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
    });

    return firstActive?.id || null;
};

const applyCustomerFinancialDelta = async (tx, {
    customerId,
    balanceDelta = 0,
    activityDate = null,
    paymentDate = null
} = {}) => {
    const parsedCustomerId = parsePositiveInt(customerId);
    if (!parsedCustomerId) return;

    const safeBalanceDelta = toNumber(balanceDelta, 0);
    const safeActivityDate = toValidDate(activityDate);
    const safePaymentDate = toValidDate(paymentDate);

    await tx.$executeRaw`
        UPDATE "Customer"
        SET
            "balance" = COALESCE("balance", 0) + ${safeBalanceDelta},
            "firstActivityDate" = CASE
                WHEN CAST(${safeActivityDate} AS TIMESTAMP) IS NULL THEN "firstActivityDate"
                WHEN "firstActivityDate" IS NULL OR "firstActivityDate" > CAST(${safeActivityDate} AS TIMESTAMP) THEN CAST(${safeActivityDate} AS TIMESTAMP)
                ELSE "firstActivityDate"
            END,
            "lastPaymentDate" = CASE
                WHEN CAST(${safePaymentDate} AS TIMESTAMP) IS NULL THEN "lastPaymentDate"
                WHEN "lastPaymentDate" IS NULL OR "lastPaymentDate" < CAST(${safePaymentDate} AS TIMESTAMP) THEN CAST(${safePaymentDate} AS TIMESTAMP)
                ELSE "lastPaymentDate"
            END,
            "financialsUpdatedAt" = NOW()
        WHERE "id" = ${parsedCustomerId}
    `;
};

const recalculateCustomerActivityDates = async (tx, customerId) => {
    const parsedCustomerId = parsePositiveInt(customerId);
    if (!parsedCustomerId) return null;

    const [saleAgg, paymentMinAgg, paymentMaxAgg] = await Promise.all([
        tx.sale.aggregate({
            where: { customerId: parsedCustomerId },
            _min: { invoiceDate: true }
        }),
        tx.customerPayment.aggregate({
            where: { customerId: parsedCustomerId },
            _min: { paymentDate: true }
        }),
        tx.customerPayment.aggregate({
            where: { customerId: parsedCustomerId },
            _max: { paymentDate: true }
        })
    ]);

    const firstActivityDate = pickEarlierDate(
        saleAgg?._min?.invoiceDate || null,
        paymentMinAgg?._min?.paymentDate || null,
    );
    const lastPaymentDate = paymentMaxAgg?._max?.paymentDate || null;

    await tx.customer.update({
        where: { id: parsedCustomerId },
        data: {
            firstActivityDate,
            lastPaymentDate,
            financialsUpdatedAt: new Date()
        }
    });

    return { firstActivityDate, lastPaymentDate };
};

const calculateCustomerFinancialSummaries = async (txOrClient, customerIds = []) => {

    const ids = [...new Set(
        customerIds
            .map((id) => parseInt(id, 10))
            .filter((id) => Number.isFinite(id) && id > 0),
    )];

    if (ids.length === 0) return new Map();

    const [balances, paymentStats, saleStats] = await Promise.all([
        txOrClient.customerTransaction.groupBy({
            by: ['customerId'],
            _sum: {
                debit: true,
                credit: true
            },
            where: {
                customerId: { in: ids }
            }
        }),
        txOrClient.customerPayment.groupBy({
            by: ['customerId'],
            _max: { paymentDate: true },
            _min: { paymentDate: true },
            where: { customerId: { in: ids } }
        }),
        txOrClient.sale.groupBy({
            by: ['customerId'],
            _min: { invoiceDate: true },
            where: { customerId: { in: ids } }
        })
    ]);

    const balanceMap = new Map();
    balances.forEach((entry) => {
        balanceMap.set(
            entry.customerId,
            (entry._sum.debit || 0) - (entry._sum.credit || 0),
        );
    });

    const paymentMap = new Map();
    paymentStats.forEach((entry) => {
        paymentMap.set(entry.customerId, {
            firstPaymentDate: entry._min.paymentDate || null,
            lastPaymentDate: entry._max.paymentDate || null
        });
    });

    const saleMap = new Map();
    saleStats.forEach((entry) => {
        saleMap.set(entry.customerId, entry._min.invoiceDate || null);
    });

    const financialsUpdatedAt = new Date();
    const updates = ids.map((customerId) => {
        const paymentInfo = paymentMap.get(customerId);
        const firstPaymentDate = paymentInfo?.firstPaymentDate || null;
        const firstSaleDate = saleMap.get(customerId) || null;
        const firstActivityDate = pickEarlierDate(firstSaleDate, firstPaymentDate);
        const lastPaymentDate = paymentInfo?.lastPaymentDate || null;

        return {
            customerId,
            balance: balanceMap.get(customerId) || 0,
            firstActivityDate,
            lastPaymentDate,
            financialsUpdatedAt
        };
    });

    const summaryMap = new Map();
    updates.forEach((summary) => {
        summaryMap.set(summary.customerId, summary);
    });
    return summaryMap;
};

const persistCustomerFinancialSummaries = async (txOrClient, summaryMap) => {
    const updates = [...summaryMap.values()];
    if (updates.length === 0) return 0;

    const updateBatchSize = 50;
    for (let i = 0; i < updates.length; i += updateBatchSize) {
        const batch = updates.slice(i, i + updateBatchSize);
        await Promise.all(
            batch.map((summary) => txOrClient.customer.update({
                where: { id: summary.customerId },
                data: {
                    balance: summary.balance,
                    firstActivityDate: summary.firstActivityDate,
                    lastPaymentDate: summary.lastPaymentDate,
                    financialsUpdatedAt: summary.financialsUpdatedAt
                }
            })),
        );
    }

    return updates.length;
};

const rebuildCustomerFinancialSummary = async (txOrClient, customerId) => {
    const summaryMap = await calculateCustomerFinancialSummaries(txOrClient, [customerId]);
    await persistCustomerFinancialSummaries(txOrClient, summaryMap);
    return summaryMap.get(parseInt(customerId, 10)) || null;
};

const TREASURY_DEFAULT_CODE = 'MAIN';
const TREASURY_DIRECTION = Object.freeze({
    IN: 'IN',
    OUT: 'OUT'
});
const TREASURY_ENTRY_TYPE = Object.freeze({
    OPENING_BALANCE: 'OPENING_BALANCE',
    SALE_INCOME: 'SALE_INCOME',
    CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
    DEPOSIT_IN: 'DEPOSIT_IN',
    DEPOSIT_REFUND: 'DEPOSIT_REFUND',
    MANUAL_IN: 'MANUAL_IN',
    EXPENSE_PAYMENT: 'EXPENSE_PAYMENT',
    PURCHASE_PAYMENT: 'PURCHASE_PAYMENT',
    SUPPLIER_PAYMENT: 'SUPPLIER_PAYMENT',
    RETURN_REFUND: 'RETURN_REFUND',
    MANUAL_OUT: 'MANUAL_OUT',
    TRANSFER_IN: 'TRANSFER_IN',
    TRANSFER_OUT: 'TRANSFER_OUT',
    ADJUSTMENT_IN: 'ADJUSTMENT_IN',
    ADJUSTMENT_OUT: 'ADJUSTMENT_OUT'
});
const TREASURY_ENTRY_TYPE_SET = new Set(Object.values(TREASURY_ENTRY_TYPE));
const TREASURY_REVENUE_ENTRY_TYPES = new Set([
    TREASURY_ENTRY_TYPE.SALE_INCOME,
    TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT,
    TREASURY_ENTRY_TYPE.DEPOSIT_IN,
    TREASURY_ENTRY_TYPE.DEPOSIT_REFUND
]);
const TREASURY_CASH_ENTRY_TYPES = new Set(Object.values(TREASURY_ENTRY_TYPE));
const PAYMENT_ALLOCATION_SOURCE_TYPE = Object.freeze({
    CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
    DEPOSIT: 'DEPOSIT'
});
const REFUND_MODE = Object.freeze({
    SAME_METHOD: 'SAME_METHOD',
    CASH_ONLY: 'CASH_ONLY'
});
const AUDIT_ACTION = Object.freeze({
    TREASURY_CREATE: 'TREASURY_CREATE',
    TREASURY_UPDATE: 'TREASURY_UPDATE',
    TREASURY_DELETE: 'TREASURY_DELETE',
    TREASURY_DEFAULT_SET: 'TREASURY_DEFAULT_SET',
    TREASURY_ENTRY_CREATE: 'TREASURY_ENTRY_CREATE',
    TREASURY_ENTRY_ROLLBACK: 'TREASURY_ENTRY_ROLLBACK',
    DEPOSIT_RECEIPT_CREATE: 'DEPOSIT_RECEIPT_CREATE',
    DEPOSIT_APPLY_TO_SALE: 'DEPOSIT_APPLY_TO_SALE',
    DEPOSIT_REFUND: 'DEPOSIT_REFUND',
    PAYMENT_ALLOCATION_CREATE: 'PAYMENT_ALLOCATION_CREATE'
});

const normalizeReportPaymentCode = (value) => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const resolveReportPaymentMethodCode = (paymentMethod = null) => {
    const lookup = normalizePaymentMethodLookup(
        paymentMethod?.code || paymentMethod?.name || null
    );
    const directCode = normalizeReportPaymentCode(paymentMethod?.code || paymentMethod?.name || '');
    const resolvedCode = normalizeReportPaymentCode(lookup?.code || directCode || 'UNSPECIFIED');
    return resolvedCode || 'UNSPECIFIED';
};

const resolveRevenueChannelFromCode = (code) => {
    const normalizedCode = normalizeReportPaymentCode(code);
    if (normalizedCode === 'CASH') return 'cash';
    if (normalizedCode === 'VODAFONE_CASH') return 'vodafoneCash';
    if (normalizedCode === 'INSTAPAY') return 'instaPay';
    return 'other';
};

const normalizeTreasuryCode = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return null;

    const normalized = raw
        .replace(/[\s-]+/g, '_')
        .replace(/[^\p{L}\p{N}_]/gu, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || null;
};

const generateTreasuryCode = () => {
    const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
    return `TRS_${suffix.toUpperCase()}`;
};

const parseDateOrDefault = (value, fallback = new Date()) => {
    if (!value) return fallback;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsedDate = new Date(`${value}T00:00:00`);
        return Number.isFinite(parsedDate.getTime()) ? parsedDate : fallback;
    }
    const parsedDate = toValidDate(value);
    return parsedDate || fallback;
};

const startOfDay = (value) => {
    const date = parseDateOrDefault(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const endOfDay = (value) => {
    const date = parseDateOrDefault(value);
    date.setHours(23, 59, 59, 999);
    return date;
};

const setDefaultTreasuryInternal = async (txOrClient, treasuryId, { forceActivate = true } = {}) => {
    const parsedTreasuryId = parsePositiveInt(treasuryId);
    if (!parsedTreasuryId) {
        return { error: 'Invalid treasuryId' };
    }

    const existing = await txOrClient.treasury.findUnique({
        where: { id: parsedTreasuryId },
        select: {
            id: true,
            isActive: true,
            isDeleted: true
        }
    });
    if (!existing) {
        return { error: 'Treasury not found' };
    }
    if (existing.isDeleted) {
        return { error: 'Cannot set deleted treasury as default' };
    }

    await txOrClient.treasury.updateMany({
        where: {
            isDefault: true,
            isDeleted: false,
            id: { not: parsedTreasuryId }
        },
        data: { isDefault: false },
    });

    const updateData = { isDefault: true };
    if (forceActivate) updateData.isActive = true;

    const treasury = await txOrClient.treasury.update({
        where: { id: parsedTreasuryId },
        data: updateData
    });

    return { success: true, treasury };
};

const pickDefaultTreasuryCandidate = async (txOrClient, { allowInactive = false } = {}) => {
    const explicitDefault = await txOrClient.treasury.findFirst({
        where: { isDefault: true, isDeleted: false },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, isActive: true }
    });
    if (explicitDefault?.id) return explicitDefault;

    const mainCodeDefault = await txOrClient.treasury.findFirst({
        where: { code: TREASURY_DEFAULT_CODE, isDeleted: false },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, isActive: true }
    });
    if (mainCodeDefault?.id) return mainCodeDefault;

    const activeTreasury = await txOrClient.treasury.findFirst({
        where: { isActive: true, isDeleted: false },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, isActive: true }
    });
    if (activeTreasury?.id) return activeTreasury;

    if (allowInactive) {
        const anyTreasury = await txOrClient.treasury.findFirst({
            where: { isDeleted: false },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true, isActive: true }
        });
        return anyTreasury || null;
    }

    const inactiveTreasury = await txOrClient.treasury.findFirst({
        where: { isDeleted: false },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, isActive: true }
    });
    return inactiveTreasury || null;
};

const getOrCreateDefaultTreasury = async (txOrClient, { allowInactive = false } = {}) => {
    let candidate = await pickDefaultTreasuryCandidate(txOrClient, { allowInactive });
    if (!candidate) {
        candidate = await txOrClient.treasury.create({
            data: {
                name: 'Main Treasury',
                code: TREASURY_DEFAULT_CODE,
                description: 'Auto-created default treasury',
                openingBalance: 0,
                currentBalance: 0,
                isActive: true,
                isDefault: false,
                isDeleted: false
            },
            select: { id: true, isActive: true }
        });
    }

    const defaultResult = await setDefaultTreasuryInternal(txOrClient, candidate.id, {
        forceActivate: !allowInactive
    });
    if (defaultResult?.error) {
        throw new Error(defaultResult.error);
    }
    return defaultResult.treasury;
};

const resolveTreasuryId = async (txOrClient, rawTreasuryId = null, { allowInactive = false } = {}) => {
    const parsedTreasuryId = parsePositiveInt(rawTreasuryId);
    if (parsedTreasuryId) {
        const treasury = await txOrClient.treasury.findFirst({
            where: {
                id: parsedTreasuryId,
                isDeleted: false,
                ...(allowInactive ? {} : { isActive: true })
            },
            select: { id: true }
        });
        if (treasury?.id) return treasury.id;
    }

    const fallbackTreasury = await getOrCreateDefaultTreasury(txOrClient, { allowInactive: false });
    return fallbackTreasury.id;
};

const getTreasuryOperationLinkStats = async (txOrClient, treasuryId) => {
    const parsedTreasuryId = parsePositiveInt(treasuryId);
    if (!parsedTreasuryId) {
        return {
            nonOpeningEntryCount: 0,
            hasLinkedOperations: false
        };
    }

    const nonOpeningEntryCount = await txOrClient.treasuryEntry.count({
        where: {
            treasuryId: parsedTreasuryId,
            entryType: { not: TREASURY_ENTRY_TYPE.OPENING_BALANCE }
        }
    });

    return {
        nonOpeningEntryCount,
        hasLinkedOperations: nonOpeningEntryCount > 0
    };
};

const normalizeIdempotencyKey = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    return raw.slice(0, 191);
};

const hashToSignedInt = (value) => {
    const digest = crypto
        .createHash('sha256')
        .update(String(value || ''))
        .digest('hex')
        .slice(0, 8);
    let parsed = Number.parseInt(digest, 16);
    if (!Number.isFinite(parsed)) parsed = 0;
    if (parsed > 0x7fffffff) parsed -= 0x100000000;
    return parsed;
};

const generateIdempotencyKey = (prefix, parts = []) => {
    const normalizedPrefix = String(prefix || 'GEN').trim().toUpperCase();
    const serializedParts = Array.isArray(parts) ? parts : [parts];
    const payload = serializedParts
        .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
        .join('|');
    const hash = crypto.createHash('sha256').update(`${normalizedPrefix}|${payload}`).digest('hex');
    return normalizeIdempotencyKey(`${normalizedPrefix}:${hash}`);
};

const acquireIdempotencyLock = async (tx, idempotencyKey) => {
    const normalized = normalizeIdempotencyKey(idempotencyKey);
    if (!normalized) return null;
    const advisoryKey = hashToSignedInt(normalized);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryKey})`;
    return normalized;
};

const toDayLockDate = (value) => startOfDay(value);

const writeAuditLog = async (txOrClient, payload = {}) => {
    try {
        await txOrClient.auditLog.create({
            data: {
                action: String(payload?.action || 'UNKNOWN'),
                entityType: String(payload?.entityType || 'UNKNOWN'),
                entityId: payload?.entityId !== undefined && payload?.entityId !== null
                    ? String(payload.entityId)
                    : null,
                treasuryId: parsePositiveInt(payload?.treasuryId),
                treasuryEntryId: parsePositiveInt(payload?.treasuryEntryId),
                referenceType: payload?.referenceType ? String(payload.referenceType) : null,
                referenceId: parsePositiveInt(payload?.referenceId),
                performedByUserId: parsePositiveInt(payload?.performedByUserId),
                note: payload?.note ? String(payload.note) : null,
                meta: payload?.meta ?? null
            }
        });
    } catch (error) {
        // Keep business flow non-blocking if audit insert fails.
        console.warn('Audit log write failed:', error?.message || error);
    }
};

const resolveCashPaymentMethodId = async (txOrClient, fallbackId = 1) => {
    const cashMethod = await txOrClient.paymentMethod.findFirst({
        where: {
            isActive: true,
            OR: [
                { code: { equals: 'CASH', mode: 'insensitive' } },
                { name: { equals: 'cash', mode: 'insensitive' } },
                { name: { equals: 'نقدي', mode: 'insensitive' } }
            ]
        },
        select: { id: true }
    });
    if (cashMethod?.id) return cashMethod.id;
    return resolvePaymentMethodId(txOrClient, 'CASH', fallbackId);
};

const lockTreasuryForUpdate = async (tx, treasuryId) => {
    const parsedTreasuryId = parsePositiveInt(treasuryId);
    if (!parsedTreasuryId) return null;
    const rows = await tx.$queryRaw`
        SELECT "id", "currentBalance", "isActive"
        FROM "Treasury"
        WHERE "id" = ${parsedTreasuryId}
        FOR UPDATE
    `;
    return rows?.[0] || null;
};

const normalizeAmountForKey = (value) => Number(Math.max(0, toNumber(value, 0)).toFixed(2)).toFixed(2);

const normalizeSplitPaymentsInput = (rows = []) => (
    Array.isArray(rows)
        ? rows
            .map((row, index) => ({
                index,
                rawPaymentMethodId: row?.paymentMethodId ?? row?.methodId ?? row?.paymentMethod,
                amount: Math.max(0, toNumber(row?.amount)),
                note: row?.note ? String(row.note) : null
            }))
            .filter((row) => row.amount > 0)
        : []
);

const resolvePaymentSplits = async (
    tx,
    {
        splitPayments = [],
        fallbackPaymentMethodId = 1,
        totalAmount = 0
    } = {},
) => {
    const safeTotalAmount = Math.max(0, toNumber(totalAmount));
    if (safeTotalAmount <= 0) return [];

    const normalizedSplits = normalizeSplitPaymentsInput(splitPayments);
    if (normalizedSplits.length === 0) {
        const resolvedMethod = await resolvePaymentMethodId(tx, fallbackPaymentMethodId, 1);
        return [{
            index: 0,
            paymentMethodId: resolvedMethod,
            amount: safeTotalAmount,
            note: null
        }];
    }

    const resolvedSplits = [];
    for (const split of normalizedSplits) {
        const paymentMethodId = await resolvePaymentMethodId(tx, split.rawPaymentMethodId, fallbackPaymentMethodId || 1);
        if (!paymentMethodId) {
            return { error: 'Invalid payment method in split payments' };
        }
        resolvedSplits.push({
            index: split.index,
            paymentMethodId,
            amount: split.amount,
            note: split.note
        });
    }

    const splitTotal = resolvedSplits.reduce((sum, row) => sum + row.amount, 0);
    const roundedSplitTotal = Number(splitTotal.toFixed(2));
    const roundedTargetTotal = Number(safeTotalAmount.toFixed(2));
    if (Math.abs(roundedSplitTotal - roundedTargetTotal) > 0.01) {
        return { error: 'Split payment total does not match paid amount' };
    }

    return resolvedSplits;
};

const getSaleOutstandingRowsForAllocation = async (
    txOrClient,
    customerId,
    { customerBalanceOverride = null } = {},
) => {
    const parsedCustomerId = parsePositiveInt(customerId);
    if (!parsedCustomerId) return [];

    const sales = await txOrClient.sale.findMany({
        where: { customerId: parsedCustomerId },
        select: {
            id: true,
            invoiceDate: true,
            createdAt: true
        },
        orderBy: [
            { invoiceDate: 'asc' },
            { id: 'asc' }
        ]
    });

    if (sales.length === 0) return [];
    const saleIds = sales.map((sale) => sale.id);

    const [saleTransactions, allocationsAgg, customer] = await Promise.all([
        txOrClient.customerTransaction.groupBy({
            by: ['referenceId'],
            where: {
                customerId: parsedCustomerId,
                referenceType: 'SALE',
                referenceId: { in: saleIds }
            },
            _sum: {
                debit: true,
                credit: true
            }
        }),
        txOrClient.paymentAllocation.groupBy({
            by: ['saleId'],
            where: { saleId: { in: saleIds } },
            _sum: { amount: true }
        }),
        txOrClient.customer.findUnique({
            where: { id: parsedCustomerId },
            select: { balance: true }
        })
    ]);

    const outstandingBySaleId = new Map();
    saleTransactions.forEach((row) => {
        const saleId = parsePositiveInt(row.referenceId);
        if (!saleId) return;
        const outstanding = Math.max(0, toNumber(row?._sum?.debit) - toNumber(row?._sum?.credit));
        outstandingBySaleId.set(saleId, outstanding);
    });

    const allocationBySaleId = new Map();
    allocationsAgg.forEach((row) => {
        const saleId = parsePositiveInt(row.saleId);
        if (!saleId) return;
        allocationBySaleId.set(saleId, Math.max(0, toNumber(row?._sum?.amount)));
    });

    const rows = sales
        .map((sale) => {
            const baseOutstanding = Math.max(0, toNumber(outstandingBySaleId.get(sale.id)));
            const allocated = Math.max(0, toNumber(allocationBySaleId.get(sale.id)));
            const outstanding = Math.max(0, Number((baseOutstanding - allocated).toFixed(2)));
            return {
                saleId: sale.id,
                invoiceDate: sale.invoiceDate || sale.createdAt || new Date(),
                outstanding
            };
        })
        .filter((row) => row.outstanding > 0)
        .sort((a, b) => (
            a.invoiceDate.getTime() - b.invoiceDate.getTime() || a.saleId - b.saleId
        ));

    const referenceBalance = Math.max(
        0,
        toNumber(customerBalanceOverride, toNumber(customer?.balance, 0))
    );
    const rawOutstandingTotal = rows.reduce((sum, row) => sum + row.outstanding, 0);
    let settledWithoutAllocation = Math.max(0, Number((rawOutstandingTotal - referenceBalance).toFixed(2)));
    if (settledWithoutAllocation > 0) {
        for (const row of rows) {
            if (settledWithoutAllocation <= 0) break;
            const reduction = Math.min(row.outstanding, settledWithoutAllocation);
            row.outstanding = Number((row.outstanding - reduction).toFixed(2));
            settledWithoutAllocation = Number((settledWithoutAllocation - reduction).toFixed(2));
        }
    }

    return rows.filter((row) => row.outstanding > 0);
};

const applyAllocationsFromOutstandingRows = async (
    tx,
    {
        outstandingRows = [],
        sourceType,
        amount,
        customerId = null,
        customerPaymentId = null,
        treasuryEntryId = null,
        createdByUserId = null,
        note = null,
        allocationDate = new Date()
    } = {},
) => {
    let remaining = Math.max(0, toNumber(amount));
    if (remaining <= 0) return [];

    const allocations = [];
    for (const row of outstandingRows) {
        if (remaining <= 0) break;
        const outstanding = Math.max(0, toNumber(row?.outstanding));
        if (outstanding <= 0) continue;

        const allocated = Number(Math.min(remaining, outstanding).toFixed(2));
        if (allocated <= 0) continue;

        const createdAllocation = await tx.paymentAllocation.create({
            data: {
                customerId: parsePositiveInt(customerId),
                saleId: row.saleId,
                sourceType,
                customerPaymentId: parsePositiveInt(customerPaymentId),
                treasuryEntryId: parsePositiveInt(treasuryEntryId),
                amount: allocated,
                allocationDate: parseDateOrDefault(allocationDate, new Date()),
                createdByUserId: parsePositiveInt(createdByUserId),
                note: note || null
            }
        });

        row.outstanding = Number((outstanding - allocated).toFixed(2));
        remaining = Number((remaining - allocated).toFixed(2));
        allocations.push(createdAllocation);
    }

    return allocations;
};

const createTreasuryEntry = async (tx, {
    treasuryId = null,
    entryType = TREASURY_ENTRY_TYPE.MANUAL_IN,
    direction = TREASURY_DIRECTION.IN,
    amount = 0,
    notes = null,
    note = null,
    referenceType = null,
    referenceId = null,
    paymentMethodId = null,
    sourceTreasuryId = null,
    targetTreasuryId = null,
    entryDate = null,
    allowNegative = false,
    idempotencyKey = null,
    createdByUserId = null,
    meta = null
} = {}) => {
    const safeDirection = direction === TREASURY_DIRECTION.OUT
        ? TREASURY_DIRECTION.OUT
        : TREASURY_DIRECTION.IN;
    const safeAmount = Math.max(0, toNumber(amount));
    if (safeAmount <= 0) {
        return { error: 'Invalid treasury amount' };
    }

    const safeEntryDate = parseDateOrDefault(entryDate);
    const safeIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
    const includeRelations = {
        treasury: true,
        paymentMethod: true,
        sourceTreasury: true,
        targetTreasury: true
    };

    if (safeIdempotencyKey) {
        await acquireIdempotencyLock(tx, safeIdempotencyKey);
        const existingEntry = await tx.treasuryEntry.findUnique({
            where: { idempotencyKey: safeIdempotencyKey },
            include: includeRelations
        });
        if (existingEntry) {
            return { success: true, entry: existingEntry, idempotent: true };
        }
    }

    const resolvedTreasuryId = await resolveTreasuryId(tx, treasuryId);

    const treasury = await lockTreasuryForUpdate(tx, resolvedTreasuryId);
    if (!treasury) {
        return { error: 'Treasury not found' };
    }
    if (!treasury?.isActive) {
        return { error: 'Treasury is inactive' };
    }

    const balanceBefore = toNumber(treasury.currentBalance, 0);
    const delta = safeDirection === TREASURY_DIRECTION.IN ? safeAmount : -safeAmount;
    const balanceAfter = Number((balanceBefore + delta).toFixed(2));

    if (!allowNegative && safeDirection === TREASURY_DIRECTION.OUT && balanceAfter < -0.0001) {
        return { error: 'Insufficient treasury balance' };
    }

    await tx.treasury.update({
        where: { id: resolvedTreasuryId },
        data: { currentBalance: balanceAfter }
    });

    let entry;
    try {
        entry = await tx.treasuryEntry.create({
            data: {
                treasuryId: resolvedTreasuryId,
                entryType,
                direction: safeDirection,
                amount: safeAmount,
                balanceBefore,
                balanceAfter,
                notes: notes || note || null,
                note: note || notes || null,
                referenceType: referenceType || null,
                referenceId: parsePositiveInt(referenceId),
                paymentMethodId: parsePositiveInt(paymentMethodId),
                idempotencyKey: safeIdempotencyKey,
                createdByUserId: parsePositiveInt(createdByUserId),
                meta: meta ?? null,
                sourceTreasuryId: parsePositiveInt(sourceTreasuryId),
                targetTreasuryId: parsePositiveInt(targetTreasuryId),
                entryDate: safeEntryDate
            },
            include: includeRelations
        });
    } catch (error) {
        const duplicateByIdempotency = (
            safeIdempotencyKey &&
            error?.code === 'P2002'
        );
        if (duplicateByIdempotency) {
            const existingEntry = await tx.treasuryEntry.findUnique({
                where: { idempotencyKey: safeIdempotencyKey },
                include: includeRelations
            });
            if (existingEntry) {
                return { success: true, entry: existingEntry, idempotent: true };
            }
        }
        throw error;
    }

    await writeAuditLog(tx, {
        action: AUDIT_ACTION.TREASURY_ENTRY_CREATE,
        entityType: 'TreasuryEntry',
        entityId: entry.id,
        treasuryId: entry.treasuryId,
        treasuryEntryId: entry.id,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        performedByUserId: parsePositiveInt(createdByUserId),
        note: entry.note || entry.notes || null,
        meta: {
            entryType: entry.entryType,
            direction: entry.direction,
            amount: entry.amount,
            idempotencyKey: entry.idempotencyKey || null
        }
    });

    return { success: true, entry };
};

const rollbackTreasuryEntriesByReference = async (tx, referenceType, referenceId) => {
    const parsedReferenceId = parsePositiveInt(referenceId);
    if (!referenceType || !parsedReferenceId) {
        return { count: 0 };
    }

    const entries = await tx.treasuryEntry.findMany({
        where: {
            referenceType: String(referenceType),
            referenceId: parsedReferenceId
        },
        select: {
            id: true,
            treasuryId: true,
            direction: true,
            amount: true,
            entryDate: true,
            createdAt: true
        }
    });

    if (entries.length === 0) {
        return { count: 0 };
    }

    const balanceDeltaByTreasury = new Map();
    entries.forEach((entry) => {
        const rollbackDelta = entry.direction === TREASURY_DIRECTION.IN
            ? -Math.max(0, toNumber(entry.amount))
            : Math.max(0, toNumber(entry.amount));
        const previous = balanceDeltaByTreasury.get(entry.treasuryId) || 0;
        balanceDeltaByTreasury.set(entry.treasuryId, Number((previous + rollbackDelta).toFixed(2)));
    });

    for (const treasuryId of balanceDeltaByTreasury.keys()) {
        await lockTreasuryForUpdate(tx, treasuryId);
    }

    for (const [treasuryId, delta] of balanceDeltaByTreasury.entries()) {
        await tx.treasury.update({
            where: { id: treasuryId },
            data: {
                currentBalance: {
                    increment: delta
                }
            }
        });
    }

    const entryIds = entries.map((entry) => entry.id);
    if (String(referenceType).toUpperCase() === 'PAYMENT') {
        await tx.paymentAllocation.deleteMany({
            where: { customerPaymentId: parsedReferenceId }
        });
    }
    await tx.paymentAllocation.deleteMany({
        where: { treasuryEntryId: { in: entryIds } }
    });

    await tx.treasuryEntry.deleteMany({
        where: {
            id: {
                in: entryIds
            }
        }
    });

    await writeAuditLog(tx, {
        action: AUDIT_ACTION.TREASURY_ENTRY_ROLLBACK,
        entityType: 'TreasuryEntry',
        referenceType: String(referenceType),
        referenceId: parsedReferenceId,
        note: `Rollback by reference ${referenceType}#${parsedReferenceId}`,
        meta: {
            count: entries.length,
            treasuryIds: [...new Set(entries.map((entry) => entry.treasuryId))]
        }
    });

    return { count: entries.length };
};

const throwIfResultError = (result, fallbackMessage = 'Operation failed') => {
    if (result?.error) {
        throw new Error(result.error || fallbackMessage);
    }
    return result;
};

const resolveReportRange = (params = {}) => {
    const hasFromTo = Boolean(params?.fromDate || params?.toDate);
    if (!hasFromTo) {
        const reportDate = params?.date || new Date();
        return {
            from: startOfDay(reportDate),
            to: endOfDay(reportDate),
            isSingleDay: true
        };
    }

    const rawFrom = params?.fromDate || params?.date || new Date();
    const rawTo = params?.toDate || params?.date || rawFrom;
    const from = startOfDay(rawFrom);
    const to = endOfDay(rawTo);
    if (from.getTime() <= to.getTime()) {
        return { from, to, isSingleDay: false };
    }
    return { from: startOfDay(rawTo), to: endOfDay(rawFrom), isSingleDay: false };
};

const shiftDateRange = ({ from, to }, daysBack = 1) => {
    const shiftMs = Math.max(1, Number(daysBack || 1)) * 24 * 60 * 60 * 1000;
    return {
        from: new Date(from.getTime() - shiftMs),
        to: new Date(to.getTime() - shiftMs)
    };
};

const getDepositSummary = async (txOrClient, depositReferenceId) => {
    const parsedReferenceId = parsePositiveInt(depositReferenceId);
    if (!parsedReferenceId) {
        return { error: 'Invalid deposit reference' };
    }

    const [entries, appliedAgg] = await Promise.all([
        txOrClient.treasuryEntry.findMany({
            where: {
                referenceType: 'DEPOSIT',
                referenceId: parsedReferenceId,
                entryType: {
                    in: [TREASURY_ENTRY_TYPE.DEPOSIT_IN, TREASURY_ENTRY_TYPE.DEPOSIT_REFUND]
                }
            },
            orderBy: [{ id: 'asc' }]
        }),
        txOrClient.paymentAllocation.aggregate({
            where: {
                sourceType: PAYMENT_ALLOCATION_SOURCE_TYPE.DEPOSIT,
                treasuryEntry: {
                    referenceType: 'DEPOSIT',
                    referenceId: parsedReferenceId,
                    entryType: TREASURY_ENTRY_TYPE.DEPOSIT_IN
                }
            },
            _sum: { amount: true }
        })
    ]);

    const totalIn = entries
        .filter((entry) => entry.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_IN)
        .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
    const totalRefund = entries
        .filter((entry) => entry.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_REFUND)
        .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
    const totalApplied = Math.max(0, toNumber(appliedAgg?._sum?.amount));
    const remaining = Number(Math.max(0, totalIn - totalRefund - totalApplied).toFixed(2));

    return {
        referenceId: parsedReferenceId,
        entries,
        totalIn,
        totalRefund,
        totalApplied,
        remaining
    };
};

const computeExpectedCashFromLedger = async (
    txOrClient,
    {
        treasuryId = null,
        from,
        to
    } = {},
) => {
    const parsedTreasuryId = parsePositiveInt(treasuryId);
    const where = {
        entryDate: {
            gte: startOfDay(from),
            lte: endOfDay(to)
        },
        ...(parsedTreasuryId ? { treasuryId: parsedTreasuryId } : {})
    };

    const cashEntries = await txOrClient.treasuryEntry.findMany({
        where,
        include: {
            paymentMethod: true
        }
    });

    let inCash = 0;
    let outCash = 0;
    cashEntries.forEach((entry) => {
        const code = resolveReportPaymentMethodCode(entry?.paymentMethod);
        if (code !== 'CASH') return;

        const amount = Math.max(0, toNumber(entry.amount));
        if (entry.direction === TREASURY_DIRECTION.IN) inCash += amount;
        else outCash += amount;
    });

    return {
        expectedCash: Number((inCash - outCash).toFixed(2)),
        cashIn: Number(inCash.toFixed(2)),
        cashOut: Number(outCash.toFixed(2)),
        entryCount: cashEntries.length
    };
};

const dbService = {
    // ==================== AUTH ====================
    async login({ username, password }) {
        try {
            const user = await prisma.user.findUnique({
                where: { username }
            });

            if (!user) return { error: 'المستخدم غير موجود' };

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return { error: 'كلمة المرور غير صحيحة' };

            const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY);
            return { token, user: { id: user.id, name: user.name, role: user.role } };
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== DASHBOARD ====================
    async getDashboardStats() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const sales = await prisma.sale.findMany({
                where: { createdAt: { gte: today } }
            });

            const expenses = await prisma.expense.findMany({
                where: { createdAt: { gte: today } }
            });

            const productsCount = await prisma.product.count();

            const lowStockVariants = await prisma.variant.findMany({
                where: { quantity: { lte: 5 } },
                include: { product: true },
                take: 10
            });

            const salesAmount = sales.reduce((sum, sale) => sum + sale.total, 0);
            const expensesAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

            // حساب الديون من CustomerTransaction
            const customerDebtResult = await prisma.customerTransaction.aggregate({
                _sum: {
                    debit: true,
                    credit: true
                }
            });

            const totalDebit = customerDebtResult._sum.debit || 0;
            const totalCredit = customerDebtResult._sum.credit || 0;
            const customersDebt = totalDebit - totalCredit;

            const suppliersDebt = await prisma.supplier.aggregate({
                _sum: { balance: true }
            });

            let treasuryBalance = 0;
            let treasuryInToday = 0;
            let treasuryOutToday = 0;

            try {
                const [treasuryAgg, treasuryTodayAgg] = await Promise.all([
                    prisma.treasury.aggregate({
                        where: { isActive: true },
                        _sum: { currentBalance: true }
                    }),
                    prisma.treasuryEntry.groupBy({
                        by: ['direction'],
                        where: { entryDate: { gte: today } },
                        _sum: { amount: true }
                    })
                ]);

                treasuryBalance = treasuryAgg?._sum?.currentBalance || 0;
                treasuryTodayAgg.forEach((entry) => {
                    const amount = entry?._sum?.amount || 0;
                    if (entry.direction === TREASURY_DIRECTION.IN) {
                        treasuryInToday += amount;
                    } else {
                        treasuryOutToday += amount;
                    }
                });
            } catch (treasuryError) {
                console.warn('Treasury stats are unavailable:', treasuryError?.message || treasuryError);
            }

            return {
                salesAmount,
                salesCount: sales.length,
                expensesAmount,
                productsCount,
                customersDebt: customersDebt || 0,
                suppliersDebt: suppliersDebt._sum.balance || 0,
                netProfit: salesAmount - expensesAmount,
                treasuryBalance,
                treasuryInToday,
                treasuryOutToday,
                lowStockVariants: lowStockVariants.map(v => ({
                    id: v.id,
                    productName: v.product.name,
                    size: v.productSize,
                    color: v.color,
                    quantity: v.quantity,
                    price: v.price
                }))
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== PRODUCTS ====================
    async getProducts({
        page = 1,
        pageSize = 50,
        searchTerm = '',
        categoryId = null,
        stockFilter = 'all',
        sortCol = 'id',
        sortDir = 'desc',
        includeTotal = true,
        includeDescription = true,
        includeImage = true,
        includeCategory = true,
        includeInventory = true,
        includeProductUnits = true,
        includeVariants = true
    } = {}) {
        try {
            const safePage = Math.max(1, parseInt(page, 10) || 1);
            const safePageSize = Math.min(10000, Math.max(1, parseInt(pageSize, 10) || 50));
            const skip = (safePage - 1) * safePageSize;
            const where = {};

            if (categoryId) where.categoryId = parseInt(categoryId, 10);

            // Stock filter – server-side so frontend doesn't need to fetch all products
            const safeStockFilter = String(stockFilter || 'all').trim().toLowerCase();
            if (safeStockFilter === 'out') {
                where.inventory = { totalQuantity: { lte: 0 } };
            } else if (safeStockFilter === 'available') {
                where.inventory = { totalQuantity: { gt: 0 } };
            }
            // 'low' is handled client-side because Prisma can't compare totalQuantity <= minStock

            const normalizedSearch = String(searchTerm || '').trim();
            if (normalizedSearch.length > 0) {
                const [unitBarcodeRows, variantBarcodeRows] = await Promise.all([
                    prisma.productUnit.findMany({
                        where: { barcode: { startsWith: normalizedSearch } },
                        select: { productId: true },
                        take: 150
                    }),
                    prisma.variant.findMany({
                        where: { barcode: { startsWith: normalizedSearch } },
                        select: { productId: true },
                        take: 150
                    })
                ]);

                const barcodeProductIds = Array.from(new Set([
                    ...unitBarcodeRows.map((row) => row.productId),
                    ...variantBarcodeRows.map((row) => row.productId)
                ])).filter((id) => Number.isFinite(id) && id > 0);

                where.OR = [
                    { name: { contains: normalizedSearch, mode: 'insensitive' } },
                    { sku: { startsWith: normalizedSearch, mode: 'insensitive' } },
                    { barcode: { startsWith: normalizedSearch } }
                ];

                if (barcodeProductIds.length > 0) {
                    where.OR.push({ id: { in: barcodeProductIds } });
                }
            }

            const validSortCols = ['id', 'name', 'basePrice', 'cost', 'createdAt', 'updatedAt'];
            const safeSortDir = sortDir === 'asc' ? 'asc' : 'desc';
            const orderBy = validSortCols.includes(sortCol) ? { [sortCol]: safeSortDir } : { id: 'desc' };

            const queryArgs = {
                skip,
                take: safePageSize,
                where,
                orderBy,
                select: buildProductSelect({
                    includeDescription: includeDescription !== false,
                    includeImage: includeImage !== false,
                    includeCategory: includeCategory !== false,
                    includeInventory: includeInventory !== false,
                    includeProductUnits: includeProductUnits !== false,
                    includeVariants: includeVariants !== false
                })
            };

            const needTotal = includeTotal !== false;
            let products = [];
            let total = null;

            if (needTotal) {
                [products, total] = await Promise.all([
                    prisma.product.findMany(queryArgs),
                    prisma.product.count({ where })
                ]);
            } else {
                products = await prisma.product.findMany(queryArgs);
            }

            const totalPages = needTotal ? Math.ceil((total || 0) / safePageSize) : null;

            return {
                data: products,
                total,
                page: safePage,
                totalPages,
                hasMore: needTotal ? safePage < totalPages : products.length === safePageSize
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async getProduct(id) {
        try {
            const productId = parsePositiveInt(id);
            if (!productId) {
                return { error: 'Invalid productId' };
            }

            const product = await prisma.product.findUnique({
                where: { id: productId },
                select: buildProductSelect()
            });

            if (!product) {
                return { error: 'Product not found' };
            }

            return product;
        } catch (error) {
            return { error: error.message };
        }
    },

    async addProduct(productData) {
        try {
            // تنظيف البيانات
            const basePrice = toMoney(productData.basePrice, 0);
            const cost = toMoney(productData.cost, 0);
            const units = normalizeProductUnits(productData.units, basePrice, cost);
            const mainUnit = units[0] || null;
            const name = String(productData.name ?? '').trim();
            if (!name) return { error: 'Product name is required' };

            const cleanData = {
                name,
                description: normalizeString(productData.description),
                categoryId: productData.categoryId ? parsePositiveInt(productData.categoryId) : null,
                brand: normalizeString(productData.brand),
                basePrice: mainUnit ? toMoney(mainUnit.salePrice, basePrice) : basePrice,
                cost: mainUnit ? toMoney(mainUnit.purchasePrice, cost) : cost,
                image: normalizeString(productData.image),
                sku: normalizeString(productData.sku),
                barcode: normalizeString(productData.barcode) || mainUnit?.barcode || null,
                isActive: productData.isActive ?? true,
                type: normalizeString(productData.type) || 'store',
            };

            const warehouseQty = Math.max(0, toInteger(productData.openingQty, 0));

            return await prisma.product.create({
                data: {
                    ...cleanData,
                    ...(units.length > 0 ? {
                        productUnits: {
                            create: units.map((unit) => ({
                                unitName: unit.unitName,
                                conversionFactor: unit.conversionFactor,
                                salePrice: unit.salePrice,
                                wholesalePrice: unit.wholesalePrice,
                                minSalePrice: unit.minSalePrice,
                                purchasePrice: unit.purchasePrice,
                                barcode: unit.barcode
                            }))
                        }
                    } : {}),
                    inventory: {
                        create: {
                            warehouseQty,
                            totalQuantity: warehouseQty,
                            lastRestock: warehouseQty > 0 ? new Date() : null
                        }
                    },
                    variants: {
                        create: [{
                            productSize: 'Standard',
                            color: 'Standard',
                            price: cleanData.basePrice,
                            cost: cleanData.cost,
                            quantity: warehouseQty,
                            barcode: cleanData.barcode
                        }]
                    }
                },
                include: { variants: true, category: true, inventory: true, productUnits: true }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateProduct(id, productData) {
        try {
            const productId = parseInt(id);
            const cleanData = {};
            const basePrice = toMoney(productData.basePrice, 0);
            const cost = toMoney(productData.cost, 0);
            const units = normalizeProductUnits(productData.units, basePrice, cost);
            const mainUnit = units[0] || null;

            if (productData.name !== undefined) cleanData.name = String(productData.name ?? '').trim();
            if (productData.description !== undefined) cleanData.description = normalizeString(productData.description);
            if (productData.categoryId !== undefined) cleanData.categoryId = productData.categoryId ? parsePositiveInt(productData.categoryId) : null;
            if (productData.brand !== undefined) cleanData.brand = normalizeString(productData.brand);
            if (productData.basePrice !== undefined) cleanData.basePrice = mainUnit ? toMoney(mainUnit.salePrice, basePrice) : basePrice;
            if (productData.cost !== undefined) cleanData.cost = mainUnit ? toMoney(mainUnit.purchasePrice, cost) : cost;
            if (productData.image !== undefined) cleanData.image = normalizeString(productData.image);
            if (productData.sku !== undefined) cleanData.sku = normalizeString(productData.sku);
            if (productData.barcode !== undefined) cleanData.barcode = normalizeString(productData.barcode) || mainUnit?.barcode || null;
            if (productData.isActive !== undefined) cleanData.isActive = productData.isActive;
            if (productData.type !== undefined) cleanData.type = normalizeString(productData.type) || 'store';

            return await prisma.$transaction(async (tx) => {
                await tx.product.update({
                    where: { id: productId },
                    data: cleanData
                });

                if (Array.isArray(productData.units)) {
                    await tx.productUnit.deleteMany({ where: { productId } });
                    if (units.length > 0) {
                        await tx.productUnit.createMany({
                            data: units.map((unit) => ({
                                productId,
                                unitName: unit.unitName,
                                conversionFactor: unit.conversionFactor,
                                salePrice: unit.salePrice,
                                wholesalePrice: unit.wholesalePrice,
                                minSalePrice: unit.minSalePrice,
                                purchasePrice: unit.purchasePrice,
                                barcode: unit.barcode
                            }))
                        });
                    }
                }

                return await tx.product.findUnique({
                    where: { id: productId },
                    include: { variants: true, category: true, inventory: true, productUnits: true }
                });
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteProduct(id) {
        try {
            return await prisma.product.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async searchProducts(query) {
        try {
            return await prisma.product.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { barcode: { contains: query } },
                        { sku: { contains: query, mode: 'insensitive' } }
                    ]
                },
                include: { variants: true, category: true, inventory: true },
                take: 20
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== CATEGORIES ====================
    async getCategories() {
        try {
            return await prisma.category.findMany({
                orderBy: { name: 'asc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addCategory(categoryData) {
        try {
            return await prisma.category.create({
                data: categoryData
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateCategory(id, categoryData) {
        try {
            return await prisma.category.update({
                where: { id: parseInt(id) },
                data: categoryData
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteCategory(id) {
        try {
            return await prisma.category.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== INVENTORY ====================
    async getInventory(productId) {
        try {
            return await prisma.inventory.findUnique({
                where: { productId: parseInt(productId) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateInventory(productId, inventoryData) {
        try {
            const existing = await prisma.inventory.findUnique({
                where: { productId: parseInt(productId) }
            });

            if (existing) {
                return await prisma.inventory.update({
                    where: { productId: parseInt(productId) },
                    data: inventoryData
                });
            } else {
                return await prisma.inventory.create({
                    data: {
                        productId: parseInt(productId),
                        ...inventoryData
                    }
                });
            }
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== VARIANTS ====================
    async getVariants() {
        try {
            // Self-healing: Ensure all products have at least one variant
            const productsWithoutVariants = await prisma.product.findMany({
                where: { variants: { none: {} } },
                include: { inventory: true }
            });

            if (productsWithoutVariants.length > 0) {
                await prisma.$transaction(
                    productsWithoutVariants.map(product => {
                        const qty = product.inventory?.totalQuantity || 0;
                        return prisma.variant.create({
                            data: {
                                productId: product.id,
                                productSize: 'Standard',
                                color: 'Standard',
                                price: product.basePrice,
                                cost: product.cost,
                                quantity: qty,
                                barcode: product.barcode
                            }
                        });
                    })
                );
            }

            return await prisma.variant.findMany({
                include: { product: true },
                orderBy: { id: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async searchVariants(query) {
        try {
            return await prisma.variant.findMany({
                where: {
                    OR: [
                        { barcode: { contains: query } },
                        { product: { name: { contains: query, mode: 'insensitive' } } },
                        { product: { barcode: { contains: query } } }
                    ]
                },
                include: { product: true },
                take: 20
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addVariant(variantData) {
        try {
            return await prisma.variant.create({
                data: {
                    productId: parseInt(variantData.productId),
                    productSize: variantData.size,
                    color: variantData.color,
                    price: parseFloat(variantData.price),
                    cost: parseFloat(variantData.cost),
                    quantity: parseInt(variantData.quantity),
                    barcode: variantData.barcode || null
                },
                include: { product: true }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateVariant(id, variantData) {
        try {
            const updateData = {};
            if (variantData.size !== undefined) updateData.productSize = variantData.size;
            if (variantData.color !== undefined) updateData.color = variantData.color;
            if (variantData.price !== undefined) updateData.price = parseFloat(variantData.price);
            if (variantData.cost !== undefined) updateData.cost = parseFloat(variantData.cost);
            if (variantData.quantity !== undefined) updateData.quantity = parseInt(variantData.quantity);
            if (variantData.barcode !== undefined) updateData.barcode = variantData.barcode || null;

            return await prisma.variant.update({
                where: { id: parseInt(id) },
                data: updateData,
                include: { product: true }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteVariant(id) {
        try {
            return await prisma.variant.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== SALES ====================
    async getSales(options = {}) {
        try {
            const { customerId, limit } = options;
            const whereClause = {};
            if (customerId) {
                whereClause.customerId = parseInt(customerId);
            }

            const queryArgs = {
                where: whereClause,
                include: {
                    customer: true,
                    paymentMethod: true,
                    items: {
                        include: {
                            variant: {
                                include: { product: true }
                            }
                        }
                    },
                    returns: {
                        include: {
                            items: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            };

            if (limit) {
                queryArgs.take = parseInt(limit);
            }

            const sales = await prisma.sale.findMany(queryArgs);

            return sales.map((sale) => ({
                ...sale,
                payment: sale?.paymentMethod?.name || null,
                paymentMethodCode: sale?.paymentMethod?.code || null
            }));
        } catch (error) {
            return { error: error.message };
        }
    },

    async createSale(saleData) {
        const perf = startPerfTimer('db:createSale', {
            hasCustomer: Boolean(saleData?.customerId),
            saleType: saleData?.saleType || null,
            itemCount: Array.isArray(saleData?.items) ? saleData.items.length : 0
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                const parsedCustomerId = parsePositiveInt(saleData.customerId);
                const resolvedPaymentMethodId = await resolvePaymentMethodId(
                    tx,
                    saleData.paymentMethodId ?? saleData.paymentMethod ?? saleData.payment,
                    1
                );

                const newSale = await tx.sale.create({
                    data: {
                        customer: parsedCustomerId ? {
                            connect: { id: parsedCustomerId }
                        } : undefined,
                        paymentMethod: resolvedPaymentMethodId
                            ? { connect: { id: resolvedPaymentMethodId } }
                            : undefined,
                        total: parseFloat(saleData.total),
                        discount: parseFloat(saleData.discount || 0),
                        saleType: saleData.saleType || '\u0646\u0642\u062f\u064a',
                        notes: saleData.notes || null,
                        invoiceDate: saleData.invoiceDate
                            ? new Date(saleData.invoiceDate)
                            : undefined
                    }
                });

                // إنشاء بنود الفاتورة وتحديث المخزون
                for (let i = 0; i < saleData.items.length; i++) {
                    const item = saleData.items[i];

                    await tx.saleItem.create({
                        data: {
                            id: i + 1,
                            saleId: newSale.id,
                            variantId: parseInt(item.variantId),
                            quantity: parseInt(item.quantity),
                            price: parseFloat(item.price),
                            discount: parseFloat(item.discount || 0)
                        }
                    });

                    await tx.variant.update({
                        where: { id: parseInt(item.variantId) },
                        data: { quantity: { decrement: parseInt(item.quantity) } }
                    });
                }

                const outstandingAmount = computeSaleOutstandingAmount({
                    total: saleData.total,
                    discount: saleData.discount || 0,
                    paid: saleData.paid || 0,
                    saleType: saleData.saleType
                });

                // إنشاء سجل دين فقط لو فيه متبقي فعلي
                if (parsedCustomerId) {
                    if (outstandingAmount > 0) {
                        await tx.customerTransaction.create({
                            data: {
                                customer: {
                                    connect: { id: parsedCustomerId }
                                },
                                date: newSale.invoiceDate || new Date(),
                                type: 'SALE',
                                referenceType: 'SALE',
                                referenceId: newSale.id,
                                debit: outstandingAmount,
                                credit: 0,
                                notes: `فاتورة #${newSale.id} - ${saleData.notes || 'بيع'}`
                            }
                        });
                    }

                    await applyCustomerFinancialDelta(tx, {
                        customerId: parsedCustomerId,
                        balanceDelta: outstandingAmount,
                        activityDate: newSale.invoiceDate || new Date()
                    });
                }

                if (parsedCustomerId) {
                    const customer = await tx.customer.findUnique({
                        where: { id: parsedCustomerId },
                        include: {
                            sales: true,
                            payments: true
                        }
                    });

                    if (customer) {
                        // حساب إجمالي المشتريات
                        const totalPurchases = customer.sales.reduce((sum, sale) => sum + sale.total, 0);

                        // حساب التقييم الذكي (0-5 نجوم)
                        let rating = 0;

                        // معايير التقييم:
                        // 1. حجم المشتريات (40%)
                        if (totalPurchases >= 50000) rating += 2;
                        else if (totalPurchases >= 20000) rating += 1.5;
                        else if (totalPurchases >= 10000) rating += 1;
                        else if (totalPurchases >= 5000) rating += 0.5;

                        // 2. عدد المعاملات (20%)
                        const salesCount = customer.sales.length;
                        if (salesCount >= 50) rating += 1;
                        else if (salesCount >= 20) rating += 0.7;
                        else if (salesCount >= 10) rating += 0.5;
                        else if (salesCount >= 5) rating += 0.3;

                        // 3. انتظام السداد (40%) - من الرصيد الملخص
                        const currentBalance = customer.balance || 0;
                        const debtRatio = currentBalance / Math.max(totalPurchases, 1);

                        if (debtRatio < 0.1 && salesCount >= 5) rating += 2;
                        else if (debtRatio < 0.2 && salesCount >= 3) rating += 1.5;
                        else if (debtRatio < 0.3) rating += 1;
                        else if (debtRatio < 0.5) rating += 0.5;

                        rating = Math.min(5, rating); // الحد الأقصى 5 نجوم

                        // تصنيف تلقائي للعميل
                        let customerType = 'عادي';
                        if (totalPurchases >= 50000 && rating >= 4) {
                            customerType = 'VIP';
                        } else if (totalPurchases >= 30000 && salesCount >= 10) {
                            customerType = 'تاجر جملة';
                        } else if (totalPurchases >= 20000 || rating >= 3.5) {
                            customerType = 'VIP';
                        }

                        // تحديث بيانات العميل (rating و customerType فقط)
                        await tx.customer.update({
                            where: { id: parsedCustomerId },
                            data: {
                                rating,
                                customerType
                            }
                        });
                    }
                }

                const paidAmount = Math.max(0, Math.min(
                    toNumber(saleData.paid, 0),
                    toNumber(saleData.total, 0)
                ));
                if (paidAmount > 0) {
                    const saleTreasuryId = await resolveTreasuryId(tx, saleData?.treasuryId);
                    const splitRows = await resolvePaymentSplits(tx, {
                        splitPayments: saleData?.splitPayments ?? saleData?.payments,
                        fallbackPaymentMethodId: resolvedPaymentMethodId || 1,
                        totalAmount: paidAmount
                    });
                    if (splitRows?.error) {
                        return { error: splitRows.error };
                    }

                    for (const splitRow of splitRows) {
                        const splitAmount = Math.max(0, toNumber(splitRow.amount));
                        if (splitAmount <= 0) continue;

                        const treasuryEntryResult = await createTreasuryEntry(tx, {
                            treasuryId: saleTreasuryId,
                            entryType: TREASURY_ENTRY_TYPE.SALE_INCOME,
                            direction: TREASURY_DIRECTION.IN,
                            amount: splitAmount,
                            notes: `Sale #${newSale.id}${saleData.notes ? ` - ${saleData.notes}` : ''}`,
                            note: splitRow?.note || null,
                            referenceType: 'SALE',
                            referenceId: newSale.id,
                            paymentMethodId: splitRow.paymentMethodId,
                            entryDate: newSale.invoiceDate || new Date(),
                            idempotencyKey: generateIdempotencyKey('SALE_PAYMENT', [
                                newSale.id,
                                splitRow.paymentMethodId,
                                normalizeAmountForKey(splitAmount),
                                splitRow.index,
                                'CREATE'
                            ]),
                            createdByUserId: parsePositiveInt(saleData?.createdByUserId ?? saleData?.userId),
                            meta: {
                                source: 'createSale',
                                splitIndex: splitRow.index,
                                splitCount: splitRows.length
                            }
                        });
                        throwIfResultError(treasuryEntryResult);
                    }
                }

                return newSale;
            });

            perf({ rows: 1 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async getSaleDetails(saleId) {
        try {
            const sale = await prisma.sale.findUnique({
                where: { id: parseInt(saleId) },
                include: {
                    customer: true,
                    paymentMethod: true,
                    items: {
                        include: {
                            variant: {
                                include: {
                                    product: true
                                }
                            }
                        }
                    }
                }
            });

            if (!sale) return null;

            return {
                ...sale,
                payment: sale?.paymentMethod?.name || null,
                paymentMethodCode: sale?.paymentMethod?.code || null
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteSale(saleId) {
        const perf = startPerfTimer('db:deleteSale', {
            saleId: parseInt(saleId, 10) || null
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                // الحصول على بيانات الفاتورة
                const sale = await tx.sale.findUnique({
                    where: { id: parseInt(saleId) },
                    include: {
                        items: true,
                        customer: true
                    }
                });

                if (!sale) {
                    return { error: 'Sale not found' };
                }

                const saleTransactions = await tx.customerTransaction.findMany({
                    where: {
                        referenceType: 'SALE',
                        referenceId: parseInt(saleId)
                    },
                    select: {
                        debit: true,
                        credit: true
                    }
                });
                const previousSaleDelta = saleTransactions.reduce((sum, trx) => (
                    sum + (toNumber(trx.debit) - toNumber(trx.credit))
                ), 0);

                // استرجاع الكميات للمنتجات
                for (const item of sale.items) {
                    await tx.variant.update({
                        where: { id: item.variantId },
                        data: { quantity: { increment: item.quantity } }
                    });
                }

                await tx.customerTransaction.deleteMany({
                    where: {
                        referenceType: 'SALE',
                        referenceId: parseInt(saleId)
                    }
                });
                const rollbackResult = await rollbackTreasuryEntriesByReference(tx, 'SALE', parseInt(saleId));
                throwIfResultError(rollbackResult, 'Failed to rollback sale treasury entries');

                // حذف بنود الفاتورة
                await tx.saleItem.deleteMany({
                    where: { saleId: parseInt(saleId) }
                });

                // حذف الفاتورة
                const deletedSale = await tx.sale.delete({
                    where: { id: parseInt(saleId) }
                });

                if (sale.customerId) {
                    if (previousSaleDelta !== 0) {
                        await applyCustomerFinancialDelta(tx, {
                            customerId: sale.customerId,
                            balanceDelta: -previousSaleDelta
                        });
                    }
                    await recalculateCustomerActivityDates(tx, sale.customerId);
                }

                return { success: true, data: deletedSale };
            });

            perf({ rows: result?.success ? 1 : 0 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async updateSale(saleId, saleData) {
        const perf = startPerfTimer('db:updateSale', {
            saleId: parseInt(saleId, 10) || null,
            hasCustomer: Object.prototype.hasOwnProperty.call(saleData || {}, 'customerId'),
            itemCount: Array.isArray(saleData?.items) ? saleData.items.length : 0
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                // الحصول على الفاتورة الحالية
                const currentSale = await tx.sale.findUnique({
                    where: { id: parseInt(saleId) },
                    include: {
                        items: true,
                        customer: true
                    }
                });

                if (!currentSale) {
                    return { error: 'Sale not found' };
                }

                const newCustomerId = Object.prototype.hasOwnProperty.call(saleData, 'customerId')
                    ? parsePositiveInt(saleData.customerId)
                    : currentSale.customerId;
                const hasPaymentMethodUpdate = (
                    Object.prototype.hasOwnProperty.call(saleData || {}, 'paymentMethodId') ||
                    Object.prototype.hasOwnProperty.call(saleData || {}, 'paymentMethod') ||
                    Object.prototype.hasOwnProperty.call(saleData || {}, 'payment')
                );
                const nextPaymentMethodId = hasPaymentMethodUpdate
                    ? await resolvePaymentMethodId(
                        tx,
                        saleData.paymentMethodId ?? saleData.paymentMethod ?? saleData.payment,
                        currentSale.paymentMethodId || 1
                    )
                    : currentSale.paymentMethodId;

                const oldSaleTransactions = await tx.customerTransaction.findMany({
                    where: {
                        referenceType: 'SALE',
                        referenceId: parseInt(saleId)
                    },
                    select: {
                        debit: true,
                        credit: true
                    }
                });
                const oldOutstanding = oldSaleTransactions.reduce((sum, trx) => (
                    sum + (toNumber(trx.debit) - toNumber(trx.credit))
                ), 0);

                // استرجاع الكميات القديمة
                for (const item of currentSale.items) {
                    await tx.variant.update({
                        where: { id: item.variantId },
                        data: { quantity: { increment: item.quantity } }
                    });
                }

                await tx.customerTransaction.deleteMany({
                    where: {
                        referenceType: 'SALE',
                        referenceId: parseInt(saleId)
                    }
                });

                // حذف البنود القديمة
                await tx.saleItem.deleteMany({
                    where: { saleId: parseInt(saleId) }
                });

                // إنشاء البنود الجديدة
                if (saleData.items && saleData.items.length > 0) {
                    for (let i = 0; i < saleData.items.length; i++) {
                        const item = saleData.items[i];

                        await tx.saleItem.create({
                            data: {
                                id: i + 1,
                                saleId: parseInt(saleId),
                                variantId: parseInt(item.variantId),
                                quantity: parseInt(item.quantity),
                                price: parseFloat(item.price),
                                discount: parseFloat(item.discount || 0)
                            }
                        });

                        await tx.variant.update({
                            where: { id: parseInt(item.variantId) },
                            data: { quantity: { decrement: parseInt(item.quantity) } }
                        });
                    }
                }

                // تحديث بيانات الفاتورة
                const updatedSale = await tx.sale.update({
                    where: { id: parseInt(saleId) },
                    data: {
                        customer: Object.prototype.hasOwnProperty.call(saleData, 'customerId')
                            ? (newCustomerId
                                ? { connect: { id: newCustomerId } }
                                : { disconnect: true })
                            : undefined,
                        paymentMethod: hasPaymentMethodUpdate
                            ? (nextPaymentMethodId
                                ? { connect: { id: nextPaymentMethodId } }
                                : { disconnect: true })
                            : undefined,
                        total: parseFloat(saleData.total),
                        discount: parseFloat(saleData.discount || 0),
                        saleType: saleData.saleType || 'نقدي',
                        notes: saleData.notes || null,
                        invoiceDate: saleData.invoiceDate
                            ? new Date(saleData.invoiceDate)
                            : undefined
                    },
                    include: {
                        customer: true,
                        paymentMethod: true,
                        items: true
                    }
                });

                const newOutstanding = computeSaleOutstandingAmount({
                    total: saleData.total,
                    discount: saleData.discount || 0,
                    paid: saleData.paid || 0,
                    saleType: saleData.saleType
                });

                // إنشاء سجل CustomerTransaction الجديد
                if (newCustomerId && newOutstanding > 0) {
                    await tx.customerTransaction.create({
                        data: {
                            customer: {
                                connect: { id: newCustomerId }
                            },
                            date: updatedSale.invoiceDate || new Date(),
                            type: 'SALE',
                            referenceType: 'SALE',
                            referenceId: updatedSale.id,
                            debit: newOutstanding,
                            credit: 0,
                            notes: `فاتورة معدلة #${updatedSale.id} - ${saleData.notes || 'بيع'}`
                        }
                    });
                }

                if (currentSale.customerId && currentSale.customerId === newCustomerId) {
                    const delta = newOutstanding - oldOutstanding;
                    await applyCustomerFinancialDelta(tx, {
                        customerId: newCustomerId,
                        balanceDelta: delta,
                        activityDate: updatedSale.invoiceDate || new Date()
                    });
                    await recalculateCustomerActivityDates(tx, newCustomerId);
                } else {
                    if (currentSale.customerId) {
                        if (oldOutstanding !== 0) {
                            await applyCustomerFinancialDelta(tx, {
                                customerId: currentSale.customerId,
                                balanceDelta: -oldOutstanding
                            });
                        }
                        await recalculateCustomerActivityDates(tx, currentSale.customerId);
                    }

                    if (newCustomerId) {
                        await applyCustomerFinancialDelta(tx, {
                            customerId: newCustomerId,
                            balanceDelta: newOutstanding,
                            activityDate: updatedSale.invoiceDate || new Date()
                        });
                    }
                }

                const rollbackResult = await rollbackTreasuryEntriesByReference(tx, 'SALE', parseInt(saleId));
                throwIfResultError(rollbackResult, 'Failed to rollback sale treasury entries');

                const paidAmount = Math.max(0, Math.min(
                    toNumber(saleData.paid, 0),
                    toNumber(saleData.total, 0)
                ));
                if (paidAmount > 0) {
                    const saleTreasuryId = await resolveTreasuryId(tx, saleData?.treasuryId);
                    const splitRows = await resolvePaymentSplits(tx, {
                        splitPayments: saleData?.splitPayments ?? saleData?.payments,
                        fallbackPaymentMethodId: nextPaymentMethodId || 1,
                        totalAmount: paidAmount
                    });
                    if (splitRows?.error) {
                        return { error: splitRows.error };
                    }

                    for (const splitRow of splitRows) {
                        const splitAmount = Math.max(0, toNumber(splitRow.amount));
                        if (splitAmount <= 0) continue;

                        const treasuryEntryResult = await createTreasuryEntry(tx, {
                            treasuryId: saleTreasuryId,
                            entryType: TREASURY_ENTRY_TYPE.SALE_INCOME,
                            direction: TREASURY_DIRECTION.IN,
                            amount: splitAmount,
                            notes: `Sale update #${updatedSale.id}${saleData.notes ? ` - ${saleData.notes}` : ''}`,
                            note: splitRow?.note || null,
                            referenceType: 'SALE',
                            referenceId: updatedSale.id,
                            paymentMethodId: splitRow.paymentMethodId,
                            entryDate: updatedSale.invoiceDate || new Date(),
                            idempotencyKey: generateIdempotencyKey('SALE_PAYMENT', [
                                updatedSale.id,
                                splitRow.paymentMethodId,
                                normalizeAmountForKey(splitAmount),
                                splitRow.index,
                                'UPDATE'
                            ]),
                            createdByUserId: parsePositiveInt(saleData?.createdByUserId ?? saleData?.userId),
                            meta: {
                                source: 'updateSale',
                                splitIndex: splitRow.index,
                                splitCount: splitRows.length
                            }
                        });
                        throwIfResultError(treasuryEntryResult);
                    }
                }

                return { success: true, data: updatedSale };
            });

            perf({ rows: result?.success ? 1 : 0 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    // ==================== PURCHASES (فواتير المشتريات) ====================
    async getPurchases() {
        try {
            return await prisma.purchase.findMany({
                include: {
                    supplier: true,
                    items: {
                        include: {
                            variant: {
                                include: { product: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async createPurchase(purchaseData) {
        try {
            return await prisma.$transaction(async (tx) => {
                const parsedSupplierId = parsePositiveInt(purchaseData?.supplierId);
                const safeTotal = Math.max(0, toNumber(purchaseData?.total, 0));
                const safePaid = Math.max(0, Math.min(
                    toNumber(purchaseData?.paid, 0),
                    safeTotal
                ));
                const invoiceDate = parseDateOrDefault(
                    purchaseData?.invoiceDate ?? purchaseData?.createdAt,
                    new Date()
                );
                const resolvedPaymentMethodId = await resolvePaymentMethodId(
                    tx,
                    purchaseData?.paymentMethodId ?? purchaseData?.paymentMethod ?? purchaseData?.payment,
                    1
                );

                if (!Array.isArray(purchaseData?.items) || purchaseData.items.length === 0) {
                    return { error: 'Purchase items are required' };
                }

                const newPurchase = await tx.purchase.create({
                    data: {
                        supplierId: parsedSupplierId,
                        total: safeTotal,
                        paid: safePaid,
                        notes: purchaseData.notes || null,
                        createdAt: invoiceDate
                    }
                });

                for (let i = 0; i < purchaseData.items.length; i++) {
                    const item = purchaseData.items[i];
                    const variantId = parsePositiveInt(item?.variantId);
                    const quantity = Math.max(1, toInteger(item?.quantity, 1));
                    const cost = Math.max(0, toNumber(item?.cost ?? item?.price, 0));

                    if (!variantId) {
                        return { error: 'Invalid variantId in purchase items' };
                    }

                    await tx.purchaseItem.create({
                        data: {
                            id: i + 1,
                            purchaseId: newPurchase.id,
                            variantId,
                            quantity,
                            cost
                        }
                    });

                    // زيادة المخزون
                    await tx.variant.update({
                        where: { id: variantId },
                        data: {
                            quantity: { increment: quantity },
                            cost // تحديث سعر التكلفة
                        }
                    });
                }

                // تحديث رصيد المورد
                if (parsedSupplierId) {
                    const remaining = Math.max(0, safeTotal - safePaid);
                    await tx.supplier.update({
                        where: { id: parsedSupplierId },
                        data: { balance: { decrement: remaining } }
                    });
                }

                const paidAmount = safePaid;
                if (paidAmount > 0) {
                    const purchaseTreasuryId = await resolveTreasuryId(tx, purchaseData?.treasuryId);
                    const splitRows = await resolvePaymentSplits(tx, {
                        splitPayments: purchaseData?.splitPayments ?? purchaseData?.payments,
                        fallbackPaymentMethodId: resolvedPaymentMethodId || 1,
                        totalAmount: paidAmount
                    });
                    if (splitRows?.error) {
                        return { error: splitRows.error };
                    }

                    for (const splitRow of splitRows) {
                        const splitAmount = Math.max(0, toNumber(splitRow.amount));
                        if (splitAmount <= 0) continue;

                        const treasuryEntryResult = await createTreasuryEntry(tx, {
                            treasuryId: purchaseTreasuryId,
                            entryType: TREASURY_ENTRY_TYPE.PURCHASE_PAYMENT,
                            direction: TREASURY_DIRECTION.OUT,
                            amount: splitAmount,
                            notes: `Purchase #${newPurchase.id}${purchaseData.notes ? ` - ${purchaseData.notes}` : ''}`,
                            note: splitRow?.note || null,
                            referenceType: 'PURCHASE',
                            referenceId: newPurchase.id,
                            paymentMethodId: splitRow.paymentMethodId,
                            entryDate: invoiceDate,
                            idempotencyKey: generateIdempotencyKey('PURCHASE_PAYMENT', [
                                newPurchase.id,
                                splitRow.paymentMethodId,
                                normalizeAmountForKey(splitAmount),
                                splitRow.index,
                                'CREATE'
                            ]),
                            createdByUserId: parsePositiveInt(purchaseData?.createdByUserId ?? purchaseData?.userId),
                            meta: {
                                source: 'createPurchase',
                                splitIndex: splitRow.index,
                                splitCount: splitRows.length
                            }
                        });

                        throwIfResultError(treasuryEntryResult);
                    }
                }

                return newPurchase;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== RETURNS (المرتجعات) ====================
    async getReturns() {
        try {
            return await prisma.return.findMany({
                include: {
                    sale: true,
                    customer: true,
                    items: {
                        include: {
                            variant: {
                                include: { product: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async createReturn(returnData) {
        const perf = startPerfTimer('db:createReturn', {
            hasCustomer: Boolean(returnData?.customerId),
            itemCount: Array.isArray(returnData?.items) ? returnData.items.length : 0
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                const returnDate = parseDateOrDefault(returnData?.returnDate, new Date());
                const newReturn = await tx.return.create({
                    data: {
                        saleId: returnData.saleId ? parseInt(returnData.saleId) : null,
                        customerId: returnData.customerId ? parseInt(returnData.customerId) : null,
                        total: parseFloat(returnData.total),
                        notes: returnData.notes || null
                    }
                });

                for (let i = 0; i < returnData.items.length; i++) {
                    const item = returnData.items[i];

                    await tx.returnItem.create({
                        data: {
                            id: i + 1,
                            returnId: newReturn.id,
                            variantId: parseInt(item.variantId),
                            quantity: parseInt(item.quantity),
                            price: parseFloat(item.price)
                        }
                    });

                    // إرجاع الكمية للمخزون
                    await tx.variant.update({
                        where: { id: parseInt(item.variantId) },
                        data: { quantity: { increment: parseInt(item.quantity) } }
                    });
                }

                // إنشاء سجل مرتجعات في CustomerTransaction
                if (returnData.customerId) {
                    const parsedCustomerId = parseInt(returnData.customerId);
                    const returnAmount = Math.max(0, toNumber(returnData.total));

                    await tx.customerTransaction.create({
                        data: {
                            customer: {
                                connect: { id: parsedCustomerId }
                            },
                            date: returnDate,
                            type: 'RETURN',
                            referenceType: 'RETURN',
                            referenceId: newReturn.id,
                            debit: 0,
                            credit: returnAmount,
                            notes: `مرتجع #${newReturn.id} - ${returnData.notes || 'مرتجع'}`
                        }
                    });

                    await applyCustomerFinancialDelta(tx, {
                        customerId: parsedCustomerId,
                        balanceDelta: -returnAmount,
                        activityDate: returnDate
                    });
                }

                const refundAmount = Math.max(0, toNumber(
                    returnData?.refundAmount !== undefined ? returnData.refundAmount : returnData.total
                ));
                if (refundAmount > 0) {
                    const returnTreasuryId = await resolveTreasuryId(tx, returnData?.treasuryId);
                    const refundMode = String(returnData?.refundMode || REFUND_MODE.SAME_METHOD)
                        .trim()
                        .toUpperCase();

                    let resolvedPaymentMethodId;
                    if (refundMode === REFUND_MODE.CASH_ONLY) {
                        resolvedPaymentMethodId = await resolveCashPaymentMethodId(tx, 1);
                    } else {
                        let sameMethodCandidate = returnData?.paymentMethodId ?? returnData?.paymentMethod;
                        if (!sameMethodCandidate && returnData?.saleId) {
                            const sourceSale = await tx.sale.findUnique({
                                where: { id: parsePositiveInt(returnData.saleId) || 0 },
                                select: { paymentMethodId: true }
                            });
                            sameMethodCandidate = sourceSale?.paymentMethodId || null;
                        }
                        resolvedPaymentMethodId = await resolvePaymentMethodId(
                            tx,
                            sameMethodCandidate,
                            1
                        );
                    }

                    const treasuryEntryResult = await createTreasuryEntry(tx, {
                        treasuryId: returnTreasuryId,
                        entryType: TREASURY_ENTRY_TYPE.RETURN_REFUND,
                        direction: TREASURY_DIRECTION.OUT,
                        amount: refundAmount,
                        notes: `Return #${newReturn.id}${returnData.notes ? ` - ${returnData.notes}` : ''}`,
                        referenceType: 'RETURN',
                        referenceId: newReturn.id,
                        paymentMethodId: resolvedPaymentMethodId,
                        entryDate: returnDate,
                        idempotencyKey: generateIdempotencyKey('RETURN_REFUND', [
                            newReturn.id,
                            resolvedPaymentMethodId,
                            normalizeAmountForKey(refundAmount),
                            refundMode
                        ]),
                        createdByUserId: parsePositiveInt(returnData?.createdByUserId ?? returnData?.userId),
                        meta: {
                            refundMode
                        }
                    });

                    throwIfResultError(treasuryEntryResult);
                }

                return newReturn;
            });

            perf({ rows: 1 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    // ==================== CUSTOMERS ====================
    async getCustomerBalance(customerId) {
        try {
            const parsedCustomerId = parseInt(customerId);
            const customer = await prisma.customer.findUnique({
                where: { id: parsedCustomerId },
                select: {
                    id: true,
                    balance: true
                }
            });

            if (!customer) return 0;

            return customer.balance || 0;
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomerStatement(customerId, fromDate, toDate) {
        try {
            const whereClause = { customer: { id: parseInt(customerId) } };

            if (fromDate || toDate) {
                whereClause.date = {};
                if (fromDate) whereClause.date.gte = new Date(fromDate);
                if (toDate) whereClause.date.lte = new Date(toDate);
            }

            const transactions = await prisma.customerTransaction.findMany({
                where: whereClause,
                orderBy: { date: 'asc' },
                include: {
                    customer: {
                        select: { name: true, phone: true }
                    }
                }
            });

            // Calculate running balance
            let runningBalance = 0;
            const statement = transactions.map(t => {
                runningBalance += t.debit - t.credit;
                return {
                    ...t,
                    runningBalance
                };
            });

            return statement;
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomerTransactions(customerId) {
        try {
            return await prisma.customerTransaction.findMany({
                where: { customer: { id: parseInt(customerId) } },
                orderBy: { date: 'desc' },
                take: 50
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomers({
        page = 1,
        pageSize = 1000,
        searchTerm = '',
        customerType = null,
        city = '',
        sortCol = 'createdAt',
        sortDir = 'desc',
        overdueThreshold = 30
    } = {}) {
        const perf = startPerfTimer('db:getCustomers', {
            page,
            pageSize,
            searchLength: String(searchTerm || '').trim().length,
            customerType: customerType || 'all',
            cityLength: String(city || '').trim().length,
            sortCol,
            sortDir
        });

        try {
            const safePage = Math.max(1, parseInt(page, 10) || 1);
            const safePageSize = Math.min(2000, Math.max(1, parseInt(pageSize, 10) || 1000));
            const safeSortDir = String(sortDir).toLowerCase() === 'asc' ? 'asc' : 'desc';
            const skip = (safePage - 1) * safePageSize;

            const where = {};
            const normalizedSearch = String(searchTerm || '').trim();
            const normalizedCity = String(city || '').trim();

            if (normalizedSearch.length > 0) {
                where.OR = [
                    { name: { startsWith: normalizedSearch, mode: 'insensitive' } },
                    { phone: { startsWith: normalizedSearch } }
                ];
            }

            if (customerType && customerType !== 'all') {
                where.customerType = customerType;
            }

            if (normalizedCity.length > 0) {
                where.city = { startsWith: normalizedCity, mode: 'insensitive' };
            }

            const sortable = new Set(['balance', 'lastPaymentDate', 'createdAt', 'name', 'id']);
            const safeSortCol = sortable.has(sortCol) ? sortCol : 'createdAt';
            const orderBy = safeSortCol === 'lastPaymentDate'
                ? [{ lastPaymentDate: safeSortDir }, { id: 'desc' }]
                : { [safeSortCol]: safeSortDir };

            const [customers, total] = await Promise.all([
                prisma.customer.findMany({
                    skip,
                    take: safePageSize,
                    where,
                    orderBy,
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        phone2: true,
                        address: true,
                        city: true,
                        district: true,
                        notes: true,
                        creditLimit: true,
                        customerType: true,
                        rating: true,
                        balance: true,
                        firstActivityDate: true,
                        lastPaymentDate: true,
                        createdAt: true
                    }
                }),
                prisma.customer.count({ where })
            ]);

            const data = customers.map((customer) => {
                const status = computeCustomerPaymentStatus(
                    customer.firstActivityDate,
                    customer.lastPaymentDate,
                    overdueThreshold,
                );

                return {
                    ...customer,
                    balance: customer.balance || 0,
                    lastPaymentDays: status.lastPaymentDays,
                    isOverdue: status.isOverdue
                };
            });

            perf({ rows: data.length });

            return {
                data,
                total,
                page: safePage,
                totalPages: Math.max(1, Math.ceil(total / safePageSize))
            };
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async getCustomer(id) {
        try {
            const parsedCustomerId = parseInt(id);
            const customer = await prisma.customer.findUnique({
                where: { id: parsedCustomerId }
            });

            if (!customer) return { error: 'العميل غير موجود' };

            const status = computeCustomerPaymentStatus(
                customer.firstActivityDate,
                customer.lastPaymentDate,
                30,
            );

            return {
                ...customer,
                balance: customer.balance ?? 0,
                lastPaymentDays: status.lastPaymentDays,
                isOverdue: status.isOverdue
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomerSales(customerId) {
        try {
            const parsedCustomerId = parseInt(customerId);
            const sales = await prisma.sale.findMany({
                where: { customerId: parseInt(customerId) },
                include: {
                    paymentMethod: true,
                    items: {
                        include: {
                            variant: { include: { product: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!Array.isArray(sales) || sales.length === 0) {
                return sales;
            }

            const saleIds = sales.map((sale) => sale.id);
            const saleTransactions = await prisma.customerTransaction.findMany({
                where: {
                    customerId: parsedCustomerId,
                    referenceType: 'SALE',
                    referenceId: { in: saleIds }
                },
                select: {
                    referenceId: true,
                    debit: true,
                    credit: true
                }
            });

            const outstandingBySaleId = saleTransactions.reduce((map, transaction) => {
                const saleReferenceId = transaction.referenceId;
                if (!saleReferenceId) return map;
                const delta = toNumber(transaction.debit) - toNumber(transaction.credit);
                map.set(saleReferenceId, (map.get(saleReferenceId) || 0) + delta);
                return map;
            }, new Map());

            return sales.map((sale) => {
                const total = Math.max(0, toNumber(sale.total));
                const remainingAmount = Math.max(0, toNumber(outstandingBySaleId.get(sale.id) || 0));
                const paidAmount = Math.max(0, total - remainingAmount);
                return {
                    ...sale,
                    payment: sale?.paymentMethod?.name || null,
                    paymentMethodCode: sale?.paymentMethod?.code || null,
                    remainingAmount,
                    paidAmount,
                    // Backward-compatible aliases used by some UI paths.
                    remaining: remainingAmount,
                    paid: paidAmount
                };
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomerReturns(customerId) {
        try {
            return await prisma.return.findMany({
                where: { customerId: parseInt(customerId) },
                include: {
                    items: {
                        include: {
                            variant: { include: { product: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addCustomer(customerData) {
        try {
            return await prisma.customer.create({
                data: {
                    name: customerData.name,
                    phone: customerData.phone || null,
                    phone2: customerData.phone2 || null,
                    address: customerData.address || null,
                    city: customerData.city || null,
                    district: customerData.district || null,
                    notes: customerData.notes || null,
                    creditLimit: parseFloat(customerData.creditLimit || 0),
                    balance: 0,
                    firstActivityDate: null,
                    lastPaymentDate: null,
                    financialsUpdatedAt: new Date(),
                    customerType: customerData.customerType || 'عادي'
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateCustomer(id, customerData) {
        try {
            return await prisma.customer.update({
                where: { id: parseInt(id) },
                data: {
                    name: customerData.name,
                    phone: customerData.phone || null,
                    phone2: customerData.phone2 || null,
                    address: customerData.address || null,
                    city: customerData.city || null,
                    district: customerData.district || null,
                    notes: customerData.notes || null,
                    creditLimit: customerData.creditLimit !== undefined ? parseFloat(customerData.creditLimit) : undefined,
                    customerType: customerData.customerType || undefined
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteCustomer(id) {
        try {
            return await prisma.customer.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async previewCustomerPaymentAllocation(params = {}) {
        try {
            const customerId = parsePositiveInt(params?.customerId);
            if (!customerId) return { error: 'Invalid customerId' };

            const requestedAmount = Math.max(0, toNumber(params?.amount));
            if (requestedAmount <= 0) return { error: 'Invalid amount' };

            return await prisma.$transaction(async (tx) => {
                const customer = await tx.customer.findUnique({
                    where: { id: customerId },
                    select: { id: true, balance: true }
                });
                if (!customer) return { error: 'Customer not found' };

                const outstandingRows = await getSaleOutstandingRowsForAllocation(tx, customerId, {
                    customerBalanceOverride: Math.max(0, toNumber(customer.balance))
                });

                let remaining = Number(requestedAmount.toFixed(2));
                const allocations = [];
                for (const row of outstandingRows) {
                    if (remaining <= 0) break;
                    const allocationAmount = Number(Math.min(remaining, row.outstanding).toFixed(2));
                    if (allocationAmount <= 0) continue;
                    allocations.push({
                        saleId: row.saleId,
                        invoiceDate: row.invoiceDate,
                        outstandingBefore: row.outstanding,
                        amount: allocationAmount,
                        outstandingAfter: Number((row.outstanding - allocationAmount).toFixed(2))
                    });
                    remaining = Number((remaining - allocationAmount).toFixed(2));
                }

                return {
                    success: true,
                    data: {
                        customerId,
                        customerBalance: toNumber(customer.balance),
                        requestedAmount,
                        allocatedAmount: Number((requestedAmount - remaining).toFixed(2)),
                        unallocatedAmount: remaining,
                        allocations
                    }
                };
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async createCustomerPayment(paymentData = {}) {
        const perf = startPerfTimer('db:createCustomerPayment', {
            hasPaymentDate: Boolean(paymentData?.paymentDate),
            hasSplitPayments: Array.isArray(paymentData?.splitPayments) || Array.isArray(paymentData?.payments)
        });

        try {
            const customerId = parsePositiveInt(paymentData?.customerId);
            if (!customerId) {
                return { error: 'Invalid customerId' };
            }

            // If payment date is today, use current time. Otherwise use start of day.
            // Parse the input date (user selected day)
            const paymentDateInput = paymentData?.paymentDate ? new Date(paymentData.paymentDate) : new Date();

            // Apply current time to the selected date
            // This ensures even backdated payments have a time component (preserving entry order)
            const now = new Date();
            const paymentDate = new Date(paymentDateInput);
            paymentDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
            const createdByUserId = parsePositiveInt(paymentData?.createdByUserId ?? paymentData?.userId);

            const rawSplitRows = normalizeSplitPaymentsInput(
                paymentData?.splitPayments ?? paymentData?.payments
            );
            const fallbackAmount = Math.max(0, toNumber(paymentData?.amount));
            const totalAmount = rawSplitRows.length > 0
                ? rawSplitRows.reduce((sum, row) => sum + row.amount, 0)
                : fallbackAmount;
            if (totalAmount <= 0) {
                return { error: 'Invalid payment amount' };
            }

            const result = await prisma.$transaction(async (tx) => {
                const customer = await tx.customer.findUnique({
                    where: { id: customerId },
                    select: { id: true, balance: true }
                });
                if (!customer) return { error: 'Customer not found' };

                const paymentTreasuryId = await resolveTreasuryId(tx, paymentData?.treasuryId);
                const splitRows = await resolvePaymentSplits(tx, {
                    splitPayments: rawSplitRows,
                    fallbackPaymentMethodId: paymentData?.paymentMethodId ?? paymentData?.paymentMethod ?? 1,
                    totalAmount
                });
                if (splitRows?.error) return { error: splitRows.error };

                const fifoOutstandingRows = await getSaleOutstandingRowsForAllocation(tx, customerId, {
                    customerBalanceOverride: Math.max(0, toNumber(customer.balance))
                });

                const payments = [];
                const treasuryEntries = [];
                const allocations = [];
                for (const splitRow of splitRows) {
                    const splitAmount = Math.max(0, toNumber(splitRow.amount));
                    if (splitAmount <= 0) continue;

                    const payment = await tx.customerPayment.create({
                        data: {
                            customer: {
                                connect: { id: customerId }
                            },
                            paymentMethod: {
                                connect: { id: splitRow.paymentMethodId }
                            },
                            amount: splitAmount,
                            notes: paymentData?.notes || splitRow?.note || null,
                            paymentDate
                        },
                        include: {
                            paymentMethod: true
                        }
                    });

                    await tx.customerTransaction.create({
                        data: {
                            customer: {
                                connect: { id: customerId }
                            },
                            date: paymentDate,
                            type: 'PAYMENT',
                            referenceType: 'PAYMENT',
                            referenceId: payment.id,
                            debit: 0,
                            credit: splitAmount,
                            notes: `دفعة #${payment.id} - ${paymentData?.notes || 'دفعة عميل'}`
                        }
                    });

                    const treasuryEntryResult = await createTreasuryEntry(tx, {
                        treasuryId: paymentTreasuryId,
                        entryType: TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT,
                        direction: TREASURY_DIRECTION.IN,
                        amount: splitAmount,
                        notes: `Customer payment #${payment.id}${paymentData?.notes ? ` - ${paymentData.notes}` : ''}`,
                        referenceType: 'PAYMENT',
                        referenceId: payment.id,
                        paymentMethodId: splitRow.paymentMethodId,
                        entryDate: paymentDate,
                        idempotencyKey: generateIdempotencyKey('CUSTOMER_PAYMENT', [
                            payment.id,
                            splitRow.paymentMethodId,
                            normalizeAmountForKey(splitAmount),
                            splitRow.index
                        ]),
                        createdByUserId,
                        meta: {
                            source: 'createCustomerPayment',
                            splitIndex: splitRow.index,
                            splitCount: splitRows.length
                        }
                    });
                    throwIfResultError(treasuryEntryResult);

                    const createdAllocations = await applyAllocationsFromOutstandingRows(tx, {
                        outstandingRows: fifoOutstandingRows,
                        sourceType: PAYMENT_ALLOCATION_SOURCE_TYPE.CUSTOMER_PAYMENT,
                        amount: splitAmount,
                        customerId,
                        customerPaymentId: payment.id,
                        createdByUserId,
                        note: `FIFO allocation for payment #${payment.id}`,
                        allocationDate: paymentDate
                    });

                    if (createdAllocations.length > 0) {
                        await writeAuditLog(tx, {
                            action: AUDIT_ACTION.PAYMENT_ALLOCATION_CREATE,
                            entityType: 'PaymentAllocation',
                            referenceType: 'PAYMENT',
                            referenceId: payment.id,
                            performedByUserId: createdByUserId,
                            note: `FIFO allocations created for payment #${payment.id}`,
                            meta: {
                                allocationCount: createdAllocations.length,
                                amount: splitAmount
                            }
                        });
                    }

                    payments.push(payment);
                    treasuryEntries.push(treasuryEntryResult.entry);
                    allocations.push(...createdAllocations);
                }

                await applyCustomerFinancialDelta(tx, {
                    customerId,
                    balanceDelta: -totalAmount,
                    activityDate: paymentDate,
                    paymentDate
                });
                await recalculateCustomerActivityDates(tx, customerId);

                return {
                    success: true,
                    data: {
                        customerId,
                        totalAmount,
                        paymentDate,
                        payments,
                        treasuryEntries,
                        allocations
                    }
                };
            });

            perf({ rows: Array.isArray(result?.data?.payments) ? result.data.payments.length : 0 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async addCustomerPayment(paymentData) {
        const result = await this.createCustomerPayment(paymentData);
        if (result?.error) {
            return result;
        }

        const payments = Array.isArray(result?.data?.payments) ? result.data.payments : [];
        if (payments.length === 1) {
            return payments[0];
        }
        return result;
    },

    async getCustomerPayments(customerId) {
        try {
            return await prisma.customerPayment.findMany({
                where: { customerId: parseInt(customerId) },
                include: { paymentMethod: true },
                orderBy: { paymentDate: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateCustomerPayment(paymentId, paymentData) {
        const perf = startPerfTimer('db:updateCustomerPayment', {
            paymentId: parseInt(paymentId, 10) || null
        });

        try {
            const parsedPaymentId = parsePositiveInt(paymentId);
            if (!parsedPaymentId) {
                return { error: 'Invalid paymentId' };
            }

            const amount = Math.max(0, toNumber(paymentData?.amount));
            if (amount <= 0) {
                return { error: 'Invalid payment amount' };
            }

            const paymentDate = parsePaymentDateInput(paymentData?.paymentDate);

            const result = await prisma.$transaction(async (tx) => {
                const existingPayment = await tx.customerPayment.findUnique({
                    where: { id: parsedPaymentId },
                    select: {
                        id: true,
                        customerId: true,
                        amount: true,
                        paymentDate: true,
                        paymentMethodId: true
                    }
                });

                if (!existingPayment) {
                    return { error: 'Payment not found' };
                }

                const nextCustomerId = Object.prototype.hasOwnProperty.call(paymentData || {}, 'customerId')
                    ? parsePositiveInt(paymentData.customerId)
                    : existingPayment.customerId;

                if (!nextCustomerId) {
                    return { error: 'Invalid customerId' };
                }

                const paymentMethodId = await resolvePaymentMethodId(
                    tx,
                    paymentData?.paymentMethodId ?? paymentData?.paymentMethod,
                    existingPayment.paymentMethodId || 1
                );
                if (!paymentMethodId) {
                    return { error: 'Invalid paymentMethodId' };
                }

                const updatedPayment = await tx.customerPayment.update({
                    where: { id: parsedPaymentId },
                    data: {
                        customerId: nextCustomerId,
                        paymentMethodId,
                        amount,
                        notes: paymentData?.notes || null,
                        paymentDate
                    },
                    include: {
                        paymentMethod: true
                    }
                });

                await tx.customerTransaction.deleteMany({
                    where: {
                        referenceType: 'PAYMENT',
                        referenceId: parsedPaymentId
                    }
                });

                await tx.customerTransaction.create({
                    data: {
                        customer: {
                            connect: { id: nextCustomerId }
                        },
                        date: paymentDate,
                        type: 'PAYMENT',
                        referenceType: 'PAYMENT',
                        referenceId: parsedPaymentId,
                        debit: 0,
                        credit: amount,
                        notes: `دفعة معدلة #${parsedPaymentId} - ${paymentData?.notes || 'دفعة نقدية'}`
                    }
                });

                const oldAmount = Math.max(0, toNumber(existingPayment.amount));

                if (existingPayment.customerId === nextCustomerId) {
                    const balanceDelta = oldAmount - amount;
                    if (balanceDelta !== 0) {
                        await applyCustomerFinancialDelta(tx, {
                            customerId: nextCustomerId,
                            balanceDelta,
                            paymentDate
                        });
                    } else {
                        await applyCustomerFinancialDelta(tx, {
                            customerId: nextCustomerId,
                            balanceDelta: 0,
                            paymentDate
                        });
                    }
                    await recalculateCustomerActivityDates(tx, nextCustomerId);
                } else {
                    await applyCustomerFinancialDelta(tx, {
                        customerId: existingPayment.customerId,
                        balanceDelta: oldAmount
                    });
                    await recalculateCustomerActivityDates(tx, existingPayment.customerId);

                    await applyCustomerFinancialDelta(tx, {
                        customerId: nextCustomerId,
                        balanceDelta: -amount,
                        paymentDate
                    });
                    await recalculateCustomerActivityDates(tx, nextCustomerId);
                }

                const rollbackResult = await rollbackTreasuryEntriesByReference(tx, 'PAYMENT', parsedPaymentId);
                throwIfResultError(rollbackResult, 'Failed to rollback payment treasury entries');
                const paymentTreasuryId = await resolveTreasuryId(tx, paymentData?.treasuryId);
                const treasuryEntryResult = await createTreasuryEntry(tx, {
                    treasuryId: paymentTreasuryId,
                    entryType: TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT,
                    direction: TREASURY_DIRECTION.IN,
                    amount,
                    notes: `Customer payment update #${parsedPaymentId}${paymentData?.notes ? ` - ${paymentData.notes}` : ''}`,
                    referenceType: 'PAYMENT',
                    referenceId: parsedPaymentId,
                    paymentMethodId,
                    entryDate: paymentDate,
                    idempotencyKey: generateIdempotencyKey('CUSTOMER_PAYMENT', [
                        parsedPaymentId,
                        paymentMethodId,
                        normalizeAmountForKey(amount),
                        'UPDATE'
                    ]),
                    createdByUserId: parsePositiveInt(paymentData?.createdByUserId ?? paymentData?.userId),
                    meta: {
                        source: 'updateCustomerPayment'
                    }
                });
                throwIfResultError(treasuryEntryResult);

                const currentCustomer = await tx.customer.findUnique({
                    where: { id: nextCustomerId },
                    select: { balance: true }
                });
                const balanceBeforePayment = Math.max(0, toNumber(currentCustomer?.balance) + amount);
                const fifoOutstandingRows = await getSaleOutstandingRowsForAllocation(tx, nextCustomerId, {
                    customerBalanceOverride: balanceBeforePayment
                });
                await applyAllocationsFromOutstandingRows(tx, {
                    outstandingRows: fifoOutstandingRows,
                    sourceType: PAYMENT_ALLOCATION_SOURCE_TYPE.CUSTOMER_PAYMENT,
                    amount,
                    customerId: nextCustomerId,
                    customerPaymentId: parsedPaymentId,
                    createdByUserId: parsePositiveInt(paymentData?.createdByUserId ?? paymentData?.userId),
                    note: `FIFO allocation for updated payment #${parsedPaymentId}`,
                    allocationDate: paymentDate
                });

                return { success: true, data: updatedPayment };
            });

            perf({ rows: result?.success ? 1 : 0 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async deleteCustomerPayment(paymentId) {
        const perf = startPerfTimer('db:deleteCustomerPayment', {
            paymentId: parseInt(paymentId, 10) || null
        });

        try {
            return await prisma.$transaction(async (tx) => {
                const payment = await tx.customerPayment.findUnique({
                    where: { id: parseInt(paymentId) },
                    select: {
                        id: true,
                        customerId: true,
                        amount: true,
                        paymentDate: true
                    }
                });

                if (!payment) {
                    return { error: 'Payment not found' };
                }

                await tx.customerTransaction.deleteMany({
                    where: {
                        customerId: payment.customerId,
                        referenceType: 'PAYMENT',
                        referenceId: parseInt(paymentId)
                    }
                });

                const rollbackResult = await rollbackTreasuryEntriesByReference(tx, 'PAYMENT', parseInt(paymentId));
                throwIfResultError(rollbackResult, 'Failed to rollback payment treasury entries');

                const deletedPayment = await tx.customerPayment.delete({
                    where: { id: parseInt(paymentId) }
                });

                await applyCustomerFinancialDelta(tx, {
                    customerId: payment.customerId,
                    balanceDelta: Math.max(0, toNumber(payment.amount))
                });

                await recalculateCustomerActivityDates(tx, payment.customerId);

                perf({ rows: 1 });
                return { success: true, data: deletedPayment };
            });
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async rebuildCustomerFinancials(customerId) {
        const parsedCustomerId = parsePositiveInt(customerId);
        if (!parsedCustomerId) {
            return { error: 'Invalid customerId' };
        }

        const perf = startPerfTimer('db:rebuildCustomerFinancials', {
            customerId: parsedCustomerId
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                const customer = await tx.customer.findUnique({
                    where: { id: parsedCustomerId },
                    select: { id: true }
                });

                if (!customer) {
                    return { error: 'Customer not found' };
                }

                const summary = await rebuildCustomerFinancialSummary(tx, parsedCustomerId);
                return { success: true, data: summary };
            });

            perf({ rows: result?.success ? 1 : 0 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async rebuildAllCustomersFinancials({ batchSize = 200, startAfterId = 0 } = {}) {
        const safeBatchSize = Math.min(1000, Math.max(10, parseInt(batchSize, 10) || 200));
        let cursorId = Math.max(0, parseInt(startAfterId, 10) || 0);

        const perf = startPerfTimer('db:rebuildAllCustomersFinancials', {
            batchSize: safeBatchSize,
            startAfterId: cursorId
        });

        try {
            let processed = 0;
            let updated = 0;
            let batches = 0;

            while (true) {
                const batchCustomers = await prisma.customer.findMany({
                    where: { id: { gt: cursorId } },
                    orderBy: { id: 'asc' },
                    take: safeBatchSize,
                    select: { id: true }
                });

                if (batchCustomers.length === 0) break;

                const batchIds = batchCustomers.map((customer) => customer.id);

                const updatedInBatch = await prisma.$transaction(async (tx) => {
                    const summaryMap = await calculateCustomerFinancialSummaries(tx, batchIds);
                    return persistCustomerFinancialSummaries(tx, summaryMap);
                });

                processed += batchIds.length;
                updated += updatedInBatch;
                batches += 1;
                cursorId = batchIds[batchIds.length - 1];

                console.log(`[REBUILD][CUSTOMERS] batch=${batches} processed=${processed} updated=${updated} cursor=${cursorId}`);
            }

            const result = {
                success: true,
                processed,
                updated,
                batches,
                batchSize: safeBatchSize
            };

            perf({ rows: processed });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async checkCustomerFinancialsHealth() {
        try {
            await prisma.customer.findFirst({
                select: {
                    id: true,
                    balance: true,
                    firstActivityDate: true,
                    lastPaymentDate: true,
                    financialsUpdatedAt: true
                }
            });

            return { ok: true };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    },

    // ==================== PAYMENT METHODS ====================
    async getPaymentMethods() {
        try {
            const methods = await prisma.paymentMethod.findMany({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' }
            });

            console.log('📋 طرق الدفع:', methods);
            return methods;
        } catch (error) {
            console.error('❌ خطأ في جلب طرق الدفع:', error);
            return [];
        }
    },

    async getPaymentMethodStats() {
        try {
            const stats = await prisma.paymentMethod.findMany({
                where: { isActive: true },
                include: {
                    payments: {
                        select: { amount: true }
                    }
                }
            });

            return stats.map(method => ({
                ...method,
                totalAmount: method.payments.reduce((sum, p) => sum + p.amount, 0),
                count: method.payments.length
            }));
        } catch (error) {
            console.error('❌ خطأ في جلب إحصائيات طرق الدفع:', error);
            return [];
        }
    },

    async createDepositReceipt(params = {}) {
        try {
            const amount = Math.max(0, toNumber(params?.amount));
            if (amount <= 0) return { error: 'Invalid deposit amount' };

            const customerId = parsePositiveInt(params?.customerId);
            const entryDate = parseDateOrDefault(params?.entryDate ?? params?.paymentDate, new Date());
            const createdByUserId = parsePositiveInt(params?.createdByUserId ?? params?.userId);

            return await prisma.$transaction(async (tx) => {
                let referenceId = parsePositiveInt(params?.referenceId ?? params?.depositReferenceId);
                if (!referenceId) {
                    const latestRef = await tx.treasuryEntry.findFirst({
                        where: { referenceType: 'DEPOSIT' },
                        orderBy: { referenceId: 'desc' },
                        select: { referenceId: true }
                    });
                    referenceId = Math.max(100000, parsePositiveInt(latestRef?.referenceId) || 100000) + 1;
                }

                const treasuryId = await resolveTreasuryId(tx, params?.treasuryId);
                const paymentMethodId = await resolvePaymentMethodId(
                    tx,
                    params?.paymentMethodId ?? params?.paymentMethod,
                    1
                );
                if (!paymentMethodId) {
                    return { error: 'Invalid paymentMethodId' };
                }

                const entryResult = await createTreasuryEntry(tx, {
                    treasuryId,
                    entryType: TREASURY_ENTRY_TYPE.DEPOSIT_IN,
                    direction: TREASURY_DIRECTION.IN,
                    amount,
                    notes: params?.notes || 'Deposit receipt',
                    referenceType: 'DEPOSIT',
                    referenceId,
                    paymentMethodId,
                    entryDate,
                    idempotencyKey: generateIdempotencyKey('DEPOSIT_RECEIPT', [
                        referenceId,
                        paymentMethodId,
                        normalizeAmountForKey(amount),
                        toDayLockDate(entryDate).toISOString()
                    ]),
                    createdByUserId,
                    meta: {
                        customerId,
                        referenceType: params?.referenceType || 'DEPOSIT'
                    }
                });
                throwIfResultError(entryResult);
                await writeAuditLog(tx, {
                    action: AUDIT_ACTION.DEPOSIT_RECEIPT_CREATE,
                    entityType: 'TreasuryEntry',
                    entityId: entryResult.entry.id,
                    treasuryId,
                    treasuryEntryId: entryResult.entry.id,
                    referenceType: 'DEPOSIT',
                    referenceId,
                    performedByUserId: createdByUserId,
                    note: `Deposit receipt #${referenceId}`,
                    meta: {
                        customerId,
                        amount,
                        paymentMethodId
                    }
                });

                return {
                    success: true,
                    data: {
                        referenceId,
                        entry: entryResult.entry
                    }
                };
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async applyDepositToSale(params = {}) {
        try {
            const saleId = parsePositiveInt(params?.saleId);
            const referenceId = parsePositiveInt(params?.depositReferenceId ?? params?.referenceId);
            const amountApplied = Math.max(0, toNumber(params?.amountApplied ?? params?.amount));
            const applyDate = parseDateOrDefault(params?.applyDate ?? params?.entryDate, new Date());
            const createdByUserId = parsePositiveInt(params?.createdByUserId ?? params?.userId);

            if (!saleId) return { error: 'Invalid saleId' };
            if (!referenceId) return { error: 'Invalid deposit reference' };
            if (amountApplied <= 0) return { error: 'Invalid amountApplied' };

            return await prisma.$transaction(async (tx) => {
                const sale = await tx.sale.findUnique({
                    where: { id: saleId },
                    select: { id: true, customerId: true }
                });
                if (!sale) return { error: 'Sale not found' };
                const customerId = parsePositiveInt(params?.customerId) || parsePositiveInt(sale.customerId);

                const depositSummary = await getDepositSummary(tx, referenceId);
                if (depositSummary?.error) return depositSummary;
                if (depositSummary.remaining + 0.0001 < amountApplied) {
                    return { error: 'Deposit remaining amount is insufficient' };
                }

                const depositInEntries = depositSummary.entries
                    .filter((entry) => entry.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_IN)
                    .sort((a, b) => a.id - b.id);
                if (depositInEntries.length === 0) {
                    return { error: 'No deposit receipt found for this reference' };
                }

                const depositEntryIds = depositInEntries.map((entry) => entry.id);
                const usedByEntry = await tx.paymentAllocation.groupBy({
                    by: ['treasuryEntryId'],
                    where: {
                        sourceType: PAYMENT_ALLOCATION_SOURCE_TYPE.DEPOSIT,
                        treasuryEntryId: { in: depositEntryIds }
                    },
                    _sum: { amount: true }
                });
                const usedMap = new Map();
                usedByEntry.forEach((row) => {
                    usedMap.set(row.treasuryEntryId, Math.max(0, toNumber(row?._sum?.amount)));
                });

                let remainingToApply = Number(amountApplied.toFixed(2));
                const createdAllocations = [];
                for (const depositEntry of depositInEntries) {
                    if (remainingToApply <= 0) break;
                    const entryAmount = Math.max(0, toNumber(depositEntry.amount));
                    const alreadyUsed = Math.max(0, toNumber(usedMap.get(depositEntry.id)));
                    const available = Number(Math.max(0, entryAmount - alreadyUsed).toFixed(2));
                    if (available <= 0) continue;

                    const allocationAmount = Number(Math.min(remainingToApply, available).toFixed(2));
                    if (allocationAmount <= 0) continue;

                    const allocation = await tx.paymentAllocation.create({
                        data: {
                            customerId: customerId || null,
                            saleId,
                            sourceType: PAYMENT_ALLOCATION_SOURCE_TYPE.DEPOSIT,
                            treasuryEntryId: depositEntry.id,
                            amount: allocationAmount,
                            allocationDate: applyDate,
                            createdByUserId,
                            note: params?.notes || `Apply deposit #${referenceId} to sale #${saleId}`
                        }
                    });
                    createdAllocations.push(allocation);
                    remainingToApply = Number((remainingToApply - allocationAmount).toFixed(2));
                }

                if (remainingToApply > 0.01) {
                    return { error: 'Unable to allocate requested amount from deposit balance' };
                }
                await writeAuditLog(tx, {
                    action: AUDIT_ACTION.DEPOSIT_APPLY_TO_SALE,
                    entityType: 'PaymentAllocation',
                    referenceType: 'DEPOSIT',
                    referenceId,
                    performedByUserId: createdByUserId,
                    note: `Apply deposit #${referenceId} to sale #${saleId}`,
                    meta: {
                        saleId,
                        customerId: customerId || null,
                        amountApplied,
                        allocationCount: createdAllocations.length
                    }
                });

                return {
                    success: true,
                    data: {
                        referenceId,
                        saleId,
                        amountApplied,
                        allocations: createdAllocations
                    }
                };
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async refundDeposit(params = {}) {
        try {
            const referenceId = parsePositiveInt(params?.depositReferenceId ?? params?.referenceId);
            const amount = Math.max(0, toNumber(params?.amount));
            if (!referenceId) return { error: 'Invalid deposit reference' };
            if (amount <= 0) return { error: 'Invalid refund amount' };

            const refundDate = parseDateOrDefault(params?.refundDate ?? params?.entryDate, new Date());
            const refundMode = String(params?.refundMode || REFUND_MODE.SAME_METHOD).trim().toUpperCase();
            const createdByUserId = parsePositiveInt(params?.createdByUserId ?? params?.userId);

            return await prisma.$transaction(async (tx) => {
                const depositSummary = await getDepositSummary(tx, referenceId);
                if (depositSummary?.error) return depositSummary;
                if (depositSummary.remaining + 0.0001 < amount) {
                    return { error: 'Deposit remaining amount is insufficient for refund' };
                }

                const sourceEntry = depositSummary.entries.find(
                    (entry) => entry.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_IN
                );
                if (!sourceEntry) {
                    return { error: 'No deposit receipt found for this reference' };
                }

                let paymentMethodId;
                if (refundMode === REFUND_MODE.CASH_ONLY) {
                    paymentMethodId = await resolveCashPaymentMethodId(tx, 1);
                } else {
                    paymentMethodId = await resolvePaymentMethodId(
                        tx,
                        params?.paymentMethodId ?? params?.paymentMethod ?? sourceEntry.paymentMethodId,
                        1
                    );
                }
                if (!paymentMethodId) {
                    return { error: 'Invalid paymentMethodId for refund' };
                }

                const customerIdFromMeta = parsePositiveInt(sourceEntry?.meta?.customerId);
                const customerId = parsePositiveInt(params?.customerId) || customerIdFromMeta;

                const refundEntryResult = await createTreasuryEntry(tx, {
                    treasuryId: sourceEntry.treasuryId,
                    entryType: TREASURY_ENTRY_TYPE.DEPOSIT_REFUND,
                    direction: TREASURY_DIRECTION.OUT,
                    amount,
                    notes: params?.notes || `Deposit refund #${referenceId}`,
                    referenceType: 'DEPOSIT',
                    referenceId,
                    paymentMethodId,
                    entryDate: refundDate,
                    idempotencyKey: generateIdempotencyKey('DEPOSIT_REFUND', [
                        referenceId,
                        paymentMethodId,
                        normalizeAmountForKey(amount),
                        refundMode
                    ]),
                    createdByUserId,
                    meta: {
                        refundMode
                    }
                });
                throwIfResultError(refundEntryResult);
                await writeAuditLog(tx, {
                    action: AUDIT_ACTION.DEPOSIT_REFUND,
                    entityType: 'TreasuryEntry',
                    entityId: refundEntryResult.entry.id,
                    treasuryId: refundEntryResult.entry.treasuryId,
                    treasuryEntryId: refundEntryResult.entry.id,
                    referenceType: 'DEPOSIT',
                    referenceId,
                    performedByUserId: createdByUserId,
                    note: `Deposit refund #${referenceId}`,
                    meta: {
                        amount,
                        refundMode,
                        paymentMethodId
                    }
                });

                return {
                    success: true,
                    data: {
                        referenceId,
                        entry: refundEntryResult.entry
                    }
                };
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== TREASURY ====================
    async getTreasuries() {
        try {
            let treasuries = await prisma.treasury.findMany({
                where: { isDeleted: false },
                include: {
                    _count: {
                        select: {
                            entries: true
                        }
                    }
                },
                orderBy: [
                    { isDefault: 'desc' },
                    { isActive: 'desc' },
                    { createdAt: 'asc' }
                ]
            });

            if (treasuries.length === 0) {
                await getOrCreateDefaultTreasury(prisma);
                treasuries = await prisma.treasury.findMany({
                    where: { isDeleted: false },
                    include: {
                        _count: {
                            select: {
                                entries: true
                            }
                        }
                    },
                    orderBy: [
                        { isDefault: 'desc' },
                        { isActive: 'desc' },
                        { createdAt: 'asc' }
                    ]
                });
            }

            if (treasuries.length > 0 && !treasuries.some((row) => row.isDefault)) {
                const fallbackDefault = await getOrCreateDefaultTreasury(prisma);
                treasuries = treasuries.map((row) => ({
                    ...row,
                    isDefault: row.id === fallbackDefault.id
                }));
            }

            const activeCount = treasuries.filter((row) => row.isActive).length;
            const linkedEntryAgg = await prisma.treasuryEntry.groupBy({
                by: ['treasuryId'],
                where: {
                    treasuryId: { in: treasuries.map((row) => row.id) },
                    entryType: { not: TREASURY_ENTRY_TYPE.OPENING_BALANCE }
                },
                _count: { _all: true }
            });
            const linkedEntryMap = new Map(
                linkedEntryAgg.map((row) => [row.treasuryId, row?._count?._all || 0])
            );

            // Fetch payment methods to map IDs to codes
            const paymentMethods = await prisma.paymentMethod.findMany();
            const pmMap = new Map(paymentMethods.map(pm => [pm.id, { code: pm.code, name: pm.name }]));

            // Aggregate balances by Treasury + PaymentMethod
            // We need to sum amounts based on direction (IN vs OUT)
            // Group by: treasuryId, paymentMethodId, direction
            const breakdownAgg = await prisma.treasuryEntry.groupBy({
                by: ['treasuryId', 'paymentMethodId', 'direction'],
                where: {
                    treasuryId: { in: treasuries.map((row) => row.id) },
                    entryType: { not: TREASURY_ENTRY_TYPE.OPENING_BALANCE } // Optional: exclude opening balance if it doesn't have PM?
                },
                _sum: { amount: true },
                _count: { _all: true }
            });

            // Process aggregation into a map: treasuryId -> { [pmCode]: { balance, count, name } }
            const breakdownMap = {}; // { [treasuryId]: [ { code, name, balance, count } ] }

            breakdownAgg.forEach(row => {
                const tid = row.treasuryId;
                const pmid = row.paymentMethodId;
                const direction = row.direction;
                const amount = row._sum.amount || 0;
                const count = row._count._all || 0;

                if (!breakdownMap[tid]) breakdownMap[tid] = {};

                // key for the method in the map (e.g., 'CASH', 'VODAFONE_CASH')
                // If paymentMethodId is null, usually means CASH or internal. Let's assume CASH default for now or 'OTHER'
                let code = 'CASH';
                let name = 'نقدي';

                if (pmid && pmMap.has(pmid)) {
                    code = pmMap.get(pmid).code;
                    name = pmMap.get(pmid).name;
                } else if (pmid === null) {
                    code = 'CASH';
                    name = 'نقدي';
                } else {
                    code = 'OTHER';
                    name = 'أخرى';
                }

                if (!breakdownMap[tid][code]) {
                    breakdownMap[tid][code] = { code, name, balance: 0, count: 0 };
                }

                if (direction === 'IN') {
                    breakdownMap[tid][code].balance += amount;
                } else {
                    breakdownMap[tid][code].balance -= amount;
                }
                breakdownMap[tid][code].count += count;
            });

            const enriched = treasuries.map((treasury) => {
                const nonOpeningEntryCount = linkedEntryMap.get(treasury.id) || 0;
                const hasLinkedOperations = nonOpeningEntryCount > 0;
                const canDelete = treasury.isActive
                    ? activeCount > 1
                    : activeCount >= 1;

                // NEW: Get breakdown
                const breakdownObj = breakdownMap[treasury.id] || {};
                const breakdown = Object.values(breakdownObj).sort((a, b) => b.balance - a.balance);

                return {
                    ...treasury,
                    nonOpeningEntryCount,
                    hasLinkedOperations,
                    canEdit: true, // Always allow editing (name, description, etc.)
                    canDelete,
                    breakdown
                };
            });

            const totalBalance = enriched.reduce(
                (sum, treasury) => sum + toNumber(treasury.currentBalance),
                0
            );

            return {
                data: enriched,
                totalBalance
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async createTreasury(treasuryData = {}) {
        try {
            const name = String(treasuryData?.name || '').trim();
            const requestedCode = normalizeTreasuryCode(treasuryData?.code || name);
            const openingBalance = Math.max(0, toNumber(treasuryData?.openingBalance));
            const openingDate = parseDateOrDefault(treasuryData?.openingDate, new Date());
            const requestedDefault = Boolean(treasuryData?.isDefault);

            if (!name) {
                return { error: 'Treasury name is required' };
            }

            return await prisma.$transaction(async (tx) => {
                let code = requestedCode;
                if (!code) {
                    // If name/code contains unsupported chars only, fallback to generated code.
                    code = generateTreasuryCode();
                }

                const defaultCount = await tx.treasury.count({
                    where: { isDefault: true, isDeleted: false }
                });
                const shouldSetAsDefault = requestedDefault || defaultCount === 0;

                let createdTreasury = await tx.treasury.create({
                    data: {
                        name,
                        code,
                        description: treasuryData?.description || null,
                        openingBalance,
                        currentBalance: 0,
                        isActive: true,
                        isDefault: false
                    }
                });

                if (openingBalance > 0) {
                    const openingEntryResult = await createTreasuryEntry(tx, {
                        treasuryId: createdTreasury.id,
                        entryType: TREASURY_ENTRY_TYPE.OPENING_BALANCE,
                        direction: TREASURY_DIRECTION.IN,
                        amount: openingBalance,
                        notes: treasuryData?.openingNotes || 'Opening balance',
                        entryDate: openingDate,
                        allowNegative: true
                    });
                    throwIfResultError(openingEntryResult);
                }

                if (shouldSetAsDefault) {
                    const defaultResult = await setDefaultTreasuryInternal(tx, createdTreasury.id, {
                        forceActivate: true
                    });
                    if (defaultResult?.error) {
                        return { error: defaultResult.error };
                    }
                    createdTreasury = defaultResult.treasury;
                }

                await writeAuditLog(tx, {
                    action: AUDIT_ACTION.TREASURY_CREATE,
                    entityType: 'Treasury',
                    entityId: createdTreasury.id,
                    treasuryId: createdTreasury.id,
                    performedByUserId: parsePositiveInt(treasuryData?.createdByUserId ?? treasuryData?.userId),
                    note: `Create treasury ${createdTreasury.name}`,
                    meta: {
                        code: createdTreasury.code,
                        openingBalance,
                        isDefault: Boolean(createdTreasury?.isDefault)
                    }
                });

                return createdTreasury;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateTreasury(id, treasuryData = {}) {
        try {
            const treasuryId = parsePositiveInt(id);
            if (!treasuryId) {
                return { error: 'Invalid treasuryId' };
            }

            const hasName = Object.prototype.hasOwnProperty.call(treasuryData, 'name');
            const hasCode = Object.prototype.hasOwnProperty.call(treasuryData, 'code');
            const hasDescription = Object.prototype.hasOwnProperty.call(treasuryData, 'description');
            const hasIsActive = Object.prototype.hasOwnProperty.call(treasuryData, 'isActive');
            const hasIsDefault = Object.prototype.hasOwnProperty.call(treasuryData, 'isDefault');
            const hasOpeningBalance = Object.prototype.hasOwnProperty.call(treasuryData, 'openingBalance');

            const data = {};
            if (hasName) {
                const name = String(treasuryData?.name || '').trim();
                if (!name) return { error: 'Treasury name cannot be empty' };
                data.name = name;
            }
            if (hasCode) {
                const code = normalizeTreasuryCode(treasuryData?.code);
                if (!code) return { error: 'Treasury code cannot be empty' };
                data.code = code;
            }
            if (hasDescription) {
                data.description = treasuryData?.description || null;
            }
            if (hasIsActive) {
                data.isActive = Boolean(treasuryData.isActive);
            }

            const openingBalance = hasOpeningBalance
                ? Math.max(0, toNumber(treasuryData?.openingBalance))
                : null;
            const openingDate = parseDateOrDefault(treasuryData?.openingDate, new Date());
            const requestedDefault = hasIsDefault ? Boolean(treasuryData?.isDefault) : null;
            const updatedByUserId = parsePositiveInt(treasuryData?.updatedByUserId ?? treasuryData?.userId);

            if (Object.keys(data).length === 0 && !hasIsDefault && !hasOpeningBalance) {
                return { error: 'No fields to update' };
            }

            return await prisma.$transaction(async (tx) => {
                const existingTreasury = await tx.treasury.findUnique({
                    where: { id: treasuryId },
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        isActive: true,
                        isDefault: true,
                        isDeleted: true,
                        openingBalance: true
                    }
                });
                if (!existingTreasury) {
                    return { error: 'Treasury not found' };
                }
                if (existingTreasury.isDeleted) {
                    return { error: 'Treasury is deleted' };
                }

                const linkStats = await getTreasuryOperationLinkStats(tx, treasuryId);
                const isMasterDataChangeRequested = (
                    hasName ||
                    hasCode ||
                    hasDescription ||
                    hasIsActive ||
                    hasOpeningBalance
                );
                if (linkStats.hasLinkedOperations && isMasterDataChangeRequested) {
                    return { error: 'Cannot edit treasury because it is linked to operations' };
                }

                if (hasIsActive && data.isActive === false) {
                    const activeCount = await tx.treasury.count({
                        where: { isActive: true, id: { not: treasuryId } }
                    });
                    if (activeCount === 0) {
                        return { error: 'At least one active treasury is required' };
                    }
                    if (existingTreasury.isDefault && requestedDefault !== false) {
                        return { error: 'Default treasury cannot be deactivated. Set another default first' };
                    }
                }

                if (hasOpeningBalance) {
                    data.openingBalance = openingBalance;
                }

                const changedFields = [];
                let updatedTreasury = existingTreasury;

                if (Object.keys(data).length > 0) {
                    updatedTreasury = await tx.treasury.update({
                        where: { id: treasuryId },
                        data
                    });
                    changedFields.push(...Object.keys(data));
                }

                if (hasOpeningBalance) {
                    const openingDelta = Number((openingBalance - toNumber(existingTreasury.openingBalance)).toFixed(2));
                    if (Math.abs(openingDelta) > 0.0001) {
                        const openingAdjustResult = await createTreasuryEntry(tx, {
                            treasuryId,
                            entryType: openingDelta > 0
                                ? TREASURY_ENTRY_TYPE.OPENING_BALANCE
                                : TREASURY_ENTRY_TYPE.ADJUSTMENT_OUT,
                            direction: openingDelta > 0
                                ? TREASURY_DIRECTION.IN
                                : TREASURY_DIRECTION.OUT,
                            amount: Math.abs(openingDelta),
                            notes: `Opening balance update for treasury #${treasuryId}`,
                            entryDate: openingDate,
                            allowNegative: true,
                            idempotencyKey: generateIdempotencyKey('TREASURY_OPENING_BALANCE_UPDATE', [
                                treasuryId,
                                normalizeAmountForKey(openingBalance),
                                openingDate.toISOString(),
                            ]),
                            createdByUserId: updatedByUserId,
                            meta: {
                                source: 'updateTreasury',
                                openingBalanceBefore: toNumber(existingTreasury.openingBalance),
                                openingBalanceAfter: openingBalance
                            }
                        });
                        throwIfResultError(openingAdjustResult);
                    }
                }

                if (hasIsDefault) {
                    if (requestedDefault) {
                        const setDefaultResult = await setDefaultTreasuryInternal(tx, treasuryId, {
                            forceActivate: true
                        });
                        if (setDefaultResult?.error) return { error: setDefaultResult.error };
                        updatedTreasury = setDefaultResult.treasury;
                        if (!changedFields.includes('isDefault')) changedFields.push('isDefault');
                    } else if (existingTreasury.isDefault) {
                        const replacementTreasury = await tx.treasury.findFirst({
                            where: {
                                id: { not: treasuryId },
                                isActive: true,
                                isDeleted: false
                            },
                            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                            select: { id: true }
                        });
                        if (!replacementTreasury?.id) {
                            return { error: 'Cannot remove default treasury without another active treasury' };
                        }

                        const replacementSetResult = await setDefaultTreasuryInternal(tx, replacementTreasury.id, {
                            forceActivate: true
                        });
                        if (replacementSetResult?.error) return { error: replacementSetResult.error };

                        updatedTreasury = await tx.treasury.update({
                            where: { id: treasuryId },
                            data: { isDefault: false }
                        });
                        if (!changedFields.includes('isDefault')) changedFields.push('isDefault');
                    }
                }

                if (changedFields.length === 0) {
                    return { error: 'No fields to update' };
                }

                await writeAuditLog(tx, {
                    action: AUDIT_ACTION.TREASURY_UPDATE,
                    entityType: 'Treasury',
                    entityId: updatedTreasury.id,
                    treasuryId: updatedTreasury.id,
                    performedByUserId: updatedByUserId,
                    note: `Update treasury ${updatedTreasury.name}`,
                    meta: {
                        changedFields
                    }
                });

                return updatedTreasury;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async setDefaultTreasury(id, options = {}) {
        try {
            const treasuryId = parsePositiveInt(id ?? options?.treasuryId);
            if (!treasuryId) {
                return { error: 'Invalid treasuryId' };
            }

            return await prisma.$transaction(async (tx) => {
                const result = await setDefaultTreasuryInternal(tx, treasuryId, {
                    forceActivate: true
                });
                if (result?.error) return { error: result.error };

                await writeAuditLog(tx, {
                    action: AUDIT_ACTION.TREASURY_DEFAULT_SET,
                    entityType: 'Treasury',
                    entityId: treasuryId,
                    treasuryId,
                    performedByUserId: parsePositiveInt(options?.updatedByUserId ?? options?.userId),
                    note: `Set treasury #${treasuryId} as default`,
                    meta: {
                        source: options?.source || 'setDefaultTreasury'
                    }
                });

                return result.treasury;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteTreasury(id, options = {}) {
        try {
            const treasuryId = parsePositiveInt(id);
            if (!treasuryId) {
                return { error: 'Invalid treasuryId' };
            }

            return await prisma.$transaction(async (tx) => {
                const treasury = await tx.treasury.findUnique({
                    where: { id: treasuryId },
                    include: {
                        _count: {
                            select: {
                                entries: true
                            }
                        }
                    }
                });

                if (!treasury) {
                    return { error: 'Treasury not found' };
                }
                if (treasury.isDeleted) {
                    return { error: 'Treasury already deleted' };
                }

                const linkStats = await getTreasuryOperationLinkStats(tx, treasuryId);

                if (treasury.isActive) {
                    const activeCount = await tx.treasury.count({
                        where: { isActive: true, isDeleted: false, id: { not: treasuryId } }
                    });
                    if (activeCount < 1) {
                        return { error: 'At least one active treasury is required' };
                    }
                }

                if (treasury.isDefault) {
                    const replacementTreasury = await tx.treasury.findFirst({
                        where: {
                            id: { not: treasuryId },
                            isActive: true,
                            isDeleted: false
                        },
                        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                        select: { id: true }
                    });
                    if (!replacementTreasury?.id) {
                        return { error: 'Cannot delete default treasury without another active treasury' };
                    }

                    const replacementSetResult = await setDefaultTreasuryInternal(tx, replacementTreasury.id, {
                        forceActivate: true
                    });
                    if (replacementSetResult?.error) {
                        return { error: replacementSetResult.error };
                    }
                }

                const deletedByUserId = parsePositiveInt(options?.deletedByUserId ?? options?.userId);

                if (linkStats.hasLinkedOperations) {
                    const archiveCode = normalizeTreasuryCode(
                        `DEL_${treasury.code}_${treasuryId}_${Date.now().toString(36)}`
                    ) || `DEL_${treasuryId}_${Date.now().toString(36).toUpperCase()}`;
                    const archiveName = `${treasury.name} [محذوف]`;

                    const archivedTreasury = await tx.treasury.update({
                        where: { id: treasuryId },
                        data: {
                            isDeleted: true,
                            isActive: false,
                            isDefault: false,
                            code: archiveCode,
                            name: archiveName
                        }
                    });

                    await writeAuditLog(tx, {
                        action: AUDIT_ACTION.TREASURY_DELETE,
                        entityType: 'Treasury',
                        entityId: archivedTreasury.id,
                        treasuryId: archivedTreasury.id,
                        performedByUserId: deletedByUserId,
                        note: `Archive treasury ${treasury.name}`,
                        meta: {
                            mode: 'SOFT_DELETE',
                            deletedTreasuryId: archivedTreasury.id,
                            previousCode: treasury.code,
                            previousName: treasury.name,
                            linkedOperations: linkStats
                        }
                    });

                    return {
                        success: true,
                        data: archivedTreasury,
                        softDeleted: true
                    };
                }

                if (treasury._count.entries > 0) {
                    await tx.treasuryEntry.deleteMany({
                        where: { treasuryId }
                    });
                }

                const deletedTreasury = await tx.treasury.delete({
                    where: { id: treasuryId }
                });

                await writeAuditLog(tx, {
                    action: AUDIT_ACTION.TREASURY_DELETE,
                    entityType: 'Treasury',
                    entityId: deletedTreasury.id,
                    treasuryId: null,
                    performedByUserId: deletedByUserId,
                    note: `Delete treasury ${deletedTreasury.name}`,
                    meta: {
                        mode: 'HARD_DELETE',
                        deletedTreasuryId: deletedTreasury.id,
                        code: deletedTreasury.code,
                        isDefault: Boolean(deletedTreasury?.isDefault)
                    }
                });

                return deletedTreasury;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async createTreasuryTransaction(transactionData = {}) {
        try {
            const transactionTypeRaw = String(
                transactionData?.transactionType || transactionData?.type || 'IN'
            ).trim().toUpperCase();
            const transactionType = ['IN', 'OUT', 'TRANSFER'].includes(transactionTypeRaw)
                ? transactionTypeRaw
                : 'IN';

            const amount = Math.max(0, toNumber(transactionData?.amount));
            if (amount <= 0) {
                return { error: 'Invalid transaction amount' };
            }

            const entryDate = parseDateOrDefault(transactionData?.entryDate, new Date());
            const notes = String(transactionData?.notes || '').trim();
            const createdByUserId = parsePositiveInt(
                transactionData?.createdByUserId ?? transactionData?.userId
            );

            return await prisma.$transaction(async (tx) => {
                if (transactionType === 'TRANSFER') {
                    const sourceTreasuryId = parsePositiveInt(
                        transactionData?.sourceTreasuryId ?? transactionData?.fromTreasuryId
                    );
                    const targetTreasuryId = parsePositiveInt(
                        transactionData?.targetTreasuryId ?? transactionData?.toTreasuryId
                    );

                    if (!sourceTreasuryId || !targetTreasuryId) {
                        return { error: 'Transfer requires source and target treasuries' };
                    }
                    if (sourceTreasuryId === targetTreasuryId) {
                        return { error: 'Source and target treasuries must be different' };
                    }

                    const [sourceTreasury, targetTreasury] = await Promise.all([
                        tx.treasury.findFirst({
                            where: { id: sourceTreasuryId, isActive: true },
                            select: { id: true }
                        }),
                        tx.treasury.findFirst({
                            where: { id: targetTreasuryId, isActive: true },
                            select: { id: true }
                        })
                    ]);

                    if (!sourceTreasury || !targetTreasury) {
                        return { error: 'Source or target treasury is invalid/inactive' };
                    }

                    const outEntryResult = await createTreasuryEntry(tx, {
                        treasuryId: sourceTreasuryId,
                        entryType: TREASURY_ENTRY_TYPE.TRANSFER_OUT,
                        direction: TREASURY_DIRECTION.OUT,
                        amount,
                        notes: notes || `Transfer to treasury #${targetTreasuryId}`,
                        sourceTreasuryId,
                        targetTreasuryId,
                        entryDate,
                        idempotencyKey: generateIdempotencyKey('TREASURY_TRANSFER', [
                            sourceTreasuryId,
                            targetTreasuryId,
                            normalizeAmountForKey(amount),
                            toDayLockDate(entryDate).toISOString(),
                            'OUT'
                        ]),
                        createdByUserId
                    });
                    throwIfResultError(outEntryResult);

                    const inEntryResult = await createTreasuryEntry(tx, {
                        treasuryId: targetTreasuryId,
                        entryType: TREASURY_ENTRY_TYPE.TRANSFER_IN,
                        direction: TREASURY_DIRECTION.IN,
                        amount,
                        notes: notes || `Transfer from treasury #${sourceTreasuryId}`,
                        sourceTreasuryId,
                        targetTreasuryId,
                        entryDate,
                        allowNegative: true,
                        idempotencyKey: generateIdempotencyKey('TREASURY_TRANSFER', [
                            sourceTreasuryId,
                            targetTreasuryId,
                            normalizeAmountForKey(amount),
                            toDayLockDate(entryDate).toISOString(),
                            'IN'
                        ]),
                        createdByUserId
                    });
                    throwIfResultError(inEntryResult);

                    return {
                        success: true,
                        data: {
                            sourceEntry: outEntryResult.entry,
                            targetEntry: inEntryResult.entry
                        }
                    };
                }

                const treasuryId = await resolveTreasuryId(tx, transactionData?.treasuryId);
                const paymentMethodId = await resolvePaymentMethodId(
                    tx,
                    transactionData?.paymentMethodId ?? transactionData?.paymentMethod,
                    1
                );
                const direction = transactionType === 'OUT'
                    ? TREASURY_DIRECTION.OUT
                    : TREASURY_DIRECTION.IN;

                const providedEntryType = String(transactionData?.entryType || '').trim().toUpperCase();
                const entryType = TREASURY_ENTRY_TYPE_SET.has(providedEntryType)
                    ? providedEntryType
                    : (direction === TREASURY_DIRECTION.OUT
                        ? TREASURY_ENTRY_TYPE.MANUAL_OUT
                        : TREASURY_ENTRY_TYPE.MANUAL_IN);

                const entryResult = await createTreasuryEntry(tx, {
                    treasuryId,
                    entryType,
                    direction,
                    amount,
                    notes: notes || null,
                    referenceType: transactionData?.referenceType || null,
                    referenceId: transactionData?.referenceId || null,
                    paymentMethodId,
                    entryDate,
                    idempotencyKey: normalizeIdempotencyKey(transactionData?.idempotencyKey),
                    createdByUserId,
                    meta: transactionData?.meta ?? null
                });

                throwIfResultError(entryResult);

                return { success: true, data: entryResult.entry };
            });
        } catch (error) {
            return { error: error.message };
        }
    },
    async getPaymentMethodReport(params = {}) {
        try {
            const treasuryId = parsePositiveInt(params.treasuryId);
            const paymentMethodId = parsePositiveInt(params.paymentMethodId);
            if (!treasuryId || !paymentMethodId) return { error: 'Missing treasuryId or paymentMethodId' };

            const where = {
                treasuryId,
                paymentMethodId,
                entryType: { not: TREASURY_ENTRY_TYPE.OPENING_BALANCE },
                isDeleted: false // Assuming we might add soft delete later
            };

            if (params.fromDate) where.entryDate = { ...where.entryDate, gte: startOfDay(params.fromDate) };
            if (params.toDate) where.entryDate = { ...where.entryDate, lte: endOfDay(params.toDate) };

            // Fetch entries
            const entries = await prisma.treasuryEntry.findMany({
                where: {
                    treasuryId,
                    paymentMethodId,
                    entryType: { not: TREASURY_ENTRY_TYPE.OPENING_BALANCE }
                },
                include: {
                    paymentMethod: true
                },
                orderBy: { entryDate: 'desc' }
            });

            // Enrich with entity names (Customer/Supplier)
            // We need to look up referenceType/referenceId
            // Optimization: Collect IDs and fetch in batches
            const customerPaymentIds = [];
            const saleIds = [];
            const supplierPaymentIds = [];

            entries.forEach(e => {
                if (e.referenceType === 'PAYMENT') customerPaymentIds.push(e.referenceId);
                else if (e.referenceType === 'SALE') saleIds.push(e.referenceId);
                else if (e.referenceType === 'SUPPLIER_PAYMENT') supplierPaymentIds.push(e.referenceId);
            });

            const customerPayments = customerPaymentIds.length > 0
                ? await prisma.customerPayment.findMany({ where: { id: { in: customerPaymentIds } }, include: { customer: true } })
                : [];
            const sales = saleIds.length > 0
                ? await prisma.sale.findMany({ where: { id: { in: saleIds } }, include: { customer: true } })
                : [];
            const supplierPayments = supplierPaymentIds.length > 0
                ? await prisma.supplierPayment.findMany({ where: { id: { in: supplierPaymentIds } }, include: { supplier: true } })
                : [];

            const cpMap = new Map(customerPayments.map(i => [i.id, i.customer?.name || 'Unknown Customer']));
            const saleMap = new Map(sales.map(i => [i.id, i.customer?.name || 'Unknown Customer']));
            const spMap = new Map(supplierPayments.map(i => [i.id, i.supplier?.name || 'Unknown Supplier']));

            const enrichedEntries = entries.map(e => {
                let entityName = '-';
                if (e.referenceType === 'PAYMENT') entityName = cpMap.get(e.referenceId) || '-';
                else if (e.referenceType === 'SALE') entityName = saleMap.get(e.referenceId) || '-';
                else if (e.referenceType === 'SUPPLIER_PAYMENT') entityName = spMap.get(e.referenceId) || '-';

                return {
                    ...e,
                    entityName
                };
            });

            // Calculate totals
            const totalIn = enrichedEntries.reduce((sum, e) => e.direction === 'IN' ? sum + e.amount : sum, 0);
            const totalOut = enrichedEntries.reduce((sum, e) => e.direction === 'OUT' ? sum + e.amount : sum, 0);

            return {
                data: enrichedEntries,
                summary: { totalIn, totalOut, net: totalIn - totalOut }
            };

        } catch (error) {
            return { error: error.message };
        }
    },

    async getTreasuryEntries(params = {}) {
        try {
            const page = Math.max(1, parseInt(params?.page, 10) || 1);
            const pageSize = Math.min(500, Math.max(1, parseInt(params?.pageSize, 10) || 100));
            const skip = (page - 1) * pageSize;

            const where = {};
            const treasuryId = parsePositiveInt(params?.treasuryId);
            const direction = String(params?.direction || '').trim().toUpperCase();
            const entryType = String(params?.entryType || '').trim().toUpperCase();
            const referenceType = String(params?.referenceType || '').trim();
            const search = String(params?.search || '').trim();
            const paymentMethodId = parsePositiveInt(params?.paymentMethodId);

            if (treasuryId) where.treasuryId = treasuryId;
            if (paymentMethodId) where.paymentMethodId = paymentMethodId;
            if (direction && direction !== 'ALL' && Object.values(TREASURY_DIRECTION).includes(direction)) {
                where.direction = direction;
            }
            if (entryType && entryType !== 'ALL' && TREASURY_ENTRY_TYPE_SET.has(entryType)) {
                where.entryType = entryType;
            }
            if (referenceType) {
                where.referenceType = referenceType;
            }
            if (params?.fromDate || params?.toDate) {
                where.entryDate = {};
                if (params?.fromDate) where.entryDate.gte = startOfDay(params.fromDate);
                if (params?.toDate) where.entryDate.lte = endOfDay(params.toDate);
            }
            if (search) {
                where.OR = [
                    { notes: { contains: search, mode: 'insensitive' } },
                    { referenceType: { contains: search, mode: 'insensitive' } }
                ];
            }

            const [entries, total, totalsByDirection] = await Promise.all([
                prisma.treasuryEntry.findMany({
                    where,
                    skip,
                    take: pageSize,
                    include: {
                        treasury: true,
                        paymentMethod: true,
                        sourceTreasury: true,
                        targetTreasury: true
                    },
                    orderBy: [
                        { id: 'desc' }
                    ]
                }),
                prisma.treasuryEntry.count({ where }),
                prisma.treasuryEntry.groupBy({
                    by: ['direction'],
                    where,
                    _sum: { amount: true }
                })
            ]);

            let totalIn = 0;
            let totalOut = 0;
            totalsByDirection.forEach((row) => {
                const amountByDirection = row?._sum?.amount || 0;
                if (row.direction === TREASURY_DIRECTION.IN) totalIn += amountByDirection;
                else totalOut += amountByDirection;
            });

            return {
                data: entries,
                total,
                page,
                totalPages: Math.max(1, Math.ceil(total / pageSize)),
                summary: {
                    totalIn,
                    totalOut,
                    net: totalIn - totalOut
                }
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async getDailyRevenueReportLegacy(params = {}) {
        try {
            const reportDate = params?.date || new Date();
            const from = startOfDay(reportDate);
            const to = endOfDay(reportDate);
            const previousFrom = new Date(from);
            previousFrom.setDate(previousFrom.getDate() - 1);
            const previousTo = new Date(to);
            previousTo.setDate(previousTo.getDate() - 1);
            const treasuryId = parsePositiveInt(params?.treasuryId);

            const where = {
                entryDate: {
                    gte: from,
                    lte: to
                },
                ...(treasuryId ? { treasuryId } : {})
            };

            const previousWhere = {
                entryDate: {
                    gte: previousFrom,
                    lte: previousTo
                },
                ...(treasuryId ? { treasuryId } : {})
            };

            const [entries, totalsByDirection, previousTotalsByDirection] = await Promise.all([
                prisma.treasuryEntry.findMany({
                    where,
                    include: {
                        treasury: true,
                        paymentMethod: true,
                        sourceTreasury: true,
                        targetTreasury: true
                    },
                    orderBy: [
                        { entryDate: 'desc' },
                        { id: 'desc' }
                    ]
                }),
                prisma.treasuryEntry.groupBy({
                    by: ['direction'],
                    where,
                    _sum: { amount: true }
                }),
                prisma.treasuryEntry.groupBy({
                    by: ['direction'],
                    where: previousWhere,
                    _sum: { amount: true }
                })
            ]);

            let totalIn = 0;
            let totalOut = 0;
            totalsByDirection.forEach((row) => {
                const amountByDirection = row?._sum?.amount || 0;
                if (row.direction === TREASURY_DIRECTION.IN) totalIn += amountByDirection;
                else totalOut += amountByDirection;
            });

            let previousIn = 0;
            let previousOut = 0;
            previousTotalsByDirection.forEach((row) => {
                const amountByDirection = row?._sum?.amount || 0;
                if (row.direction === TREASURY_DIRECTION.IN) previousIn += amountByDirection;
                else previousOut += amountByDirection;
            });

            const byPaymentMethodMap = new Map();
            const byEntryTypeMap = new Map();

            entries.forEach((entry) => {
                const paymentMethodId = entry?.paymentMethod?.id || 0;
                const paymentMethodCode = entry?.paymentMethod?.code || 'UNSPECIFIED';
                const paymentMethodName = entry?.paymentMethod?.name || 'غير محدد';
                const paymentMethodKey = `${paymentMethodId}:${paymentMethodCode}`;
                const signedAmount = entry.direction === TREASURY_DIRECTION.IN
                    ? toNumber(entry.amount)
                    : -toNumber(entry.amount);

                if (!byPaymentMethodMap.has(paymentMethodKey)) {
                    byPaymentMethodMap.set(paymentMethodKey, {
                        paymentMethodId: paymentMethodId || null,
                        code: paymentMethodCode,
                        name: paymentMethodName,
                        totalIn: 0,
                        totalOut: 0,
                        net: 0,
                        count: 0
                    });
                }
                const methodRow = byPaymentMethodMap.get(paymentMethodKey);
                if (entry.direction === TREASURY_DIRECTION.IN) methodRow.totalIn += toNumber(entry.amount);
                else methodRow.totalOut += toNumber(entry.amount);
                methodRow.net += signedAmount;
                methodRow.count += 1;

                const typeKey = entry.entryType;
                if (!byEntryTypeMap.has(typeKey)) {
                    byEntryTypeMap.set(typeKey, {
                        entryType: typeKey,
                        totalIn: 0,
                        totalOut: 0,
                        net: 0,
                        count: 0
                    });
                }
                const typeRow = byEntryTypeMap.get(typeKey);
                if (entry.direction === TREASURY_DIRECTION.IN) typeRow.totalIn += toNumber(entry.amount);
                else typeRow.totalOut += toNumber(entry.amount);
                typeRow.net += signedAmount;
                typeRow.count += 1;
            });

            const net = totalIn - totalOut;
            const previousNet = previousIn - previousOut;

            return {
                date: from.toISOString().split('T')[0],
                summary: {
                    totalIn,
                    totalOut,
                    net,
                    previousDayNet: previousNet,
                    changeFromPreviousDay: net - previousNet
                },
                byPaymentMethod: [...byPaymentMethodMap.values()].sort((a, b) => b.net - a.net),
                byEntryType: [...byEntryTypeMap.values()].sort((a, b) => b.net - a.net),
                entries
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async getDailyRevenueReport(params = {}) {
        try {
            const { from, to, isSingleDay } = resolveReportRange(params);
            const treasuryId = parsePositiveInt(params?.treasuryId);
            const includeDepositsInRevenue = Boolean(params?.includeDepositsInRevenue);
            const rangeMs = endOfDay(to).getTime() - startOfDay(from).getTime();
            const rangeDays = Math.max(1, Math.ceil((rangeMs + 1) / (24 * 60 * 60 * 1000)));
            const previousRange = shiftDateRange({ from, to }, rangeDays);

            const where = {
                entryDate: {
                    gte: from,
                    lte: to
                },
                ...(treasuryId ? { treasuryId } : {})
            };
            const previousWhere = {
                entryDate: {
                    gte: previousRange.from,
                    lte: previousRange.to
                },
                ...(treasuryId ? { treasuryId } : {})
            };

            const revenueEntryTypes = [
                TREASURY_ENTRY_TYPE.SALE_INCOME,
                TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT,
                TREASURY_ENTRY_TYPE.DEPOSIT_IN,
                TREASURY_ENTRY_TYPE.DEPOSIT_REFUND
            ];

            const [
                entries,
                totalsByDirection,
                previousTotalsByDirection,
                previousRevenueByType,
                salesAgg,
                previousSalesAgg,
                returnsAgg,
                previousReturnsAgg
            ] = await Promise.all([
                prisma.treasuryEntry.findMany({
                    where,
                    include: {
                        treasury: true,
                        paymentMethod: true,
                        sourceTreasury: true,
                        targetTreasury: true
                    },
                    orderBy: [
                        { entryDate: 'desc' },
                        { id: 'desc' }
                    ]
                }),
                prisma.treasuryEntry.groupBy({
                    by: ['direction'],
                    where,
                    _sum: { amount: true }
                }),
                prisma.treasuryEntry.groupBy({
                    by: ['direction'],
                    where: previousWhere,
                    _sum: { amount: true }
                }),
                prisma.treasuryEntry.groupBy({
                    by: ['entryType', 'direction'],
                    where: {
                        ...previousWhere,
                        entryType: { in: revenueEntryTypes }
                    },
                    _sum: { amount: true }
                }),
                prisma.sale.aggregate({
                    where: {
                        invoiceDate: {
                            gte: from,
                            lte: to
                        }
                    },
                    _sum: { total: true },
                    _count: { id: true }
                }),
                prisma.sale.aggregate({
                    where: {
                        invoiceDate: {
                            gte: previousRange.from,
                            lte: previousRange.to
                        }
                    },
                    _sum: { total: true },
                    _count: { id: true }
                }),
                prisma.return.aggregate({
                    where: {
                        createdAt: {
                            gte: from,
                            lte: to
                        }
                    },
                    _sum: { total: true },
                    _count: { id: true }
                }),
                prisma.return.aggregate({
                    where: {
                        createdAt: {
                            gte: previousRange.from,
                            lte: previousRange.to
                        }
                    },
                    _sum: { total: true },
                    _count: { id: true }
                })
            ]);

            let totalIn = 0;
            let totalOut = 0;
            totalsByDirection.forEach((row) => {
                const amountByDirection = toNumber(row?._sum?.amount);
                if (row.direction === TREASURY_DIRECTION.IN) totalIn += amountByDirection;
                else totalOut += amountByDirection;
            });

            let previousIn = 0;
            let previousOut = 0;
            previousTotalsByDirection.forEach((row) => {
                const amountByDirection = toNumber(row?._sum?.amount);
                if (row.direction === TREASURY_DIRECTION.IN) previousIn += amountByDirection;
                else previousOut += amountByDirection;
            });

            let previousSaleIncome = 0;
            let previousCustomerPayments = 0;
            let previousDepositsIn = 0;
            let previousDepositsRefund = 0;
            previousRevenueByType.forEach((row) => {
                const amount = toNumber(row?._sum?.amount);
                const signedAmount = row.direction === TREASURY_DIRECTION.IN ? amount : -amount;

                if (row.entryType === TREASURY_ENTRY_TYPE.SALE_INCOME) {
                    previousSaleIncome += signedAmount;
                } else if (row.entryType === TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT) {
                    previousCustomerPayments += signedAmount;
                } else if (row.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_IN) {
                    previousDepositsIn += signedAmount;
                } else if (row.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_REFUND) {
                    previousDepositsRefund += Math.abs(signedAmount);
                }
            });

            const byPaymentMethodMap = new Map();
            const byEntryTypeMap = new Map();
            const byTreasuryMap = new Map();
            const revenueByPaymentMethodMap = new Map();
            const revenueByTreasuryMap = new Map();
            const revenueEntries = [];

            const saleReferences = new Set();
            const customerPaymentReferences = new Set();
            const depositInReferences = new Set();
            const depositRefundReferences = new Set();
            const sourceCountByType = new Map();

            const revenueChannelTotals = {
                cash: 0,
                vodafoneCash: 0,
                instaPay: 0,
                other: 0
            };

            let totalSaleIncome = 0;
            let totalCustomerPayments = 0;
            let totalDepositsIn = 0;
            let totalDepositsRefund = 0;
            let cashIn = 0;
            let cashOut = 0;

            entries.forEach((entry) => {
                const amount = Math.max(0, toNumber(entry.amount));
                const signedAmount = entry.direction === TREASURY_DIRECTION.IN ? amount : -amount;
                const paymentMethodId = entry?.paymentMethod?.id || 0;
                const paymentMethodCode = resolveReportPaymentMethodCode(entry?.paymentMethod);
                const paymentMethodName = entry?.paymentMethod?.name || 'غير محدد';
                const paymentMethodKey = `${paymentMethodId}:${paymentMethodCode}`;
                const treasuryKey = entry?.treasury?.id || entry?.treasuryId || 0;
                const treasuryName = entry?.treasury?.name || `Treasury #${treasuryKey}`;

                if (!byPaymentMethodMap.has(paymentMethodKey)) {
                    byPaymentMethodMap.set(paymentMethodKey, {
                        paymentMethodId: paymentMethodId || null,
                        code: paymentMethodCode,
                        name: paymentMethodName,
                        totalIn: 0,
                        totalOut: 0,
                        net: 0,
                        count: 0
                    });
                }
                const methodRow = byPaymentMethodMap.get(paymentMethodKey);
                if (entry.direction === TREASURY_DIRECTION.IN) methodRow.totalIn += amount;
                else methodRow.totalOut += amount;
                methodRow.net += signedAmount;
                methodRow.count += 1;

                if (!byEntryTypeMap.has(entry.entryType)) {
                    byEntryTypeMap.set(entry.entryType, {
                        entryType: entry.entryType,
                        totalIn: 0,
                        totalOut: 0,
                        net: 0,
                        count: 0
                    });
                }
                const typeRow = byEntryTypeMap.get(entry.entryType);
                if (entry.direction === TREASURY_DIRECTION.IN) typeRow.totalIn += amount;
                else typeRow.totalOut += amount;
                typeRow.net += signedAmount;
                typeRow.count += 1;

                if (!byTreasuryMap.has(treasuryKey)) {
                    byTreasuryMap.set(treasuryKey, {
                        treasuryId: treasuryKey || null,
                        treasuryName,
                        totalIn: 0,
                        totalOut: 0,
                        net: 0,
                        count: 0
                    });
                }
                const treasurySummaryRow = byTreasuryMap.get(treasuryKey);
                if (entry.direction === TREASURY_DIRECTION.IN) treasurySummaryRow.totalIn += amount;
                else treasurySummaryRow.totalOut += amount;
                treasurySummaryRow.net += signedAmount;
                treasurySummaryRow.count += 1;

                if (paymentMethodCode === 'CASH') {
                    if (entry.direction === TREASURY_DIRECTION.IN) cashIn += amount;
                    else cashOut += amount;
                }

                if (!TREASURY_REVENUE_ENTRY_TYPES.has(entry.entryType)) {
                    return;
                }

                revenueEntries.push(entry);

                const sourceCountKey = `${entry.entryType}:${entry.direction}`;
                sourceCountByType.set(sourceCountKey, (sourceCountByType.get(sourceCountKey) || 0) + 1);

                if (entry.entryType === TREASURY_ENTRY_TYPE.SALE_INCOME) {
                    totalSaleIncome += signedAmount;
                    if (entry.referenceId) saleReferences.add(entry.referenceId);
                } else if (entry.entryType === TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT) {
                    totalCustomerPayments += signedAmount;
                    if (entry.referenceId) customerPaymentReferences.add(entry.referenceId);
                } else if (entry.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_IN) {
                    totalDepositsIn += signedAmount;
                    if (entry.referenceId) depositInReferences.add(entry.referenceId);
                } else if (entry.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_REFUND) {
                    totalDepositsRefund += Math.abs(signedAmount);
                    if (entry.referenceId) depositRefundReferences.add(entry.referenceId);
                }

                if (!revenueByPaymentMethodMap.has(paymentMethodKey)) {
                    revenueByPaymentMethodMap.set(paymentMethodKey, {
                        paymentMethodId: paymentMethodId || null,
                        code: paymentMethodCode,
                        name: paymentMethodName,
                        totalIn: 0,
                        totalOut: 0,
                        net: 0,
                        count: 0,
                        saleIncomeAmount: 0,
                        customerPaymentAmount: 0,
                        depositsInAmount: 0,
                        depositsRefundAmount: 0,
                        revenueAmount: 0
                    });
                }
                const revenueMethodRow = revenueByPaymentMethodMap.get(paymentMethodKey);
                if (entry.direction === TREASURY_DIRECTION.IN) revenueMethodRow.totalIn += amount;
                else revenueMethodRow.totalOut += amount;
                revenueMethodRow.net += signedAmount;
                revenueMethodRow.count += 1;

                if (entry.entryType === TREASURY_ENTRY_TYPE.SALE_INCOME) {
                    revenueMethodRow.saleIncomeAmount += signedAmount;
                } else if (entry.entryType === TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT) {
                    revenueMethodRow.customerPaymentAmount += signedAmount;
                } else if (entry.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_IN) {
                    revenueMethodRow.depositsInAmount += signedAmount;
                } else if (entry.entryType === TREASURY_ENTRY_TYPE.DEPOSIT_REFUND) {
                    revenueMethodRow.depositsRefundAmount += Math.abs(signedAmount);
                }

                const channelKey = resolveRevenueChannelFromCode(paymentMethodCode);
                revenueChannelTotals[channelKey] += signedAmount;

                if (!revenueByTreasuryMap.has(treasuryKey)) {
                    revenueByTreasuryMap.set(treasuryKey, {
                        treasuryId: treasuryKey || null,
                        treasuryName,
                        totalIn: 0,
                        totalOut: 0,
                        net: 0,
                        count: 0
                    });
                }
                const revenueTreasuryRow = revenueByTreasuryMap.get(treasuryKey);
                if (entry.direction === TREASURY_DIRECTION.IN) revenueTreasuryRow.totalIn += amount;
                else revenueTreasuryRow.totalOut += amount;
                revenueTreasuryRow.net += signedAmount;
                revenueTreasuryRow.count += 1;
            });

            const totalSales = Math.max(0, toNumber(salesAgg?._sum?.total));
            const totalReturns = Math.max(0, toNumber(returnsAgg?._sum?.total));
            const netSales = totalSales - totalReturns;
            const saleCount = parseInt(salesAgg?._count?.id, 10) || 0;
            const returnCount = parseInt(returnsAgg?._count?.id, 10) || 0;

            const previousTotalSales = Math.max(0, toNumber(previousSalesAgg?._sum?.total));
            const previousTotalReturns = Math.max(0, toNumber(previousReturnsAgg?._sum?.total));
            const previousNetSales = previousTotalSales - previousTotalReturns;

            const depositsNet = totalDepositsIn - totalDepositsRefund;
            const previousDepositsNet = previousDepositsIn - previousDepositsRefund;
            const totalRevenue = totalSaleIncome
                + totalCustomerPayments
                + (includeDepositsInRevenue ? totalDepositsIn : 0);
            const previousPeriodRevenue = previousSaleIncome
                + previousCustomerPayments
                + (includeDepositsInRevenue ? previousDepositsIn : 0);

            const net = totalIn - totalOut;
            const previousNet = previousIn - previousOut;
            const cashNet = cashIn - cashOut;

            const revenueByPaymentMethod = [...revenueByPaymentMethodMap.values()]
                .map((row) => {
                    const rowRevenueAmount = row.saleIncomeAmount
                        + row.customerPaymentAmount
                        + (includeDepositsInRevenue ? row.depositsInAmount : 0);

                    return {
                        ...row,
                        amount: row.net,
                        revenueAmount: rowRevenueAmount,
                        percentOfRevenue: totalRevenue > 0
                            ? Number(((rowRevenueAmount / totalRevenue) * 100).toFixed(2))
                            : 0
                    };
                })
                .sort((a, b) => b.revenueAmount - a.revenueAmount);

            const revenueByTreasury = [...revenueByTreasuryMap.values()]
                .map((row) => ({
                    ...row,
                    amount: row.net
                }))
                .sort((a, b) => b.net - a.net);

            const byPaymentMethod = [...byPaymentMethodMap.values()]
                .sort((a, b) => b.net - a.net);

            const byEntryType = [...byEntryTypeMap.values()]
                .sort((a, b) => b.net - a.net);

            const byTreasury = [...byTreasuryMap.values()]
                .sort((a, b) => b.net - a.net);

            return {
                date: from.toISOString().split('T')[0],
                fromDate: from.toISOString().split('T')[0],
                toDate: to.toISOString().split('T')[0],
                period: {
                    from: from.toISOString(),
                    to: to.toISOString(),
                    previousFrom: previousRange.from.toISOString(),
                    previousTo: previousRange.to.toISOString(),
                    days: rangeDays,
                    isSingleDay
                },
                summary: {
                    totalIn,
                    totalOut,
                    net,
                    cashIn,
                    cashOut,
                    cashNet,
                    netCashIn: cashNet,
                    previousDayNet: previousNet,
                    previousPeriodNet: previousNet,
                    changeFromPreviousDay: net - previousNet,
                    changeFromPreviousPeriod: net - previousNet
                },
                sales: {
                    totalSales,
                    totalReturns,
                    netSales,
                    saleCount,
                    returnCount,
                    previousPeriodNetSales: previousNetSales,
                    changeFromPreviousPeriodNetSales: netSales - previousNetSales
                },
                byPaymentMethod,
                byEntryType,
                byTreasury,
                revenue: {
                    config: {
                        includeDepositsInRevenue
                    },
                    summary: {
                        totalRevenue,
                        saleIncome: totalSaleIncome,
                        customerPayments: totalCustomerPayments,
                        depositsIn: totalDepositsIn,
                        depositsRefund: totalDepositsRefund,
                        depositsNet,
                        invoiceCount: saleReferences.size,
                        customerPaymentCount: customerPaymentReferences.size,
                        depositReceiptCount: depositInReferences.size,
                        depositRefundCount: depositRefundReferences.size,
                        previousDayRevenue: previousPeriodRevenue,
                        previousPeriodRevenue,
                        changeFromPreviousDayRevenue: totalRevenue - previousPeriodRevenue,
                        changeFromPreviousPeriodRevenue: totalRevenue - previousPeriodRevenue,
                        previousPeriodDepositsNet: previousDepositsNet,
                        channelTotals: {
                            cash: Number(revenueChannelTotals.cash.toFixed(2)),
                            vodafoneCash: Number(revenueChannelTotals.vodafoneCash.toFixed(2)),
                            instaPay: Number(revenueChannelTotals.instaPay.toFixed(2)),
                            other: Number(revenueChannelTotals.other.toFixed(2))
                        }
                    },
                    bySource: [
                        {
                            entryType: TREASURY_ENTRY_TYPE.SALE_INCOME,
                            direction: TREASURY_DIRECTION.IN,
                            amount: totalSaleIncome,
                            totalIn: totalSaleIncome,
                            totalOut: 0,
                            net: totalSaleIncome,
                            count: sourceCountByType.get(`${TREASURY_ENTRY_TYPE.SALE_INCOME}:${TREASURY_DIRECTION.IN}`) || 0,
                            referenceCount: saleReferences.size
                        },
                        {
                            entryType: TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT,
                            direction: TREASURY_DIRECTION.IN,
                            amount: totalCustomerPayments,
                            totalIn: totalCustomerPayments,
                            totalOut: 0,
                            net: totalCustomerPayments,
                            count: sourceCountByType.get(`${TREASURY_ENTRY_TYPE.CUSTOMER_PAYMENT}:${TREASURY_DIRECTION.IN}`) || 0,
                            referenceCount: customerPaymentReferences.size
                        },
                        {
                            entryType: TREASURY_ENTRY_TYPE.DEPOSIT_IN,
                            direction: TREASURY_DIRECTION.IN,
                            amount: totalDepositsIn,
                            totalIn: totalDepositsIn,
                            totalOut: 0,
                            net: totalDepositsIn,
                            count: sourceCountByType.get(`${TREASURY_ENTRY_TYPE.DEPOSIT_IN}:${TREASURY_DIRECTION.IN}`) || 0,
                            referenceCount: depositInReferences.size
                        },
                        {
                            entryType: TREASURY_ENTRY_TYPE.DEPOSIT_REFUND,
                            direction: TREASURY_DIRECTION.OUT,
                            amount: totalDepositsRefund,
                            totalIn: 0,
                            totalOut: totalDepositsRefund,
                            net: -totalDepositsRefund,
                            count: sourceCountByType.get(`${TREASURY_ENTRY_TYPE.DEPOSIT_REFUND}:${TREASURY_DIRECTION.OUT}`) || 0,
                            referenceCount: depositRefundReferences.size
                        }
                    ],
                    byPaymentMethod: revenueByPaymentMethod,
                    byTreasury: revenueByTreasury,
                    entries: revenueEntries
                },
                entries
            };
        } catch (error) {
            return { error: error.message };
        }
    },
    // ==================== SUPPLIERS ====================
    async getSuppliers() {
        try {
            return await prisma.supplier.findMany({
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addSupplier(supplierData) {
        try {
            return await prisma.supplier.create({
                data: {
                    name: supplierData.name,
                    phone: supplierData.phone || null,
                    address: supplierData.address || null,
                    balance: parseFloat(supplierData.balance || 0)
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateSupplier(id, supplierData) {
        try {
            return await prisma.supplier.update({
                where: { id: parseInt(id) },
                data: {
                    name: supplierData.name,
                    phone: supplierData.phone || null,
                    address: supplierData.address || null
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteSupplier(id) {
        try {
            return await prisma.supplier.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addSupplierPayment(paymentData) {
        try {
            const supplierId = parsePositiveInt(paymentData?.supplierId);
            const amount = Math.max(0, toNumber(paymentData?.amount));

            const paymentDateInput = paymentData?.paymentDate ? new Date(paymentData.paymentDate) : new Date();
            // If payment date is today, use current time. Otherwise use start of day.
            const today = new Date();
            const isToday = paymentDateInput.toDateString() === today.toDateString();
            const paymentDate = isToday ? new Date() : startOfDay(paymentDateInput);

            if (!supplierId) {
                return { error: 'Invalid supplierId' };
            }
            if (amount <= 0) {
                return { error: 'Invalid payment amount' };
            }

            return await prisma.$transaction(async (tx) => {
                const payment = await tx.supplierPayment.create({
                    data: {
                        supplierId,
                        amount,
                        notes: paymentData?.notes || null,
                        createdAt: paymentDate
                    }
                });

                await tx.supplier.update({
                    where: { id: supplierId },
                    data: { balance: { increment: amount } }
                });

                const supplierPaymentTreasuryId = await resolveTreasuryId(tx, paymentData?.treasuryId);
                const treasuryEntryResult = await createTreasuryEntry(tx, {
                    treasuryId: supplierPaymentTreasuryId,
                    entryType: TREASURY_ENTRY_TYPE.SUPPLIER_PAYMENT,
                    direction: TREASURY_DIRECTION.OUT,
                    amount,
                    notes: `Supplier payment #${payment.id}${paymentData?.notes ? ` - ${paymentData.notes}` : ''}`,
                    referenceType: 'SUPPLIER_PAYMENT',
                    referenceId: payment.id,
                    entryDate: paymentDate
                });
                throwIfResultError(treasuryEntryResult);

                return payment;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async getSupplierPayments(supplierId) {
        try {
            return await prisma.supplierPayment.findMany({
                where: { supplierId: parseInt(supplierId) },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== EXPENSES ====================
    async getExpenses(params = {}) {
        try {
            const where = {};
            const categoryId = parsePositiveInt(params?.categoryId);
            if (categoryId) where.categoryId = categoryId;
            if (params?.fromDate || params?.toDate) {
                where.expenseDate = {};
                if (params.fromDate) where.expenseDate.gte = startOfDay(new Date(params.fromDate));
                if (params.toDate) where.expenseDate.lte = endOfDay(new Date(params.toDate));
            }
            return await prisma.expense.findMany({
                where,
                include: { category: true },
                orderBy: { expenseDate: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addExpense(expenseData) {
        try {
            const title = String(expenseData?.title || '').trim();
            const amount = Math.max(0, toNumber(expenseData?.amount));
            const expenseDate = parseDateOrDefault(expenseData?.expenseDate, new Date());

            if (!title) {
                return { error: 'Expense title is required' };
            }
            if (amount <= 0) {
                return { error: 'Invalid expense amount' };
            }

            return await prisma.$transaction(async (tx) => {
                const expense = await tx.expense.create({
                    data: {
                        title,
                        amount,
                        categoryId: parsePositiveInt(expenseData?.categoryId) || null,
                        notes: String(expenseData?.notes || '').trim() || null,
                        expenseDate,
                        createdAt: expenseDate
                    },
                    include: { category: true }
                });

                const expenseTreasuryId = await resolveTreasuryId(tx, expenseData?.treasuryId);
                const paymentMethodId = await resolvePaymentMethodId(
                    tx,
                    expenseData?.paymentMethodId ?? expenseData?.paymentMethod,
                    1
                );

                const treasuryEntryResult = await createTreasuryEntry(tx, {
                    treasuryId: expenseTreasuryId,
                    entryType: TREASURY_ENTRY_TYPE.EXPENSE_PAYMENT,
                    direction: TREASURY_DIRECTION.OUT,
                    amount,
                    notes: `Expense #${expense.id}${expenseData?.title ? ` - ${expenseData.title}` : ''}`,
                    referenceType: 'EXPENSE',
                    referenceId: expense.id,
                    paymentMethodId,
                    entryDate: expenseDate
                });
                throwIfResultError(treasuryEntryResult);

                return expense;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteExpense(id) {
        try {
            const parsedExpenseId = parsePositiveInt(id);
            if (!parsedExpenseId) {
                return { error: 'Invalid expenseId' };
            }

            return await prisma.$transaction(async (tx) => {
                const expense = await tx.expense.findUnique({
                    where: { id: parsedExpenseId },
                    select: { id: true }
                });

                if (!expense) {
                    return { error: 'Expense not found' };
                }

                const rollbackResult = await rollbackTreasuryEntriesByReference(tx, 'EXPENSE', parsedExpenseId);
                throwIfResultError(rollbackResult, 'Failed to rollback expense treasury entries');

                return tx.expense.delete({
                    where: { id: parsedExpenseId }
                });
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateExpense(id, expenseData) {
        try {
            const parsedId = parsePositiveInt(id);
            if (!parsedId) return { error: 'Invalid expenseId' };

            const title = String(expenseData?.title || '').trim();
            const amount = Math.max(0, toNumber(expenseData?.amount));
            if (!title) return { error: 'Expense title is required' };
            if (amount <= 0) return { error: 'Invalid expense amount' };

            const categoryId = parsePositiveInt(expenseData?.categoryId) || null;
            const notes = String(expenseData?.notes || '').trim() || null;
            const expenseDate = parseDateOrDefault(expenseData?.expenseDate, undefined);

            const data = { title, amount, categoryId, notes };
            if (expenseDate) data.expenseDate = expenseDate;

            return await prisma.$transaction(async (tx) => {
                const updatedExpense = await tx.expense.update({
                    where: { id: parsedId },
                    data,
                    include: { category: true }
                });

                // Update associated TreasuryEntry to keep balance/totals in sync
                // Note: Treasury/PaymentMethod cannot be changed in edit mode currently, so we focus on amount/date/notes
                await tx.treasuryEntry.updateMany({
                    where: {
                        referenceType: 'EXPENSE',
                        referenceId: parsedId
                    },
                    data: {
                        amount,
                        entryDate: updatedExpense.expenseDate,
                        notes: `Expense #${updatedExpense.id}${updatedExpense.title ? ` - ${updatedExpense.title}` : ''}`
                    }
                });

                return updatedExpense;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== EXPENSE CATEGORIES ====================
    async getExpenseCategories() {
        try {
            return await prisma.expenseCategory.findMany({
                orderBy: { name: 'asc' },
                include: { _count: { select: { expenses: true } } }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addExpenseCategory(data) {
        try {
            const name = String(data?.name || '').trim();
            if (!name) return { error: 'Category name is required' };
            return await prisma.expenseCategory.create({ data: { name, color: data?.color || null, icon: data?.icon || null } });
        } catch (error) {
            if (error?.code === 'P2002') return { error: 'اسم التصنيف موجود بالفعل' };
            return { error: error.message };
        }
    },

    async updateExpenseCategory(id, data) {
        try {
            const parsedId = parsePositiveInt(id);
            if (!parsedId) return { error: 'Invalid categoryId' };
            const name = String(data?.name || '').trim();
            if (!name) return { error: 'Category name is required' };
            return await prisma.expenseCategory.update({ where: { id: parsedId }, data: { name, color: data?.color || null, icon: data?.icon || null } });
        } catch (error) {
            if (error?.code === 'P2002') return { error: 'اسم التصنيف موجود بالفعل' };
            return { error: error.message };
        }
    },

    async deleteExpenseCategory(id) {
        try {
            const parsedId = parsePositiveInt(id);
            if (!parsedId) return { error: 'Invalid categoryId' };
            await prisma.expense.updateMany({ where: { categoryId: parsedId }, data: { categoryId: null } });
            return await prisma.expenseCategory.delete({ where: { id: parsedId } });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== USERS ====================
    async getUsers() {
        try {
            const users = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' }
            });
            return users.map(({ password, ...user }) => user);
        } catch (error) {
            return { error: error.message };
        }
    },

    async addUser(userData) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const user = await prisma.user.create({
                data: {
                    name: userData.name,
                    username: userData.username,
                    password: hashedPassword,
                    role: userData.role
                }
            });
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateUser(id, userData) {
        try {
            const data = { ...userData };
            if (userData.password) {
                data.password = await bcrypt.hash(userData.password, 10);
            }
            const user = await prisma.user.update({
                where: { id: parseInt(id) },
                data
            });
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteUser(id) {
        try {
            return await prisma.user.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async disconnect() {
        await prisma.$disconnect();
    }
};

Object.keys(dbService).forEach((methodName) => {
    const method = dbService[methodName];
    if (typeof method !== 'function') return;

    dbService[methodName] = async function wrappedDbServiceMethod(...args) {
        const result = await method.apply(dbService, args);
        return normalizeDecimalValues(result);
    };
});

module.exports = dbService;
