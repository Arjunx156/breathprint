import type { en } from "./en";

/** Hindi strings. The type makes a missing key a compile error. */
export const hi: Record<keyof typeof en, string> = {
  "app.name": "Breathprint",
  "app.tagline": "हर चुनाव हवा पर अपनी छाप छोड़ता है।",

  "ledger.protect": "बचाव",
  "ledger.prevent": "रोकथाम",
  "ledger.protect.about": "आपका परिवार क्या साँस में लेता है",
  "ledger.prevent.about": "आपकी गली की साझा हवा",

  "group.infant": "शिशु",
  "group.child": "बच्चा",
  "group.teen": "किशोर",
  "group.adult": "वयस्क",
  "group.older": "बुज़ुर्ग",
  "who.family": "पूरे परिवार",
  "who.you": "आप",
  "list.and": "और",

  "aqi.IN.good": "अच्छा",
  "aqi.IN.satisfactory": "संतोषजनक",
  "aqi.IN.moderate": "मध्यम",
  "aqi.IN.poor": "ख़राब",
  "aqi.IN.veryPoor": "बहुत ख़राब",
  "aqi.IN.severe": "गंभीर",
  "aqi.US.good": "अच्छा",
  "aqi.US.moderate": "मध्यम",
  "aqi.US.usg": "संवेदनशील लोगों के लिए अस्वस्थ",
  "aqi.US.unhealthy": "अस्वस्थ",
  "aqi.US.veryUnhealthy": "बहुत अस्वस्थ",
  "aqi.US.hazardous": "ख़तरनाक",

  "headline.0": "आज हवा साफ़ है। घर हवादार करने और बाहर खेलने का अच्छा दिन।",
  "headline.1": "आज हवा ठीक-ठाक है। दिन का ज़्यादातर हिस्सा सबके लिए ठीक है।",
  "headline.2": "आज की हवा बच्चों, बुज़ुर्गों और दमे वालों के लिए भारी है। कुछ छोटे बदलाव उन्हें सुरक्षित रखेंगे।",
  "headline.3": "आज हवा अस्वस्थ है। ज़ोर की कसरत घर के अंदर करें और सोने के कमरे की हवा साफ़ रखें।",
  "headline.4": "आज हवा बहुत अस्वस्थ है। जितना हो सके घर में रहें, सोने के कमरे साफ़ रखें और ग़ैरज़रूरी सफ़र टालें।",
  "headline.5":
    "आज हवा ख़तरनाक है। इसे आपात स्थिति मानें: घर में रहें, एक कमरे की हवा साफ़ रखें, बाहर हर बार मास्क पहनें।",

  "reason.protect": "{who} के लिए दिन भर में लगभग {pct}% कम PM2.5, यानी करीब {cig} सिगरेट जितना।",
  "reason.protectSmall": "{who} के लिए दिन भर में लगभग {pct}% कम PM2.5।",
  "reason.protectWorse": "सफ़र के खुले हिस्से में {who} को थोड़ा ज़्यादा धुआँ मिलता है, इसलिए उसमें मास्क पहनें।",
  "reason.preventBoth": "गली की हवा से {co2} किलो CO2 और {pm} ग्राम PM2.5 कम।",
  "reason.preventCo2": "हवा से {co2} किलो CO2 कम।",
  "reason.preventPm": "गली की हवा से {pm} ग्राम PM2.5 कम।",
  "reason.saves": "रोज़ लगभग ₹{inr} की बचत।",
  "reason.costs": "रोज़ लगभग ₹{inr} का खर्च।",
  "reason.once": "एक बार का खर्च ₹{once}।",

  "action.heater-safety.title": "अँगीठी या हीटर सोने के कमरे से बाहर रखें",
  "action.heater-safety.detail":
    "अँगीठी, केरोसिन और गैस हीटर कार्बन मोनोऑक्साइड बनाते हैं, जो न दिखती है न सूँघी जा सकती है। सोने से पहले आग बुझा दें, जलते समय खिड़की थोड़ी खुली रखें, और वह कमरा कभी बंद न करें।",
  "action.heater-safety.why": "बंद कमरे में कार्बन मोनोऑक्साइड जान ले सकती है। यह स्मॉग से भी पहले है।",

  "action.cleaner-cooking.title": "साफ़ ईंधन पर पकाएँ, या बाहर पकाएँ",
  "action.cleaner-cooking.detail":
    "लकड़ी, उपले और केरोसिन का चूल्हा रसोई को धुएँ और कार्बन मोनोऑक्साइड से भर देता है। हो सके तो एलपीजी या इंडक्शन इस्तेमाल करें; नहीं तो खुले में या खुले दरवाज़े के पास पकाएँ और बच्चों को धुएँ से दूर रखें।",
  "action.cleaner-cooking.why":
    "ठोस ईंधन का धुआँ परिवार की साँस के सबसे बड़े स्रोतों में से है, और इसमें कार्बन मोनोऑक्साइड भी होती है।",

  "action.purifier-night.title": "जहाँ सबसे नाज़ुक लोग सोते हैं, वहाँ प्यूरीफ़ायर चलाएँ",
  "action.purifier-night.detail":
    "कमरे का दरवाज़ा और खिड़की बंद करें, सोने से एक घंटा पहले प्यूरीफ़ायर मीडियम पर चलाएँ और रात भर चलने दें।",

  "action.diy-purifier.title": "सोने के कमरे के लिए बॉक्स-फ़ैन प्यूरीफ़ायर बनाएँ",
  "action.diy-purifier.detail":
    "बॉक्स फ़ैन के पीछे MERV 13 या HEPA-ग्रेड फ़िल्टर टेप से लगाएँ, तीर पंखे की ओर। दरवाज़ा बंद करके उस कमरे में चलाएँ जहाँ बच्चे या बुज़ुर्ग सोते हैं। फ़िल्टर स्लेटी हो जाए तो बदलें।",

  "action.ventilate-window.title": "घर साफ़ समय में हवादार करें, सुबह नहीं",
  "action.ventilate-window.detail":
    "सुबह के प्रदूषण के समय खिड़कियाँ बंद रखें। साफ़ समय में आधे घंटे के लिए पूरी खोलें, फिर बंद कर दें।",
  "action.ventilate-window.why":
    "उस समय बाहर की हवा सबसे साफ़ है, लगभग {outside} µg/m³, इसलिए बहुत कम धुआँ अंदर आता है।",

  "action.seal-gaps.title": "दरवाज़ों और खिड़कियों की दरारें बंद करें",
  "action.seal-gaps.detail":
    "खिड़की के फ़्रेम पर फ़ोम स्ट्रिप और दरवाज़े के नीचे ड्राफ़्ट स्टॉपर बाहर का धुआँ दिन भर अंदर आने से रोकते हैं। एक खिड़की खुलने लायक रखें, और जहाँ कुछ जलता हो वह कमरा कभी बंद न करें।",

  "action.skip-incense.title": "आज अगरबत्ती बालकनी में जलाएँ",
  "action.skip-incense.detail":
    "एक अगरबत्ती बंद कमरे में दसियों मिलीग्राम बारीक धुआँ छोड़ती है। स्मॉग के दिनों में इसे बालकनी या खुले दरवाज़े के पास जलाएँ, या पूजा में फूल चढ़ाएँ।",

  "action.swap-coil.title": "मच्छर कॉइल की जगह मच्छरदानी या प्लग-इन",
  "action.swap-coil.detail":
    "एक जलती कॉइल 75 से 137 सिगरेट जितना बारीक धुआँ छोड़ती है। मच्छरदानी या बिजली वाला वेपराइज़र बिना धुएँ के मच्छर दूर रखता है।",

  "action.cooking-vent.title": "पकाते समय ढक्कन लगाएँ, एग्ज़ॉस्ट चलाएँ",
  "action.cooking-vent.detail":
    "एलपीजी पर भी तलने और तड़के से बारीक धुआँ उठता है। ढककर पकाएँ, एग्ज़ॉस्ट फ़ैन चलाएँ या रसोई की खिड़की थोड़ी खोलें, और तलते समय बच्चों को रसोई से दूर रखें।",
  "action.cooking-vent.why":
    "चिमनी न होने पर रसोई का धुआँ पूरे घर में फैलता है; इससे ज़्यादातर धुआँ रसोई में रहकर बाहर निकलता है।",

  "action.smoke-outside.title": "धूम्रपान बाहर करें, दरवाज़े से दूर",
  "action.smoke-outside.detail":
    "घर के अंदर का धुआँ घंटों रहता है, और यह उस स्मॉग में जुड़ता है जो परिवार पहले से झेल रहा है।",
  "action.smoke-outside.why": "घर के अंदर धूम्रपान बारीक कणों का सबसे बड़ा एकल स्रोत होता है।",

  "action.wet-cleaning.title": "झाड़ू की जगह पोंछा लगाएँ",
  "action.wet-cleaning.detail":
    "सूखी झाड़ू जमी धूल को फिर हवा में उड़ा देती है। फ़र्श पर गीला पोंछा और खिड़की-चौखट पर गीला कपड़ा फेरें।",
  "action.wet-cleaning.why": "जमी हुई स्मॉग की धूल परिवार की साँस से दूर रहती है।",

  "action.heat-one-room.title": "एक ही कमरा टाइमर पर गरम करें",
  "action.heat-one-room.detail":
    "शाम को सब एक बंद कमरे में बैठें और पूरे घर की जगह उसी कमरे का हीटर टाइमर पर चलाएँ।",

  "action.mask-school-run.title": "स्कूल के रास्ते पर N95 मास्क",
  "action.mask-school-run.detail":
    "प्रमाणित N95 या FFP2, जो नाक और ठुड्डी पर कसकर बैठे। कपड़े और सर्जिकल मास्क स्मॉग में बहुत कम काम आते हैं। शिशुओं को मास्क न पहनाएँ।",
  "action.mask-school-run.why": "{time} पर बाहर लगभग {outside} µg/m³ है।",

  "action.mask-commute.title": "दफ़्तर के रास्ते पर N95 मास्क",
  "action.mask-commute.detail":
    "प्रमाणित N95 या FFP2, जो नाक और ठुड्डी पर कसकर बैठे, पूरे खुले सफ़र में पहनें। कपड़े और सर्जिकल मास्क स्मॉग में बहुत कम काम आते हैं।",
  "action.mask-commute.why": "{time} पर बाहर लगभग {outside} µg/m³ है।",

  "action.car-recirculate.title": "शीशे ऊपर, हवा रीसर्कुलेट पर",
  "action.car-recirculate.detail":
    "ट्रैफ़िक में खिड़कियाँ बंद रखें और गाड़ी की हवा रीसर्कुलेट पर रखें। अगली सर्विस में केबिन फ़िल्टर साफ़ करवाएँ।",

  "action.commute-metro.title": "काम पर मेट्रो से जाएँ",
  "action.commute-metro.detail": "स्टेशन तक आने-जाने के पैदल रास्ते में N95 पहनें।",

  "action.commute-bus.title": "काम पर बस से जाएँ",
  "action.commute-bus.detail": "बस स्टॉप पर और पैदल रास्ते में N95 पहनें।",

  "action.carpool.title": "दफ़्तर के लिए गाड़ी साझा करें",
  "action.carpool.detail": "पास रहने वाले किसी सहकर्मी के साथ आएँ-जाएँ, या बारी-बारी से गाड़ी चलाएँ।",

  "action.school-carpool.title": "स्कूल के लिए बारी-बारी की गाड़ी",
  "action.school-carpool.detail": "दो और परिवारों के साथ बारी बाँधें, ताकि हर गाड़ी एक-तिहाई चक्कर लगाए।",

  "action.work-from-home.title": "हो सके तो आज घर से काम करें",
  "action.work-from-home.detail":
    "सबसे ख़राब दिनों में दिल्ली-एनसीआर की आपात योजना (GRAP) दफ़्तरों को आधे कर्मचारियों से घर से काम करवाने की छूट देती है।",

  "action.combine-errands.title": "सारे काम एक ही चक्कर में",
  "action.combine-errands.detail":
    "बाज़ार, दवा की दुकान और लाने-ले जाने के काम एक ही सफ़र में निपटाएँ, या पास की दुकान तक साफ़ समय में पैदल जाएँ।",

  "action.engine-off.title": "लंबी लाल बत्ती पर इंजन बंद",
  "action.engine-off.detail": "अगर बत्ती दस सेकंड से ज़्यादा लाल रहेगी, तो इंजन बंद कर दें।",

  "action.exercise-indoors.title": "कसरत घर के अंदर करें",
  "action.exercise-indoors.detail":
    "योग, रस्सी कूदना या घर पर वर्कआउट, खिड़कियाँ बंद रखकर। ऐसे दिन बाहर तेज़ साँस लेने से कई गुना ज़्यादा धुआँ अंदर जाता है।",
  "action.exercise-indoors.why": "{time} पर बाहर लगभग {outside} µg/m³ है।",

  "action.exercise-window.title": "सैर या दौड़ साफ़ समय में करें",
  "action.exercise-window.detail": "जब हवा सबसे साफ़ हो तब बाहर जाएँ और रफ़्तार हल्की रखें।",
  "action.exercise-window.why": "उस समय हवा सबसे साफ़ है, लगभग {outside} µg/m³।",

  "action.play-indoors.title": "आज दोपहर घर के अंदर खेल",
  "action.play-indoors.detail": "लूडो, नाच-गाना, चादर का क़िला। शाम का स्मॉग बढ़ते समय खिड़कियाँ बंद रखें।",
  "action.play-indoors.why": "{time} पर बाहर लगभग {outside} µg/m³ है।",

  "action.no-waste-burning.title": "पत्ते और कचरा बोरी में भरें, जलाएँ नहीं",
  "action.no-waste-burning.detail":
    "सूखा कचरा कूड़ा उठाने वाले को दें या पत्तों की खाद बनाएँ। दिल्ली में खुले में कचरा जलाना मना है और इससे स्मॉग बढ़ता है।",

  "action.report-burning.title": "आसपास खुले में जलाने की शिकायत करें",
  "action.report-burning.detail":
    "स्मॉग वाली रातों में पत्तों और कचरे की आग बड़ा स्थानीय स्रोत है। इसकी शिकायत नगर निगम या राज्य प्रदूषण बोर्ड से करें।",
  "action.report-burning.why": "एक आग पूरे मोहल्ले की हवा बिगाड़ सकती है; शिकायत से उसे बुझवाया जा सकता है।",

  "method.airingSwap": "सुबह की जगह साफ़ समय में हवा देना",
  "method.bedroomOvernight": "रात भर सोने के कमरे की हवा",
  "method.burning": "कचरा जलाने का धुआँ",
  "method.burst": "घर में एक बार जलाने का धुआँ",
  "method.doseSleep": "सोने वालों की साँस",
  "method.electricity": "बिजली की बचत",
  "method.exercise": "बाहर की जगह अंदर कसरत",
  "method.exerciseShift": "साफ़ समय में कसरत",
  "method.idling": "रुकी गाड़ी में जला ईंधन",
  "method.mask": "खुले सफ़र में मास्क",
  "method.play": "बाहर की जगह अंदर खेल",
  "method.recirculate": "गाड़ी की हवा रीसर्कुलेट पर",
  "method.sealing": "दरारें बंद होने पर घर की हवा",
  "method.tripDose": "सफ़र में ली गई साँस",
  "method.wear": "टायर, ब्रेक और सड़क की धूल",
  "method.co2Switch": "बदलाव से CO2",
  "method.carpool": "गाड़ी के किलोमीटर आधे",
  "method.rota": "गाड़ी के किलोमीटर साझा",
  "method.errands": "गाड़ी के बचे किलोमीटर",

  "ui.skip": "सीधे मुख्य हिस्से पर जाएँ",
  "nav.label": "मुख्य",
  "nav.today": "आज",
  "nav.ask": "पूछें",
  "nav.indoors": "घर के अंदर",
  "nav.community": "समुदाय",
  "nav.settings": "सेटिंग",

  "scale.IN": "भारत AQI",
  "scale.US": "अमेरिकी AQI",
  "today.title": "आज की हवा",
  "today.place": "{place}, {time}",
  "today.change": "बदलें",
  "today.level": "6 में से स्तर {level}",
  "today.pm25Over": "अभी PM2.5 {pm25} µg/m³, WHO की दैनिक सीमा का {times} गुना।",
  "today.pm25Under": "अभी PM2.5 {pm25} µg/m³, WHO की दैनिक सीमा के भीतर।",
  "today.ribbonTitle": "अगले 48 घंटे",
  "today.ribbonDesc": "{start} से {end} तक हर घंटे का PM2.5, µg/m³ में।",
  "today.clean": "आज सबसे साफ़ {start} से {end}, लगभग {pm} µg/m³।",
  "today.cleanTomorrow": "कल सबसे साफ़ {start} से {end}, लगभग {pm} µg/m³।",
  "today.flat": "आज कोई साफ़ समय नहीं; पूरे दिन हवा लगभग एक जैसी रहेगी।",
  "today.window": "साफ़ समय",
  "today.now": "अभी",
  "today.who": "WHO दिशानिर्देश",
  "today.asTable": "तालिका में देखें",
  "today.asChart": "चार्ट में देखें",
  "table.time": "समय",
  "table.pm25": "PM2.5 (µg/m³)",
  "table.level": "स्तर",

  "plan.title": "आज की आपकी योजना",
  "plan.rules": "मौसम के पूर्वानुमान और आपके परिवार के हिसाब से इसी डिवाइस पर बनी।",
  "plan.done": "हो गया",
  "plan.for": "{who} के लिए",
  "plan.numbers": "आँकड़े देखें",
  "plan.hideNumbers": "आँकड़े छिपाएँ",
  "plan.swaps": "या इसकी जगह",
  "plan.how": "कैसे करें",
  "plan.empty": "आज कुछ बदलने की ज़रूरत नहीं। साफ़ हवा का मज़ा लें।",

  "ledger.title": "आज आपकी साँस-छाप",
  "ledger.ifAll": "अगर आप पूरी योजना अपनाएँ",
  "ledger.doneSoFar": "अब तक जो किया उससे",
  "ledger.cig": "सिगरेट जितना धुआँ जिससे आपका परिवार बचता है",
  "ledger.co2": "किलो CO2 हवा से दूर",
  "ledger.preventPm": "और {pm} ग्राम PM2.5 गली से दूर",
  "ledger.saves": "रोज़ की बचत",
  "ledger.spends": "रोज़ का खर्च",
  "ledger.once": "और एक बार ₹{once}",
  "ledger.note": "सिगरेट के आँकड़े Berkeley Earth के आधार पर पैमाना दिखाते हैं; यह कोई चिकित्सा माप नहीं है।",

  "impact.protect": "आपका परिवार क्या साँस में लेता है",
  "impact.prevent": "आपकी गली को क्या मिलता है",
  "impact.wallet": "आपकी जेब",
  "impact.doseLess": "{mid} µg कम PM2.5 साँस में",
  "impact.doseMore": "{mid} µg ज़्यादा PM2.5 साँस में",
  "impact.share": "{who} की दिन भर की ख़ुराक का {pct}%",
  "impact.co2": "{mid} किलो कम CO2",
  "impact.pm": "{mid} ग्राम कम PM2.5",
  "impact.saves": "रोज़ ₹{mid} की बचत",
  "impact.costs": "रोज़ ₹{mid}",
  "impact.once": "एक बार ₹{mid}",
  "impact.co2More": "{mid} किलो ज़्यादा CO2",
  "impact.pmMore": "{mid} ग्राम ज़्यादा PM2.5",
  "impact.none": "कोई बदलाव नहीं",
  "impact.range": "{low} से {high}",
  "impact.method": "हमने यह कैसे निकाला",
  "impact.sources": "स्रोत",
  "impact.qualitative": "इसके आँकड़े नहीं: सबूत दिशा पर साफ़ हैं, मात्रा पर नहीं।",

  "air.loading": "{place} का पूर्वानुमान आ रहा है",
  "air.error": "हवा के आँकड़ों की सेवा से जवाब नहीं मिला।",
  "air.retry": "फिर कोशिश करें",
  "air.saved": "ऑफ़लाइन। {time} पर सहेजा गया पूर्वानुमान दिख रहा है।",
  "demo.banner": "डेमो: दिल्ली की एक गंभीर सर्दी की सुबह में मीरा का परिवार, नमूना पूर्वानुमान के साथ।",
  "demo.exit": "डेमो से बाहर निकलें",

  "footer.data": "हवा के आँकड़े: Open-Meteo से CAMS पूर्वानुमान, लगभग 45 किमी के दायरे में।",
  "footer.privacy": "आपके परिवार की जानकारी इसी डिवाइस पर रहती है।",
  "footer.by": "निर्माण: अर्जुन कृष्णन",

  "setup.title": "आपका परिवार",
  "setup.intro":
    "हर सवाल वैकल्पिक है और उसका एक समझदार डिफ़ॉल्ट है। इस डिवाइस से सिर्फ़ मोटा-मोटा स्थान बाहर जाता है।",
  "setup.step": "{total} में से चरण {n}",
  "setup.back": "पीछे",
  "setup.next": "आगे",
  "setup.finish": "मेरी योजना दिखाएँ",
  "setup.place": "आप कहाँ रहते हैं?",
  "setup.search": "अपना इलाका खोजें",
  "setup.searchHint": "मोहल्ला या शहर",
  "setup.searching": "खोज रहे हैं",
  "setup.noResults": "कोई जगह नहीं मिली। शहर का नाम आज़माएँ।",
  "setup.searchError": "खोज अभी काम नहीं कर रही। अपना स्थान इस्तेमाल करें।",
  "setup.locate": "मेरा स्थान इस्तेमाल करें",
  "setup.locating": "आपको ढूँढ रहे हैं",
  "setup.locateError": "आपका स्थान नहीं मिला। खोजकर चुनें।",
  "setup.here": "मेरा स्थान",
  "setup.chosen": "चुना गया: {place}",
  "setup.demo": "या गंभीर दिन पर मीरा का परिवार देखें",
  "setup.household": "आपके साथ कौन रहता है?",
  "setup.person": "व्यक्ति {n}",
  "setup.name": "नाम (वैकल्पिक)",
  "setup.group": "उम्र",
  "setup.conditions": "सेहत",
  "setup.outdoorWork": "बाहर काम करते हैं",
  "setup.add": "एक व्यक्ति जोड़ें",
  "setup.remove": "{who} को हटाएँ",
  "setup.travel": "आप कैसे आते-जाते हैं?",
  "setup.commute": "काम या कॉलेज का रास्ता",
  "setup.schoolRun": "स्कूल का रास्ता",
  "setup.mode": "कैसे",
  "setup.km": "एक तरफ़ की दूरी, किमी",
  "setup.leave": "निकलने का समय",
  "setup.return": "लौटने का समय",
  "setup.who": "कौन जाता है",
  "setup.exercise": "बाहर कसरत",
  "setup.home": "आपका घर",
  "setup.tightness": "खिड़कियाँ बंद हों तो घर",
  "setup.purifier": "हमारे पास एयर प्यूरीफ़ायर है",
  "setup.cooking": "खाना पकाने का मुख्य ईंधन",
  "setup.chimney": "रसोई में चिमनी या एग्ज़ॉस्ट है",
  "setup.heating": "सर्दियों में गरमाहट",
  "setup.habits": "घर में हम",
  "setup.incense": "अगरबत्ती या धूप जलाते हैं",
  "setup.coil": "मच्छर कॉइल जलाते हैं",
  "setup.smoking": "अंदर धूम्रपान करते हैं",
  "setup.burnsWaste": "पत्ते या कचरा जलाते हैं",
  "setup.prefs": "कुछ पसंद",
  "setup.budget": "सुधार का बजट",
  "setup.language": "भाषा",
  "setup.scale": "AQI पैमाना",
  "setup.invalid": "योजना बनाने से पहले कुछ जवाब दोबारा देखने होंगे। दूरी और समय जाँचें।",

  "groupLabel.infant": "शिशु, 1 साल से कम",
  "groupLabel.child": "बच्चा, 1 से 10 साल",
  "groupLabel.teen": "किशोर, 11 से 17 साल",
  "groupLabel.adult": "वयस्क",
  "groupLabel.older": "बुज़ुर्ग, 60 और ऊपर",
  "condition.asthma": "दमा",
  "condition.copd": "सीओपीडी",
  "condition.heart": "दिल की बीमारी",
  "condition.pregnant": "गर्भवती",
  "mode.car": "कार",
  "mode.twoWheeler": "स्कूटर या मोटरसाइकिल",
  "mode.auto": "ऑटो-रिक्शा",
  "mode.bus": "बस",
  "mode.metro": "मेट्रो",
  "mode.walk": "पैदल",
  "mode.cycle": "साइकिल",
  "mode.none": "यह सफ़र कोई नहीं करता",
  "exercise.none": "नहीं",
  "exercise.morning": "सुबह",
  "exercise.evening": "शाम",
  "tightness.leaky": "हवादार, दरारों वाला",
  "tightness.average": "सामान्य",
  "tightness.tight": "अच्छी तरह बंद",
  "cooking.lpg": "एलपीजी सिलेंडर",
  "cooking.png": "पाइप वाली गैस",
  "cooking.electric": "बिजली या इंडक्शन",
  "cooking.biomass": "लकड़ी, उपले या फ़सल का कचरा",
  "cooking.kerosene": "केरोसिन",
  "heating.none": "कुछ नहीं",
  "heating.electric": "बिजली का हीटर",
  "heating.angithi": "अँगीठी या कोयला",
  "heating.kerosene": "केरोसिन हीटर",
  "heating.gasHeater": "गैस हीटर",
  "budget.tight": "मुफ़्त ही रहे",
  "budget.moderate": "थोड़ा बहुत",
  "budget.comfortable": "आराम से",
  "language.en": "English",
  "language.hi": "हिन्दी",

  "settings.title": "सेटिंग",
  "settings.edit": "परिवार की जानकारी बदलें",
  "settings.knows": "सहायक क्या जानता है",
  "settings.knowsIntro":
    "जब आप कुछ पूछते हैं तो Breathprint मॉडल को बस इतना भेजता है। नाम इसी डिवाइस पर रहते हैं।",
  "settings.forget": "मेरे परिवार की जानकारी मिटाएँ",
  "settings.forgetConfirm": "इससे इस डिवाइस से आपका परिवार, योजना और प्रगति मिट जाएगी।",
  "settings.forgetYes": "हाँ, मिटा दें",
  "settings.cancel": "रहने दें",

  "notFound.title": "यह पन्ना स्मॉग में खो गया",
  "notFound.body": "इस पते पर कुछ नहीं है।",
  "notFound.home": "आज पर वापस",
};
