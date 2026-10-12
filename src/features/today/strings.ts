import { defineStrings } from '../../shared/i18n/define'

export const strings = defineStrings({
  en: {
    'today.greeting': 'As-salamu alaykum',
    'today.prayers': 'Today’s prayers',
    'today.azkar': 'Daily azkar',
    'today.locationUnset': 'Location not set',
    'today.locationLink': '{place}. Change location',
    'today.locationSet': 'Location set: {place}',
    'today.lastNightIsha': 'Last night’s Isha',
    'today.lastNightIsha.day': 'Counts for {date}',
  },
  ar: {
    'today.greeting': 'السلام عليكم',
    'today.prayers': 'صلوات اليوم',
    'today.azkar': 'أذكار اليوم',
    'today.locationUnset': 'لم يُحدَّد الموقع',
    'today.locationLink': '{place}. تغيير الموقع',
    'today.locationSet': 'حُدِّد الموقع: {place}',
    'today.lastNightIsha': 'عشاء الليلة الماضية',
    'today.lastNightIsha.day': 'من صلوات يوم {date}',
  },
})
