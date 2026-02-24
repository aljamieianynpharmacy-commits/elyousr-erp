import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import { machineId } from 'node-machine-id';

type LicenseState =
  | 'NO_LICENSE'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'INVALID_SIGNATURE'
  | 'NOT_YET_VALID'
  | 'DEVICE_MISMATCH'
  | 'CORRUPT';

interface LicensePayload {
  licenseId: string;
  customerName: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  deviceBinding: boolean;
  deviceFingerprint: string;
  maxDevices: number;
  features: string[];
  version: number;
}

interface LicenseFile {
  payload: LicensePayload;
  signature: string;
}

interface LicenseStatus {
  status: LicenseState;
  messageAr: string;
  details?: Pick<LicensePayload, 'customerName' | 'expiresAt' | 'licenseId' | 'features'>;
}

const LICENSE_PUBLIC_KEY_BASE64 = '49zTfBJpXN+35o+0kiPUuufxs3G++SyvH5yixcgbEiQ=';
const MAX_LICENSE_FILE_BYTES = 256 * 1024;

const STATUS_MESSAGES: Record<LicenseState, string> = {
  NO_LICENSE: 'لا يوجد ترخيص مفعل على هذا الجهاز.',
  ACTIVE: 'الترخيص صالح ومفعل.',
  EXPIRED: 'انتهت صلاحية الترخيص.',
  INVALID_SIGNATURE: 'التوقيع الرقمي غير صالح.',
  NOT_YET_VALID: 'الترخيص غير ساري حتى تاريخ البداية.',
  DEVICE_MISMATCH: 'الترخيص لا يطابق بصمة هذا الجهاز.',
  CORRUPT: 'ملف الترخيص تالف أو بصيغة غير صحيحة.',
};

type ActivateOptions = { dryRun?: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function stableCanonicalStringify(value: unknown): string {
  const canonicalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(canonicalize);
    }

    if (isRecord(input)) {
      return Object.keys(input)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = canonicalize(input[key]);
          return acc;
        }, {});
    }

    return input;
  };

  return JSON.stringify(canonicalize(value));
}

function buildStatus(status: LicenseState, payload?: LicensePayload): LicenseStatus {
  if (!payload) {
    return {
      status,
      messageAr: STATUS_MESSAGES[status],
    };
  }

  return {
    status,
    messageAr: STATUS_MESSAGES[status],
    details: {
      customerName: payload.customerName,
      expiresAt: payload.expiresAt,
      licenseId: payload.licenseId,
      features: payload.features,
    },
  };
}

function getLicenseFilePath(): string {
  return path.join(app.getPath('userData'), 'license.json');
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function toLicensePayload(payload: unknown): LicensePayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const maybePayload = payload as Partial<LicensePayload>;

  const hasRequiredStrings =
    typeof maybePayload.licenseId === 'string' &&
    typeof maybePayload.customerName === 'string' &&
    typeof maybePayload.deviceFingerprint === 'string';

  const hasRequiredDates =
    isValidDateString(maybePayload.issuedAt) &&
    isValidDateString(maybePayload.validFrom) &&
    isValidDateString(maybePayload.expiresAt);

  const hasBooleansAndNumbers =
    typeof maybePayload.deviceBinding === 'boolean' &&
    typeof maybePayload.maxDevices === 'number' &&
    Number.isInteger(maybePayload.maxDevices) &&
    maybePayload.maxDevices >= 1 &&
    typeof maybePayload.version === 'number' &&
    Number.isInteger(maybePayload.version);

  const hasFeatures =
    Array.isArray(maybePayload.features) &&
    maybePayload.features.length > 0 &&
    maybePayload.features.every((feature) => typeof feature === 'string' && feature.trim().length > 0);

  if (!hasRequiredStrings || !hasRequiredDates || !hasBooleansAndNumbers || !hasFeatures) {
    return null;
  }

  if (maybePayload.deviceBinding && maybePayload.deviceFingerprint.trim().length === 0) {
    return null;
  }

  return {
    licenseId: maybePayload.licenseId,
    customerName: maybePayload.customerName,
    issuedAt: maybePayload.issuedAt,
    validFrom: maybePayload.validFrom,
    expiresAt: maybePayload.expiresAt,
    deviceBinding: maybePayload.deviceBinding,
    deviceFingerprint: maybePayload.deviceFingerprint,
    maxDevices: maybePayload.maxDevices,
    features: maybePayload.features,
    version: maybePayload.version,
  };
}

function safeDecodeBase64(value: string): Uint8Array | null {
  try {
    return naclUtil.decodeBase64(value);
  } catch {
    return null;
  }
}

function verifySignature(payload: LicensePayload, signatureBase64: string): boolean {
  const signatureBytes = safeDecodeBase64(signatureBase64);
  const publicKeyBytes = safeDecodeBase64(LICENSE_PUBLIC_KEY_BASE64);

  if (!signatureBytes || !publicKeyBytes) {
    return false;
  }

  if (signatureBytes.length !== nacl.sign.signatureLength) {
    return false;
  }

  if (publicKeyBytes.length !== nacl.sign.publicKeyLength) {
    return false;
  }

  const payloadBytes = naclUtil.decodeUTF8(stableCanonicalStringify(payload));
  return nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKeyBytes);
}

