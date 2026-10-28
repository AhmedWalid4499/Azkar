import { defineStrings } from '../../shared/i18n/define'

// All keys for this feature start with `qibla.`.
export const strings = defineStrings({
  en: {
    'qibla.title': 'Qibla',
    'qibla.from': 'From {place}',

    'qibla.bearing': 'Qibla direction',
    'qibla.bearing.detail': 'Clockwise from true north, toward the {direction}',
    'qibla.direction.n': 'north',
    'qibla.direction.ne': 'northeast',
    'qibla.direction.e': 'east',
    'qibla.direction.se': 'southeast',
    'qibla.direction.s': 'south',
    'qibla.direction.sw': 'southwest',
    'qibla.direction.w': 'west',
    'qibla.direction.nw': 'northwest',
    'qibla.distance': '{distance} to the Kaaba',

    'qibla.dial': 'Compass dial, with the Qibla arrow at {degrees} from north',
    'qibla.dial.n': 'N',
    'qibla.dial.e': 'E',
    'qibla.dial.s': 'S',
    'qibla.dial.w': 'W',

    'qibla.turn.right': 'Turn right {degrees}',
    'qibla.turn.left': 'Turn left {degrees}',
    'qibla.aligned': 'You’re facing the Qibla',

    'qibla.compass.ask':
      'Turn on the compass and the dial will turn with your phone. You’ll be asked to allow access to motion and orientation.',
    'qibla.compass.ask.app': 'Turn on the compass and the dial will turn with your phone.',
    'qibla.compass.start': 'Turn on compass',
    'qibla.compass.starting': 'Waiting for the compass…',
    'qibla.compass.hold': 'Hold your phone flat, away from metal and magnets.',
    'qibla.compass.calibrate':
      'The compass is unsure of its direction. Move your phone through a figure-eight a few times, away from metal, to calibrate it.',
    'qibla.compass.denied.app':
      'Access to motion and orientation wasn’t allowed, so the dial can’t turn with your phone. To try again, close the app completely, open it again and turn on the compass.',
    'qibla.compass.denied.web':
      'Access to motion and orientation wasn’t allowed, so the dial can’t turn with your phone. To try again, close your browser completely, open this page again and turn on the compass.',
    'qibla.compass.unsupported': 'This device doesn’t share a compass heading here, so the dial can’t turn with your phone.',
    'qibla.compass.unavailable':
      'No compass heading has arrived. This device may not have a compass, or it may be switched off.',
    'qibla.fixed':
      'North is at the top of the dial. Point the top of your phone north, using a map or a landmark you know, and the arrow shows the Qibla.',
    'qibla.magnetic':
      'Your phone’s compass finds magnetic north, while the direction above is measured from true north. In most places the two are a few degrees apart, more in some regions, so the dial can be off by that much. To check it, compare it with a mosque’s mihrab or a landmark you know.',

    'qibla.near.title': 'You’re close to the Kaaba',
    'qibla.near':
      'You’re less than a kilometre from the Kaaba. This close, the direction depends on exactly where you stand, so face the Kaaba itself.',
    'qibla.near.saved':
      'Your saved location is less than a kilometre from the Kaaba. This close, the direction depends on exactly where you stand, so face the Kaaba itself. If you’re farther away, open Settings and choose “Use my location” to get a direction from where you are.',
    'qibla.near.action': 'Open settings',

    'qibla.noLocation.title': 'Set your location',
    'qibla.noLocation.body':
      'The Qibla direction is worked out from where you are. Set your location in Settings and it will appear here.',
    'qibla.noLocation.action': 'Open settings',
  },
  ar: {
    'qibla.title': 'القبلة',
    'qibla.from': 'من {place}',

    'qibla.bearing': 'اتجاه القبلة',
    'qibla.bearing.detail': 'مقيسًا من الشمال الجغرافي مع اتجاه عقارب الساعة، نحو {direction}',
    'qibla.direction.n': 'الشمال',
    'qibla.direction.ne': 'الشمال الشرقي',
    'qibla.direction.e': 'الشرق',
    'qibla.direction.se': 'الجنوب الشرقي',
    'qibla.direction.s': 'الجنوب',
    'qibla.direction.sw': 'الجنوب الغربي',
    'qibla.direction.w': 'الغرب',
    'qibla.direction.nw': 'الشمال الغربي',
    'qibla.distance': 'تبعد عنك الكعبة {distance}',

    'qibla.dial': 'قرص البوصلة، وسهم القبلة فيه على {degrees} من الشمال',
    'qibla.dial.n': 'ش',
    'qibla.dial.e': 'ق',
    'qibla.dial.s': 'ج',
    'qibla.dial.w': 'غ',

    'qibla.turn.right': 'استدر يمينًا {degrees}',
    'qibla.turn.left': 'استدر يسارًا {degrees}',
    'qibla.aligned': 'أنت متّجه إلى القبلة',

    'qibla.compass.ask':
      'شغّل البوصلة ليدور القرص مع هاتفك. سيُطلب منك السماح بالوصول إلى بيانات الحركة والاتجاه.',
    'qibla.compass.ask.app': 'شغّل البوصلة ليدور القرص مع هاتفك.',
    'qibla.compass.start': 'تشغيل البوصلة',
    'qibla.compass.starting': 'في انتظار البوصلة…',
    'qibla.compass.hold': 'أمسك هاتفك مستويًا، بعيدًا عن المعادن والمغناطيس.',
    'qibla.compass.calibrate':
      'البوصلة غير متأكدة من الاتجاه. حرّك هاتفك في الهواء عدة مرات على شكل ∞، بعيدًا عن المعادن، لمعايرتها.',
    'qibla.compass.denied.app':
      'لم يُسمح بالوصول إلى بيانات الحركة والاتجاه، فلا يستطيع القرص أن يدور مع هاتفك. لإعادة المحاولة، أغلق التطبيق تمامًا ثم افتحه من جديد وشغّل البوصلة.',
    'qibla.compass.denied.web':
      'لم يُسمح بالوصول إلى بيانات الحركة والاتجاه، فلا يستطيع القرص أن يدور مع هاتفك. لإعادة المحاولة، أغلق المتصفح تمامًا ثم افتح هذه الصفحة من جديد وشغّل البوصلة.',
    'qibla.compass.unsupported': 'لا يتيح هذا الجهاز قراءة البوصلة هنا، فلا يستطيع القرص أن يدور مع هاتفك.',
    'qibla.compass.unavailable': 'لم تصل أي قراءة من البوصلة. ربما لا يحتوي هذا الجهاز على بوصلة، أو أنها متوقفة.',
    'qibla.fixed':
      'الشمال في أعلى القرص. وجِّه أعلى هاتفك نحو الشمال مستعينًا بخريطة أو بمعلم تعرفه، فيدلّك السهم على القبلة.',
    'qibla.magnetic':
      'تهتدي بوصلة هاتفك إلى الشمال المغناطيسي، أما الاتجاه المذكور أعلاه فمقيس من الشمال الجغرافي. ويفصل بينهما في معظم الأماكن بضع درجات، وأكثر من ذلك في بعض المناطق، فقد يحيد القرص بهذا القدر. وللتحقق منه، قارنه بمحراب مسجد أو بمعلم تعرف اتجاهه.',

    'qibla.near.title': 'أنت قريب من الكعبة',
    'qibla.near':
      'أنت على بُعد أقل من كيلومتر من الكعبة. وعلى هذا القرب يتوقف الاتجاه على موضع وقوفك بالضبط، فتوجّه إلى الكعبة نفسها.',
    'qibla.near.saved':
      'موقعك المحفوظ على بُعد أقل من كيلومتر من الكعبة. وعلى هذا القرب يتوقف الاتجاه على موضع وقوفك بالضبط، فتوجّه إلى الكعبة نفسها. وإن كنت أبعد من ذلك، فافتح الإعدادات واختر «استخدام موقعي» لتحصل على الاتجاه من مكانك.',
    'qibla.near.action': 'فتح الإعدادات',

    'qibla.noLocation.title': 'حدّد موقعك',
    'qibla.noLocation.body': 'يُحسب اتجاه القبلة من موقعك. حدّد موقعك في الإعدادات وسيظهر الاتجاه هنا.',
    'qibla.noLocation.action': 'فتح الإعدادات',
  },
})
