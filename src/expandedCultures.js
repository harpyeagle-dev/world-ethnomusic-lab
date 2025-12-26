export const expandedCulturesData = [
    {
        id: 'west-african',
        name: 'West African',
        emoji: '🌍',
        region: 'West Africa',
        description: 'Rich polyrhythmic traditions featuring djembe, kora, and talking drums. Complex interlocking rhythms and call-and-response patterns.',
        characteristics: {
            rhythm: 'Polyrhythmic, complex cross-rhythms',
            scales: 'Pentatonic and heptatonic scales',
            instruments: 'Djembe, kora, balafon, talking drum',
            tempo: '100-140 BPM typically'
        },
        facts: [
            'The kora is a 21-string bridge-harp used extensively in West African music',
            'Polyrhythms often feature 3:2 or 4:3 ratios',
            'Many rhythms have specific social or ceremonial purposes'
        ],
        audioSample: '/samples/west-african.mp3',
        videoTutorial: 'https://example.com/west-african-tutorial'
    },
    {
        id: 'indian-classical',
        name: 'Indian Classical',
        emoji: '🇮🇳',
        region: 'South Asia',
        description: 'Ancient tradition built on ragas (melodic frameworks) and talas (rhythmic cycles). Features sitar, tabla, and sophisticated improvisation.',
        characteristics: {
            rhythm: 'Cyclic patterns (talas) from 3 to 16+ beats',
            scales: 'Ragas with specific melodic rules and moods',
            instruments: 'Sitar, tabla, tanpura, sarod, bansuri',
            tempo: 'Variable, from very slow (vilambit) to very fast (drut)'
        },
        facts: [
            'There are over 300 ragas, each associated with specific times and seasons',
            'The tabla consists of two drums played with complex finger techniques',
            'Indian classical music has a continuous tradition spanning over 2,000 years'
        ],
        audioSample: '/samples/indian-classical.mp3',
        videoTutorial: 'https://example.com/indian-classical-tutorial'
    },
    {
        id: 'chinese-traditional',
        name: 'Chinese Traditional',
        emoji: '🇨🇳',
        region: 'East Asia',
        description: 'Ancient musical tradition featuring pentatonic scales, silk and bamboo instruments, and philosophical connections to nature.',
        characteristics: {
            rhythm: 'Free-flowing, often following natural speech patterns',
            scales: 'Primarily pentatonic (5-note scales)',
            instruments: 'Guzheng, erhu, pipa, dizi, sheng',
            tempo: 'Variable, often slow and meditative'
        },
        facts: [
            'The guzheng is a 21-string zither with over 2,500 years of history',
            'Chinese music theory is deeply connected to philosophical concepts',
            'The pentatonic scale is considered to represent the five elements'
        ],
        audioSample: '/samples/chinese-traditional.mp3',
        videoTutorial: 'https://example.com/chinese-traditional-tutorial'
    },
    {
        id: 'middle-eastern',
        name: 'Middle Eastern',
        emoji: '🏜️',
        region: 'Middle East',
        description: 'Sophisticated modal system (maqamat) with microtonal intervals, featuring oud, qanun, and complex ornamental melodies.',
        characteristics: {
            rhythm: 'Complex meters including 7/8, 9/8, 10/8',
            scales: 'Maqamat with quarter-tone intervals',
            instruments: 'Oud, qanun, ney, darbuka, riq',
            tempo: 'Variable, from slow taqsim to fast samai'
        },
        facts: [
            'The maqam system includes over 70 different modal scales',
            'Quarter tones create intervals between Western semitones',
            'The oud is considered the ancestor of the European lute'
        ],
        audioSample: '/samples/middle-eastern.mp3',
        videoTutorial: 'https://example.com/middle-eastern-tutorial'
    },
    {
        id: 'latin-american',
        name: 'Latin American',
        emoji: '🎺',
        region: 'Latin America',
        description: 'Vibrant fusion of Indigenous, African, and European traditions featuring complex syncopation, brass, and percussion.',
        characteristics: {
            rhythm: 'Syncopated patterns, clave rhythms',
            scales: 'Major, minor, and modal scales',
            instruments: 'Congas, timbales, brass, guitar, charango',
            tempo: '120-180 BPM typically'
        },
        facts: [
            'The clave pattern is the rhythmic foundation of many Latin styles',
            'Salsa music typically uses a 3-2 or 2-3 son clave pattern',
            'Latin music blends African rhythms with European harmony'
        ],
        audioSample: '/samples/latin-american.mp3',
        videoTutorial: 'https://example.com/latin-american-tutorial'
    },
    {
        id: 'aboriginal-australian',
        name: 'Aboriginal Australian',
        emoji: '🦘',
        region: 'Australia',
        description: 'One of the world\'s oldest musical traditions featuring the didgeridoo, clapsticks, and connection to Dreamtime stories.',
        characteristics: {
            rhythm: 'Steady pulse with complex variations',
            scales: 'Often based on overtone series',
            instruments: 'Didgeridoo (yidaki), clapsticks, bullroarer',
            tempo: '60-100 BPM typically'
        },
        facts: [
            'The didgeridoo is one of the oldest wind instruments, over 1,500 years old',
            'Circular breathing allows continuous drone sounds',
            'Aboriginal music is deeply connected to oral history and law'
        ],
        audioSample: '/samples/aboriginal-australian.mp3',
        videoTutorial: 'https://example.com/aboriginal-australian-tutorial'
    },
    {
        id: 'european-folk',
        name: 'European Folk',
        emoji: '🎻',
        region: 'Europe',
        description: 'Diverse regional traditions featuring modal melodies, dance rhythms, and instruments like fiddle, accordion, and bagpipes.',
        characteristics: {
            rhythm: 'Dance rhythms (waltz, jig, reel, polka)',
            scales: 'Modal scales and major/minor tonality',
            instruments: 'Fiddle, accordion, bagpipes, hurdy-gurdy',
            tempo: 'Variable by dance type, 80-200 BPM'
        },
        facts: [
            'Irish reels are typically played at around 110-120 BPM',
            'Many folk traditions use modal scales like Dorian and Mixolydian',
            'The hurdy-gurdy produces a continuous drone with a rotating wheel'
        ],
        audioSample: '/samples/european-folk.mp3',
        videoTutorial: 'https://example.com/european-folk-tutorial'
    },
    {
        id: 'japanese-traditional',
        name: 'Japanese Traditional',
        emoji: '🎌',
        region: 'East Asia',
        description: 'Refined aesthetic featuring ma (silence/space), pentatonic scales, and instruments like shakuhachi, koto, and shamisen.',
        characteristics: {
            rhythm: 'Flexible, emphasizing space and silence (ma)',
            scales: 'Pentatonic and specific traditional modes',
            instruments: 'Shakuhachi, koto, shamisen, taiko',
            tempo: 'Often slow and contemplative'
        },
        facts: [
            'Ma (間) - the concept of negative space - is as important as sound',
            'The shakuhachi bamboo flute was used by Zen monks for meditation',
            'Taiko drumming has both religious and theatrical purposes'
        ],
        audioSample: '/samples/japanese-traditional.mp3',
        videoTutorial: 'https://example.com/japanese-traditional-tutorial'
    },
    {
        id: 'mongolian-throat-singing',
        name: 'Mongolian Throat Singing',
        emoji: '🇲🇳',
        region: 'Central Asia',
        description: 'Unique vocal technique producing multiple pitches simultaneously, imitating sounds of nature and animals.',
        characteristics: {
            rhythm: 'Free and flowing, often following natural patterns',
            scales: 'Based on overtone series',
            instruments: 'Voice, morin khuur (horsehead fiddle), tovshuur',
            tempo: 'Slow and meditative'
        },
        facts: [
            'Khöömei singers can produce up to 4 simultaneous pitches',
            'Different styles imitate eagles, horses, and flowing water',
            'UNESCO Intangible Cultural Heritage since 2010'
        ],
        audioSample: '/samples/mongolian-throat-singing.mp3',
        videoTutorial: 'https://example.com/mongolian-tutorial'
    },
    {
        id: 'indonesian-gamelan',
        name: 'Indonesian Gamelan',
        emoji: '🇮🇩',
        region: 'Southeast Asia',
        description: 'Ensemble of bronze metallophones, gongs, and drums creating shimmering, interlocking textures.',
        characteristics: {
            rhythm: 'Interlocking patterns (kotekan), cyclical structures',
            scales: 'Slendro (5-tone) and Pelog (7-tone) scales',
            instruments: 'Metallophones, gongs, kendang, suling, rebab',
            tempo: '60-120 BPM, varies by piece'
        },
        facts: [
            'Each gamelan set is tuned uniquely and considered sacred',
            'Players must remove shoes before playing out of respect',
            'Gamelan music often accompanies shadow puppet theater'
        ],
        audioSample: '/samples/indonesian-gamelan.mp3',
        videoTutorial: 'https://example.com/gamelan-tutorial'
    },
    {
        id: 'flamenco',
        name: 'Flamenco',
        emoji: '💃',
        region: 'Spain',
        description: 'Passionate Andalusian art form combining guitar, singing, dance, and hand-clapping with complex rhythms.',
        characteristics: {
            rhythm: 'Complex compás patterns in 12, 4, or 3 beats',
            scales: 'Phrygian mode (por arriba), various flamenco modes',
            instruments: 'Flamenco guitar, cajón, palmas (hand claps), castanets',
            tempo: '80-200 BPM depending on palo (style)'
        },
        facts: [
            'Over 50 different palos (flamenco styles) exist',
            'The 12-beat bulería is one of the most complex rhythms',
            'UNESCO recognized flamenco as World Heritage in 2010'
        ],
        audioSample: '/samples/flamenco.mp3',
        videoTutorial: 'https://example.com/flamenco-tutorial'
    },
    {
        id: 'andean',
        name: 'Andean Music',
        emoji: '🏔️',
        region: 'South America',
        description: 'Indigenous music of the Andes featuring panpipes, flutes, and charango with haunting melodies.',
        characteristics: {
            rhythm: 'Huayno rhythms, often in 2/4 or 6/8',
            scales: 'Pentatonic scales, often minor',
            instruments: 'Quena, zampoña (panpipes), charango, bombo',
            tempo: '100-140 BPM typically'
        },
        facts: [
            'The charango is made from armadillo shell traditionally',
            'Panpipes are played in interlocking hocket technique',
            'Music often reflects high-altitude landscapes and spirituality'
        ],
        audioSample: '/samples/andean.mp3',
        videoTutorial: 'https://example.com/andean-tutorial'
    },
    {
        id: 'bluegrass',
        name: 'Bluegrass',
        emoji: '🪕',
        region: 'North America',
        description: 'American roots music featuring banjo, fiddle, and mandolin with fast picking and vocal harmonies.',
        characteristics: {
            rhythm: 'Fast 2/4 or 4/4, syncopated rolls',
            scales: 'Major, minor, and blues scales',
            instruments: 'Banjo, fiddle, mandolin, guitar, upright bass',
            tempo: '120-180 BPM typically'
        },
        facts: [
            'Bill Monroe is considered the "Father of Bluegrass"',
            'Three-finger banjo picking creates the signature "roll"',
            'Vocal harmonies often feature "high lonesome sound"'
        ],
        audioSample: '/samples/bluegrass.mp3',
        videoTutorial: 'https://example.com/bluegrass-tutorial'
    },
    {
        id: 'brazilian-samba',
        name: 'Brazilian Samba',
        emoji: '🇧🇷',
        region: 'South America',
        description: 'Afro-Brazilian rhythmic tradition featuring syncopated percussion and dance-oriented grooves.',
        characteristics: {
            rhythm: 'Syncopated 2/4, partido-alto patterns',
            scales: 'Major and minor with chromatic passing tones',
            instruments: 'Surdo, tamborim, cuíca, pandeiro, cavaquinho',
            tempo: '180-200 BPM for parade samba'
        },
        facts: [
            'Rio Carnival features thousands of samba drummers',
            'The surdo bass drum holds the fundamental beat',
            'Samba schools compete annually in elaborate parades'
        ],
        audioSample: '/samples/brazilian-samba.mp3',
        videoTutorial: 'https://example.com/samba-tutorial'
    },
    {
        id: 'caribbean-steel-pan',
        name: 'Caribbean Steel Pan',
        emoji: '🏝️',
        region: 'Caribbean',
        description: 'Innovative percussion instruments made from oil drums, creating melodic and harmonic music.',
        characteristics: {
            rhythm: 'Calypso, soca rhythms in 4/4',
            scales: 'Major and minor scales, full chromatic range',
            instruments: 'Steel pans (tenor, double seconds, bass)',
            tempo: '120-140 BPM typically'
        },
        facts: [
            'Steel pans were invented in Trinidad in the 1930s',
            'Each pan is hand-tuned with incredible precision',
            'Pan ensembles can have 100+ musicians'
        ],
        audioSample: '/samples/caribbean-steel-pan.mp3',
        videoTutorial: 'https://example.com/steel-pan-tutorial'
    },
    {
        id: 'korean-traditional',
        name: 'Korean Traditional',
        emoji: '🇰🇷',
        region: 'East Asia',
        description: 'Ancient court and folk music featuring flexible rhythms, ornamentation, and unique vocal techniques.',
        characteristics: {
            rhythm: 'Jangdan patterns, often in 12/8 or 6/8',
            scales: 'Pentatonic modes, microtonal ornaments',
            instruments: 'Gayageum, daegeum, janggu, haegeum',
            tempo: 'Variable, from very slow to fast'
        },
        facts: [
            'Pansori epic singing can last up to 8 hours',
            'The gayageum has 12 silk strings',
            'Sinawi improvisation allows creative freedom within tradition'
        ],
        audioSample: '/samples/korean-traditional.mp3',
        videoTutorial: 'https://example.com/korean-tutorial'
    },
    {
        id: 'venezuelan-joropo',
        name: 'Venezuelan Joropo',
        emoji: '🇻🇪',
        region: 'Venezuela',
        description: 'Venezuela\'s national music and dance, featuring harp, cuatro (4-string guitar), and maracas with fast-paced rhythms and African, Indigenous, and Spanish influences.',
        characteristics: {
            rhythm: '3/4 or 6/8 time signatures with syncopated patterns',
            scales: 'Major and minor scales with Spanish modal influences',
            instruments: 'Arpa llanera (harp), cuatro, maracas, bandola',
            tempo: '120-180 BPM, energetic and fast-paced'
        },
        facts: [
            'The joropo is both a music style and a partnered dance from the Venezuelan plains (llanos)',
            'The cuatro is a small 4-string guitar that provides rhythmic drive',
            'The harp in joropo music can have up to 32 or 36 strings',
            'Joropo rhythms combine Spanish waltz with African syncopation'
        ],
        audioSample: '/samples/venezuelan-joropo.mp3',
        videoTutorial: 'https://example.com/joropo-tutorial'
    },
    {
        id: 'caribbean-rhythms',
        name: 'Caribbean Rhythms',
        emoji: '🏝️',
        region: 'Caribbean Islands',
        description: 'Diverse rhythmic traditions including calypso, reggae, son, merengue, and zouk - blending African, European, and Indigenous influences across island nations.',
        characteristics: {
            rhythm: 'Syncopated, offbeat emphasis (ska, reggae), clave patterns (salsa, son)',
            scales: 'Major, minor, and modal scales with blue notes',
            instruments: 'Steelpan, bongos, congas, tres, bass guitar, horns',
            tempo: '60-180 BPM depending on style (reggae slow, merengue fast)'
        },
        facts: [
            'Reggae\'s "one drop" rhythm places emphasis on the third beat',
            'Calypso originated in Trinidad and Tobago as social commentary',
            'Cuban son is the foundation for salsa, mambo, and cha-cha-chá',
            'Merengue from Dominican Republic uses a distinctive "limping" 2/4 rhythm',
            'Zouk from the French Antilles combines Caribbean and African rhythms'
        ],
        audioSample: '/samples/caribbean-rhythms.mp3',
        videoTutorial: 'https://example.com/caribbean-tutorial'
    },
    {
        id: 'guyana',
        name: 'Guyanese',
        emoji: '🇬🇾',
        region: 'South America/Caribbean',
        description: 'Vibrant multicultural fusion blending Indo-Caribbean chutney, Afro-Guyanese rhythms, and Indigenous traditions featuring tassa drums, steel pan, and calypso influences.',
        characteristics: {
            rhythm: 'Syncopated chutney patterns, tassa drumming cycles, calypso beats',
            scales: 'Major/minor with Indian modal influences and Caribbean melodic patterns',
            instruments: 'Tassa drums, dholak, djembe, sambura, steel pan, dhantal, harmonium, cuatro',
            tempo: '120-180 BPM for chutney, variable for traditional styles'
        },
        genres: ['Chutney', 'Chutney Soca', 'Calypso', 'Reggae', 'Soca', 'Indigenous traditional (Parishara, Mari-Mari, Mari, Banchikilli)', 'Guyanese Folk', 'Shanto', 'Lopee', 'CaliMari', 'Afai'],
        facts: [
            'Chutney music blends Indian film music with Caribbean soca rhythms',
            'Tassa drumming, brought by Indian indentured laborers, is integral to Hindu and Muslim celebrations',
            'Mashramani music celebrates Guyana\'s Republic Day with elaborate street festivals'
        ],
        audioSample: '/samples/guyana.mp3',
        videoTutorial: 'https://example.com/guyana-tutorial'
    }
];

export function getAllExpandedCultures() {
    return expandedCulturesData;
}

export function getCultureById(id) {
    return expandedCulturesData.find(culture => culture.id === id);
}
