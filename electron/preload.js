const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Auth
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),

    // Dashboard
    getDashboardStats: (token) => ipcRenderer.invoke('db:getDashboardStats', token),

    // Products
    getProducts: (params) => ipcRenderer.invoke('db:getProducts', params),
    searchProducts: (query) => ipcRenderer.invoke('db:searchProducts', query),
    addProduct: (productData) => ipcRenderer.invoke('db:addProduct', productData),
    updateProduct: (id, productData) => ipcRenderer.invoke('db:updateProduct', id, productData),
    deleteProduct: (id) => ipcRenderer.invoke('db:deleteProduct', id),

    // Categories
    getCategories: () => ipcRenderer.invoke('db:getCategories'),
    addCategory: (categoryData) => ipcRenderer.invoke('db:addCategory', categoryData),
    updateCategory: (id, categoryData) => ipcRenderer.invoke('db:updateCategory', id, categoryData),
    deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),

    // Inventory
    getInventory: (productId) => ipcRenderer.invoke('db:getInventory', productId),
    updateInventory: (productId, inventoryData) => ipcRenderer.invoke('db:updateInventory', productId, inventoryData),

    // Variants
    getVariants: () => ipcRenderer.invoke('db:getVariants'),
    searchVariants: (query) => ipcRenderer.invoke('db:searchVariants', query),
    addVariant: (variantData) => ipcRenderer.invoke('db:addVariant', variantData),
    updateVariant: (id, variantData) => ipcRenderer.invoke('db:updateVariant', id, variantData),

    // Sales
    getSales: () => ipcRenderer.invoke('db:getSales'),
    createSale: (saleData) => ipcRenderer.invoke('db:createSale', saleData),
    printSale: (saleId) => ipcRenderer.invoke('print:sale', saleId),
    deleteSale: (saleId) => ipcRenderer.invoke('db:deleteSale', saleId),
    updateSale: (saleId, saleData) => ipcRenderer.invoke('db:updateSale', saleId, saleData),

    // Purchases
    getPurchases: () => ipcRenderer.invoke('db:getPurchases'),
    createPurchase: (purchaseData) => ipcRenderer.invoke('db:createPurchase', purchaseData),

    // Returns
    getReturns: () => ipcRenderer.invoke('db:getReturns'),
    createReturn: (returnData) => ipcRenderer.invoke('db:createReturn', returnData),

    // Customers
    getCustomers: (params) => ipcRenderer.invoke('db:getCustomers', params),
    addCustomer: (customerData) => ipcRenderer.invoke('db:addCustomer', customerData),
    updateCustomer: (id, customerData) => ipcRenderer.invoke('db:updateCustomer', id, customerData),
    deleteCustomer: (id) => ipcRenderer.invoke('db:deleteCustomer', id),
    getCustomer: (id) => ipcRenderer.invoke('db:getCustomer', id),
    getCustomerSales: (customerId) => ipcRenderer.invoke('db:getCustomerSales', customerId),
    getCustomerReturns: (customerId) => ipcRenderer.invoke('db:getCustomerReturns', customerId),
    addCustomerPayment: (paymentData) => ipcRenderer.invoke('db:addCustomerPayment', paymentData),
    getCustomerPayments: (customerId) => ipcRenderer.invoke('db:getCustomerPayments', customerId),
    deleteCustomerPayment: (paymentId) => ipcRenderer.invoke('db:deleteCustomerPayment', paymentId),
    rebuildCustomerFinancials: (customerId) => ipcRenderer.invoke('db:rebuildCustomerFinancials', customerId),
    rebuildAllCustomersFinancials: (params) => ipcRenderer.invoke('db:rebuildAllCustomersFinancials', params),
    checkCustomerFinancialsHealth: () => ipcRenderer.invoke('db:checkCustomerFinancialsHealth'),

    // Suppliers
    getSuppliers: () => ipcRenderer.invoke('db:getSuppliers'),
    addSupplier: (supplierData) => ipcRenderer.invoke('db:addSupplier', supplierData),
    updateSupplier: (id, supplierData) => ipcRenderer.invoke('db:updateSupplier', id, supplierData),
    deleteSupplier: (id) => ipcRenderer.invoke('db:deleteSupplier', id),
    addSupplierPayment: (paymentData) => ipcRenderer.invoke('db:addSupplierPayment', paymentData),
    getSupplierPayments: (supplierId) => ipcRenderer.invoke('db:getSupplierPayments', supplierId),

    // Expenses
    getExpenses: () => ipcRenderer.invoke('db:getExpenses'),
    addExpense: (expenseData) => ipcRenderer.invoke('db:addExpense', expenseData),
    deleteExpense: (id) => ipcRenderer.invoke('db:deleteExpense', id),

    // Users
    getUsers: () => ipcRenderer.invoke('db:getUsers'),
    addUser: (userData) => ipcRenderer.invoke('db:addUser', userData),
    updateUser: (id, userData) => ipcRenderer.invoke('db:updateUser', id, userData),
    deleteUser: (id) => ipcRenderer.invoke('db:deleteUser', id),

    // Dialog & Printing
    showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
    printHTML: (options) => ipcRenderer.invoke('print:html', options)
});
