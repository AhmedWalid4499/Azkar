// Entry 12 of the chapter "Adhkar of sleep" of Hisn al-Muslim: reading Surah as-Sajdah (32) and
// Surah al-Mulk (67) before sleeping. Each surah is one item, recited whole: the basmala, then one
// ayah to a line, character for character from Tanzil (build.mjs, recitedText). As everywhere,
// no Arabic is in this file.
//
// The transliteration and the English rendering of the meaning were written for this project, one
// string per line of the Arabic (the basmala first, then each ayah in order); build.mjs refuses a
// rendering that does not have exactly one part per line, so that no ayah can be skipped, and joins
// the parts with spaces. The transliteration follows the scheme of mapping.mjs; each ayah ends in
// its pausal form, and a comma stands where the Tanzil text has a pause mark (or where the
// sentence turns), with the pausal form before it. Ayah 32:1 is the three disconnected letters
// alif lam mim, read by their names. The Tanzil text opens 32:11 with the rub' al-hizb sign and
// closes 32:15 with the sajdah sign; neither is read aloud, so neither is transliterated.

import { bookTitle, list, note, surahName } from './lib/selectors.mjs'

const sleepNote = (page, number, options = {}) => note(page, number, { chapter: 'sleep', ...options })

const BASMALA = {
  transliteration: 'Bismillāhir-raḥmānir-raḥīm.',
  translation: 'In the name of Allah, the Most Gracious, the Most Merciful.',
}

/**
 * At-Tirmidhi 3404 (Jabir: he would not sleep until he had read Tanzil as-Sajdah and Tabarak),
 * an-Nasa'i's 'Amal al-Yawm wal-Laylah 707 and Sahih al-Jami' 4/255: the book's footnote, after
 * the name of the surah. The narration names both surahs, so both items cite it.
 */
const reference = (surah, name) => ({
  en: `Qur'an, Surah ${name}. At-Tirmidhi (no. 3404); an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 707); see also Sahih al-Jami' 4/255`,
  ar: [surahName(surah), sleepNote(5, 3)],
})

/**
 * Ayah 32:15 is a place of the prostration of recitation; the Tanzil text closes it with the
 * sajdah sign, which the item keeps. The Arabic of the note is put together from the book: the
 * words "the prostration of recitation" of the title of its chapter on that prostration, and its
 * citation "the ayah: 255" of Ayat al-Kursi (morning and evening chapter) with the ayah's number.
 */
const SAJDAH_NOTE = {
  en: 'Ayah 15 is a place of prostration of recitation (sajdat at-tilawah), marked by the sign at its end.',
  ar: [list(bookTitle('sujud-at-tilawah', { words: [1, 2] }), note(0, 2, { sentence: 0, segments: [1], citeAs: [['255', '15']] }))],
}