async function getDeviceFingerprint(): Promise<string> {
  let deviceId = 'unknown-device-id';

  try {
    deviceId = await machineId();
  } catch {
    deviceId = 'unknown-device-id';
  }

  const fingerprintSource = stableCanonicalStringify({
    machineId: deviceId,
    platform: process.platform,
    cpuModel: os.cpus()[0]?.model ?? 'unknown-cpu-model',
    totalmem: os.totalmem(),
    hostname: os.hostname(),
  });

  return createHash('sha256').update(fingerprintSource, 'utf8').digest('hex');
}

interface EvaluationResult {
  status: LicenseStatus;
  normalized?: LicenseFile;
}

function parseLicenseFileText(licenseJsonText: string): LicenseFile | null {
  if (typeof licenseJsonText !== 'string') {
    return null;
  }

  if (Buffer.byteLength(licenseJsonText, 'utf8') > MAX_LICENSE_FILE_BYTES) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(licenseJsonText);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const signature = parsed.signature;
  const payload = parsed.payload;

  if (typeof signature !== 'string') {
    return null;
  }

  const typedPayload = toLicensePayload(payload);
  if (!typedPayload) {
    return null;
  }

  return {
    payload: typedPayload,
    signature,
  };
}

async function evaluateLicenseText(licenseJsonText: string): Promise<EvaluationResult> {
  const licenseFile = parseLicenseFileText(licenseJsonText);
  if (!licenseFile) {
    return { status: buildStatus('CORRUPT') };
  }

  if (!verifySignature(licenseFile.payload, licenseFile.signature)) {
    return { status: buildStatus('INVALID_SIGNATURE', licenseFile.payload) };
  }

  const validFromMs = Date.parse(licenseFile.payload.validFrom);
  const expiresAtMs = Date.parse(licenseFile.payload.expiresAt);
  const nowMs = Date.now();

  if (!Number.isFinite(validFromMs) || !Number.isFinite(expiresAtMs)) {
    return { status: buildStatus('CORRUPT', licenseFile.payload) };
  }

  if (nowMs < validFromMs) {
    return { status: buildStatus('NOT_YET_VALID', licenseFile.payload) };
  }

  if (nowMs > expiresAtMs) {
    return { status: buildStatus('EXPIRED', licenseFile.payload) };
  }

  if (licenseFile.payload.deviceBinding) {
    const currentFingerprint = await getDeviceFingerprint();
    if (licenseFile.payload.deviceFingerprint !== currentFingerprint) {
      return { status: buildStatus('DEVICE_MISMATCH', licenseFile.payload) };
    }
  }

  return {
    status: buildStatus('ACTIVE', licenseFile.payload),
    normalized: licenseFile,
  };
}

async function getCurrentLicenseStatus(): Promise<LicenseStatus> {
  const licensePath = getLicenseFilePath();

  let licenseText: string;
  try {
    licenseText = await fs.readFile(licensePath, 'utf8');
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return buildStatus('NO_LICENSE');
    }
    return buildStatus('CORRUPT');
  }

  const evaluated = await evaluateLicenseText(licenseText);
  return evaluated.status;
}

async function activateLicenseFromJson(
  licenseJsonText: string,
  options: ActivateOptions = {}
): Promise<LicenseStatus> {
  const evaluated = await evaluateLicenseText(licenseJsonText);

  if (evaluated.status.status !== 'ACTIVE') {
    return evaluated.status;
  }

  if (options.dryRun) {
    return evaluated.status;
  }

  if (!evaluated.normalized) {
    return buildStatus('CORRUPT');
  }

  const licensePath = getLicenseFilePath();
  await fs.mkdir(path.dirname(licensePath), { recursive: true });
  await fs.writeFile(licensePath, `${JSON.stringify(evaluated.normalized, null, 2)}\n`, 'utf8');

  return getCurrentLicenseStatus();
}

async function removeLicense(): Promise<LicenseStatus> {
  try {
    await fs.unlink(getLicenseFilePath());
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') {
      return buildStatus('CORRUPT');
    }
  }

  return buildStatus('NO_LICENSE');
}

function registerLicensingHandlers(): void {
  ipcMain.handle('licensing:getStatus', async () => getCurrentLicenseStatus());
  ipcMain.handle(
    'licensing:activateFromJson',
    async (_event, licenseJsonText: string, options?: ActivateOptions) =>
      activateLicenseFromJson(licenseJsonText, options)
  );
  ipcMain.handle('licensing:remove', async () => removeLicense());
  ipcMain.handle('licensing:getDeviceFingerprint', async () => getDeviceFingerprint());
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    void window.loadURL('http://localhost:5173');
  } else {
    void window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  registerLicensingHandlers();

  // Keep your existing business IPC handlers here unchanged.
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
