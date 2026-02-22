import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { browserStorageService } from './browserStorageService';

describe('browserStorageService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('stores and reads string values', () => {
    browserStorageService.setString('app.key', 'value-1');

    expect(browserStorageService.getString('app.key')).toBe('value-1');
  });

  it('returns null for blank keys and missing values', () => {
    expect(browserStorageService.getString('')).toBeNull();
    expect(browserStorageService.getString('missing.key')).toBeNull();
  });

  it('removes values', () => {
    browserStorageService.setString('remove.key', 'value');
    browserStorageService.remove('remove.key');

    expect(browserStorageService.getString('remove.key')).toBeNull();
  });

  it('stores and reads json values', () => {
    const value = { campaignId: 'abc123', nested: { enabled: true } };

    browserStorageService.setJson('json.key', value);

    expect(browserStorageService.getJson<typeof value>('json.key')).toEqual(value);
  });

  it('returns null when json is invalid', () => {
    window.localStorage.setItem('bad.json', '{not-valid-json');

    expect(browserStorageService.getJson('bad.json')).toBeNull();
  });

  it('swallows localStorage get failures', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('get failed');
    });

    expect(browserStorageService.getString('app.key')).toBeNull();
  });

  it('swallows localStorage set failures', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('set failed');
    });

    expect(() => browserStorageService.setString('app.key', 'value')).not.toThrow();
    expect(setItemSpy).toHaveBeenCalledWith('app.key', 'value');
  });

  it('swallows localStorage remove failures', () => {
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove failed');
    });

    expect(() => browserStorageService.remove('app.key')).not.toThrow();
    expect(removeItemSpy).toHaveBeenCalledWith('app.key');
  });
});
