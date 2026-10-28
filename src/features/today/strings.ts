import { defineStrings } from '../../shared/i18n/define'

export const strings = defineStrings({
  en: {
    'today.greeting': 'As-salamu alaykum',
    'today.greeting.named': 'As-salamu alaykum, {name}',
    'today.prayers': 'Today’s prayers',
    'today.azkar': 'Daily azkar',
    'today.locationUnset': 'Location not set',
    'today.locationLink': '{place}. Change location',
    'today.locationSet': 'Location set: {place}',
    'today.lastNightIsha': 'Last night’s Isha',
    'today.lastNightIsha.day': 'Counts for {date}',
    'today.sunnah.title': 'Sunnah prayers',
    'today.sunnah.count': '{done} of {total}',
    'today.sunnah.night': 'Last night',
    'today.sunnah.night.day': 'Counts for {date}',
  },
  ar: {
    'today.greeting': 'السلام عليكم',
    'today.greeting.named': 'السلام عليكم يا {name}',
    'today.prayers': 'صلوات اليوم',
    'today.azkar': 'أذكار اليوم',
    'today.locationUnset': 'لم يُحدَّد الموقع',
    'today.locationLink': '{place}. تغيير الموقع',
    'today.locationSet': 'حُدِّد الموقع: {place}',
    'today.lastNightIsha': 'عشاء الليلة الماضية',
    'today.lastNightIsha.day': 'من صلوات يوم {date}',
    'today.sunnah.title': 'السنن والنوافل',
    'today.sunnah.count': '{done} من {total}',
    'today.sunnah.night': 'الليلة الماضية',
    'today.sunnah.night.day': 'من صلوات يوم {date}',
  },
})
