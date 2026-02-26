const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { createHash } = require('crypto')
const dotenv = require('dotenv')
const Module = require('module')
const nacl = require('tweetnacl')
const naclUtil = require('tweetnacl-util')
const { machineId } = require('node-machine-id')

if (app.isPackaged && process.resourcesPath) {
    const packagedNodeModules = path.join(process.resourcesPath, 'node_modules');
    const currentNodePath = process.env.NODE_PATH || '';
    const alreadyIncluded = currentNodePath
        .split(path.delimiter)
        .filter(Boolean)
        .includes(packagedNodeModules);

    if (!alreadyIncluded) {
        process.env.NODE_PATH = currentNodePath
            ? `${packagedNodeModules}${path.delimiter}${currentNodePath}`
            : packagedNodeModules;
        Module._initPaths();
    }
}

const loadEnvironmentVariables = () => {
    const candidates = [];
    candidates.push(path.join(__dirname, 'runtime.env'));

    if (app.isPackaged && process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, '.env'));
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', '.env'));
    } else {
        candidates.push(path.join(process.cwd(), '.env'));
        candidates.push(path.join(__dirname, '..', '.env'));
    }

    for (const envPath of candidates) {
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath, override: false });
        }
    }

    if (!process.env.DATABASE_URL) {
        console.warn('DATABASE_URL is not defined. Expected .env in one of:', candidates);
    }
};

loadEnvironmentVariables();

const dbService = require('./db-service')

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    const isDev = !app.isPackaged;

    const devCsp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:5173",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: http: file:",
        "font-src 'self' data:",
        "connect-src 'self' ws://localhost:5173 http://localhost:5173",
    ].join("; ");

    const prodCsp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: http: file:",
        "font-src 'self' data:",
        "connect-src 'self'",
    ].join("; ");

    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const cspValue = isDev ? devCsp : prodCsp;
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [cspValue],
            },
        });
    });

    if (isDev) {
        console.log('🔧 Development Mode: حاول الاتصال بـ http://localhost:5173');
        win.loadURL('http://localhost:5173')
            .then(() => {
                console.log('✅ اتصال ناجح بـ Vite dev server');
            })
            .catch((err) => {
                console.error('❌ فشل الاتصال بـ dev server:', err.message);
                console.log('⚠️ تأكد من تشغيل: npm run dev');
                console.log('⏳ جاري إعادة المحاولة كل 2 ثانية...');

                // Retry connection every 2 seconds
                const retryInterval = setInterval(() => {
                    win.loadURL('http://localhost:5173')
                        .then(() => {
                            console.log('✅ اتصال ناجح!');
                            clearInterval(retryInterval);
                        })
                        .catch(() => {
                            console.log('⏳ محاولة أخرى...');
                        });
                }, 2000);
            });
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'))
    }
}

const sanitizePdfFileName = (value) => {
    const raw = String(value || '').trim();
    const cleaned = raw
        .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return 'labels.pdf';
    return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
};

const LICENSE_PUBLIC_KEY_BASE64 = '49zTfBJpXN+35o+0kiPUuufxs3G++SyvH5yixcgbEiQ=';
const LICENSE_FILE_NAME = 'license.json';
const MAX_LICENSE_FILE_BYTES = 256 * 1024;
const TRIAL_FILE_NAME = 'trial.json';
const MAX_TRIAL_FILE_BYTES = 16 * 1024;
const TRIAL_PERIOD_DAYS = 7;
const TRIAL_PERIOD_MS = TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000;
const TRIAL_DURATION_TOLERANCE_MS = 60 * 1000;
const TRIAL_EXPIRED_MESSAGE_AR = `انتهت الفترة التجريبية (${TRIAL_PERIOD_DAYS} أيام). يرجى تفعيل الترخيص للمتابعة.`;

const LICENSE_STATUS_MESSAGES_AR = {
    NO_LICENSE: 'لا يوجد ترخيص مفعل على هذا الجهاز.',
    ACTIVE: 'الترخيص صالح ومفعل.',
    TRIAL_ACTIVE: 'الفترة التجريبية مفعلة.',
    EXPIRED: 'انتهت صلاحية الترخيص.',
    INVALID_SIGNATURE: 'التوقيع الرقمي غير صالح.',
    NOT_YET_VALID: 'الترخيص غير ساري حتى تاريخ البداية.',
    DEVICE_MISMATCH: 'الترخيص لا يطابق بصمة هذا الجهاز.',
    CORRUPT: 'ملف الترخيص تالف أو بصيغة غير صحيحة.'
};

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);

