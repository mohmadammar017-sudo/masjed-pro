import {
  AnnouncementPrayerTrigger,
  RemotePrayerFlowItem,
  RemotePrayerFlowMap,
  RemotePrayerFlowSystemStep
} from '../types';

export const PRAYER_FLOW_PRAYERS: AnnouncementPrayerTrigger[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const PRAYER_FLOW_SYSTEM_LABELS: Record<RemotePrayerFlowSystemStep, string> = {
  dua_ahd: 'دعاء العهد',
  dua_sabah: 'دعاء الصباح',
  pre_adhan: 'حان وقت الصلاة',
  adhan: 'الأذان',
  iqama: 'إقامة الصلاة',
  tasbeeh: 'تسبيحة الزهراء',
  quran_verse: 'الآية الشريفة',
  ghufaylah: 'صلاة الغفيلة',
  announcement_builtin: 'صفحة الإعلان'
};

const createSystemFlowItem = (
  prayerId: AnnouncementPrayerTrigger,
  order: number,
  systemStep: RemotePrayerFlowSystemStep
): RemotePrayerFlowItem => ({
  id: `flow_${prayerId}_${systemStep}_${order}`,
  type: 'system',
  enabled: true,
  order,
  systemStep
});

export const createPageFlowItem = (
  prayerId: AnnouncementPrayerTrigger,
  pageId: string,
  order: number
): RemotePrayerFlowItem => ({
  id: `flow_${prayerId}_page_${pageId}_${order}`,
  type: 'page',
  enabled: true,
  order,
  pageId
});

export const getDefaultPrayerFlows = (): RemotePrayerFlowMap => ({
  fajr: [
    createSystemFlowItem('fajr', 1, 'dua_ahd'),
    createSystemFlowItem('fajr', 2, 'dua_sabah'),
    createSystemFlowItem('fajr', 3, 'pre_adhan'),
    createSystemFlowItem('fajr', 4, 'adhan'),
    createSystemFlowItem('fajr', 5, 'iqama'),
    createSystemFlowItem('fajr', 6, 'tasbeeh'),
    createSystemFlowItem('fajr', 7, 'quran_verse')
  ],
  dhuhr: [
    createSystemFlowItem('dhuhr', 1, 'pre_adhan'),
    createSystemFlowItem('dhuhr', 2, 'adhan'),
    createSystemFlowItem('dhuhr', 3, 'iqama'),
    createSystemFlowItem('dhuhr', 4, 'tasbeeh'),
    createSystemFlowItem('dhuhr', 5, 'quran_verse')
  ],
  asr: [
    createSystemFlowItem('asr', 1, 'pre_adhan'),
    createSystemFlowItem('asr', 2, 'adhan'),
    createSystemFlowItem('asr', 3, 'iqama'),
    createSystemFlowItem('asr', 4, 'tasbeeh'),
    createSystemFlowItem('asr', 5, 'quran_verse')
  ],
  maghrib: [
    createSystemFlowItem('maghrib', 1, 'pre_adhan'),
    createSystemFlowItem('maghrib', 2, 'adhan'),
    createSystemFlowItem('maghrib', 3, 'iqama'),
    createSystemFlowItem('maghrib', 4, 'tasbeeh'),
    createSystemFlowItem('maghrib', 5, 'quran_verse'),
    createSystemFlowItem('maghrib', 6, 'ghufaylah')
  ],
  isha: [
    createSystemFlowItem('isha', 1, 'iqama'),
    createSystemFlowItem('isha', 2, 'tasbeeh'),
    createSystemFlowItem('isha', 3, 'quran_verse')
  ]
});

export const renumberPrayerFlowItems = (
  prayerId: AnnouncementPrayerTrigger,
  items: RemotePrayerFlowItem[]
): RemotePrayerFlowItem[] => {
  return items
    .filter((item) => item.type === 'system' ? Boolean(item.systemStep) : Boolean(item.pageId))
    .map((item, index) => ({
      ...item,
      id:
        item.type === 'system'
          ? item.id || `flow_${prayerId}_${item.systemStep}_${index + 1}`
          : item.id || `flow_${prayerId}_page_${item.pageId}_${index + 1}`,
      order: index + 1
    }));
};

export const normalizePrayerFlows = (
  flows?: Partial<RemotePrayerFlowMap> | null
): RemotePrayerFlowMap => {
  const defaults = getDefaultPrayerFlows();

  return PRAYER_FLOW_PRAYERS.reduce<RemotePrayerFlowMap>((accumulator, prayerId) => {
    const source = Array.isArray(flows?.[prayerId]) ? flows?.[prayerId] : defaults[prayerId];
    accumulator[prayerId] = renumberPrayerFlowItems(
      prayerId,
      (source || defaults[prayerId]).map((item, index) => ({
        id: typeof item.id === 'string' && item.id.trim()
          ? item.id
          : item.type === 'system'
            ? `flow_${prayerId}_${item.systemStep}_${index + 1}`
            : `flow_${prayerId}_page_${item.pageId}_${index + 1}`,
        type: item.type === 'page' ? 'page' : 'system',
        enabled: item.enabled !== false,
        order: Number.isFinite(item.order) ? Number(item.order) : index + 1,
        systemStep: item.type === 'system' ? item.systemStep : undefined,
        pageId: item.type === 'page' ? item.pageId : undefined
      }))
    );
    return accumulator;
  }, {} as RemotePrayerFlowMap);
};

export const movePrayerFlowItem = (
  prayerId: AnnouncementPrayerTrigger,
  items: RemotePrayerFlowItem[],
  fromIndex: number,
  toIndex: number
): RemotePrayerFlowItem[] => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return renumberPrayerFlowItems(prayerId, items);
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return renumberPrayerFlowItems(prayerId, next);
};

