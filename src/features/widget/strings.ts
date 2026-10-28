import { defineStrings } from '../../shared/i18n/define'

// All keys for this feature start with `widget.`.
// The iOS widgets show these in the app's language: the app hands them over with
// the prayer times (see snapshot.ts). Text in `{braces}` is filled in by the widget.
export const strings = defineStrings({
  en: {
    'widget.title': 'Home screen widget',
    'widget.nextPrayer': 'Next prayer',
    'widget.tomorrow': 'Tomorrow',
    'widget.greeting': 'As-salamu alaykum, {name}',
    'widget.countdown': 'Time remaining',
    'widget.row.logged': '{prayer}, {time}: {status}',
    'widget.row.unlogged': '{prayer}, {time}: not logged. Mark as prayed on time.',
    'widget.noLocation': 'Open Azkar and choose your location to see prayer times here.',
    'widget.stale': 'Open Azkar to bring the prayer times up to date.',
  },
  ar: {
    'widget.title': 'أداة الشاشة الرئيسية',
    'widget.nextPrayer': 'الصلاة القادمة',
    'widget.tomorrow': 'غدًا',
    'widget.greeting': 'السلام عليكم يا {name}',
    'widget.countdown': 'الوقت المتبقي',
    'widget.row.logged': '{prayer}، {time}: {status}',
    'widget.row.unlogged': '{prayer}، {time}: غير مسجَّلة. تسجيلها «في وقتها».',
    'widget.noLocation': 'افتح أذكار واختر موقعك لتظهر مواقيت الصلاة هنا.',
    'widget.stale': 'افتح أذكار لتحديث مواقيت الصلاة.',
  },
})