const stableCanonicalStringify = (value) => {
    const canonicalize = (input) => {
        if (Array.isArray(input)) {
            return input.map(canonicalize);
        }

        if (isRecord(input)) {
            return Object.keys(input)
                .sort()
                .reduce((acc, key) => {
                    acc[key] = canonicalize(input[key]);
                    return acc;
                }, {});
        }

        return input;
    };

    return JSON.stringify(canonicalize(value));
};

const buildLicenseStatus = (status, payload) => {
    if (!payload) {
        return {
            status,
            messageAr: LICENSE_STATUS_MESSAGES_AR[status]
        };
    }

    return {
        status,
        messageAr: LICENSE_STATUS_MESSAGES_AR[status],
        details: {
            customerName: payload.customerName,
            expiresAt: payload.expiresAt,
            licenseId: payload.licenseId,
            features: payload.features
        }
    };
};

const getLicenseFilePath = () => path.join(app.getPath('userData'), LICENSE_FILE_NAME);
const getTrialFilePath = () => path.join(app.getPath('userData'), TRIAL_FILE_NAME);

const isValidDateString = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));

const parseTrialFileText = (trialJsonText) => {
    if (typeof trialJsonText !== 'string') return null;
    if (Buffer.byteLength(trialJsonText, 'utf8') > MAX_TRIAL_FILE_BYTES) return null;

    let parsed;
    try {
        parsed = JSON.parse(trialJsonText);
    } catch {
        return null;
    }

    if (!isRecord(parsed)) {
        return null;
    }

    if (!isValidDateString(parsed.startedAt) || !isValidDateString(parsed.expiresAt)) {
        return null;
    }

    const startedAtMs = Date.parse(parsed.startedAt);
    const expiresAtMs = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(expiresAtMs)) {
        return null;
    }

    const durationMs = expiresAtMs - startedAtMs;
    if (durationMs <= 0) {
        return null;
    }

    if (Math.abs(durationMs - TRIAL_PERIOD_MS) > TRIAL_DURATION_TOLERANCE_MS) {
        return null;
    }

    return {
        startedAt: parsed.startedAt,
        expiresAt: parsed.expiresAt
    };
};

const createTrialState = () => {
    const startedAtMs = Date.now();
    const expiresAtMs = startedAtMs + TRIAL_PERIOD_MS;

    return {
        startedAt: new Date(startedAtMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString()
    };
};

const toLicensePayload = (payload) => {
    if (!isRecord(payload)) {
        return null;
    }

    const hasRequiredStrings =
        typeof payload.licenseId === 'string' &&
        typeof payload.customerName === 'string' &&
        typeof payload.deviceFingerprint === 'string';

    const hasRequiredDates =
        isValidDateString(payload.issuedAt) &&
        isValidDateString(payload.validFrom) &&
        isValidDateString(payload.expiresAt);

    const hasBooleansAndNumbers =
        typeof payload.deviceBinding === 'boolean' &&
        typeof payload.maxDevices === 'number' &&
        Number.isInteger(payload.maxDevices) &&
        payload.maxDevices >= 1 &&
        typeof payload.version === 'number' &&
        Number.isInteger(payload.version);

    const hasFeatures =
        Array.isArray(payload.features) &&
        payload.features.length > 0 &&
        payload.features.every((item) => typeof item === 'string' && item.trim().length > 0);

    if (!hasRequiredStrings || !hasRequiredDates || !hasBooleansAndNumbers || !hasFeatures) {
        return null;
    }

    if (payload.deviceBinding && payload.deviceFingerprint.trim().length === 0) {
        return null;
    }

    return {
        licenseId: payload.licenseId,
        customerName: payload.customerName,
        issuedAt: payload.issuedAt,
        validFrom: payload.validFrom,
        expiresAt: payload.expiresAt,
        deviceBinding: payload.deviceBinding,
        deviceFingerprint: payload.deviceFingerprint,
        maxDevices: payload.maxDevices,
        features: payload.features,
        version: payload.version
    };
};

const safeDecodeBase64 = (value) => {
    try {
        return naclUtil.decodeBase64(value);
    } catch {
        return null;
    }
};

const verifyLicenseSignature = (payload, signatureBase64) => {
    const signatureBytes = safeDecodeBase64(signatureBase64);
    const publicKeyBytes = safeDecodeBase64(LICENSE_PUBLIC_KEY_BASE64);

    if (!signatureBytes || !publicKeyBytes) return false;
    if (signatureBytes.length !== nacl.sign.signatureLength) return false;
    if (publicKeyBytes.length !== nacl.sign.publicKeyLength) return false;

    const payloadBytes = naclUtil.decodeUTF8(stableCanonicalStringify(payload));
    return nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKeyBytes);
};

