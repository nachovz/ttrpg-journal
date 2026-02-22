import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { browserStorageService } from './browserStorageService';

describe('browserStorageService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('stores and reads string values', () => {
    browserStorageService.setString('bards_journal.selected_campaign_id', 'campaign_icewind-dale_2026');

    expect(browserStorageService.getString('bards_journal.selected_campaign_id')).toBe('campaign_icewind-dale_2026');
  });

  it('returns null for blank keys and missing values', () => {
    expect(browserStorageService.getString('')).toBeNull();
    expect(browserStorageService.getString('bards_journal.missing_preference')).toBeNull();
  });

  it('removes values', () => {
    browserStorageService.setString('bards_journal.last_open_route', '/journal/campaign_shadowfell_01');
    browserStorageService.remove('bards_journal.last_open_route');

    expect(browserStorageService.getString('bards_journal.last_open_route')).toBeNull();
  });

  it('stores and reads json values', () => {
    const value = {
      userId: 'user_ignacio_01',
      characterName: 'Thalia Moonwhisper',
      uiPreferences: {
        theme: 'dark',
        compactChat: true,
      },
      lastViewedCampaignIds: ['campaign_icewind-dale_2026', 'campaign_waterdeep_02'],
    };

    browserStorageService.setJson('bards_journal.user_preferences', value);

    expect(browserStorageService.getJson<typeof value>('bards_journal.user_preferences')).toEqual(value);
  });

  it('returns null when json is invalid', () => {
    window.localStorage.setItem('bards_journal.corrupted_cache', '{not-valid-json');

    expect(browserStorageService.getJson('bards_journal.corrupted_cache')).toBeNull();
  });

  it('swallows localStorage get failures', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('get failed');
    });

    expect(browserStorageService.getString('bards_journal.selected_campaign_id')).toBeNull();
  });

  it('swallows localStorage set failures', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('set failed');
    });

    expect(() => browserStorageService.setString('bards_journal.selected_campaign_id', 'campaign_barovia_03')).not.toThrow();
    expect(setItemSpy).toHaveBeenCalledWith('bards_journal.selected_campaign_id', 'campaign_barovia_03');
  });

  it('swallows localStorage remove failures', () => {
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove failed');
    });

    expect(() => browserStorageService.remove('bards_journal.selected_campaign_id')).not.toThrow();
    expect(removeItemSpy).toHaveBeenCalledWith('bards_journal.selected_campaign_id');
  });
});