export const SLEEP_SURAH_ITEMS = [
  {
    id: 'surah-as-sajdah',
    entry: 12,
    repeat: 1,
    arabic: { from: 'quran', basmala: true, passages: [{ surah: 32, from: 1, to: 30 }] },
    witnesses: [],
    transliteration: [
      BASMALA.transliteration,
      'Alif lām mīm.',
      'Tanzīlul-kitābi lā rayba fīhi min rabbil-ʿālamīn.',
      'Am yaqūlūnaftarāh, bal huwal-ḥaqqu min rabbika li-tundhira qawman mā atāhum min nadhīrin min qablika laʿallahum yahtadūn.',
      'Allāhul-ladhī khalaqas-samāwāti wal-arḍa wa mā baynahumā fī sittati ayyāmin thummastawā ʿalal-ʿarsh, mā lakum min dūnihi min waliyyin wa lā shafīʿ, afalā tatadhakkarūn.',
      'Yudabbirul-amra minas-samāʾi ilal-arḍi thumma yaʿruju ilayhi fī yawmin kāna miqdāruhu alfa sanatin mimmā taʿuddūn.',
      'Dhālika ʿālimul-ghaybi wash-shahādatil-ʿazīzur-raḥīm.',
      'Alladhī aḥsana kulla shayʾin khalaqah, wa badaʾa khalqal-insāni min ṭīn.',
      'Thumma jaʿala naslahu min sulālatin min māʾin mahīn.',
      'Thumma sawwāhu wa nafakha fīhi min rūḥih, wa jaʿala lakumus-samʿa wal-abṣāra wal-afʾidah, qalīlan mā tashkurūn.',
      'Wa qālū aʾidhā ḍalalnā fil-arḍi aʾinnā la-fī khalqin jadīd, bal hum bi-liqāʾi rabbihim kāfirūn.',
      'Qul yatawaffākum malakul-mawtil-ladhī wukkila bikum thumma ilā rabbikum turjaʿūn.',
      'Wa law tarā idhil-mujrimūna nākisū ruʾūsihim ʿinda rabbihim, rabbanā abṣarnā wa samiʿnā farjiʿnā naʿmal ṣāliḥan innā mūqinūn.',
      'Wa law shiʾnā la-ātaynā kulla nafsin hudāhā wa lākin ḥaqqal-qawlu minnī la-amlaʾanna jahannama minal-jinnati wan-nāsi ajmaʿīn.',
      'Fa-dhūqū bi-mā nasītum liqāʾa yawmikum hādhā innā nasīnākum, wa dhūqū ʿadhābal-khuldi bi-mā kuntum taʿmalūn.',
      'Innamā yuʾminu bi-āyātinal-ladhīna idhā dhukkirū bihā kharrū sujjadan wa sabbaḥū bi-ḥamdi rabbihim wa hum lā yastakbirūn.',
      'Tatajāfā junūbuhum ʿanil-maḍājiʿi yadʿūna rabbahum khawfan wa ṭamaʿan wa mimmā razaqnāhum yunfiqūn.',
      'Fa-lā taʿlamu nafsun mā ukhfiya lahum min qurrati aʿyunin jazāʾan bi-mā kānū yaʿmalūn.',
      'A-fa-man kāna muʾminan ka-man kāna fāsiqā, lā yastawūn.',
      'Ammal-ladhīna āmanū wa ʿamiluṣ-ṣāliḥāti fa-lahum jannātul-maʾwā nuzulan bi-mā kānū yaʿmalūn.',
      'Wa ammal-ladhīna fasaqū fa-maʾwāhumun-nār, kullamā arādū an yakhrujū minhā uʿīdū fīhā wa qīla lahum dhūqū ʿadhāban-nāril-ladhī kuntum bihi tukadhdhibūn.',
      'Wa la-nudhīqannahum minal-ʿadhābil-adnā dūnal-ʿadhābil-akbari laʿallahum yarjiʿūn.',
      'Wa man aẓlamu mimman dhukkira bi-āyāti rabbihi thumma aʿraḍa ʿanhā, innā minal-mujrimīna muntaqimūn.',
      'Wa laqad ātaynā Mūsal-kitāba fa-lā takun fī miryatin min liqāʾih, wa jaʿalnāhu hudan li-banī Isrāʾīl.',
      'Wa jaʿalnā minhum aʾimmatan yahdūna bi-amrinā lammā ṣabarū, wa kānū bi-āyātinā yūqinūn.',
      'Inna rabbaka huwa yafṣilu baynahum yawmal-qiyāmati fīmā kānū fīhi yakhtalifūn.',
      'Awalam yahdi lahum kam ahlaknā min qablihim minal-qurūni yamshūna fī masākinihim, inna fī dhālika la-āyāt, afalā yasmaʿūn.',
      'Awalam yaraw annā nasūqul-māʾa ilal-arḍil-juruzi fa-nukhriju bihi zarʿan taʾkulu minhu anʿāmuhum wa anfusuhum, afalā yubṣirūn.',
      'Wa yaqūlūna matā hādhal-fatḥu in kuntum ṣādiqīn.',
      'Qul yawmal-fatḥi lā yanfaʿul-ladhīna kafarū īmānuhum wa lā hum yunẓarūn.',
      'Fa-aʿriḍ ʿanhum wantaẓir innahum muntaẓirūn.',
    ],
    translation: [
      BASMALA.translation,
      'Alif. Lam. Mim.',
      'The sending down of the Book, in which there is no doubt, is from the Lord of all the worlds.',
      'Or do they say, "He has made it up"? No, it is the truth from your Lord, for you to warn a people to whom no warner came before you, so that they may be guided.',
      'It is Allah who created the heavens and the earth and all that is between them in six days, then rose over the Throne. Apart from Him you have no protector and no intercessor. Will you not, then, take heed?',
      'He directs every affair from the heaven to the earth, then it ascends to Him in a day whose length is a thousand years of what you count.',
      'That is the Knower of the unseen and the witnessed, the Almighty, the Most Merciful,',
      'who made excellent everything He created, and began the creation of man from clay,',
      'then made his descendants from an extract of a humble fluid,',
      'then shaped him and breathed into him of His spirit, and gave you hearing, sight and hearts. Little thanks do you give.',
      'They say, "When we have been lost in the earth, shall we really be created anew?" In truth, they deny that they will meet their Lord.',
      'Say: "The angel of death who has been put in charge of you will take your souls, then to your Lord you will be brought back."',
      'If only you could see the guilty with heads bowed low in the presence of their Lord: "Our Lord, we have seen and heard. Return us, and we shall act righteously; we are now certain."',
      'If it had been Our will, each soul would have received its guidance from Us; but the word from Me has come to pass: "I shall fill Hell with jinn and humans together."',
      'So taste, for having forgotten the meeting of this Day of yours. We too have forgotten you. Taste the punishment that lasts for ever, for what you used to do.',
      'Only those believe in Our signs who, when they are reminded of them, fall down prostrating and glorify their Lord with His praise, and are not arrogant.',
      'Their sides keep away from their beds as they call on their Lord in fear and in hope, and they spend from what We have provided for them.',
      'No soul knows what joy for the eyes has been kept hidden for them, as a reward for what they used to do.',
      'Is the one who believes like the one who defies Allah? They are not equal.',
      'As for those who believe and do righteous deeds, the Gardens of Refuge are theirs, a welcome for what they used to do.',
      'As for those who defy Allah, their refuge is the Fire. Every time they want to leave it they are put back into it, and they are told: "Taste the punishment of the Fire that you used to deny."',
      'We will make them taste the lesser punishment before the greater punishment, so that they may turn back.',
      'Who does greater wrong than one who is reminded of the signs of his Lord and then turns away from them? We will exact retribution from the guilty.',
      'We gave Moses the Book, so be in no doubt about meeting him, and We made it a guidance for the Children of Israel.',
      'We made from among them leaders who guided by Our command when they had been patient and were certain of Our signs.',
      'Your Lord will judge between them on the Day of Resurrection concerning the things over which they used to differ.',
      'Is it not a lesson to them how many generations We destroyed before them, through whose dwellings they now walk? In that there are signs. Will they not, then, listen?',
      'Do they not see how We drive the water to the barren land and bring out with it crops from which their livestock and they themselves eat? Will they not, then, see?',
      'They say: "When will this Victory come, if you are telling the truth?"',
      'Say: "On the Day of Victory their belief will not help those who disbelieved, nor will they be given more time."',
      'So turn aside from them, and wait, as they also wait.',
    ],
    note: SAJDAH_NOTE,
    reference: reference(32, 'as-Sajdah'),
  },
  {
    id: 'surah-al-mulk',
    entry: 12,
    repeat: 1,
    arabic: { from: 'quran', basmala: true, passages: [{ surah: 67, from: 1, to: 30 }] },
    witnesses: [],
    transliteration: [
      BASMALA.transliteration,
      'Tabārakal-ladhī bi-yadihil-mulku wa huwa ʿalā kulli shayʾin qadīr.',
      'Alladhī khalaqal-mawta wal-ḥayāta li-yabluwakum ayyukum aḥsanu ʿamalā, wa huwal-ʿazīzul-ghafūr.',
      'Alladhī khalaqa sabʿa samāwātin ṭibāqā, mā tarā fī khalqir-raḥmāni min tafāwut, farjiʿil-baṣara hal tarā min fuṭūr.',
      'Thummarjiʿil-baṣara karratayni yanqalib ilaykal-baṣaru khāsiʾan wa huwa ḥasīr.',
      'Wa laqad zayyannas-samāʾad-dunyā bi-maṣābīḥa wa jaʿalnāhā rujūman lish-shayāṭīn, wa aʿtadnā lahum ʿadhābas-saʿīr.',
      'Wa lil-ladhīna kafarū bi-rabbihim ʿadhābu jahannam, wa biʾsal-maṣīr.',
      'Idhā ulqū fīhā samiʿū lahā shahīqan wa hiya tafūr.',
      'Takādu tamayyazu minal-ghayẓ, kullamā ulqiya fīhā fawjun saʾalahum khazanatuhā alam yaʾtikum nadhīr.',
      'Qālū balā qad jāʾanā nadhīrun fa-kadhdhabnā wa qulnā mā nazzalallāhu min shayʾin in antum illā fī ḍalālin kabīr.',
      'Wa qālū law kunnā nasmaʿu aw naʿqilu mā kunnā fī aṣḥābis-saʿīr.',
      'Faʿtarafū bi-dhanbihim fa-suḥqan li-aṣḥābis-saʿīr.',
      'Innal-ladhīna yakhshawna rabbahum bil-ghaybi lahum maghfiratun wa ajrun kabīr.',
      'Wa asirrū qawlakum awijharū bih, innahu ʿalīmun bi-dhātiṣ-ṣudūr.',
      'Alā yaʿlamu man khalaqa wa huwal-laṭīful-khabīr.',
      'Huwal-ladhī jaʿala lakumul-arḍa dhalūlan famshū fī manākibihā wa kulū min rizqih, wa ilayhin-nushūr.',
      'Aʾamintum man fis-samāʾi an yakhsifa bikumul-arḍa fa-idhā hiya tamūr.',
      'Am amintum man fis-samāʾi an yursila ʿalaykum ḥāṣibā, fa-sataʿlamūna kayfa nadhīr.',
      'Wa laqad kadhdhabal-ladhīna min qablihim fa-kayfa kāna nakīr.',
      'Awalam yaraw ilaṭ-ṭayri fawqahum ṣāffātin wa yaqbiḍn, mā yumsikuhunna illar-raḥmān, innahu bi-kulli shayʾin baṣīr.',
      'Amman hādhal-ladhī huwa jundun lakum yanṣurukum min dūnir-raḥmān, inil-kāfirūna illā fī ghurūr.',
      'Amman hādhal-ladhī yarzuqukum in amsaka rizqah, bal lajjū fī ʿutuwwin wa nufūr.',
      'A-fa-man yamshī mukibban ʿalā wajhihi ahdā amman yamshī sawiyyan ʿalā ṣirāṭin mustaqīm.',
      'Qul huwal-ladhī anshaʾakum wa jaʿala lakumus-samʿa wal-abṣāra wal-afʾidah, qalīlan mā tashkurūn.',
      'Qul huwal-ladhī dharaʾakum fil-arḍi wa ilayhi tuḥsharūn.',
      'Wa yaqūlūna matā hādhal-waʿdu in kuntum ṣādiqīn.',
      'Qul innamal-ʿilmu ʿindallāhi wa innamā ana nadhīrun mubīn.',
      'Fa-lammā raʾawhu zulfatan sīʾat wujūhul-ladhīna kafarū wa qīla hādhal-ladhī kuntum bihi taddaʿūn.',
      'Qul araʾaytum in ahlakaniyallāhu wa man maʿiya aw raḥimanā fa-man yujīrul-kāfirīna min ʿadhābin alīm.',
      'Qul huwar-raḥmānu āmannā bihi wa ʿalayhi tawakkalnā, fa-sataʿlamūna man huwa fī ḍalālin mubīn.',
      'Qul araʾaytum in aṣbaḥa māʾukum ghawran fa-man yaʾtīkum bi-māʾin maʿīn.',
    ],
    translation: [
      BASMALA.translation,
      'Blessed is He in whose hand is the dominion, and He has power over all things,',
      'who created death and life to test which of you is best in deeds. He is the Almighty, the Most Forgiving,',
      'who created seven heavens, one above another. You see no flaw in the creation of the Most Gracious. Look again: do you see any crack?',
      'Then look again, and again: your sight will come back to you humbled and weary.',
      'We have adorned the nearest heaven with lamps and made them missiles to drive away the devils, and We have prepared for them the punishment of the Blaze.',
      'For those who disbelieve in their Lord there is the punishment of Hell, and how evil a destination it is.',
      'When they are thrown into it they will hear it drawing in its breath as it boils,',
      'almost bursting with fury. Every time a crowd is thrown into it, its keepers will ask them: "Did no warner come to you?"',
      'They will say: "Yes, a warner did come to us, but we denied him and said, \'Allah has sent nothing down; you are only in great error.\'"',
      'And they will say: "Had we listened or used our reason, we would not be among the people of the Blaze."',
      'So they will confess their sin. Far away, then, be the people of the Blaze.',
      'Those who fear their Lord though they cannot see Him will have forgiveness and a great reward.',
      'Keep what you say secret or say it openly: He knows well what is in the hearts.',
      'Does He who created not know, when He is the Subtle, the All-Aware?',
      'It is He who made the earth easy for you to tread, so walk in its tracts and eat of His provision; and to Him is the rising from the dead.',
      'Do you feel safe from Him who is above the heaven, that He will not make the earth swallow you up as it quakes?',
      'Or do you feel safe from Him who is above the heaven, that He will not send against you a storm of stones? Then you will know how My warning is.',
      'Those who came before them denied the truth as well, and how severe was My reproach!',
      'Do they not see the birds above them, spreading their wings and folding them? None holds them up but the Most Gracious. He sees all things.',
      'Who is it that could be an army for you, to help you, apart from the Most Gracious? The disbelievers are in nothing but delusion.',
      'Who is it that could provide for you, if He held back His provision? Yet they persist in arrogance and aversion.',
      'Is one who walks bent over on his face better guided, or one who walks upright on a straight path?',
      'Say: "It is He who brought you into being and gave you hearing, sight and hearts. Little thanks do you give."',
      'Say: "It is He who spread you over the earth, and to Him you will be gathered."',
      'They say: "When will this promise come, if you are telling the truth?"',
      'Say: "The knowledge of it is with Allah alone, and I am only a plain warner."',
      'When they see it close at hand, the faces of those who disbelieved will be stricken with grief, and it will be said: "This is what you used to ask for."',
      'Say: "Consider this: whether Allah destroys me and those with me or has mercy on us, who will protect the disbelievers from a painful punishment?"',
      'Say: "He is the Most Gracious. We believe in Him, and in Him we put our trust. You will come to know who is in plain error."',
      'Say: "Consider this: if your water were to sink deep into the earth, who then could bring you flowing water?"',
    ],
    reference: reference(67, 'al-Mulk'),
  },
]
