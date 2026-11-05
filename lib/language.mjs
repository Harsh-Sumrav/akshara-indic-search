// Keep combining marks with their base letters; normalize join controls and nukta.
export function tokens(text) {
  return (String(text ?? '').normalize('NFKC').normalize('NFD')
    .replace(/[\u200c\u200d\u093c]/gu, '').normalize('NFC')
    .toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu) || []);
}

export const stops = new Set(tokens('the a an of to is are and for from in on by with और है हैं था थे का की के को से पर में तथा एक एकच हे च ও এর এই আর এবং का ka ki ke ko se mein me aur hai hain the'));

// Ordered longest-first. Keep at least two Devanagari letters in the root.
const endings = ['ाइयों','ाइयां','ाइयाँ','ाएंगी','ाएंगे','ाऊँगा','ाऊंगी','ाइयो','ियों','ियाँ','ियां','ाएँ','ाओं','ाएं','ेंगी','ेंगे','ियां','ों','ें','ियाँ','ियों','ती','ते','ता'];
export function stem(term) {
  if (!/^[\u0900-\u097f]+$/u.test(term)) return term;
  for (const suffix of ['ियों','ियाँ','ियां']) {
    if (term.endsWith(suffix)) {
      const base=term.slice(0,-suffix.length);
      if ((base.match(/[\u0904-\u0939]/gu)||[]).length>=2) return base+'ी';
    }
  }
  for (const suffix of endings) {
    if (!term.endsWith(suffix)) continue;
    const base = term.slice(0,-suffix.length);
    if ((base.match(/[\u0904-\u0939]/gu) || []).length >= 2) return base;
  }
  return term;
}

// Aligned Brahmic Unicode blocks share these consonant/vowel offsets.
const blocks = [0x900,0x980,0xa00,0xa80,0xb00,0xb80,0xc00,0xc80,0xd00];
const syllables = {
  1:'n',2:'n',3:'h',5:'a',6:'aa',7:'i',8:'ii',9:'u',10:'uu',11:'ri',
  14:'e',15:'e',16:'ai',18:'o',19:'o',20:'au',
  21:'k',22:'kh',23:'g',24:'gh',25:'ng',26:'ch',27:'chh',28:'j',
  29:'jh',30:'ny',31:'t',32:'th',33:'d',34:'dh',35:'n',36:'t',
  37:'th',38:'d',39:'dh',40:'n',41:'n',42:'p',43:'ph',44:'b',
  45:'bh',46:'m',47:'y',48:'r',49:'r',50:'l',51:'l',52:'l',
  53:'v',54:'sh',55:'sh',56:'s',57:'h',60:'',62:'aa',63:'i',
  64:'ii',65:'u',66:'uu',67:'ri',70:'e',71:'e',72:'ai',74:'o',
  75:'o',76:'au',77:'',93:'rh',95:'y'
};
export function romanize(term) {
  const chars = [...term];
  let output = '';
  for (let i=0;i<chars.length;i++) {
    const code = chars[i].codePointAt(0);
    const block = blocks.find(start => code >= start && code < start+128);
    if (block === undefined) { output += chars[i]; continue; }
    const offset = code-block;
    const next = i+1<chars.length ? chars[i+1].codePointAt(0)-block : -1;
    if (offset >= 102 && offset <= 111) { output += String(offset-102); continue; }
    output += syllables[offset] ?? chars[i];
    if (offset>=21 && offset<=57 && next>=0 && !(next>=60 && next<=77)) output+='a';
  }
  return output.normalize('NFD').replace(/[\u0300-\u036f]/gu,'');
}

export function soundKey(term) {
  const s = romanize(term).toLowerCase();
  if (!/^[a-z]{3,40}$/.test(s)) return '';
  const key = s.replace(/ph/g,'f').replace(/q/g,'k').replace(/w/g,'v')
    .replace(/sh/g,'s').replace(/([kgcjtdpb])h/g,'$1')
    .replace(/[aeiouy]/g,'').replace(/(.)\1+/g,'$1');
  return key.length>=2 ? key : '';
}

