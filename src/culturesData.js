export const culturesData = [
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
    }
];

export function getCultureById(id) {
    return culturesData.find(culture => culture.id === id);
}

export function getAllCultures() {
    return culturesData;
}

export function getRandomCulture() {
    return culturesData[Math.floor(Math.random() * culturesData.length)];
}

/**
 * Compare audio features to cultural characteristics
 * @param {Object} analysisResults - Results from audio analysis
 * @returns {Array} Matching cultures with similarity scores
 */
export function matchCulture(analysisResults) {
    const matches = [];
    
    culturesData.forEach(culture => {
        let score = 0;
        let matchedFeatures = [];
        
        // ========== RHYTHM ANALYSIS ==========
        if (analysisResults.rhythm) {
            const tempo = analysisResults.rhythm.tempo;
            const regularity = analysisResults.rhythm.regularity;
            const peakCount = analysisResults.rhythm.peakCount;
            
            // Tempo matching with ranges
            const tempoMatches = {
                'west-african': { range: [100, 140], weight: 2.5, name: 'Polyrhythmic Foundation' },
                'latin-american': { range: [120, 180], weight: 2.5, name: 'Latin Energy' },
                'brazilian-samba': { range: [150, 200], weight: 2.5, name: 'Samba Pace' },
                'caribbean-rhythms': { range: [100, 180], weight: 2, name: 'Island Syncopation' },
                'venezuelan-joropo': { range: [120, 180], weight: 2.5, name: 'Joropo Vitality' },
                'indian-classical': { range: [60, 120], weight: 1.5, name: 'Raga Flow' },
                'japanese-traditional': { range: [40, 100], weight: 2, name: 'Meditative Pace' },
                'chinese-traditional': { range: [50, 90], weight: 2, name: 'Contemplative Tempo' },
                'aboriginal-australian': { range: [70, 120], weight: 1.5, name: 'Didgeridoo Rhythm' },
                'middle-eastern': { range: [80, 140], weight: 2, name: 'Maqam Pulse' }
            };
            
            for (const [cultureId, tempoData] of Object.entries(tempoMatches)) {
                if (culture.id === cultureId) {
                    if (tempo >= tempoData.range[0] && tempo <= tempoData.range[1]) {
                        score += tempoData.weight;
                        matchedFeatures.push(tempoData.name);
                    }
                }
            }
            
            // Regularity analysis
            if (regularity > 0.8) {
                if (['indian-classical', 'middle-eastern', 'european-folk'].includes(culture.id)) {
                    score += 1.5;
                    matchedFeatures.push('Regular Pulse');
                }
            } else if (regularity < 0.6) {
                if (['west-african', 'japanese-traditional', 'aboriginal-australian'].includes(culture.id)) {
                    score += 1.5;
                    matchedFeatures.push('Complex Polyrhythm');
                }
            }
            
            // Onset complexity
            if (peakCount > 30) {
                if (['west-african', 'brazilian-samba', 'caribbean-rhythms'].includes(culture.id)) {
                    score += 1;
                    matchedFeatures.push('Dense Beat Structure');
                }
            }
        }
        
        // ========== SCALE & MELODIC ANALYSIS ==========
        if (analysisResults.scale) {
            const scaleName = analysisResults.scale.scale;
            
            // Pentatonic scales
            if (scaleName.includes('Pentatonic')) {
                const pentatonicCultures = {
                    'chinese-traditional': 2.5,
                    'japanese-traditional': 2.5,
                    'west-african': 2,
                    'aboriginal-australian': 2,
                    'korean-traditional': 2.5
                };
                if (pentatonicCultures[culture.id]) {
                    score += pentatonicCultures[culture.id];
                    matchedFeatures.push('Pentatonic Scale');
                }
            }
            
            // Major/Minor scales
            if (scaleName.includes('Major') || scaleName.includes('Minor')) {
                const majorMinorCultures = {
                    'european-folk': 2.5,
                    'latin-american': 2,
                    'bluegrass': 2.5,
                    'flamenco': 1.5,
                    'caribbean-rhythms': 1.5
                };
                if (majorMinorCultures[culture.id]) {
                    score += majorMinorCultures[culture.id];
                    matchedFeatures.push('Major/Minor Tonality');
                }
            }
            
            // Modal scales (Maqam-like)
            if (scaleName.includes('Modal') || scaleName.toLowerCase().includes('maqam')) {
                if (['middle-eastern', 'flamenco'].includes(culture.id)) {
                    score += 2.5;
                    matchedFeatures.push('Modal System');
                }
            }
        }
        
        // ========== SPECTRAL/TIMBRE ANALYSIS ==========
        if (analysisResults.spectral) {
            const brightness = analysisResults.spectral.brightness;
            const centroid = analysisResults.spectral.centroid;
            
            // Bright timbres (high-frequency dominant)
            if (brightness > 0.65) {
                const brightCultures = {
                    'caribbean-steel-pan': 2.5,
                    'latin-american': 1.5,
                    'west-african': 1.5,
                    'bluegrass': 1.5
                };
                if (brightCultures[culture.id]) {
                    score += brightCultures[culture.id];
                    matchedFeatures.push('Bright Timbre');
                }
            }
            
            // Mid-range brightness (balanced)
            if (brightness >= 0.4 && brightness <= 0.65) {
                const balancedCultures = {
                    'indian-classical': 1.5,
                    'middle-eastern': 1.5,
                    'flamenco': 1.5,
                    'korean-traditional': 1
                };
                if (balancedCultures[culture.id]) {
                    score += balancedCultures[culture.id];
                    matchedFeatures.push('Balanced Tonal Character');
                }
            }
            
            // Dark/mellow timbres (low-frequency dominant)
            if (brightness < 0.4) {
                const darkCultures = {
                    'japanese-traditional': 2,
                    'chinese-traditional': 2,
                    'aboriginal-australian': 2,
                    'andean': 1.5
                };
                if (darkCultures[culture.id]) {
                    score += darkCultures[culture.id];
                    matchedFeatures.push('Warm, Dark Timbre');
                }
            }
        }
        
        // Add base score for cultural diversity (prevent all zeros)
        if (score === 0) {
            score = 0.1;
        }
        
        matches.push({
            culture: culture,
            score: score,
            confidence: Math.min(score / 9, 1), // Normalize to 0-1
            matchedFeatures: matchedFeatures
        });
    });
    
    // Sort by confidence (descending)
    return matches.sort((a, b) => b.score - a.score);
}
