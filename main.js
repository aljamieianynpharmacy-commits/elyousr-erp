require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

let mainWindow;
let currentUser = null;

// إنشاء النافذة الرئيسية
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // في التطوير: تحميل من Vite dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173'); // تم تعديل المنفذ إلى 5173 المعتاد
    mainWindow.webContents.openDevTools();
  } else {
    // في الإنتاج: تحميل من ملف مُبني
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ==================== IPC Handlers ====================

// 🔐 Authentication
ipcMain.handle('auth:login', async (event, { username, password }) => {
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return { success: false, error: 'مستخدم غير موجود' };
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return { success: false, error: 'كلمة السر خاطئة' };
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    currentUser = { userId: user.id, username: user.username, role: user.role };

    return {
      success: true,
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:logout', () => {
  currentUser = null;
  return { success: true };
});

// التحقق من الـ token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// 👤 Users (ADMIN only)
ipcMain.handle('users:list', async (event, token) => {
  try {
    const decoded = verifyToken(token);
    if (decoded.role !== 'ADMIN') throw new Error('Not authorized');

    return await prisma.user.findMany({ select: { id: true, name: true, username: true, role: true, createdAt: true } });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('users:create', async (event, { token, data }) => {
  try {
    const decoded = verifyToken(token);
    if (decoded.role !== 'ADMIN') throw new Error('Not authorized');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        username: data.username,
        password: hashedPassword,
        role: data.role
      },
      select: { id: true, name: true, username: true, role: true }
    });
    return user;
  } catch (error) {
    return { error: error.message };
  }
});

// 👕 Products
ipcMain.handle('products:list', async (event, token) => {
  try {
    verifyToken(token);
    return await prisma.product.findMany({
      include: { variants: true },
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('products:create', async (event, { token, data }) => {
  try {
    verifyToken(token);
    return await prisma.product.create({
      data: {
        name: data.name,
        category: data.category,
        brand: data.brand
      },
      include: { variants: true }
    });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('products:delete', async (event, { token, productId }) => {
  try {
    verifyToken(token);
    await prisma.product.delete({ where: { id: productId } });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// 🎨 Variants
ipcMain.handle('variants:create', async (event, { token, data }) => {
  try {
    verifyToken(token);
    return await prisma.variant.create({
      data: {
        productId: data.productId,
        size: data.size,
        color: data.color,
        price: parseFloat(data.price),
        cost: parseFloat(data.cost),
        quantity: parseInt(data.quantity)
      }
    });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('variants:update', async (event, { token, variantId, data }) => {
  try {
    verifyToken(token);
    return await prisma.variant.update({
      where: { id: variantId },
      data: {
        size: data.size,
        color: data.color,
        price: data.price ? parseFloat(data.price) : undefined,
        cost: data.cost ? parseFloat(data.cost) : undefined,
        quantity: data.quantity ? parseInt(data.quantity) : undefined
      }
    });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('variants:delete', async (event, { token, variantId }) => {
  try {
    verifyToken(token);
    await prisma.variant.delete({ where: { id: variantId } });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// 🛒 Sales (POS)
ipcMain.handle('sales:create', async (event, { token, saleData }) => {
  try {
    verifyToken(token);

    // استخدم transaction لضمان التكامل
    const sale = await prisma.$transaction(async (tx) => {
      // إنشاء البيع
      const newSale = await tx.sale.create({
        data: {
          total: saleData.total,
          payment: saleData.payment,
          items: {
            create: saleData.items.map((item, idx) => ({
              id: idx + 1,
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.price
            }))
          }
        },
        include: { items: true }
      });

      // تحديث كمية الـ variants
      for (const item of saleData.items) {
        await tx.variant.update({
          where: { id: item.variantId },
          data: { quantity: { decrement: item.quantity } }
        });
      }

      return newSale;
    });

    return sale;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('sales:list', async (event, { token, page = 1, limit = 50 }) => {
  try {
    verifyToken(token);
    const skip = (page - 1) * limit;
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        skip,
        take: limit,
        include: { items: { include: { variant: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.sale.count()
    ]);
    return { sales, total, page, limit };
  } catch (error) {
    return { error: error.message };
  }
});

// 👥 Customers
ipcMain.handle('customers:list', async (event, token) => {
  try {
    verifyToken(token);
    return await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('customers:create', async (event, { token, data }) => {
  try {
    verifyToken(token);
    return await prisma.customer.create({ data });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('customers:delete', async (event, { token, customerId }) => {
  try {
    verifyToken(token);
    await prisma.customer.delete({ where: { id: customerId } });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// 💸 Expenses
ipcMain.handle('expenses:list', async (event, token) => {
  try {
    verifyToken(token);
    return await prisma.expense.findMany({ orderBy: { createdAt: 'desc' } });
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('expenses:create', async (event, { token, data }) => {
  try {
    verifyToken(token);
    return await prisma.expense.create({
      data: {
        title: data.title,
        amount: parseFloat(data.amount)
      }
    });
  } catch (error) {
    return { error: error.message };
  }
});

// 📊 Dashboard (معلومات سريعة)
ipcMain.handle('dashboard:stats', async (event, token) => {
  try {
    verifyToken(token);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalSalesCount,
      totalSalesAmount,
      totalExpenses,
      totalProducts,
      lowStockVariants
    ] = await Promise.all([
      prisma.sale.count({ where: { createdAt: { gte: today } } }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { total: true }
      }),
      prisma.expense.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { amount: true }
      }),
      prisma.product.count(),
      prisma.variant.findMany({
        where: { quantity: { lte: 5 } },
        take: 10
      })
    ]);

    return {
      salesCount: totalSalesCount,
      salesAmount: totalSalesAmount._sum.total || 0,
      expensesAmount: totalExpenses._sum.amount || 0,
      productsCount: totalProducts,
      lowStockVariants
    };
  } catch (error) {
    return { error: error.message };
  }
});

// عند الإغلاق
app.on('before-quit', async () => {
  await prisma.$disconnect();
});
