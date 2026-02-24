const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Auth
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),

    // Dashboard
    getDashboardStats: (token) => ipcRenderer.invoke('db:getDashboardStats', token),

    // Products
    getProducts: (params) => ipcRenderer.invoke('db:getProducts', params),
    getProduct: (id) => ipcRenderer.invoke('db:getProduct', id),
    searchProducts: (query) => ipcRenderer.invoke('db:searchProducts', query),
    addProduct: (productData) => ipcRenderer.invoke('db:addProduct', productData),
    updateProduct: (id, productData) => ipcRenderer.invoke('db:updateProduct', id, productData),
    deleteProduct: (id) => ipcRenderer.invoke('db:deleteProduct', id),

    // Categories
    getCategories: () => ipcRenderer.invoke('db:getCategories'),
    addCategory: (categoryData) => ipcRenderer.invoke('db:addCategory', categoryData),
    updateCategory: (id, categoryData) => ipcRenderer.invoke('db:updateCategory', id, categoryData),
    deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),

    // Warehouses
    getWarehouses: () => ipcRenderer.invoke('db:getWarehouses'),
    getWarehouseInventory: (warehouseId) => ipcRenderer.invoke('db:getWarehouseInventory', warehouseId),
    addWarehouse: (warehouseData) => ipcRenderer.invoke('db:addWarehouse', warehouseData),
    updateWarehouse: (id, warehouseData) => ipcRenderer.invoke('db:updateWarehouse', id, warehouseData),
    deleteWarehouse: (id) => ipcRenderer.invoke('db:deleteWarehouse', id),
    getWarehouseStocks: (productId) => ipcRenderer.invoke('db:getWarehouseStocks', productId),
    updateWarehouseStock: (productId, warehouseId, quantity) => ipcRenderer.invoke('db:updateWarehouseStock', productId, warehouseId, quantity),
    updateMultipleWarehouseStocks: (productId, stocks) => ipcRenderer.invoke('db:updateMultipleWarehouseStocks', productId, stocks),
    updateVariantWarehouseStocks: (productId, stocks) => ipcRenderer.invoke('db:updateVariantWarehouseStocks', productId, stocks),
    transferProductBetweenWarehouses: (productId, fromWarehouseId, toWarehouseId, quantity, notes, variantId) => ipcRenderer.invoke('db:transferProductBetweenWarehouses', productId, fromWarehouseId, toWarehouseId, quantity, notes, variantId),
    getWarehouseTransfers: (productId, limit) => ipcRenderer.invoke('db:getWarehouseTransfers', productId, limit),
    // Inventory
    getInventory: (productId) => ipcRenderer.invoke('db:getInventory', productId),
    updateInventory: (productId, inventoryData) => ipcRenderer.invoke('db:updateInventory', productId, inventoryData),

    // Variants
    getVariants: () => ipcRenderer.invoke('db:getVariants'),
    searchVariants: (query) => ipcRenderer.invoke('db:searchVariants', query),
    addVariant: (variantData) => ipcRenderer.invoke('db:addVariant', variantData),
    updateVariant: (id, variantData) => ipcRenderer.invoke('db:updateVariant', id, variantData),
    deleteVariant: (id) => ipcRenderer.invoke('db:deleteVariant', id),
    getProductHistory: (variantId) => ipcRenderer.invoke('db:getProductHistory', variantId),

    // Sales
    getSales: (options) => ipcRenderer.invoke('db:getSales', options),
    getSaleById: (saleId) => ipcRenderer.invoke('db:getSaleById', saleId),
    createSale: (saleData) => ipcRenderer.invoke('db:createSale', saleData),
    printSale: (saleId, companyInfo) => ipcRenderer.invoke('print:sale', saleId, companyInfo),
    printHTML: (options) => ipcRenderer.invoke('print:printHTML', options),
    listPrinters: () => ipcRenderer.invoke('print:listPrinters'),
    deleteSale: (saleId) => ipcRenderer.invoke('db:deleteSale', saleId),
    updateSale: (saleId, saleData) => ipcRenderer.invoke('db:updateSale', saleId, saleData),

    // Purchases
    getPurchases: (options) => ipcRenderer.invoke('db:getPurchases', options),
    getPurchaseById: (purchaseId) => ipcRenderer.invoke('db:getPurchaseById', purchaseId),
    createPurchase: (purchaseData) => ipcRenderer.invoke('db:createPurchase', purchaseData),
    updatePurchase: (purchaseId, purchaseData) => ipcRenderer.invoke('db:updatePurchase', purchaseId, purchaseData),
    deletePurchase: (purchaseId) => ipcRenderer.invoke('db:deletePurchase', purchaseId),

    // Returns

    // Returns
    getReturns: () => ipcRenderer.invoke('db:getReturns'),
    createReturn: (returnData) => ipcRenderer.invoke('db:createReturn', returnData),
    getPurchaseReturns: () => ipcRenderer.invoke('db:getPurchaseReturns'),
    createPurchaseReturn: (returnData) => ipcRenderer.invoke('db:createPurchaseReturn', returnData),

    // Customers
    getCustomers: (params) => ipcRenderer.invoke('db:getCustomers', params),
    addCustomer: (customerData) => ipcRenderer.invoke('db:addCustomer', customerData),
    updateCustomer: (id, customerData) => ipcRenderer.invoke('db:updateCustomer', id, customerData),
    deleteCustomer: (id) => ipcRenderer.invoke('db:deleteCustomer', id),
    getCustomer: (id) => ipcRenderer.invoke('db:getCustomer', id),
    getCustomerSales: (customerId) => ipcRenderer.invoke('db:getCustomerSales', customerId),
    getCustomerReturns: (customerId) => ipcRenderer.invoke('db:getCustomerReturns', customerId),
    addCustomerPayment: (paymentData) => ipcRenderer.invoke('db:addCustomerPayment', paymentData),
    createCustomerPayment: (paymentData) => ipcRenderer.invoke('db:createCustomerPayment', paymentData),
    previewCustomerPaymentAllocation: (params) => ipcRenderer.invoke('db:previewCustomerPaymentAllocation', params),
    getCustomerPayments: (customerId) => ipcRenderer.invoke('db:getCustomerPayments', customerId),
    updateCustomerPayment: (paymentId, paymentData) => ipcRenderer.invoke('db:updateCustomerPayment', paymentId, paymentData),
    deleteCustomerPayment: (paymentId) => ipcRenderer.invoke('db:deleteCustomerPayment', paymentId),
    rebuildCustomerFinancials: (customerId) => ipcRenderer.invoke('db:rebuildCustomerFinancials', customerId),
    rebuildAllCustomersFinancials: (params) => ipcRenderer.invoke('db:rebuildAllCustomersFinancials', params),
    checkCustomerFinancialsHealth: () => ipcRenderer.invoke('db:checkCustomerFinancialsHealth'),
    getPaymentMethods: () => ipcRenderer.invoke('db:getPaymentMethods'),
    getPaymentMethodStats: () => ipcRenderer.invoke('db:getPaymentMethodStats'),
    getPaymentMethodReport: (params) => ipcRenderer.invoke('db:getPaymentMethodReport', params),

    // Treasury
    getTreasuries: () => ipcRenderer.invoke('db:getTreasuries'),
    createTreasury: (treasuryData) => ipcRenderer.invoke('db:createTreasury', treasuryData),
    updateTreasury: (id, treasuryData) => ipcRenderer.invoke('db:updateTreasury', id, treasuryData),
    setDefaultTreasury: (id, options) => ipcRenderer.invoke('db:setDefaultTreasury', id, options),
    deleteTreasury: (id, options) => ipcRenderer.invoke('db:deleteTreasury', id, options),
    createTreasuryTransaction: (transactionData) => ipcRenderer.invoke('db:createTreasuryTransaction', transactionData),
    createDepositReceipt: (params) => ipcRenderer.invoke('db:createDepositReceipt', params),
    applyDepositToSale: (params) => ipcRenderer.invoke('db:applyDepositToSale', params),
    refundDeposit: (params) => ipcRenderer.invoke('db:refundDeposit', params),
    getTreasuryEntries: (params) => ipcRenderer.invoke('db:getTreasuryEntries', params),
    getDailyRevenueReport: (params) => ipcRenderer.invoke('db:getDailyRevenueReport', params),

    // Suppliers
    getSuppliers: () => ipcRenderer.invoke('db:getSuppliers'),
    addSupplier: (supplierData) => ipcRenderer.invoke('db:addSupplier', supplierData),
    updateSupplier: (id, supplierData) => ipcRenderer.invoke('db:updateSupplier', id, supplierData),
    deleteSupplier: (id) => ipcRenderer.invoke('db:deleteSupplier', id),
    addSupplierPayment: (paymentData) => ipcRenderer.invoke('db:addSupplierPayment', paymentData),
    getSupplierPayments: (supplierId) => ipcRenderer.invoke('db:getSupplierPayments', supplierId),

    // Expenses
    getExpenses: (params) => ipcRenderer.invoke('db:getExpenses', params),
    addExpense: (expenseData) => ipcRenderer.invoke('db:addExpense', expenseData),
    updateExpense: (id, expenseData) => ipcRenderer.invoke('db:updateExpense', id, expenseData),
    deleteExpense: (id) => ipcRenderer.invoke('db:deleteExpense', id),

    // Expense Categories
    getExpenseCategories: () => ipcRenderer.invoke('db:getExpenseCategories'),
    addExpenseCategory: (data) => ipcRenderer.invoke('db:addExpenseCategory', data),
    updateExpenseCategory: (id, data) => ipcRenderer.invoke('db:updateExpenseCategory', id, data),
    deleteExpenseCategory: (id) => ipcRenderer.invoke('db:deleteExpenseCategory', id),

    // Users
    getUsers: () => ipcRenderer.invoke('db:getUsers'),
    addUser: (userData) => ipcRenderer.invoke('db:addUser', userData),
    updateUser: (id, userData) => ipcRenderer.invoke('db:updateUser', id, userData),
    deleteUser: (id) => ipcRenderer.invoke('db:deleteUser', id),

    // Dialog & Printing
    showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
    printHTML: (options) => ipcRenderer.invoke('print:html', options),
    exportPDF: (options) => ipcRenderer.invoke('print:exportPDF', options)
});

contextBridge.exposeInMainWorld('licensing', {
    getStatus: () => ipcRenderer.invoke('licensing:getStatus'),
    activateFromJson: (licenseJsonText, options) => ipcRenderer.invoke('licensing:activateFromJson', licenseJsonText, options),
    remove: () => ipcRenderer.invoke('licensing:remove'),
    getDeviceFingerprint: () => ipcRenderer.invoke('licensing:getDeviceFingerprint')
});
