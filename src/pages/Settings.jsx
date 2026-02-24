import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { safeAlert } from '../utils/safeAlert';
import {
  CUSTOMER_IMPORT_FIELD_OPTIONS,
  delimiter as detectImportDelimiter,
  parseLine as parseImportLine,
  toImportHeaders as toCustomerImportHeaders,
  buildCustomerImportAutoMapping,
  mapRowsWithCustomerImportMapping,
  sanitizeImportedCustomer
} from '../utils/customerImportUtils';
import './Settings.css';

const normalizeCustomerNameKey = (value) => String(value ?? '').trim().toLowerCase();
const normalizeCustomerPhoneKey = (value) => String(value ?? '')
  .replace(/[^\d+]/g, '')
  .trim();

export default function Settings() {
  const customerImportInputRef = useRef(null);

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [allCustomers, setAllCustomers] = useState([]);
  const [overdueThreshold, setOverdueThreshold] = useState(() => {
    const saved = localStorage.getItem('overdueThreshold');
    return saved ? parseInt(saved, 10) : 30;
  });
  const [tempThreshold, setTempThreshold] = useState(overdueThreshold);

  const [customerImportSession, setCustomerImportSession] = useState(null);
  const [importingCustomers, setImportingCustomers] = useState(false);
  const [updateExistingOnImport, setUpdateExistingOnImport] = useState(true);

  const loadAllCustomers = useCallback(async () => {
    try {
      setLoadingCustomers(true);
      const result = await window.api.getCustomers({
        page: 1,
        pageSize: 10000,
        searchTerm: '',
        customerType: 'all',
        city: '',
        sortCol: 'createdAt',
        sortDir: 'desc',
        overdueThreshold
      });

      if (result?.error) {
        setAllCustomers([]);
        await safeAlert(result.error, null, { type: 'error', title: 'الإعدادات' });
        return;
      }

      const data = Array.isArray(result?.data) ? result.data : [];
      setAllCustomers(data);
    } catch (error) {
      setAllCustomers([]);
      await safeAlert(error?.message || 'تعذر تحميل بيانات العملاء', null, {
        type: 'error',
        title: 'الإعدادات'
      });
    } finally {
      setLoadingCustomers(false);
    }
  }, [overdueThreshold]);

  useEffect(() => {
    loadAllCustomers();
  }, [loadAllCustomers]);

  const customerStats = useMemo(() => {
    let debtedCount = 0;
    let compliantCount = 0;
    let totalDebt = 0;
    let overdueCount = 0;

    for (const customer of allCustomers) {
      const balance = Number(customer?.balance || 0);
      if (balance > 0) {
        debtedCount += 1;
        totalDebt += balance;
      } else {
        compliantCount += 1;
      }

      const lastPaymentDays = Number(customer?.lastPaymentDays || 0);
      if (lastPaymentDays > overdueThreshold) overdueCount += 1;
    }

    return {
      totalItems: allCustomers.length,
      debtedCount,
      compliantCount,
      totalDebt,
      overdueCount
    };
  }, [allCustomers, overdueThreshold]);

  const overduePreviewCount = useMemo(
    () => allCustomers.filter((customer) => (customer?.lastPaymentDays || 0) > tempThreshold).length,
    [allCustomers, tempThreshold]
  );

  const customerImportColumnSamples = useMemo(() => {
    const sampleMap = new Map();
    if (!customerImportSession?.headers?.length || !customerImportSession?.rows?.length) return sampleMap;

    const previewRows = customerImportSession.rows.slice(0, 120);
    customerImportSession.headers.forEach((header) => {
      for (const row of previewRows) {
        const value = String(row?.[header.index] ?? '').trim();
        if (value) {
          sampleMap.set(header.id, value.slice(0, 120));
          break;
        }
      }
    });

    return sampleMap;
  }, [customerImportSession]);

  const closeCustomerImportSession = useCallback(() => {
    if (importingCustomers) return;
    setCustomerImportSession(null);
  }, [importingCustomers]);

  const updateCustomerImportFieldMapping = useCallback((fieldKey, columnId) => {
    setCustomerImportSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        mapping: {
          ...prev.mapping,
          [fieldKey]: columnId
        }
      };
    });
  }, []);

  const applyCustomerImportAutoMapping = useCallback(() => {
    setCustomerImportSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        mapping: buildCustomerImportAutoMapping(prev.headers)
      };
    });
  }, []);

  const parseDelimitedCustomerRows = useCallback((rawText) => {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) throw new Error('الملف لا يحتوي على بيانات كافية');

    const delim = detectImportDelimiter(lines[0]);
    const headers = toCustomerImportHeaders(parseImportLine(lines[0], delim));
    const rows = lines
      .slice(1)
      .map((line) => parseImportLine(line, delim))
      .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));

    if (!headers.length) throw new Error('تعذر قراءة الأعمدة من الملف');
    if (!rows.length) throw new Error('الملف لا يحتوي على صفوف بيانات');

    return { headers, rows };
  }, []);

  const parseWorkbookCustomerRows = useCallback(async (file) => {
    const xlsxModule = await import('xlsx');
    const XLSX = xlsxModule?.default || xlsxModule;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: false
    });

    const firstSheetName = workbook?.SheetNames?.[0];
    if (!firstSheetName) throw new Error('ملف Excel لا يحتوي على أي ورقة بيانات');

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false
    });

    const rows = Array.isArray(matrix) ? matrix : [];
    const hasAnyValue = (row) => (
      Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
    );
    const firstNonEmptyIndex = rows.findIndex(hasAnyValue);

    if (firstNonEmptyIndex === -1) throw new Error('ورقة Excel فارغة');

    const headerRow = rows[firstNonEmptyIndex] || [];
    const dataRows = rows
      .slice(firstNonEmptyIndex + 1)
      .map((row) => (Array.isArray(row) ? row : []))
      .filter(hasAnyValue);

    const headers = toCustomerImportHeaders(headerRow);
    if (!headers.length) throw new Error('تعذر قراءة أعمدة ملف Excel');
    if (!dataRows.length) throw new Error('ورقة Excel لا تحتوي على بيانات');

    return { headers, rows: dataRows, sheetName: firstSheetName };
  }, []);

  const importCustomersFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const fileName = String(file.name || '').toLowerCase();
      let parsed = null;

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        parsed = await parseWorkbookCustomerRows(file);
      } else if (fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileName.endsWith('.txt')) {
        parsed = parseDelimitedCustomerRows(await file.text());
      } else {
        throw new Error('صيغة الملف غير مدعومة. استخدم Excel أو CSV أو TSV');
      }

      setCustomerImportSession({
        fileName: file.name,
        headers: parsed.headers,
        rows: parsed.rows,
        sheetName: parsed.sheetName || null,
        mapping: buildCustomerImportAutoMapping(parsed.headers)
      });
    } catch (err) {
      await safeAlert(err?.message || 'تعذر قراءة الملف', null, {
        type: 'error',
        title: 'استيراد العملاء'
      });
    }
  };

  const downloadCustomerImportTemplate = () => {
    const headers = [
      'name',
      'phone',
      'phone2',
      'address',
      'city',
      'district',
      'notes',
      'creditLimit',
      'customerType'
    ];
    const rows = [
      headers.join(','),
      [
        'عميل تجريبي',
        '01000000000',
        '',
        'القاهرة - شارع النصر',
        'القاهرة',
        'مدينة نصر',
        'ملاحظة اختيارية',
        '5000',
        'VIP'
      ].join(',')
    ];

    const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const startCustomerImport = useCallback(async () => {
    if (!customerImportSession || importingCustomers) return;

    if (!customerImportSession.mapping?.name) {
      await safeAlert('اختَر عمود "اسم العميل" قبل بدء الاستيراد', null, {
        type: 'warning',
        title: 'مطابقة الأعمدة'
      });
      return;
    }

    setImportingCustomers(true);
    try {
      const mappedRows = mapRowsWithCustomerImportMapping(
        customerImportSession.rows,
        customerImportSession.mapping
      ).map((mapped, index) => ({
        sourceIndex: index + 2,
        customer: sanitizeImportedCustomer(mapped)
      }));

      const validRows = mappedRows.filter((item) => item.customer.name);
      const skipped = Math.max(0, mappedRows.length - validRows.length);

      if (!validRows.length) {
        throw new Error('لم يتم العثور على صفوف صالحة تحتوي على اسم عميل');
      }

      const existingByName = new Map();
      const existingByPhone = new Map();
      if (updateExistingOnImport) {
        for (const customer of allCustomers) {
          const nameKey = normalizeCustomerNameKey(customer?.name);
          const phoneKey = normalizeCustomerPhoneKey(customer?.phone);
          if (nameKey && !existingByName.has(nameKey)) existingByName.set(nameKey, customer);
          if (phoneKey && !existingByPhone.has(phoneKey)) existingByPhone.set(phoneKey, customer);
        }
      }

      let created = 0;
      let updated = 0;
      let failed = 0;
      const rowErrors = [];

      for (const item of validRows) {
        const row = item.customer;
        const nameKey = normalizeCustomerNameKey(row.name);
        const phoneKey = normalizeCustomerPhoneKey(row.phone);

        try {
          let existingCustomer = null;
          if (updateExistingOnImport) {
            if (phoneKey) existingCustomer = existingByPhone.get(phoneKey) || null;
            if (!existingCustomer && nameKey) existingCustomer = existingByName.get(nameKey) || null;
          }

          if (existingCustomer) {
            const updatePayload = {
              name: row.name || existingCustomer.name || '',
              phone: row.phone || existingCustomer.phone || '',
              phone2: row.phone2 || existingCustomer.phone2 || '',
              address: row.address || existingCustomer.address || '',
              city: row.city || existingCustomer.city || '',
              district: row.district || existingCustomer.district || '',
              notes: row.notes || existingCustomer.notes || '',
              creditLimit: row.creditLimit ?? existingCustomer.creditLimit ?? 0,
              customerType: row.customerType || existingCustomer.customerType || 'عادي'
            };
            const updateResult = await window.api.updateCustomer(existingCustomer.id, updatePayload);
            if (updateResult?.error) throw new Error(updateResult.error);

            updated += 1;
            const mergedCustomer = { ...existingCustomer, ...updatePayload };
            const mergedNameKey = normalizeCustomerNameKey(mergedCustomer.name);
            const mergedPhoneKey = normalizeCustomerPhoneKey(mergedCustomer.phone);
            if (mergedNameKey) existingByName.set(mergedNameKey, mergedCustomer);
            if (mergedPhoneKey) existingByPhone.set(mergedPhoneKey, mergedCustomer);
          } else {
            const addResult = await window.api.addCustomer({
              ...row,
              customerType: row.customerType || 'عادي'
            });
            if (addResult?.error) throw new Error(addResult.error);

            created += 1;
            const inserted = { ...row, ...(addResult || {}) };
            const insertedNameKey = normalizeCustomerNameKey(inserted.name);
            const insertedPhoneKey = normalizeCustomerPhoneKey(inserted.phone);
            if (insertedNameKey) existingByName.set(insertedNameKey, inserted);
            if (insertedPhoneKey) existingByPhone.set(insertedPhoneKey, inserted);
          }
        } catch (rowError) {
          failed += 1;
          if (rowErrors.length < 10) {
            rowErrors.push(`صف ${item.sourceIndex}: ${rowError?.message || 'خطأ غير متوقع'}`);
          }
        }
      }

      await loadAllCustomers();
      setCustomerImportSession(null);

      await safeAlert(
        `نتيجة الاستيراد:\nجديد: ${created}\nتم تحديثه: ${updated}\nتم تجاهله (بدون اسم): ${skipped}\nفشل: ${failed}`,
        null,
        {
          type: failed > 0 ? 'warning' : 'success',
          title: 'استيراد العملاء',
          detail: rowErrors.length ? rowErrors.join('\n') : undefined
        }
      );
    } catch (err) {
      await safeAlert(err?.message || 'تعذر استيراد العملاء', null, {
        type: 'error',
        title: 'استيراد العملاء'
      });
    } finally {
      setImportingCustomers(false);
    }
  }, [customerImportSession, importingCustomers, updateExistingOnImport, allCustomers, loadAllCustomers]);

  const saveOverdueThreshold = () => {
    localStorage.setItem('overdueThreshold', String(tempThreshold));
    setOverdueThreshold(tempThreshold);
    safeAlert('تم حفظ إعدادات العملاء بنجاح', null, { type: 'success', title: 'الإعدادات' });
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>⚙️ الإعدادات</h1>
        <p>إعدادات عامة للنظام مع أدوات إدارة العملاء والاستيراد.</p>
      </header>

      <section className="settings-card">
        <h2>👥 إعدادات العملاء</h2>
        <p className="settings-hint">
          التحكم في عدد الأيام التي بعدها يظهر العميل كمتأخر في الدفع.
        </p>

        <div className="settings-range-wrap">
          <input
            type="range"
            min="7"
            max="90"
            step="1"
            value={tempThreshold}
            onChange={(event) => setTempThreshold(parseInt(event.target.value, 10))}
            className="settings-range"
          />
          <div className="settings-range-value">{tempThreshold} يوم</div>
        </div>

        <div className="settings-stats-grid">
          <div className="settings-stat-box">
            <span>إجمالي العملاء</span>
            <strong>{customerStats.totalItems}</strong>
          </div>
          <div className="settings-stat-box">
            <span>عملاء مدينين</span>
            <strong>{customerStats.debtedCount}</strong>
          </div>
          <div className="settings-stat-box">
            <span>متأخرين (حسب الإعداد الحالي)</span>
            <strong>{customerStats.overdueCount}</strong>
          </div>
          <div className="settings-stat-box">
            <span>متأخرين (حسب القيمة الجديدة)</span>
            <strong>{overduePreviewCount}</strong>
          </div>
        </div>

        <div className="settings-actions">
          <button type="button" onClick={saveOverdueThreshold} className="settings-btn settings-btn-primary">
            حفظ إعدادات العملاء
          </button>
          <button type="button" onClick={loadAllCustomers} className="settings-btn settings-btn-secondary" disabled={loadingCustomers}>
            {loadingCustomers ? 'جاري التحديث...' : 'تحديث البيانات'}
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h2>📤 استيراد العملاء</h2>
        <p className="settings-hint">الملفات المدعومة: XLSX / XLS / CSV / TSV.</p>

        <div className="settings-actions">
          <button type="button" onClick={downloadCustomerImportTemplate} className="settings-btn settings-btn-secondary">
            تنزيل قالب CSV
          </button>
          <button
            type="button"
            onClick={() => customerImportInputRef.current?.click()}
            className="settings-btn settings-btn-primary"
            disabled={importingCustomers}
          >
            {importingCustomers ? 'جاري الاستيراد...' : 'اختيار ملف'}
          </button>
        </div>

        <input
          ref={customerImportInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.txt"
          style={{ display: 'none' }}
          onChange={importCustomersFile}
        />

        <label className="settings-check">
          <input
            type="checkbox"
            checked={updateExistingOnImport}
            onChange={(event) => setUpdateExistingOnImport(event.target.checked)}
            disabled={importingCustomers}
          />
          تحديث العميل الموجود عند تطابق الاسم أو الهاتف
        </label>

        {!customerImportSession && <div className="settings-empty">لم يتم اختيار ملف استيراد بعد.</div>}

        {customerImportSession && (
          <>
            <div className="settings-import-meta">
              <div><strong>الملف:</strong> {customerImportSession.fileName}</div>
              <div>
                <strong>الأعمدة:</strong> {customerImportSession.headers.length}
                {' | '}
                <strong>الصفوف:</strong> {customerImportSession.rows.length}
                {customerImportSession.sheetName ? ` | Sheet: ${customerImportSession.sheetName}` : ''}
              </div>
            </div>

            <div className="settings-mapping-grid">
              {CUSTOMER_IMPORT_FIELD_OPTIONS.map((field) => {
                const selectedColumn = customerImportSession.mapping?.[field.key] ?? '';
                const sampleValue = selectedColumn ? customerImportColumnSamples.get(selectedColumn) : '';

                return (
                  <label key={field.key} className="settings-mapping-row">
                    <span>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                    <select
                      value={selectedColumn}
                      onChange={(event) => updateCustomerImportFieldMapping(field.key, event.target.value)}
                      disabled={importingCustomers}
                    >
                      <option value="">{field.required ? 'اختَر عمودًا...' : 'تجاهل هذا الحقل'}</option>
                      {customerImportSession.headers.map((header) => (
                        <option key={`${field.key}-${header.id}`} value={header.id}>
                          {header.label}
                        </option>
                      ))}
                    </select>
                    <small>{sampleValue ? `مثال: ${sampleValue}` : 'بدون معاينة'}</small>
                  </label>
                );
              })}
            </div>

            <div className="settings-actions">
              <button
                type="button"
                onClick={applyCustomerImportAutoMapping}
                className="settings-btn settings-btn-secondary"
                disabled={importingCustomers}
              >
                مطابقة تلقائية
              </button>
              <button
                type="button"
                onClick={closeCustomerImportSession}
                className="settings-btn settings-btn-secondary"
                disabled={importingCustomers}
              >
                إلغاء الملف
              </button>
              <button
                type="button"
                onClick={startCustomerImport}
                className="settings-btn settings-btn-primary"
                disabled={importingCustomers}
              >
                {importingCustomers ? 'جاري استيراد العملاء...' : 'بدء استيراد العملاء'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
