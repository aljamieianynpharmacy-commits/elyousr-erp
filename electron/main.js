const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')
const Module = require('module')

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

// IPC Handlers
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

// Variants
ipcMain.handle('db:getVariants', async () => {
    return await dbService.getVariants();
});
ipcMain.handle('db:addVariant', async (event, variantData) => {
    return await dbService.addVariant(variantData);
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

// Print action handler from print preview windows
ipcMain.handle('trigger-print', async (event) => {
    try {
        const senderContents = event.sender;
        const senderWindow = BrowserWindow.fromWebContents(senderContents);

        if (!senderWindow || senderWindow.isDestroyed()) {
            return { success: false, error: 'Print window is not available' };
        }

        return await new Promise((resolve) => {
            senderContents.print(
                {
                    silent: false,
                    printBackground: true,
                    color: true,
                    margins: { marginType: 'printableArea' },
                    pageSize: 'A4'
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
ipcMain.handle('print:html', async (event, options) => {
    try {
        const printWindow = new BrowserWindow({
            width: 900,
            height: 700,
            show: true,
            title: options.title || 'معاينة الطباعة',
            webPreferences: {
                preload: path.join(__dirname, 'print-preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`);

        // Handler للطباعة من داخل النافذة
        return new Promise((resolve) => {
            printWindow.on('closed', () => {
                resolve({ success: true, windowOpened: true });
            });

            printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                printWindow.close();
                resolve({ success: false, error: errorDescription });
            });
        });
    } catch (err) {
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

// Legacy Printing Handler (kept for backward compatibility)
ipcMain.handle('print:sale', async (event, saleId) => {
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

        const printPath = path.join(__dirname, 'print.html');
        await printWindow.loadFile(printPath);

        printWindow.webContents.send('print-data', sale);

        return { success: true };
    } catch (err) {
        console.error('Print Error:', err);
        return { error: err.message };
    }
});

// Customers
ipcMain.handle('db:getCustomers', async (event, params) => {
    return await dbService.getCustomers(params);
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
ipcMain.handle('print:printHTML', async (event, { html, title, silent }) => {
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

        const options = {
            silent: silent || false,
            printBackground: true,
            deviceName: '' // Default printer,
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
ipcMain.handle('db:getPurchases', async () => {
    return await dbService.getPurchases();
});
ipcMain.handle('db:createPurchase', async (event, purchaseData) => {
    return await dbService.createPurchase(purchaseData);
});

// Returns
ipcMain.handle('db:getReturns', async () => {
    return await dbService.getReturns();
});
ipcMain.handle('db:createReturn', async (event, returnData) => {
    return await dbService.createReturn(returnData);
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

app.whenReady().then(() => {
    createWindow()

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
