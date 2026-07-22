import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Config } from '../src/config/Config';
import { VersionProvider } from '../src/config/VersionProvider';

describe('VersionProvider', () => {
  let config: Config;

  beforeEach(() => {
    config = new Config();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Facepunch yanıtındaki minPublishedTime değerini bir artırmalıdır', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ minPublishedTime: 1000 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new VersionProvider(config);

    await expect(provider.getVersion()).resolves.toBe('1001');
    expect(fetchMock).toHaveBeenCalledWith(config.versionApiUrl);
  });

  it('önbellek geçerliyken API isteğini tekrarlamamalıdır', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ minPublishedTime: 2000 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new VersionProvider(config);

    await provider.getVersion();
    await provider.getVersion();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('API başarısız olduğunda varsayılan sürümü kullanmalıdır', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const provider = new VersionProvider(config);

    await expect(provider.getVersion()).resolves.toBe(config.defaultVersionValue);
  });

  it('clearCache sonrasında sürümü yeniden çekmelidir', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ minPublishedTime: 3000 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new VersionProvider(config);

    await provider.getVersion();
    provider.clearCache();
    await provider.getVersion();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
