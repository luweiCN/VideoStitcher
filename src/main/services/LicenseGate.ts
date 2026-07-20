import { app } from 'electron';
import {
  connectCloudDevice,
  getCloudLicenseStatus,
  type CloudLicenseStatus,
} from '@shared/utils/cloudLicense';

const ACCESS_CACHE_MS = 60 * 1000;

export class LicenseAccessError extends Error {
  public constructor(message = '当前套餐不可用，请在“软件授权”中续费或兑换套餐') {
    super(message);
    this.name = 'LicenseAccessError';
  }
}

class LicenseGate {
  private status: CloudLicenseStatus | null = null;
  private checkedAt = 0;
  private refreshPromise: Promise<CloudLicenseStatus> | null = null;

  public updateStatus(status: CloudLicenseStatus): void {
    this.status = status;
    this.checkedAt = Date.now();
  }

  public hasCurrentAccess(): boolean {
    if (!app.isPackaged) return true;
    if (
      this.status?.authorized !== true
      || Date.now() - this.checkedAt > ACCESS_CACHE_MS
    ) {
      return false;
    }
    if (
      this.status.licenseExpiresAt !== undefined
      && Date.parse(this.status.licenseExpiresAt) <= Date.now()
    ) {
      return false;
    }
    return true;
  }

  public async refresh(): Promise<CloudLicenseStatus> {
    if (!app.isPackaged) {
      const developmentStatus: CloudLicenseStatus = {
        configured: true,
        hasCloudCredential: false,
        authorized: true,
        reason: '本地开发套餐',
      };
      this.updateStatus(developmentStatus);
      return developmentStatus;
    }
    if (this.refreshPromise !== null) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const current = await getCloudLicenseStatus();
      const resolved = current.hasCloudCredential ? current : await connectCloudDevice();
      this.updateStatus(resolved);
      return resolved;
    })();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  public async assertAccess(): Promise<void> {
    if (this.hasCurrentAccess()) return;
    const status = await this.refresh();
    if (!status.authorized) throw new LicenseAccessError(status.reason);
  }
}

export const licenseGate = new LicenseGate();

export function withLicenseAccess<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => TResult | Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    await licenseGate.assertAccess();
    return handler(...args);
  };
}