// Explicit query translations are auditable. Ambiguous single words are excluded
// when they would introduce a strong national or geographical bias.
const families = {
  weather:'weather forecast forecasts meteorology मौसम पूर्वानुमान mausam mosam mousam আবহাওয়া வானிலை వాతావరణం हवामान હવામાન ਮੌਸਮ ಹವಾಮಾನ കാലാവസ്ഥ',
  rain:'rain rainfall rains precipitation बारिश वर्षा बरसात barish baarish varsha বৃষ্টি மழை వర్షం पाऊस વરસાદ ਮੀਂਹ ಮಳೆ മഴ',
  monsoon:'monsoon मानसून mansoon বর্ষা பருவமழை రుతుపవనాలు',
  tomorrow:'tomorrow कल kal আগামীকাল நாளை రేపు उद्या કાલે',
  farmer:'farmer farmers कृषक किसान किसानों kisaan kisan কৃষক விவசாயி రైతు शेतकरी ખેડૂત ਕਿਸਾਨ ರೈತ കർഷകൻ',
  agriculture:'agriculture agricultural farming खेती कृषि kheti krishi কৃষি வேளாண்மை వ్యవసాయం शेती ખેતી ਖੇਤੀ ಕೃಷಿ കൃഷി',
  water:'water पानी जल pani paani jal পানি জল தண்ணீர் నీరు पाणी પાણી ਪਾਣੀ ನೀರು വെള്ളം',
  river:'river rivers नदी नदियों नदियाँ nadi nadii নদী ஆறு నది નદી ਨਦੀ ನದಿ നദി',
  train:'railway railways railroad train trains rail रेल रेलवे ट्रेन gaadi rel रेलगाड़ी রেল রেলপথ রেলগাড়ি ரயில் రైలు રેલવે ਰੇਲ ರೈಲು റെയിൽ',
  station:'station stations स्टेशन जंक्शन steshan স্টেশন நிலையம் స్టేషన్',
  district:'district districts जिला ज़िला जिले जिलों zila jila জেলা மாவட்டம் జిల్లా जिल्हा જિલ્લો ਜ਼ਿਲ੍ਹਾ ಜಿಲ್ಲೆ ജില്ല',
  language:'language languages भाषा भाषाओं भाषाएं bhasha bhasa ভাষা மொழி భాష ભાષા ਭਾਸ਼ਾ ಭಾಷೆ ഭാഷ',
  education:'education educational शिक्षा shiksha siksha শিক্ষা கல்வி విద్య शिक्षण શિક્ષણ ਸਿੱਖਿਆ ಶಿಕ್ಷಣ വിദ്യാഭ്യാസം',
  university:'university universities विश्वविद्यालय vishwavidyalaya বিশ্ববিদ্যালয় பல்கலைக்கழகம் విశ్వవిద్యాలయం विद्यापीठ',
  health:'health healthcare स्वास्थ्य सेहत swasthya sehat স্বাস্থ্য சுகாதாரம் ఆరోగ్యం आरोग्य આરોગ્ય ਸਿਹਤ ಆರೋಗ್ಯ ആരോഗ്യം',
  hospital:'hospital hospitals अस्पताल aspatal হাসপাতাল மருத்துவமனை ఆసుపత్రి रुग्णालय',
  space:'space अंतरिक्ष antariksh মহাকাশ விண்வெளி అంతరిక్షం अवकाश',
  moon:'moon lunar चाँद चंद्र चन्द्रमा चंद्रमा chand chandrama চাঁদ நிலவு చంద్రుడు',
  satellite:'satellite satellites उपग्रह upgrah upagrah উপগ্রহ செயற்கைக்கோள் ఉపగ్రహం',
  moonmission:'chandrayaan chandrayan चंद्रयान चन्द्रयान চন্দ্রযান சந்திரயான் చంద్రయాన్',
  india:'india indian bharat bhaarat hindustan भारत भारतीय ভারত ভারতীয় இந்தியா భారతదేశం ભારત ਭਾਰਤ ಭಾರತ ഇന്ത്യ',
  constitution:'constitution constitutional संविधान samvidhan sanvidhan সংবিধান அரசியலமைப்பு రాజ్యాంగం',
  rights:'rights अधिकार adhikar অধিকার உரிமைகள் హక్కులు',
  city:'city cities town towns शहर shahar sheher নগর শহর நகரம் నగరం',
  population:'population census जनसंख्या जनगणना jansankhya janganana জনসংখ্যা மக்கள்தொகை జనాభా',
  capital:'capital capitals राजधानी rajdhani রাজধানী தலைநகரம் రాజధాని',
  temple:'temple temples मंदिर मन्दिर mandir মন্দির கோயில் ఆలయం',
  book:'book books किताब किताबें किताबों पुस्तक पुस्तकें पुस्तकों kitab kitaab pustak boi বই நூல் புத்தகம் పుస్తకం',
  tiger:'tiger tigers बाघ bagh baagh বাঘ புலி పులి वाघ',
  park:'park parks उद्यान udyan পার্ক பூங்கா ఉద్యానవనం',
  forest:'forest forests वन जंगल van jangal বন காடு అడవి',
  mountain:'mountain mountains peak पर्वत पहाड़ पहाड parvat pahad পর্বত மலை పర్వతం',
  freedom:'freedom independence स्वतंत्रता आजादी आज़ादी azadi azaadi স্বাধীনতা சுதந்திரம் స్వాతంత్ర్యం',
  student:'student students विद्यार्थी विद्यार्थियों छात्रों छात्र chhatra vidyarthi শিক্ষার্থী மாணவர் విద్యార్థి',
  wheat:'wheat गेहूं गेहूँ gehu gehun গম கோதுமை గోధుమ',
  rice:'rice paddy धान चावल chawal dhaan চাল ধান அரிசி వరి',
  earthquake:'earthquake earthquakes भूकंप bhukamp ভূমিকম্প நிலநடுக்கம் భూకంపం',
  flood:'flood floods बाढ़ बाढ baadh बন্যা বন্যা வெள்ளம் వరద',
  museum:'museum museums संग्रहालय sangrahalaya জাদুঘর அருங்காட்சியகம் మ్యూజియం',
  solar:'solar सौर saur সৌর சூரிய సౌర',
  energy:'energy ऊर्जा urja oorja শক্তি ஆற்றல் శక్తి',
  poet:'poet poets कवि kavi কবি கவிஞர் కవి',
  delhi:'delhi dilli dehli दिल्ली দিল্লি டெல்லி ఢిల్లీ',
  mumbai:'mumbai bombay मुंबई बंबई মুম্বাই மும்பை ముంబై',
  kolkata:'kolkata calcutta कोलकाता कलकत्ता কলকাতা கொல்கத்தா కోల్కతా',
  chennai:'chennai madras चेन्नई சென்னை চেন্নাই చెన్నై',
  ganga:'ganges ganga gangaa गंगा গঙ্গা கங்கை గంగా',
  gandhi:'gandhi gandhiji गांधी गाँधी গান্ধী காந்தி గాంధీ',
  scholarship:'scholarship scholarships छात्रवृत्ति छात्रवृत्तियां chhatravritti chatravriti chhatravritti বৃত্তি உதவித்தொகை ఉపకారవేతనం',
  aadhaar:'aadhaar aadhar adhar आधार আধার ஆதார் ఆధార్',
  update:'update updates correction सुधार अपडेट sudhar सुधारना হালনাগাদ புதுப்பிப்பு',
  payment:'payment payments भुगतान bhugtan bhugataan পেমেন্ট கட்டணம் చెల్లింపు',
  heritage:'heritage विरासत धरोहर virasat dharohar ঐতিহ্য பாரம்பரியம் వారసత్వం',
  status:'status स्थिति sthiti स्टेटस স্থিতি நிலை స్థితి',
  scheme:'scheme schemes योजना yojana योजनाओं প্রকল্প திட்டம் పథకం'
};
export const lexicon = new Map();
for (const [concept,words] of Object.entries(families)) {
  for (const word of tokens(words)) lexicon.set(word,concept);
}

export function conceptFor(word,root,context) {
  if ((word==='kal' || word==='कल') && !context.some(t=>['weather','rain','monsoon'].includes(lexicon.get(t)))) return undefined;
  return lexicon.get(word)||lexicon.get(root);
}
