require('dotenv').config();

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { createHash } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');
const { machineId } = require('node-machine-id');

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

const LICENSE_PUBLIC_KEY_BASE64 = '49zTfBJpXN+35o+0kiPUuufxs3G++SyvH5yixcgbEiQ=';
const LICENSE_FILE_NAME = 'license.json';
const MAX_LICENSE_FILE_BYTES = 256 * 1024;

const LICENSE_STATUS_MESSAGES_AR = {
  NO_LICENSE: 'لا يوجد ترخيص مفعل على هذا الجهاز.',
  ACTIVE: 'الترخيص صالح ومفعل.',
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
const isValidDateString = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));

const toLicensePayload = (payload) => {
  if (!isRecord(payload)) return null;

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

  return { payload, signature: parsed.signature };
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
    if (currentFingerprint !== licenseFile.payload.deviceFingerprint) {
      return { status: buildLicenseStatus('DEVICE_MISMATCH', licenseFile.payload) };
    }
  }

  return {
    status: buildLicenseStatus('ACTIVE', licenseFile.payload),
    normalized: licenseFile
  };
};

const getCurrentLicenseStatus = async () => {
  try {
    const raw = await fs.promises.readFile(getLicenseFilePath(), 'utf8');
    const evaluated = await evaluateLicenseText(raw);
    return evaluated.status;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return buildLicenseStatus('NO_LICENSE');
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
  return buildLicenseStatus('NO_LICENSE');
};

// ==================== IPC Handlers ====================

// UI dialogs (replace window.alert)
ipcMain.handle('ui:messageBox', async (event, options = {}) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const message = typeof options.message === 'string'
    ? options.message
    : String(options.message ?? '');
  const safeOptions = {
    type: options.type || 'info',
    buttons: Array.isArray(options.buttons) && options.buttons.length ? options.buttons : ['OK'],
    defaultId: Number.isInteger(options.defaultId) ? options.defaultId : 0,
    title: options.title || app.getName(),
    message
  };

  if (options.detail) {
    safeOptions.detail = String(options.detail);
  }

  return dialog.showMessageBox(targetWindow, safeOptions);
});

ipcMain.handle('licensing:getStatus', async () => {
  return await getCurrentLicenseStatus();
});

ipcMain.handle('licensing:activateFromJson', async (event, licenseJsonText, options = {}) => {
  return await activateLicenseFromJson(licenseJsonText, options);
});

ipcMain.handle('licensing:remove', async () => {
  return await removeCurrentLicense();
});

ipcMain.handle('licensing:getDeviceFingerprint', async () => {
  return await getDeviceFingerprint();
});

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
