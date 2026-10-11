import { defineStrings } from '../../shared/i18n/define'

export const strings = defineStrings({
  en: {
    'settings.title': 'Settings',

    'settings.general': 'General',
    'settings.language': 'Language',
    'settings.language.system': 'Auto',
    'settings.theme': 'Appearance',
    'settings.theme.system': 'Auto',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.timeFormat': 'Time format',
    'settings.timeFormat.12h': '12-hour',
    'settings.timeFormat.24h': '24-hour',
    'settings.arabicDigits': 'Arabic-Indic numerals',
    'settings.arabicDigits.description': 'Show ١٢٣ instead of 123',
    'settings.hijriOffset': 'Hijri date adjustment',
    'settings.hijriOffset.description': 'Shift by a day or two to match your local moon sighting',

    'settings.data': 'Your data',
    'settings.data.footer':
      'Your prayer log, progress and settings are stored only on this device. Export a backup before clearing your browser data or switching phones.',
    'settings.export': 'Export backup',
    'settings.export.description': 'Download everything as a file',
    'settings.import': 'Import backup',
    'settings.import.description': 'Restore from a file you exported',
    'settings.import.confirmTitle': 'Replace your data?',
    'settings.import.confirmBody':
      'Importing this backup from {date} will replace everything currently stored in the app on this device.',
    'settings.import.confirm': 'Replace and import',
    'settings.import.invalid': 'That file is not an Azkar backup.',
    'settings.reset': 'Erase all data',
    'settings.reset.description': 'Remove your log, progress and settings',
    'settings.reset.confirmTitle': 'Erase everything?',
    'settings.reset.confirmBody':
      'This permanently removes your prayer log, azkar progress, location and settings from this device. It cannot be undone.',
    'settings.reset.confirm': 'Erase all data',

    'settings.about': 'About',
    'settings.version': 'Version',
    'settings.privacy': 'Privacy',
    'settings.privacy.body':
      'Prayer times are calculated on your device. Your location is saved only here; it is sent to a lookup service solely to find a place name when you ask for it.',
  },
  ar: {
    'settings.title': 'الإعدادات',

    'settings.general': 'عام',
    'settings.language': 'اللغة',
    'settings.language.system': 'تلقائي',
    'settings.theme': 'المظهر',
    'settings.theme.system': 'تلقائي',
    'settings.theme.light': 'فاتح',
    'settings.theme.dark': 'داكن',
    'settings.timeFormat': 'صيغة الوقت',
    'settings.timeFormat.12h': '١٢ ساعة',
    'settings.timeFormat.24h': '٢٤ ساعة',
    'settings.arabicDigits': 'الأرقام العربية المشرقية',
    'settings.arabicDigits.description': 'عرض ١٢٣ بدلًا من 123',
    'settings.hijriOffset': 'تعديل التاريخ الهجري',
    'settings.hijriOffset.description': 'قدِّم أو أخِّر يومًا أو يومين ليوافق رؤية الهلال في بلدك',

    'settings.data': 'بياناتك',
    'settings.data.footer':
      'سجل صلواتك وتقدّمك وإعداداتك محفوظة على هذا الجهاز فقط. صدِّر نسخة احتياطية قبل مسح بيانات المتصفح أو تغيير هاتفك.',
    'settings.export': 'تصدير نسخة احتياطية',
    'settings.export.description': 'تنزيل كل البيانات في ملف',
    'settings.import': 'استيراد نسخة احتياطية',
    'settings.import.description': 'الاستعادة من ملف سبق تصديره',
    'settings.import.confirmTitle': 'استبدال بياناتك؟',
    'settings.import.confirmBody':
      'استيراد هذه النسخة الاحتياطية بتاريخ {date} سيستبدل كل ما هو محفوظ حاليًا في التطبيق على هذا الجهاز.',
    'settings.import.confirm': 'استبدال واستيراد',
    'settings.import.invalid': 'هذا الملف ليس نسخة احتياطية من تطبيق أذكار.',
    'settings.reset': 'مسح كل البيانات',
    'settings.reset.description': 'حذف السجل والتقدّم والإعدادات',
    'settings.reset.confirmTitle': 'مسح كل شيء؟',
    'settings.reset.confirmBody':
      'سيُحذف سجل صلواتك وتقدّمك في الأذكار وموقعك وإعداداتك من هذا الجهاز نهائيًا، ولا يمكن التراجع عن ذلك.',
    'settings.reset.confirm': 'مسح كل البيانات',

    'settings.about': 'حول التطبيق',
    'settings.version': 'الإصدار',
    'settings.privacy': 'الخصوصية',
    'settings.privacy.body':
      'تُحسب مواقيت الصلاة على جهازك. موقعك محفوظ هنا فقط، ولا يُرسل إلى خدمة بحث إلا لمعرفة اسم المكان عندما تطلب ذلك.',
  },
})