const getDeviceFingerprint = async () => {
    let deviceId = 'unknown-device-id';
    try {
        deviceId = await machineId();
    } catch {
        deviceId = 'unknown-device-id';
    }

    const source = stableCanonicalStringify({
        machineId: deviceId,
        platform: process.platform,
        cpuModel: os.cpus()[0]?.model || 'unknown-cpu-model',
        totalmem: os.totalmem(),
        hostname: os.hostname()
    });

    return createHash('sha256').update(source, 'utf8').digest('hex');
};

const parseLicenseFileText = (licenseJsonText) => {
    if (typeof licenseJsonText !== 'string') return null;
    if (Buffer.byteLength(licenseJsonText, 'utf8') > MAX_LICENSE_FILE_BYTES) return null;

    let parsed;
    try {
        parsed = JSON.parse(licenseJsonText);
    } catch {
        return null;
    }

    if (!isRecord(parsed) || typeof parsed.signature !== 'string') {
        return null;
    }

    const payload = toLicensePayload(parsed.payload);
    if (!payload) return null;

    return {
        payload,
        signature: parsed.signature
    };
};

const evaluateLicenseText = async (licenseJsonText) => {
    const licenseFile = parseLicenseFileText(licenseJsonText);
    if (!licenseFile) {
        return { status: buildLicenseStatus('CORRUPT') };
    }

    if (!verifyLicenseSignature(licenseFile.payload, licenseFile.signature)) {
        return { status: buildLicenseStatus('INVALID_SIGNATURE', licenseFile.payload) };
    }

    const validFromMs = Date.parse(licenseFile.payload.validFrom);
    const expiresAtMs = Date.parse(licenseFile.payload.expiresAt);
    const nowMs = Date.now();

    if (!Number.isFinite(validFromMs) || !Number.isFinite(expiresAtMs)) {
        return { status: buildLicenseStatus('CORRUPT', licenseFile.payload) };
    }

    if (nowMs < validFromMs) {
        return { status: buildLicenseStatus('NOT_YET_VALID', licenseFile.payload) };
    }

    if (nowMs > expiresAtMs) {
        return { status: buildLicenseStatus('EXPIRED', licenseFile.payload) };
    }

    if (licenseFile.payload.deviceBinding) {
        const currentFingerprint = await getDeviceFingerprint();
        if (licenseFile.payload.deviceFingerprint !== currentFingerprint) {
            return { status: buildLicenseStatus('DEVICE_MISMATCH', licenseFile.payload) };
        }
    }

    return {
        status: buildLicenseStatus('ACTIVE', licenseFile.payload),
        normalized: licenseFile
    };
};

const buildTrialDetails = (trialState) => ({
    customerName: 'نسخة تجريبية',
    expiresAt: trialState.expiresAt,
    licenseId: 'TRIAL-LOCAL',
    features: [`TRIAL_${TRIAL_PERIOD_DAYS}_DAYS`]
});

const buildTrialActiveStatus = (trialState) => {
    const expiresAtMs = Date.parse(trialState.expiresAt);
    const remainingMs = Math.max(0, expiresAtMs - Date.now());
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    return {
        status: 'TRIAL_ACTIVE',
        messageAr: `${LICENSE_STATUS_MESSAGES_AR.TRIAL_ACTIVE} متبقي ${remainingDays} يوم.`,
        details: buildTrialDetails(trialState)
    };
};

const getStatusWithoutLicense = async () => {
    const trialPath = getTrialFilePath();
    let trialState = null;

    try {
        const rawTrial = await fs.promises.readFile(trialPath, 'utf8');
        trialState = parseTrialFileText(rawTrial);
        if (!trialState) {
            return {
                status: 'NO_LICENSE',
                messageAr: TRIAL_EXPIRED_MESSAGE_AR
            };
        }
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            return buildLicenseStatus('CORRUPT');
        }
    }

    if (!trialState) {
        trialState = createTrialState();
        try {
            await fs.promises.mkdir(path.dirname(trialPath), { recursive: true });
            await fs.promises.writeFile(trialPath, `${JSON.stringify(trialState, null, 2)}\n`, 'utf8');
        } catch {
            return buildLicenseStatus('CORRUPT');
        }
    }

    const expiresAtMs = Date.parse(trialState.expiresAt);
    if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs) {
        return {
            status: 'NO_LICENSE',
            messageAr: TRIAL_EXPIRED_MESSAGE_AR,
            details: buildTrialDetails(trialState)
        };
    }

    return buildTrialActiveStatus(trialState);
};

const getCurrentLicenseStatus = async () => {
    try {
        const raw = await fs.promises.readFile(getLicenseFilePath(), 'utf8');
        const evaluated = await evaluateLicenseText(raw);
        return evaluated.status;
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return getStatusWithoutLicense();
        }
        return buildLicenseStatus('CORRUPT');
    }
};

