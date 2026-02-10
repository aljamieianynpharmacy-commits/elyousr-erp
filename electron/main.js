const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
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
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self' ws://localhost:5173 http://localhost:5173",
    ].join("; ");

    const prodCsp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
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
ipcMain.handle('db:getSales', async () => {
    return await dbService.getSales();
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
        ipcMain.handleOnce('trigger-print', async () => {
            return new Promise((resolve) => {
                printWindow.webContents.print(
                    {
                        silent: false,
                        printBackground: true,
                        color: true,
                        margins: { marginType: 'printableArea' },
                        pageSize: 'A4'
                    },
                    (success, errorType) => {
                        resolve({ success, error: errorType });
                    }
                );
            });
        });

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
ipcMain.handle('db:getExpenses', async () => {
    return await dbService.getExpenses();
});
ipcMain.handle('db:addExpense', async (event, expenseData) => {
    return await dbService.addExpense(expenseData);
});
ipcMain.handle('db:deleteExpense', async (event, id) => {
    return await dbService.deleteExpense(id);
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
ipcMain.handle('db:getCustomerPayments', async (event, customerId) => {
    return await dbService.getCustomerPayments(customerId);
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
