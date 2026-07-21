import type { ClientUpdateInfo } from '@shared/update';

export type UpdateInfo = ClientUpdateInfo;

export type AvailableUpdateState =
  | { status: 'available'; info: UpdateInfo }
  | { status: 'downloaded'; info: UpdateInfo };

/**
 * 已下载的同一版本不能被后续定时检查重新降级为“可下载”。
 */
export function mergeAvailableUpdate(
  current: AvailableUpdateState | null,
  incoming: AvailableUpdateState,
): AvailableUpdateState {
  if (
    current?.status === 'downloaded'
    && incoming.status === 'available'
    && current.info.version === incoming.info.version
  ) {
    return current;
  }

  return incoming;
}