const activateLicenseFromJson = async (licenseJsonText, options = {}) => {
    const evaluated = await evaluateLicenseText(licenseJsonText);
    if (evaluated.status.status !== 'ACTIVE') {
        return evaluated.status;
    }

    if (options?.dryRun) {
        return evaluated.status;
    }

    if (!evaluated.normalized) {
        return buildLicenseStatus('CORRUPT');
    }

    const licensePath = getLicenseFilePath();
    await fs.promises.mkdir(path.dirname(licensePath), { recursive: true });
    await fs.promises.writeFile(licensePath, `${JSON.stringify(evaluated.normalized, null, 2)}\n`, 'utf8');

    return getCurrentLicenseStatus();
};

const removeCurrentLicense = async () => {
    try {
        await fs.promises.unlink(getLicenseFilePath());
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            return buildLicenseStatus('CORRUPT');
        }
    }

    return getCurrentLicenseStatus();
};

// IPC Handlers
ipcMain.handle('licensing:getStatus', async () => {
    return await getCurrentLicenseStatus();
});
ipcMain.handle('licensing:activateFromJson', async (event, licenseJsonText, options) => {
    return await activateLicenseFromJson(licenseJsonText, options || {});
});
ipcMain.handle('licensing:remove', async () => {
    return await removeCurrentLicense();
});
ipcMain.handle('licensing:getDeviceFingerprint', async () => {
    return await getDeviceFingerprint();
});

ipcMain.handle('auth:login', async (event, credentials) => {
    return await dbService.login(credentials);
});

ipcMain.handle('db:getDashboardStats', async (event, token) => {
    return await dbService.getDashboardStats();
});

// Products
ipcMain.handle('db:getProducts', async (event, params) => {
    return await dbService.getProducts(params);
});
ipcMain.handle('db:getProduct', async (event, id) => {
    return await dbService.getProduct(id);
});
ipcMain.handle('db:addProduct', async (event, productData) => {
    return await dbService.addProduct(productData);
});
ipcMain.handle('db:updateProduct', async (event, id, productData) => {
    return await dbService.updateProduct(id, productData);
});
ipcMain.handle('db:deleteProduct', async (event, id) => {
    return await dbService.deleteProduct(id);
});
ipcMain.handle('db:searchProducts', async (event, query) => {
    return await dbService.searchProducts(query);
});

// Categories
ipcMain.handle('db:getCategories', async () => {
    return await dbService.getCategories();
});
ipcMain.handle('db:addCategory', async (event, categoryData) => {
    return await dbService.addCategory(categoryData);
});
ipcMain.handle('db:updateCategory', async (event, id, categoryData) => {
    return await dbService.updateCategory(id, categoryData);
});
ipcMain.handle('db:deleteCategory', async (event, id) => {
    return await dbService.deleteCategory(id);
});

// Inventory
ipcMain.handle('db:getInventory', async (event, productId) => {
    return await dbService.getInventory(productId);
});
ipcMain.handle('db:updateInventory', async (event, productId, inventoryData) => {
    return await dbService.updateInventory(productId, inventoryData);
});

// Warehouses
ipcMain.handle('db:getWarehouses', async () => {
    return await dbService.getWarehouses();
});
ipcMain.handle('db:getWarehouseInventory', async (event, warehouseId) => {
    return await dbService.getWarehouseInventory(warehouseId);
});
ipcMain.handle('db:addWarehouse', async (event, warehouseData) => {
    return await dbService.addWarehouse(warehouseData);
});
ipcMain.handle('db:updateWarehouse', async (event, id, warehouseData) => {
    return await dbService.updateWarehouse(id, warehouseData);
});
ipcMain.handle('db:deleteWarehouse', async (event, id) => {
    return await dbService.deleteWarehouse(id);
});
ipcMain.handle('db:getWarehouseStocks', async (event, productId) => {
    return await dbService.getWarehouseStocks(productId);
});
ipcMain.handle('db:updateWarehouseStock', async (event, productId, warehouseId, quantity) => {
    return await dbService.updateWarehouseStock(productId, warehouseId, quantity);
});
ipcMain.handle('db:updateMultipleWarehouseStocks', async (event, productId, stocks) => {
    return await dbService.updateMultipleWarehouseStocks(productId, stocks);
});
ipcMain.handle('db:updateVariantWarehouseStocks', async (event, productId, stocks) => {
    return await dbService.updateVariantWarehouseStocks(productId, stocks);
});
ipcMain.handle('db:reconcileVariantInventoryStocks', async (event, productId) => {
    return await dbService.reconcileVariantInventoryStocks(productId);
});
ipcMain.handle('db:transferProductBetweenWarehouses', async (event, productId, fromWarehouseId, toWarehouseId, quantity, notes, variantId) => {
    return await dbService.transferProductBetweenWarehouses(productId, fromWarehouseId, toWarehouseId, quantity, notes, variantId);
});
ipcMain.handle('db:getWarehouseTransfers', async (event, productId, limit) => {
    return await dbService.getWarehouseTransfers(productId, limit);
});

