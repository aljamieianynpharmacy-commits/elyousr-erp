const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Authentication
  login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Users
  listUsers: (token) => ipcRenderer.invoke('users:list', token),
  createUser: (token, data) => ipcRenderer.invoke('users:create', { token, data }),

  // Products
  listProducts: (token) => ipcRenderer.invoke('products:list', token),
  createProduct: (token, data) => ipcRenderer.invoke('products:create', { token, data }),
  deleteProduct: (token, productId) => ipcRenderer.invoke('products:delete', { token, productId }),

  // Variants
  createVariant: (token, data) => ipcRenderer.invoke('variants:create', { token, data }),
  updateVariant: (token, variantId, data) => ipcRenderer.invoke('variants:update', { token, variantId, data }),
  deleteVariant: (token, variantId) => ipcRenderer.invoke('variants:delete', { token, variantId }),

  // Sales / POS
  createSale: (token, saleData) => ipcRenderer.invoke('sales:create', { token, saleData }),
  listSales: (token, page, limit) => ipcRenderer.invoke('sales:list', { token, page, limit }),

  // Customers
  listCustomers: (token) => ipcRenderer.invoke('customers:list', token),
  createCustomer: (token, data) => ipcRenderer.invoke('customers:create', { token, data }),
  deleteCustomer: (token, customerId) => ipcRenderer.invoke('customers:delete', { token, customerId }),

  // Expenses
  listExpenses: (token) => ipcRenderer.invoke('expenses:list', token),
  createExpense: (token, data) => ipcRenderer.invoke('expenses:create', { token, data }),

  // Dashboard
  getDashboardStats: (token) => ipcRenderer.invoke('dashboard:stats', token)
});
