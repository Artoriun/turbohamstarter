export interface Poem {
  id: string;
  title: string;
  image: string;
  overlay?: string;
  featured?: boolean;
  deleted?: boolean;
  customSlides?: string[];
  customSlidesEnabled?: boolean;
}

export const POEMS: Poem[] = [
  {
    id: 'poem-1',
    title: 'Alkonyat',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784831893/poems/alkonyat.png',
    overlay:
      'Akarsz-e versmáglyán elégni\nKörülölelne a lángom\nHarapná a tested,\nMint éj az estet,\nAkarsz-e élni?\n\nItt oly rendesen elégnél,\nHamu sem lenne belőled,\nA hajad csillaggá válna,\nA tested felhővé,\nSzél lenne drága öled,\nS üldözné viharharaggal\nGyermekláncfű lelkemet.',
    featured: true,
  },
  {
    id: 'poem-2',
    title: 'Égő élet',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784831895/poems/ego-elet.png',
    overlay:
      'Csillagoktól szikrát fogott\nLángra lobbant az életem,\nFöldi mezőn füsttel, bajjal\nŐszi alkonyatban ég.\nLányok, lányok, sírjatok,\nKönnyetekkel altassátok\nCsitítsátok ezt a tüzet,\nNem akarok daltalanul\nCsóktalan elégni még.',
    featured: true,
  },
  {
    id: 'poem-3',
    title: 'Phaäton',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828910/poems/geel.jpg',
    overlay:
      'Ugye, hogy titok még a fény?\nUgye hogy még ma sincs megfejtve?\nUgye még mindig bambán bámultok\nTi, a sötétség fiai\nTitokzatos napszekerekre?\n\nFelhőszegte kékfényű úton,\nHa jő piros kelet felől\nNagy zörrenéssel a napszekér\nPort verve, fény meleg porát\nUgye hogy szent csodamegejtve\nLeborultok sártestetekkel\nFényittasult homokszemekre?\n\nEzek ti vagytok, földre nézők,\nDe én a nap fia vagyok:\nŐ nemzett engem földi lánnyal\nMikor vad, párzó kedve támadt,\nS én most keresem az anyámat.\n\nHa meglelem majd őt, a napszeműt\nKicsi fia eléje járul\nMegölelem gazdag csípőjét\nS kérem, meséljen az apámrul…\n\nKérem, hogyha még szeret engem,\nÁrulja el a titkok titkát\nMelyet ajkára fagyva érzek,\nHa hozzáér nagy, szomjas számhoz:\nHogy juthatnék vissza apámhoz?\n\nMert én itt nagyon idegen vagyok\nÉrzem, nekem hozzá kell mennem,\nRajta kívül hiszen nincs senki\nAki megértse szomorú,\nTitokzatos, bús napszerelmem…..',
    featured: true,
  },
  {
    id: 'poem-4',
    title: 'Éj',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1784828924/poems/nachtelijke-lucht.jpg',
    overlay:
      'Kék hold virágsziromban ül,\nS evez, evez…\nItt-ott megcsobban az ég véletlenül.\n\nA faluban ugatnak a kutyák,\nHázak mellett fekete fák\nmelle piheg.\n\nA toronyra egy fantom települ,\nA holdra vigyorog és piheg,\nnagy nyelve szürcsöli a fényt,\nFarkával a szíved veri,\nDe ne szólj senkinek.',
    featured: true,
  },
  {
    id: 'poem-5',
    title: 'Körforgás: Tavasz',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1784828918/poems/korforgas-tavasz.jpg',
    overlay:
      'Az ég határtalan\nA föld\nA víz, a sugár, a lány\nÖrömmel tölt\nÉs zeng és zúg\nA mindenség és hajt a virág\nÉs végtelen az út\nA lelked egyre fut\nSzáll nyargal, mint a szél és tarka\nMadarak közt a színbe és fénybe futsz.',
    featured: true,
  },
  {
    id: 'poem-6',
    title: 'Körforgás: Nyár',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828917/poems/korforgas-nyar.jpg',
    overlay:
      'Nyár van: izzanak a mezők és dombok\nAratsz, mert itt élsz már a földön\nVan csűröd, fiad, feleséged\nAz ideák tarkák, bolondok\nNem teremnek sok eleséget.\nS neked dolgozni kell, mert ez a rend\nFigyelemmel nézed a hangyabolyt,\nMily értelem van itt, milyen titok,\nTávol harangszót hoz hozzád a csend.\nLeülsz és vársz, az útnál feltűnik\nGyermeked, kis kosár kezében,\nEbédet hoz, szakasztott anyja éppen:\nBoldogság, béke lelkedet szűrik.',
  },
  {
    id: 'poem-7',
    title: 'Körforgás: Ősz',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828919/poems/korforgas-osz.jpg',
    overlay:
      'A sombokrokon\nPárás, lila nyom,\nAz erdők olyan beteltek\nÉs cseng kopog a lombokon.\nDe messze túl\nHol kissé alkonyul\nSzüret áll és ez a tied,\nKövér szőlőgerezdek\nTeste puttonyban reszket,\nValahol\nÓ ifjúságod újbora forr.',
  },
  {
    id: 'poem-8',
    title: 'Körforgás: Tél',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828936/poems/winter-2.jpg',
    overlay:
      'Fehér a táj\nSzán járja, nem batár\nCsonkák a fák\nAz erdő néma már.\nkandalló mellett\nVén száraz, szikkadt melled\nSípol, csak tán a tűz régi,\nLáng, láng be furcsa:\nSuttyó fák emléki.\nMost varjú károg,\nRég megholt párod,\nVagy látomás?\nAz ég szürke, fonnyadt, ragyás\nÁlmatagon szitál a hó\nS hol nyom volt, betemeti lassan\nAz elmúlás…..',
  },
  {
    id: 'poem-9',
    title: 'Nyári merengés',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828920/poems/lente.jpg',
    overlay:
      'Színek zenéje most a tájék.\nNézem, a lepke mint lebeg\nA fényben. Egyik szárnyán árnyék.\n\nDarázs udvarol a pipacsnak,\nMeggyfán egy vén szarka csörög,\nA varjak víg lakomát csapnak.\n\nA zöld mező széles szalag,\nFut át a kis falu mögött\nDűlőútján egy szekér ballag.\n\nOlyan jó élni! tenyeremen\nKis katicabogár remél,\nSzárnyára mikor hull kegyelem…\n\nElengedem. Biztosan várják\nOdahaza s ülök tovább\nAz ég partján, s nézem, a felhők\nHogy úsznak, mint nagy fehér gályák….',
  },
  {
    id: 'poem-10',
    title: 'Augusztus',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828905/poems/augustus.jpg',
    overlay:
      'Kék selymét az ég még kibontja,\nS lebegteti fejed felett\nDe te jól ismered a kelmét\nFakul már, bomlik mint a töredelmét\nValló léleken a szövet.\n\nMint nagy ordas, az erdőből kinéz\nLoppal az ősz és szerteszimatol:\nNem hajt-e álomjuhokat valaki\nEltűnő úton valahol?\n\nLehet, hogy a nyár még igéz,\nFűhajában kék a virág,\nDe nagy csendben meghallhatod:\nValami rág, valami rág….\n\nS te hova futsz, hogyha fut már a nyár,\nCsóktalan és gyümölcstelen hova?\nA zöld erdő vad jajba öltözött\nS vörös és sárga levelek között\nCsattog az ősznek kegyetlen foga.',
  },
  {
    id: 'poem-11',
    title: 'Ősz',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828914/poems/herfst1.jpg',
    overlay:
      'Télkirály ismét talpon, készül\nA hegyekből lejönni újra\nS mert nem telik levélpapírra,\nFalevelet küld szét, velük üzen.\n\nNehéz nagy eső veri a tájat,\nAz emberek máris köhögnek,\nA felhőkben a nyár sír, szíve fájhat\nMint az eke az őszi rögöknek.\n\nS valami nagy-nagy bánat suhan át\nA füveken, szíveken és a fákon:\nÖrökre elaltathat mindent,\nHa ilyen mohón itatja magát.',
  },
  {
    id: 'poem-12',
    title: 'Őszi dal',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828911/poems/herfst-2.jpg',
    overlay:
      'Szimbóluma vagy a halálnak!\nHiába menekülsz a nyárral\nSzent dél felé! Virágok sorsa\nOtt is csak a harc az elmúlással,\nA szirmok ott is pergamenné válnak.\n\nHiába írsz. Körülötted a háló:\nAz élet megfogott s el nem ereszt.\nBenne fogsz elpusztulni, télre váló\nNagy őszben a tiéd lesz a kereszt.\n\nHiába minden, vágyak, új remények,\nA sorsodat a mámor le nem bírja -\nA mosolyodban ott az este pírja\nS majd egy sejtelmes novemberi órán\nMagukkal visznek az utolsó fények.',
  },
  {
    id: 'poem-13',
    title: 'Magyar ősz',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828920/poems/lente.jpg',
    overlay:
      'Most foltos szürke ing az ég.\nZord északi szélben lebeg.\nMessze int a nyár keze még,\nDe elnyelik a kék hegyek.\n\nSzegény szívem vággyal teli,\nMint majd musttal lesz a fakád.\nHelyét a földön nem leli,\nMert érzi múlt idők szagát.\n\nNyár, nyár te lobogópiros\nPipacsú vágy! Ellobogott\nTüzed s hervadt a csalitos\nTáj, hol zöld szoknyád lobogott.',
  },
  {
    id: 'poem-14',
    title: 'Őszi kirándulás',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1784828927/poems/rivierstroompje.jpg',
    overlay:
      'Azon a tájon jártam,\nHol egykor ifjúságom égett.\nMesszire eltűnt nyárban\nKeresek egy forró emléket.\n\nA hegyek még ugyanazok,\nDe sárga-veres lombú fákon\nMár csak halottan ragyog\nAz én daloló ifjúságom.\n\nÓh, jaj, mért hal az ember\nlelkében meg volt ifjú mása?\nMért hív hűvös szeptember\nilyen fájó találkozásra.\n\nTűnő a perc, s ravatal\nSötétlik tegnaptól máig,\nKeserű-édes diadal,\nHogy én fekszem ott fejtől lábig.\n\nEmlék vagyok, mint rőt lomb\nAlkonyba süllyedő erdőben\nEzüst hajamra vén gond\nHajol: a vágy elfut előlem.',
  },
  {
    id: 'poem-15',
    title: 'Reggeli flört',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828926/poems/reggeli-flort.jpg',
    overlay:
      'A fűzfák még ködpongyolába’\nPihegnek a patak felett\nHarmatosak a levelek\nBotlik az éjnek lomha lába.\n\nDe piros vággyal kél a reggel,\nA domb teteje már arany\nOdébb ugrik egy vén varangy\nA fénytől álmos, zöldes szemmel…\n\nS a nap ezer lándzsát döf át\nA didergő, gyáva éj hasán\nVér csordul a lándzsák vasán\nKivillan egy kis falu háta.\n\nS a patak vizében észrevétlen\nA karcsú fűzfák meztelen\nFürödnek már és esztelen\nVágy ébred a nyugati szélben.',
  },
  {
    id: 'poem-16',
    title: 'Kaposszentbenedek',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828930/poems/szembek.jpg',
    overlay:
      '(Az én falum)\n\nMint barna tehén áll a völgyben,\nHátát a dombhoz dörgöli,\nLába előtt Balatonig gurul a sík…\nFüzek tündérhadától visszadöbben,\nDe a patakból még egyet iszik\nS csak áll, csak áll: földbegyökerezett a lába:\nSzelíd fejét bearanyozzák\nSugarai a tűnő nyárnak,\nKis borjai meleg tejére visszajárnak,\nHa beballag a csillagmécses éjszakába.',
  },
  {
    id: 'poem-17',
    title: 'Kaposszentbenedek',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1784828915/poems/kaposszentbenedek-kerk-1.jpg',
    overlay:
      'Mint borostyánba zárt levél,\nNevet a múltból egy falucska,\nS az ifjúságomról mesél\nKertjéből kihullt rózsacsokra.\n\nAz ember meghal s él a táj,\nA magasból csak egy sírt látunk,\nAz elmúlás az, ami fáj,\nPedig ez csak a mi sajátunk….\n\nA többi: álom, mint a lomb\nÉs zöld fenyők az udvarunkban,\nFelhők az égen, szembe’ domb,\nS monoton dongás egy malomban.\n\nEzüst nyárfák tűnő úton,\nPatak mellett fűzfák dús árnya,\nKis vonat a kis vasúton,\nS a légben száz madár kis szárnya..\n\nMilyen ifjúság! Meseszép!\nMelyet csak egy karácsony adhat\nCsillagszóróval regekép:\nA földön hát meg nem maradhat.\nEl kellet múlni, ami szép,\nS nincs a szívnek oly szenvedélye,\nMely visszaadja életét,\nHogy ragyogjon még eléd fénye…\n\nNincs képzelet, mely száz ecset -\nVonással visszaadja testét,\nCsak könny van, szívedből esett,\nS tengerré nőtető bús esték….',
  },
  {
    id: 'poem-18',
    title: 'Szembékre emlékezem',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1784828931/poems/szembekre-emlekezem.jpg',
    overlay:
      'Gyermekkorom csodás világa, te\nMely jó tündérként eltűntél a múltban\nS csak a vágyban élsz, emlékekbe borultan,\nIdézlek, mint varázsló, tébolyultan.\n\nKicsiny falum, a névtelen patak\nPartjára dőlve áldva áldalak,\nHogy ott nőttem fel és teáltalad\nLettem emberré: s ott óvtak meg engem\nLágy karolású, de szilárd falak.\n\nOtt vezettek engem apám s anyám,\nS dolgos néped, mely hangyaszorgalommal\nMunkálta földjét későn és korán,\nReám tekintett örök bizalommal….\n\nHogy csodáltam, mint gyermek s ifjú egyaránt\nS hogy jósoltam neki fényes jövőt\nÉrdeméért, - mivel a keze szánt\nS vet, - szenvedésből előretörőt.\n\nNem néztem le, ahogy lenézte más,\nHisz nagyszüleim is parasztok voltak,\nSzétszórt földjükön ők is robotoltak,\nHittem: sorsukból van föltámadás.\n\nS ha szebb országot látok, dúsabb tájat\nMa, mint gyerekkoromban volt a kép,\nEmlékezni azért én is visszajárok\nÉs nem felejtem, hogy mi volt a rég.\n\nSzembék, falum, eltűnt tündértanyám,\nLátom berkedben fűzfa sipot fújva\nLesek egy lányt, mint egy falusi Pán,\nS ha elfáradtam, konyhánk küszöbénél\nMeleg cipóval vár édesanyám…..',
  },
  {
    id: 'poem-19',
    title: 'Anyám',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828904/poems/anyam.jpg',
    overlay:
      'Te életet adtál nekem, anyám,\nÉn meg majd sírok, dadogok,\nÁllok bután\nHalálos ágyad előtt,\nMelyben leroskadsz, mint egy tündérkastély\nSzörnyű szélvész után.\n\nTöbbször gyötört a láz, voltam beteg,\nTe ott ültél az ágyam fölött,\nVégigsimítottad kezed\nA fejemen,\nÉs meggyógyultam legott,\nMint űzött vad, mert a szereteted\nVolt a nagy rengeteg.\n\nSzeretlek én is, óh de majd mit ér\nEz a szeretet akkor, ott,\nMikor a vér megfagy eredben, megalvad,\nMint égből porzó Niagara árja,\nÉs aztán jön a Tél…\n\nTe életet adtál nekem Anyám,\nÉs én majd nem segíthetek\nMikor talán\nSzeretne még a szíved\nTündérrózsája továbbnyílni\nÖrömöm mély taván….\n\nHiú vigasz, hogy utánadmegyek,\nNem nyitja zárját a titok, ha mint hegyek,\nElrejtik szép testedet\nAz égig érő sír s koporsó:\nHogy mindig bús legyek…..',
  },
  {
    id: 'poem-20',
    title: 'Szüleim szívéből',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1784828932/poems/szuleim-szivebol.jpg',
    overlay:
      'Vajon milyen már testetek\nOdalent a fakoporsóban?\nKi egykoron szerettelek\nÉs simogattam fejetek,\nMost török ki viharos szókban,\nÉs miattatok szenvedek.\n\nAz élet elszáll: csodagyöngy\nAnyaga talán üvegből van:\nSehogyse tart, s az értelem\nE miatt van elborulóban.\nSzázados fát ha nézdelek,\nMegejt az Örök gondolatja,\nMost foghatom csontvázkezét\nAnnak, aki bölcsőm ringatta.\n\nEmbernek lenni nem öröm,\nKi közben szánt s egyre mélyebben…\nMért nem vagyok karcsú madár,\nKinek szárnya könnyen lebben?\n\nVizek fölött elszállni jó,\nMint gondolat, határtalan\nA tó, a tenger és a szó\nMesszebbre hat lent a vizekben.\n\nVagy nem beszélni volna jobb?\nKi szót sem szól, az mond legtöbbet.\nRájövök, hogy a némaság\nA legtömörebb, legszebb élet….\nSzegény szüleim sem beszélnek…..',
  },
  {
    id: 'poem-21',
    title: 'Ifjúság',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828913/poems/herfst.jpg',
    overlay:
      'A tájon már az ősz remeg\nA fákon sárga levelek.\nFecskeraj gyűl a légbe fenn\nKisasszony napján hirtelen…\n\nNagy felhők szállnak Dél fele\nHajtja őket Észak szele,\nTereli őket az idő,\nMindent szülő, mindent ölő…\n\nEgy szép madár is száll velük\nRózsaszín tollú gyermekük,\nPihenni hívja őt egy ág:\nÓh ifjúság, óh ifjúság!!!\n\nAz ifjúságom! Ismerem:\nAz enyém volt, de hirtelen,\nKikapta szívemből a Tél\nS most hajnali hangon zenél….',
  },
  {
    id: 'poem-22',
    title: 'Lélekmáglya',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828921/poems/lelekmaglya.jpg',
    overlay:
      'A lelkem tiszta füveit,\nKönnyben nedveset, mosolyban asszut,\nOtt, hol a végtelenbe fut az út\nFormás boglyába gyűjti, villázza\nParasztsors, gyilkos, iszonyú.\nAnyás, szelíd pajta, ha várna\nTán megbékélnék illatos,\nTejszagú szép falusi csöndben,\nDe máglya leszek, égő máglya.\nTűzdarazsak marnak belém,\nS füveim, kiket illatnak szántam\nJóságos esővivő szélnek\nBékességes szemű tehénnek\nIrtózatos sorsról suttognak felém.',
  },
  {
    id: 'poem-23',
    title: 'Óda a testemhez',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1784828938/poems/oda-a-testemhez.jpg',
    overlay:
      'Mint könnyű nád hajoltál egykor zsenge\nTavánál életemnek, s mint a penge\nHasítottad a levegőt, ha vitt\nKét lábad: e két testvérparipa\nSzökellve vágtatva: hol ott, hol itt…\n\nŰrhajó nem volt még, de a szemed\nMégis a tejútrendszeren túl látta\nEgy álmodott világ szépségeit.\n\nEmlékszel, mikor madarat temettél,\nA földön guggolva, ástad a sírt?\nA halál mégse izgatott. Te lettél az alfa és omega, akit\nKegyes sorsod múló habokra írt.\n\nMint könnyű nád, óh, úgy hajoltál, testem\nA lányhoz, aki szőke volt és sudár,\nS úgy ölelted át loncként, mint a nyár\nBúzavirágos mezőt bíbor esten.\n\nTe voltál a gyorsaság és a szépség,\nMindent megértés: iramló határ,\nGondolatod gondolatot keresztez…\nS védni magad megálltál, mint a vár.',
    customSlides: [
      'Mint könnyű nád hajoltál egykor zsenge\nTavánál életemnek, s mint a penge\nHasítottad a levegőt, ha vitt\nKét lábad: e két testvérparipa\nSzökellve vágtatva: hol ott, hol itt…\n\nŰrhajó nem volt még, de a szemed\nMégis a tejútrendszeren túl látta\nEgy álmodott világ szépségeit.\n\nEmlékszel, mikor madarat temettél,\nA földön guggolva, ástad a sírt?\nA halál mégse izgatott. Te lettél az alfa és omega, akit\nKegyes sorsod múló habokra írt.\n\nMint könnyű nád, óh, úgy hajoltál, testem\nA lányhoz, aki szőke volt és sudár,\nS úgy ölelted át loncként, mint a nyár\nBúzavirágos mezőt bíbor esten.\n\nTe voltál a gyorsaság és a szépség,\nMindent megértés: iramló határ,\nGondolatod gondolatot keresztez…\nS védni magad megálltál, mint a vár.',
      'Csak tegnap volt, hogy hajnali szelekkel\nHalhatatlanság tündérszárnya verte\nKörülötted a nap aranyporát,\nS mért perceid már fáradt cimborák?\n\nKi győz majd benned, hogyha egyre vénül\nAz idő körülötted és dagad,\nFejeden barna hajad is csak fehérül\nÉs a halálnak megadod magad?\n\nS mi eszme volt, élet, bizodalom,\nBölcsesség, ész, gyönyör, vad fájdalom,\nKihajítódik egy kis ablakon,\nAmelynek szárnya bamba űrbe zárva,\nS két gyermekedről azt mondják, hogy árva…\n\nTested pedig, nem mint meteor\nGipszholdra hullva méltó mód enyész el,\nDe úgy rohad. Érted, látod? Tudod?\nMint a vegytan rohad el a vegyésszel.\n\nÍnycsiklandó étellel és itallal,\nLásd a halált hizlaltad hát magadban.\nÓh, testem, árnyékom: dal a dalban:\nÁtkozlak, hogy vagy s hogy benned vagyok:\nRajongva, őrülten és aztán halkan… halkan…..',
    ],
    customSlidesEnabled: true,
  },
  {
    id: 'poem-24',
    title: 'Eros',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828908/poems/eros.jpg',
    overlay:
      'A télben is lobog örök, ősi lánggal a szerelem,\nVilágok elmúlhatnak, országok eltűnhetnek, de a nagy Erosz\nKüllőző Vággyal mindennap felhág az élet egén, talányos ereidben vad sejtelemmel ott terem,\nS végzetként űz, hajt új föld és új istenek felé\nEz a legerősebb elem.\nGondolhatsz bármit, árnyéknak nézve élted,\nPiramisok tövén, dómok homályos mélyén,\nÁtokkal és halállal el nem éred.\nÖrök szépséggel, fénnyel jár ő a küzdő\nKatona oldalán, s rothadt tetem\nBűzét egyetlen ujja illatával\nTavasszá oszlathatja széjjel.\nMindent elönthet vak, halálos Éjjel,\nCsak Erosz halhatatlan, testetlen ő,\nSzellem? Vágy? Akarat? vagy tán Erő?\nNevezd el bárminek, eszed szemével úgyse\nLáthatod meg, de forrsz, mint lomha üst,\nHa jön, s lefog őszi erdők alatt,\nS szoknyája úgy lebeg a szélben, mint a füst…',
  },
  {
    id: 'poem-25',
    title: 'Cím nélkül',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828906/poems/cim-nelkul.jpg',
    overlay:
      'Nem tudok írni magának\nhelyettem elmondják a fák\nNem szeretlek csak úgy cicázok\nS este nem gondolok rád.',
  },
  {
    id: 'poem-26',
    title: 'Nofre-tete',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828925/poems/nofretete.jpg',
    overlay:
      'Királynőm, Nofre-tetém\nHiszed-e, hogy lényed piramisát\nbe nem szitálja rút időhomok?\ns örök nyomok\nbeszélik, hogy Te is a földön jártál?\nHiszed-e, hogy nem hervad el a mosolyod?\nhogy múlhatatlanok a szemeid,\ns hogy lelked ibiszmadarának\na szárnyai a végtelenbe vágnak\ntúl a Napon?\n\nAz ember, nézd, halandó lárva,\ns mindenkiben egy pillangó remeg\ns életre vár\nde rövid bábálma alatt vedleni nem tud,\nszomorú létbe zárva,\ncsak ha Ozirisz országa fénylik….\n\nS ha csókolsz, mindig fénylik Nofre-tetém,\naz ő országa közeleg.\nMaga Ozirisz jön elébünk,\ns lecsukja lassan a szemem, szemed,\naztán visz minket túl a Níluson,\ns amíg megyünk,\nmégegyszer hallgatag\na nagy Életszfinksz ránkmered….',
  },
  {
    id: 'poem-27',
    title: 'Vízió',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828935/poems/vizio.jpg',
    overlay:
      'Óra vagyok a tested dómján\nS a tested dómja mállik egyre\nMaholnap ott fekszem a romján.\n\nÓra vagyok a tested dómján\nS éjfélkor bús sohse lesz asszony\nHalk lépése közelít erre\nMegállítni a mutatókat.\n\nJön, jön. Kezét már nyújtja, nyújtja\nSzétzúzni az arcomat készül,\nhanem egyszer csak meginog,\nA falépcsőkön visszaszédül\nS valami lök a mutatókon.',
  },
  {
    id: 'poem-28',
    title: 'Temps perdu',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828933/poems/temps-perdu.jpg',
    overlay:
      'Ha festő volnék, megfesteném a szádat,\nDe előbb kékre-zöldre festeném a vásznat.\nAzután a hajadat szőkének,\nAz arcodat rózsásnak\nA ruhádat pirospettyesnek\nA karodat pelyhespuhának\nMégegyszer megnézném\nÉs az egészet összetépném.\nMert egy kép, bármi gyönyörű\nAz életből csak ellopott bánat.\nAz isten is festő volt.\nGyönyörűen megfestett téged.\nSzép fejet adott néked,Szép alakot, csodásat,\nJó hű szívet is, tüzességet,\nEgészséget, pirospozsgásat,\nÉs mégse jó a kép,\nMért szállnak a felhők\nÉs mért hervadnak el a jegenyék,\nHa nézlek,\nAz Isten is tudja ezt\nÉs összetép\nMeglátod, egyszer összetép.',
  },
  {
    id: 'poem-29',
    title: 'Így csak',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828937/poems/igy-csak.jpg',
    overlay:
      'Ködgyermekek\n\nFiaim, ti csillagmosolyok,\nHolt fények, felhők, álmodások\nMenjetek vissza föl az égbe\nAhol csillog csillaganyátok.\n\nEz a föld nem nektek való\nItt testek vannak, csókok és lázadások,\nhejehuja vér, cifrázott szavak\nAzért halt meg csillaganyátok.\n\nDecember volt, jött, álmodott a tél,\nAnyátok úgy csókolt, mint a tavasz\nÉs elment messze, hű, örök hazába\nS a távolság megölte, a ravasz.\n\nVisszajött még, de bús idegen\nSzemmel nézett rám, mint ki sose volt\nApátokba szerelmes, hidegen\nKihűlten állt meg, mint a téli hold.\n\nAz ujja egy csillagra mutatott,\nSzerelme odaszállt el, mellyel\nEngem szeretett, álmodó apátok,\nÉs elfutott kidülledt mellel.\n\nTüzét és vérét másnak viszi el,\nNekem a csillag marad és az átok,\nFiaim, csillagmosolyok,\nHolt fények, felhők, álmodások,\nMenjetek vissza föl az égbe,\nAhol csillog csillaganyátok.',
  },
  {
    id: 'poem-30',
    title: 'Könny',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828916/poems/konny-1.jpg',
    overlay:
      'Az ember e szomorú virág\nÉppúgy termi a könnyet\nAkár a rózsalevél,\nVagy fű a réten a harmatot.\nha nincs, ki felszárítsa\nBegyűrűznek a könnyek\nLátatlan levelekbe\nÉs ott tovább gyöngyöznek.\n\nHa nincs, ki felszárítsa,\nKicsurrannak a földbe\nMert már olyan sokan vannak\nS ilyenkor egy marék\nFöldet veszünk kezünkbe,\nS mondjuk: Föld, édesanyánk\nMilyen messze az ég.\nHogy nem szakadt reánk.',
  },
  {
    id: 'poem-31',
    title: 'Macbeth',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828922/poems/macbeth.jpg',
    overlay:
      'Machbeth az álmot gyilkolja\n\nA sorsom Lady Machbeth\nRagyogó szemű asszony,\nDe rút és bujtó, s most nem alszom:\nÁlmokat gyilkoltat velem,\nS ha nem teszem meg, megvet.',
  },
  {
    id: 'poem-32',
    title: 'Shakespeare',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828929/poems/shakespeare.jpg',
    overlay:
      'Hogy lelkemben lépked a dán királyfi,\nS Machbeth boszorkányi itt huhognak,\nNeked kellett előbb a földre szállni\nTe óriási hattyúja az Avonnak.\n\nHa Lear király dühöng, Prospero varázst mormol,\nVíg harca tombol szép Titániának,\nTe üzensz egy elmúlt, fenséges korból,\nS tündéreid a homlokomra szállnak.\n\nKi volt nagyobb: Shakespeare vagy az élet?\nHa tenger ez, kimerted a felét már,\nDe nagy korom újból az égig éled\nS tekintetem hullámiból feléd száll.\n\nÍgy állok én, Idő és Törvény felettem:\nVésőm szikrázik a kemény anyagban,\nSzférák zenéje hallik önfeledten,\nS átlépem a vizet, mely zúg alattam.',
  },
  {
    id: 'poem-33',
    title: 'Shakespeare halála',
    image:
      'https://res.cloudinary.com/dgk299isx/image/upload/v1784828928/poems/shakespeare-halala.jpg',
    overlay:
      'Valami nagyszerűt, csodást akartam,\nMert az ifjúság álmokkal teli,\nÉs írtam, írtam szavakba takartan\nMert az álom jogát követeli.\n\nVersenyre kelni akartam Shakespearrel\nStratford of Avon - Új Szentbenedek\nDe megjártam a dicsőséggel, hírrel\nS éveim száma lepereg.\n\nVagyok most is szánalmas ismeretlen\nÜt rajtam minden aljas törtető,\nNincsen nevem, s régóta nem nevettem,\nÉletem felett nincsen még tető.\n\nS akiben mintaképem véltem,\nVégezve dolgát, az is elhagyott,\nÖtvenkét esztendőt - íme - megéltem,\nÉs mégis, mégis sehol sem vagyok.',
  },
  {
    id: 'poem-34',
    title: 'Vigasztalás',
    image: 'https://res.cloudinary.com/dgk299isx/image/upload/v1784828934/poems/vigasztalas.jpg',
    overlay:
      'Már Shakespeare sírján fű nőtt régesrégen,\nÉs Vörösmarty is elszenderült,\nPetőfi, Ady rég megistenült\nE könnyáztatta, véres földi téren….\nMikor már annyi évet láttak, mint te Énem\nÉs bár dicsőség fanfárját nem hallani,\nTúlélted őket, ez is valami….',
  },
];