// Variants
ipcMain.handle('db:getVariants', async () => {
    return await dbService.getVariants();
});
ipcMain.handle('db:addVariant', async (event, variantData) => {
    return await dbService.addVariant(variantData);
});
ipcMain.handle('db:getProductHistory', async (event, variantId) => {
    return await dbService.getProductHistory(variantId);
});

// Sales
ipcMain.handle('db:getSales', async (event, options) => {
    return await dbService.getSales(options);
});
ipcMain.handle('db:getSaleById', async (event, saleId) => {
    return await dbService.getSaleById(saleId);
});
ipcMain.handle('db:createSale', async (event, saleData) => {
    return await dbService.createSale(saleData);
});
ipcMain.handle('db:deleteSale', async (event, saleId) => {
    return await dbService.deleteSale(saleId);
});
ipcMain.handle('db:updateSale', async (event, saleId, saleData) => {
    return await dbService.updateSale(saleId, saleData);
});

// Message Box Handler (for safeAlert and safeConfirm)
ipcMain.handle('dialog:showMessageBox', async (event, options) => {
    try {
        const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
            type: options.type || 'info',
            title: options.title || 'رسالة',
            message: options.message || '',
            detail: options.detail,
            buttons: options.buttons || ['موافق'],
            defaultId: options.defaultId || 0,
            cancelId: options.cancelId
        });
        return result;
    } catch (err) {
        console.error('Dialog Error:', err);
        return { error: err.message };
    }
});

const normalizePrinterName = (value) => String(value ?? '')
    .trim()
    .slice(0, 255);

const printWindowOptionsByWebContentsId = new Map();

ipcMain.handle('print:listPrinters', async (event) => {
    try {
        const printers = await event.sender.getPrintersAsync();
        return (Array.isArray(printers) ? printers : [])
            .map((printer) => {
                const name = String(printer?.name || '').trim();
                if (!name) return null;
                return {
                    name,
                    displayName: String(printer?.displayName || name),
                    description: String(printer?.description || ''),
                    isDefault: Boolean(printer?.isDefault)
                };
            })
            .filter(Boolean);
    } catch (err) {
        console.error('List Printers Error:', err);
        return { error: err.message };
    }
});

// Print action handler from print preview windows
ipcMain.handle('trigger-print', async (event, options = {}) => {
    try {
        const senderContents = event.sender;
        const senderWindow = BrowserWindow.fromWebContents(senderContents);
        const storedOptions = printWindowOptionsByWebContentsId.get(senderContents.id) || {};
        const printerName = normalizePrinterName(options?.printerName ?? storedOptions?.printerName);
        const silent = typeof options?.silent === 'boolean'
            ? options.silent
            : (typeof storedOptions?.silent === 'boolean' ? storedOptions.silent : true);

        if (!senderWindow || senderWindow.isDestroyed()) {
            return { success: false, error: 'Print window is not available' };
        }

        return await new Promise((resolve) => {
            senderContents.print(
                {
                    silent,
                    printBackground: true,
                    color: true,
                    margins: { marginType: 'printableArea' },
                    deviceName: printerName || ''
                },
                (success, errorType) => {
                    resolve({ success, error: errorType || null });
                }
            );
        });
    } catch (err) {
        console.error('Trigger Print Error:', err);
        return { success: false, error: err.message };
    }
});