/**
 * Page metadata derived from the poems, shared by the prerender script and the running
 * app. It has to be one implementation: the prerenderer writes a per-route <title> into
 * the HTML, and the client sets document.title on navigation. When those disagreed, the
 * client's generic title overwrote the prerendered one on mount, so every crawler that
 * executes JavaScript — Googlebot included — saw "Kovács | KÖLTÉSZET" on all 34 poems.
 */

export const SITE_TITLE = 'Kovács | KÖLTÉSZET';
export const SITE_DESCRIPTION = 'Kovács verseinek gyűjteménye.';

/** First ~155 characters of the poem, roughly what a search result displays. */
export function describePoem(poem: Poem): string {
  // Stripped, or a poem broken across pages would advertise a literal `\n` in search results.
  const text = stripPageBreaks(poem.overlay ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return `${poem.title} — vers Kovács gyűjteményéből.`;
  return text.length <= 155 ? text : `${text.slice(0, 152).trimEnd()}…`;
}

/** `path` is the app-relative pathname, e.g. `/poems/poem-2`. */
export function metaForRoute(
  path: string,
  poems: Poem[] = POEMS,
): { title: string; description: string } {
  const clean = path.replace(/\/+$/, '') || '/';
  const poemMatch = clean.match(/^\/poems\/(.+)$/);
  if (poemMatch) {
    const poem = poems.find((p) => p.id === poemMatch[1]);
    if (poem) return { title: `${poem.title} | Kovács`, description: describePoem(poem) };
  }
  if (clean === '/poems') {
    return { title: 'Versek | Kovács', description: 'Kovács összes verse egy helyen.' };
  }
  if (clean === '/contact') {
    return { title: 'Kapcsolat | Kovács', description: 'Írjon üzenetet Kovácsnak.' };
  }
  if (clean === '/privacy') {
    return {
      title: 'Adatkezelés | Kovács',
      description:
        'Milyen adatokat kezel ez az oldal, és mi történik a kapcsolatfelvételi űrlapon küldött üzenettel.',
    };
  }
  if (clean === '/admin') return { title: 'Admin | Kovács', description: '' };
  return { title: SITE_TITLE, description: SITE_DESCRIPTION };
}

/**
 * Page breaks, and the rule tying them to the admin's Custom Slides editor.
 *
 * These live in this file rather than modules of their own, which is not a style choice.
 * `packages/shared` ships raw TypeScript (`main: src/index.ts`) and is loaded three ways that
 * disagree about relative specifiers: `tsc` compiling packages/api rejects a `.ts` extension
 * because it emits, while Node's own type stripping — how the API and the prerenderer load
 * this package at runtime — does no extension guessing and fails without one. There is no
 * spelling of `./pageBreaks` that satisfies both, so the package stays a single module.
 */

export const PAGE_BREAK = '\\n';

/**
 * The overlay split into the pages the author asked for; a poem without markers yields a
 * single page, exactly as before.
 *
 * Blank lines at a seam are dropped, so the marker works both on a line of its own and tacked
 * onto the end of a line — the difference between the two is invisible to whoever is typing,
 * and it should stay that way. Empty sections (a leading, trailing or doubled marker) are
 * discarded rather than becoming blank pages.
 */
export function splitPages(overlay: string): string[] {
  const parts = overlay
    .split(PAGE_BREAK)
    .map((part) =>
      part
        .replace(/^[ \t]*\n+/, '')
        .replace(/\n+[ \t]*$/, '')
        .trim(),
    )
    .filter((part) => part !== '');
  // An overlay of nothing but markers still has to render as something.
  return parts.length > 0 ? parts : [''];
}

/**
 * The overlay as a reader should see it, with the markers removed.
 *
 * Needed everywhere the full text is shown without paging it — the grid cards, the carousel,
 * the meta description, the JSON-LD. Missing one of those is how the marker leaks out as
 * literal text on the live site.
 */
export function stripPageBreaks(overlay: string): string {
  return splitPages(overlay).join('\n');
}

/** Whether the author has placed any break at all. */
export function hasPageBreak(overlay: string): boolean {
  return overlay.includes(PAGE_BREAK);
}

/**
 * Whether the text still carries a mark, or the remains of one.
 *
 * Deleting `\n` takes two keystrokes, and in between the text holds a lone `\`. Nothing
 * splits there — it is not a page break — but it is not "the author has removed the break"
 * either. Anything that reacts to a break disappearing has to wait for this to go false, or
 * it fires one keystroke early, halfway through the deletion.
 */
export function hasPageBreakFragment(overlay: string): boolean {
  return overlay.includes(PAGE_BREAK[0]);
}

/** Just the parts of the admin's edit state this decision depends on. */
export interface OverlayEditState {
  overlay: string;
  customSlidesOpen: boolean;
}

export interface OverlayEditPatch {
  overlay: string;
  customSlides?: string[] | null;
  customSlidesOpen?: boolean;
  customSlidesEnabled?: boolean;
}

/**
 * The edit to apply when the poem text changes.
 *
 * Custom Slides and the page-break marks are two views of one thing, so this keeps them in
 * step:
 *
 * - typing the first mark into a poem that has none opens the slides on it, so the split
 *   shows up the moment it is asked for;
 * - once open, the slides mirror every later edit;
 * - deleting the last mark closes them again, since there is nothing left for them to show;
 * - a poem that has never carried a mark is left alone entirely, because splitPages would
 *   return it as a single page and collapse slides that were authored by hand.
 *
 * Opening and closing both key off a *transition*, never off the current text alone. Opening
 * whenever a mark is merely present would make Custom Slides impossible to close — the next
 * keystroke would reopen it for as long as one mark remained. Closing whenever no mark is
 * present would tear down the slides of every poem that never had one.
 *
 * The two transitions use different tests on purpose. Opening waits for a whole `\n`, since
 * half a mark breaks nothing. Closing waits for the fragment to go too: deleting `\n` takes
 * two keystrokes, and closing on the first would pull the editor out from under an author who
 * is still mid-deletion.
 *
 * Lives beside the mark parser rather than in Admin.tsx: it is the rule connecting marks
 * to slides, and keeping it out of the component is what makes it testable without React.
 */
export function overlayEdit(edit: OverlayEditState, overlay: string): OverlayEditPatch {
  if (edit.customSlidesOpen) {
    if (hasPageBreak(overlay)) return { overlay, customSlides: splitPages(overlay) };
    // Nothing of the mark is left — not even the backslash — and the slides were only ever a
    // view of it. Cleared as well as closed, so a stale split cannot be saved back.
    if (hasPageBreakFragment(edit.overlay) && !hasPageBreakFragment(overlay)) {
      return { overlay, customSlidesOpen: false, customSlidesEnabled: false, customSlides: null };
    }
    return { overlay };
  }
  if (hasPageBreak(overlay) && !hasPageBreak(edit.overlay)) {
    return {
      overlay,
      customSlidesOpen: true,
      customSlidesEnabled: true,
      customSlides: splitPages(overlay),
    };
  }
  return { overlay };
}