// HTML Printing Handler (for safePrint)
ipcMain.handle('print:html', async (event, options = {}) => {
    let printWindow = null;

    try {
        const html = typeof options?.html === 'string' ? options.html : '';
        if (!html.trim()) {
            return { success: false, error: 'HTML content is required for printing' };
        }

        const printerName = normalizePrinterName(options?.printerName);
        const silent = Boolean(options?.silent);

        printWindow = new BrowserWindow({
            width: 900,
            height: 700,
            show: !silent,
            title: options?.title || 'معاينة الطباعة',
            webPreferences: {
                preload: path.join(__dirname, '..', 'printing', 'print-preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        const printWebContentsId = printWindow.webContents.id;
        if (!silent) {
            printWindowOptionsByWebContentsId.set(printWebContentsId, {
                printerName,
                silent: true
            });
        }

        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        if (silent) {
            return await new Promise((resolve) => {
                printWindow.webContents.print(
                    {
                        silent: true,
                        printBackground: true,
                        color: true,
                        margins: { marginType: 'printableArea' },
                        deviceName: printerName || ''
                    },
                    (success, errorType) => {
                        if (printWindow && !printWindow.isDestroyed()) {
                            printWindow.close();
                        }
                        resolve({ success, error: errorType || null });
                    }
                );
            });
        }

        return await new Promise((resolve) => {
            printWindow.on('closed', () => {
                printWindowOptionsByWebContentsId.delete(printWebContentsId);
                resolve({ success: true, windowOpened: true });
            });

            printWindow.webContents.on('did-fail-load', (loadEvent, errorCode, errorDescription) => {
                printWindowOptionsByWebContentsId.delete(printWebContentsId);
                if (printWindow && !printWindow.isDestroyed()) {
                    printWindow.close();
                }
                resolve({ success: false, error: errorDescription });
            });
        });
    } catch (err) {
        if (printWindow && !printWindow.isDestroyed()) {
            printWindow.close();
        }
        console.error('Print Error:', err);
        return { error: err.message };
    }
});

ipcMain.handle('print:exportPDF', async (event, options = {}) => {
    let pdfWindow = null;

    try {
        const html = typeof options?.html === 'string' ? options.html : '';
        if (!html.trim()) {
            return { error: 'HTML content is required for PDF export' };
        }

        pdfWindow = new BrowserWindow({
            width: 900,
            height: 700,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        const pdfBuffer = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            landscape: Boolean(options?.landscape),
            marginsType: 0
        });

        const ownerWindow = BrowserWindow.fromWebContents(event.sender);
        const saveResult = await dialog.showSaveDialog(ownerWindow || undefined, {
            title: options?.title || 'حفظ PDF',
            defaultPath: path.join(
                app.getPath('documents'),
                sanitizePdfFileName(options?.suggestedName || 'labels.pdf')
            ),
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });

        if (saveResult.canceled || !saveResult.filePath) {
            return { success: false, canceled: true };
        }

        await fs.promises.writeFile(saveResult.filePath, pdfBuffer);
        return { success: true, filePath: saveResult.filePath };
    } catch (err) {
        console.error('Export PDF Error:', err);
        return { success: false, error: err.message };
    } finally {
        if (pdfWindow && !pdfWindow.isDestroyed()) {
            pdfWindow.close();
        }
    }
});

const normalizeCompanyPrintText = (value, maxLength = 250) => String(value ?? '')
    .trim()
    .slice(0, maxLength);

const normalizeCompanyPrintInfo = (companyInfo = {}) => ({
    name: normalizeCompanyPrintText(companyInfo?.name, 120),
    contactNumbers: normalizeCompanyPrintText(companyInfo?.contactNumbers, 500),
    address: normalizeCompanyPrintText(companyInfo?.address, 250)
});

// Legacy Printing Handler (kept for backward compatibility)
ipcMain.handle('print:sale', async (event, saleId, companyInfo) => {
    try {
        const sale = await dbService.getSaleDetails(saleId);
        if (!sale || sale.error) return { error: 'Sale not found' };

        const printWindow = new BrowserWindow({
            width: 400,
            height: 600,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        const printPath = path.join(__dirname, '..', 'printing', 'print.html');
        await printWindow.loadFile(printPath);

        printWindow.webContents.send('print-data', {
            sale,
            company: normalizeCompanyPrintInfo(companyInfo)
        });

        return { success: true };
    } catch (err) {
        console.error('Print Error:', err);
        return { error: err.message };
    }
});

// Customers
ipcMain.handle('db:getCustomerStats', async (event, params) => {
    return await dbService.getCustomerStats(params);
});
ipcMain.handle('db:getCustomers', async (event, params) => {
    return await dbService.getCustomers(params);
});
ipcMain.handle('db:getCustomerLookup', async (event, params) => {
    return await dbService.getCustomerLookup(params);
});
ipcMain.handle('db:addCustomer', async (event, customerData) => {
    return await dbService.addCustomer(customerData);
});
ipcMain.handle('db:updateCustomer', async (event, id, customerData) => {
    return await dbService.updateCustomer(id, customerData);
});
ipcMain.handle('db:deleteCustomer', async (event, id) => {
    return await dbService.deleteCustomer(id);
});

ipcMain.handle('db:getCustomer', async (event, id) => {
    return await dbService.getCustomer(id);
});
ipcMain.handle('db:getCustomerSales', async (event, customerId) => {
    return await dbService.getCustomerSales(customerId);
});
ipcMain.handle('db:getCustomerReturns', async (event, customerId) => {
    return await dbService.getCustomerReturns(customerId);
});

// Suppliers
ipcMain.handle('db:getSuppliers', async () => {
    return await dbService.getSuppliers();
});
ipcMain.handle('db:addSupplier', async (event, supplierData) => {
    return await dbService.addSupplier(supplierData);
});
ipcMain.handle('db:updateSupplier', async (event, id, supplierData) => {
    return await dbService.updateSupplier(id, supplierData);
});
ipcMain.handle('db:deleteSupplier', async (event, id) => {
    return await dbService.deleteSupplier(id);
});

// Expenses
ipcMain.handle('db:getExpenses', async (event, params) => {
    return await dbService.getExpenses(params || {});
});
ipcMain.handle('db:addExpense', async (event, expenseData) => {
    return await dbService.addExpense(expenseData);
});
ipcMain.handle('db:updateExpense', async (event, id, expenseData) => {
    return await dbService.updateExpense(id, expenseData);
});
ipcMain.handle('db:deleteExpense', async (event, id) => {
    return await dbService.deleteExpense(id);
});

// Expense Categories
ipcMain.handle('db:getExpenseCategories', async () => {
    return await dbService.getExpenseCategories();
});
ipcMain.handle('db:addExpenseCategory', async (event, data) => {
    return await dbService.addExpenseCategory(data);
});
ipcMain.handle('db:updateExpenseCategory', async (event, id, data) => {
    return await dbService.updateExpenseCategory(id, data);
});
// Print HTML
ipcMain.handle('print:printHTML', async (event, payload = {}) => {
    const {
        html = '',
        title,
        silent,
        printerName
    } = payload;
    let printWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    try {
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        const normalizedPrinterName = normalizePrinterName(printerName);
        const shouldPrintSilently = typeof silent === 'boolean'
            ? silent
            : Boolean(normalizedPrinterName);
        const options = {
            silent: shouldPrintSilently,
            printBackground: true,
            deviceName: normalizedPrinterName || '' // Default printer when empty
        };

        return new Promise((resolve) => {
            printWindow.webContents.print(options, (success, errorType) => {
                if (!success) {
                    resolve({ error: errorType });
                } else {
                    resolve({ success: true });
                }
                printWindow.close();
                printWindow = null;
            });
        });
    } catch (error) {
        if (printWindow) {
            printWindow.close();
            printWindow = null;
        }
        return { error: error.message };
    }
});

// Users
ipcMain.handle('db:getUsers', async () => {
    return await dbService.getUsers();
});
ipcMain.handle('db:addUser', async (event, userData) => {
    return await dbService.addUser(userData);
});
ipcMain.handle('db:updateUser', async (event, id, userData) => {
    return await dbService.updateUser(id, userData);
});
ipcMain.handle('db:deleteUser', async (event, id) => {
    return await dbService.deleteUser(id);
});

// Purchases
ipcMain.handle('db:getPurchases', async (event, options) => {
    return await dbService.getPurchases(options || {});
});
ipcMain.handle('db:getPurchaseById', async (event, purchaseId) => {
    return await dbService.getPurchaseById(purchaseId);
});
ipcMain.handle('db:createPurchase', async (event, purchaseData) => {
    return await dbService.createPurchase(purchaseData);
});
ipcMain.handle('db:updatePurchase', async (event, purchaseId, purchaseData) => {
    return await dbService.updatePurchase(purchaseId, purchaseData || {});
});
ipcMain.handle('db:deletePurchase', async (event, purchaseId) => {
    return await dbService.deletePurchase(purchaseId);
});

// Returns
ipcMain.handle('db:getReturns', async (event, options) => {
    return await dbService.getReturns(options || {});
});
ipcMain.handle('db:getReturnById', async (event, returnId) => {
    return await dbService.getReturnById(returnId);
});
ipcMain.handle('db:createReturn', async (event, returnData) => {
    return await dbService.createReturn(returnData);
});
ipcMain.handle('db:updateReturn', async (event, returnId, returnData) => {
    return await dbService.updateReturn(returnId, returnData || {});
});
ipcMain.handle('db:deleteReturn', async (event, returnId) => {
    return await dbService.deleteReturn(returnId);
});
ipcMain.handle('db:getPurchaseReturns', async (event, options) => {
    return await dbService.getPurchaseReturns(options || {});
});
ipcMain.handle('db:getPurchaseReturnById', async (event, returnId) => {
    return await dbService.getPurchaseReturnById(returnId);
});
ipcMain.handle('db:createPurchaseReturn', async (event, returnData) => {
    return await dbService.createPurchaseReturn(returnData);
});
ipcMain.handle('db:updatePurchaseReturn', async (event, returnId, returnData) => {
    return await dbService.updatePurchaseReturn(returnId, returnData || {});
});
ipcMain.handle('db:deletePurchaseReturn', async (event, returnId) => {
    return await dbService.deletePurchaseReturn(returnId);
});

// Customer Payments
ipcMain.handle('db:addCustomerPayment', async (event, paymentData) => {
    console.log('IPC db:addCustomerPayment received:', paymentData);
    return await dbService.addCustomerPayment(paymentData);
});
ipcMain.handle('db:createCustomerPayment', async (event, paymentData) => {
    return await dbService.createCustomerPayment(paymentData || {});
});
ipcMain.handle('db:previewCustomerPaymentAllocation', async (event, params) => {
    return await dbService.previewCustomerPaymentAllocation(params || {});
});
ipcMain.handle('db:getCustomerPayments', async (event, customerId) => {
    return await dbService.getCustomerPayments(customerId);
});
ipcMain.handle('db:updateCustomerPayment', async (event, paymentId, paymentData) => {
    return await dbService.updateCustomerPayment(paymentId, paymentData);
});
ipcMain.handle('db:deleteCustomerPayment', async (event, paymentId) => {
    return await dbService.deleteCustomerPayment(paymentId);
});
ipcMain.handle('db:rebuildCustomerFinancials', async (event, customerId) => {
    return await dbService.rebuildCustomerFinancials(customerId);
});
ipcMain.handle('db:rebuildAllCustomersFinancials', async (event, params) => {
    return await dbService.rebuildAllCustomersFinancials(params || {});
});
ipcMain.handle('db:checkCustomerFinancialsHealth', async () => {
    return await dbService.checkCustomerFinancialsHealth();
});
ipcMain.handle('db:getPaymentMethods', async () => {
    return await dbService.getPaymentMethods();
});
ipcMain.handle('db:getPaymentMethodStats', async () => {
    return await dbService.getPaymentMethodStats();
});

// Treasury
ipcMain.handle('db:getTreasuries', async () => {
    return await dbService.getTreasuries();
});
ipcMain.handle('db:createTreasury', async (event, treasuryData) => {
    return await dbService.createTreasury(treasuryData);
});
ipcMain.handle('db:updateTreasury', async (event, id, treasuryData) => {
    return await dbService.updateTreasury(id, treasuryData);
});
ipcMain.handle('db:setDefaultTreasury', async (event, id, options) => {
    return await dbService.setDefaultTreasury(id, options || {});
});
ipcMain.handle('db:deleteTreasury', async (event, id, options) => {
    return await dbService.deleteTreasury(id, options || {});
});
ipcMain.handle('db:createTreasuryTransaction', async (event, transactionData) => {
    return await dbService.createTreasuryTransaction(transactionData);
});
ipcMain.handle('db:createDepositReceipt', async (event, params) => {
    return await dbService.createDepositReceipt(params || {});
});
ipcMain.handle('db:applyDepositToSale', async (event, params) => {
    return await dbService.applyDepositToSale(params || {});
});
ipcMain.handle('db:refundDeposit', async (event, params) => {
    return await dbService.refundDeposit(params || {});
});
ipcMain.handle('db:getTreasuryEntries', async (event, params) => {
    return await dbService.getTreasuryEntries(params || {});
});
ipcMain.handle('db:getPaymentMethodReport', async (event, params) => {
    return await dbService.getPaymentMethodReport(params || {});
});
ipcMain.handle('db:getDailyRevenueReport', async (event, params) => {
    return await dbService.getDailyRevenueReport(params || {});
});

// Supplier Payments
ipcMain.handle('db:addSupplierPayment', async (event, paymentData) => {
    return await dbService.addSupplierPayment(paymentData);
});
ipcMain.handle('db:getSupplierPayments', async (event, supplierId) => {
    return await dbService.getSupplierPayments(supplierId);
});

// Search
ipcMain.handle('db:searchVariants', async (event, query) => {
    return await dbService.searchVariants(query);
});

// Variant Update
ipcMain.handle('db:updateVariant', async (event, id, variantData) => {
    return await dbService.updateVariant(id, variantData);
});

// Variant Delete
ipcMain.handle('db:deleteVariant', async (event, id) => {
    return await dbService.deleteVariant(id);
});

const reconcileVariantInventoryStocksOnStartup = async () => {
    try {
        const result = await dbService.reconcileVariantInventoryStocks();
        if (result?.error) {
            console.warn('[startup] Failed to reconcile variant inventory stocks:', result.error);
            return;
        }

        if ((result?.processed || 0) > 0) {
            console.log(
                `[startup] Reconciled variant inventory stocks: ${result.synced}/${result.processed} succeeded, ${result.failed} failed`
            );
        }
    } catch (error) {
        console.warn('[startup] Failed to reconcile variant inventory stocks:', error?.message || error);
    }
};

app.whenReady().then(() => {
    createWindow()
    void reconcileVariantInventoryStocksOnStartup()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
