export class RealTimePitchDetector {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.analyser = null;
        this.microphone = null;
        this.isActive = false;
        this.bufferLength = 2048;
        this.dataArray = new Float32Array(this.bufferLength);
    }

    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferLength;
            
            this.microphone.connect(this.analyser);
            this.isActive = true;
            return true;
        } catch (error) {
            console.error('Microphone access denied:', error);
            return false;
        }
    }

    stop() {
        if (this.microphone && this.microphone.mediaStream) {
            this.microphone.mediaStream.getTracks().forEach(track => track.stop());
        }
        this.isActive = false;
    }

    getPitch() {
        if (!this.isActive || !this.analyser) return null;
        
        this.analyser.getFloatTimeDomainData(this.dataArray);
        
        // Autocorrelation pitch detection
        const pitch = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);
        return pitch;
    }

    autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let best_offset = -1;
        let best_correlation = 0;
        let rms = 0;
        
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        
        if (rms < 0.01) return -1;
        
        let lastCorrelation = 1;
        for (let offset = 1; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);
            
            if (correlation > 0.9 && correlation > lastCorrelation) {
                if (correlation > best_correlation) {
                    best_correlation = correlation;
                    best_offset = offset;
                }
            }
            lastCorrelation = correlation;
        }
        
        if (best_correlation > 0.01 && best_offset !== -1) {
            return sampleRate / best_offset;
        }
        return -1;
    }

    getVolume() {
        if (!this.isActive || !this.analyser) return 0;
        
        this.analyser.getFloatTimeDomainData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            sum += this.dataArray[i] * this.dataArray[i];
        }
        return Math.sqrt(sum / this.bufferLength);
    }
}

export class Visualizer3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.spectrogramData = [];
        this.maxHistory = 200;
    }

    drawSpectrogram(frequencyData) {
        // Shift existing data
        this.spectrogramData.push([...frequencyData]);
        if (this.spectrogramData.length > this.maxHistory) {
            this.spectrogramData.shift();
        }

        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        const sliceWidth = this.width / this.spectrogramData.length;
        const barHeight = this.height / frequencyData.length;

        this.spectrogramData.forEach((slice, x) => {
            slice.forEach((value, y) => {
                const intensity = value / 255;
                const hue = (1 - intensity) * 240; // Blue to red
                this.ctx.fillStyle = `hsl(${hue}, 100%, ${intensity * 50}%)`;
                this.ctx.fillRect(
                    x * sliceWidth,
                    this.height - (y * barHeight),
                    sliceWidth + 1,
                    barHeight + 1
                );
            });
        });
    }

    drawPitchContour(pitchHistory) {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (pitchHistory.length < 2) return;

        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();

        const sliceWidth = this.width / pitchHistory.length;
        const minPitch = Math.min(...pitchHistory.filter(p => p > 0));
        const maxPitch = Math.max(...pitchHistory.filter(p => p > 0));
        const range = maxPitch - minPitch || 100;

        pitchHistory.forEach((pitch, i) => {
            if (pitch > 0) {
                const x = i * sliceWidth;
                const y = this.height - ((pitch - minPitch) / range) * this.height;
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        });

        this.ctx.stroke();
    }

    drawRhythmCircle(beats, currentBeat) {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) / 3;

        // Draw circle
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw beats
        beats.forEach((beat, i) => {
            const angle = (i / beats.length) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            this.ctx.fillStyle = i === currentBeat ? '#00ff00' : (beat ? '#fff' : '#333');
            this.ctx.beginPath();
            this.ctx.arc(x, y, 10, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
}

export class ProgressTracker {
    constructor() {
        this.achievements = [];
        this.scores = {};
        this.level = 1;
        this.xp = 0;
    }

    loadProgress() {
        const saved = localStorage.getItem('ethnomusicology_progress');
        if (saved) {
            const data = JSON.parse(saved);
            this.achievements = data.achievements || [];
            this.scores = data.scores || {};
            this.level = data.level || 1;
            this.xp = data.xp || 0;
        }
    }

    saveProgress() {
        localStorage.setItem('ethnomusicology_progress', JSON.stringify({
            achievements: this.achievements,
            scores: this.scores,
            level: this.level,
            xp: this.xp
        }));
    }

    addAchievement(achievement) {
        if (!this.achievements.includes(achievement)) {
            this.achievements.push(achievement);
            this.addXP(50);
            this.saveProgress();
            return true;
        }
        return false;
    }

    addXP(points) {
        this.xp += points;
        const xpForNextLevel = this.level * 100;
        if (this.xp >= xpForNextLevel) {
            this.level++;
            this.xp -= xpForNextLevel;
        }
        this.saveProgress();
    }

    recordScore(gameType, score) {
        if (!this.scores[gameType] || score > this.scores[gameType]) {
            this.scores[gameType] = score;
            this.addXP(10);
            this.saveProgress();
        }
    }

    getAchievements() {
        return this.achievements;
    }

    getBadges() {
        const badges = [];
        if (this.achievements.length >= 5) badges.push({ name: 'Explorer', icon: '🌍' });
        if (this.achievements.length >= 10) badges.push({ name: 'Scholar', icon: '📚' });
        if (this.level >= 5) badges.push({ name: 'Apprentice', icon: '🎵' });
        if (this.level >= 10) badges.push({ name: 'Master', icon: '🎼' });
        if (this.scores.rhythm >= 80) badges.push({ name: 'Rhythm Pro', icon: '🥁' });
        if (this.scores.quiz >= 90) badges.push({ name: 'Quiz Champion', icon: '🏆' });
        return badges;
    }
}

export const musicalGlossary = {
    'Rhythm': 'The pattern of sounds and silences in time',
    'Pitch': 'How high or low a sound is',
    'Timbre': 'The quality or color of a sound that distinguishes different instruments',
    'Tempo': 'The speed of the music, measured in beats per minute (BPM)',
    'Scale': 'A sequence of notes in ascending or descending order',
    'Pentatonic': 'A musical scale with five notes per octave',
    'Polyrhythm': 'The simultaneous use of two or more conflicting rhythms',
    'Raga': 'A melodic framework for improvisation in Indian classical music',
    'Maqam': 'A system of melodic modes used in traditional Arabic music',
    'Tala': 'Rhythmic cycles in Indian classical music',
    'Octave': 'The interval between one musical pitch and another with double its frequency',
    'Harmony': 'The combination of simultaneously sounded musical notes',
    'Melody': 'A sequence of single notes that is musically satisfying',
    'Syncopation': 'A disturbance or interruption of the regular flow of rhythm',
    'Drone': 'A sustained note or chord',
    'Improvisation': 'Creating music spontaneously while performing',
    'Ornament': 'A musical embellishment or decoration',
    'Modal': 'Music based on modes rather than major/minor scales',
    'Microtone': 'An interval smaller than a semitone',
    'Overtone': 'Higher frequencies that sound along with the fundamental pitch'
};

// World Map Initialization
export function initializeWorldMap() {
    const mapContainer = document.getElementById('world-map');
    if (!mapContainer) return null;

    try {
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.warn('Leaflet library not loaded');
            return null;
        }

        // Initialize map centered on Africa (center of world music diversity)
        const map = L.map('world-map').setView([0, 20], 3);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // World music culture locations with comprehensive data
        const musicCultures = [
            // Africa
            { lat: 0, lng: 32, name: 'Uganda', culture: 'East African Music', color: '#FF6B6B' },
            { lat: -25, lng: 25, name: 'South Africa', culture: 'Mbaqanga & Kwaito', color: '#FF6B6B' },
            { lat: 8, lng: -15, name: 'West Africa', culture: 'Griots & Djembe', color: '#FF6B6B' },
            { lat: 0, lng: 15, name: 'Congo', culture: 'Rumba & Soukous', color: '#FF6B6B' },
            
            // Middle East & Central Asia
            { lat: 33, lng: 44, name: 'Iraq', culture: 'Maqam Music', color: '#FFA500' },
            { lat: 35, lng: 69, name: 'Afghanistan', culture: 'Dari Music', color: '#FFA500' },
            { lat: 41, lng: 74, name: 'Tajikistan', culture: 'Central Asian Music', color: '#FFA500' },
            
            // South Asia
            { lat: 20, lng: 77, name: 'India', culture: 'Classical Raga', color: '#FFD700' },
            { lat: 27, lng: 85, name: 'Nepal', culture: 'Nepali Folk', color: '#FFD700' },
            { lat: 6, lng: 81, name: 'Sri Lanka', culture: 'Sinhala Tradition', color: '#FFD700' },
            
            // Southeast Asia
            { lat: 13, lng: 104, name: 'Cambodia', culture: 'Khmer Classical', color: '#90EE90' },
            { lat: 16, lng: 100, name: 'Thailand', culture: 'Gamelan & Piphat', color: '#90EE90' },
            { lat: -8, lng: 113, name: 'Indonesia', culture: 'Gamelan & Wayang', color: '#90EE90' },
            
            // East Asia
            { lat: 35, lng: 139, name: 'Japan', culture: 'Gagaku & Shamisen', color: '#87CEEB' },
            { lat: 39, lng: 116, name: 'China', culture: 'Traditional Pipa', color: '#87CEEB' },
            { lat: 37, lng: 127, name: 'Korea', culture: 'Pansori & Gayageum', color: '#87CEEB' },
            
            // Europe
            { lat: 51, lng: -0.1, name: 'UK', culture: 'Celtic & Folk', color: '#DDA0DD' },
            { lat: 48, lng: 2, name: 'France', culture: 'Breton Music', color: '#DDA0DD' },
            { lat: 52, lng: 13, name: 'Germany', culture: 'Traditional Folk', color: '#DDA0DD' },
            { lat: 41, lng: 12, name: 'Italy', culture: 'Tarantella & Opera', color: '#DDA0DD' },
            { lat: 40, lng: 21, name: 'Greece', culture: 'Rebetiko & Rembetiki', color: '#DDA0DD' },
            
            // Americas
            { lat: 40, lng: -74, name: 'USA', culture: 'Blues & Jazz', color: '#FF1493' },
            { lat: 19, lng: -87, name: 'Caribbean', culture: 'Reggae & Calypso', color: '#FF1493' },
            { lat: -34, lng: -58, name: 'Argentina', culture: 'Tango', color: '#FF1493' },
            { lat: -23, lng: -43, name: 'Brazil', culture: 'Samba & Bossa Nova', color: '#FF1493' },
            { lat: 10, lng: -75, name: 'Colombia', culture: 'Cumbia & Vallenato', color: '#FF1493' },
            
            // Oceania
            { lat: -25, lng: 133, name: 'Australia', culture: 'Aboriginal Didgeridoo', color: '#20B2AA' },
            { lat: -17, lng: 168, name: 'Vanuatu', culture: 'Oceanic Traditions', color: '#20B2AA' }
        ];

        // Add markers for each culture
        musicCultures.forEach(marker => {
            const popupContent = `
                <div style="font-weight: bold;">${marker.name}</div>
                <div style="font-size: 0.9em; color: #666;">${marker.culture}</div>
            `;
            
            L.circleMarker([marker.lat, marker.lng], {
                radius: 7,
                fillColor: marker.color,
                color: '#333',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            })
            .bindPopup(popupContent)
            .addTo(map);
        });

        // Add legend
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'info legend');
            div.style.backgroundColor = 'white';
            div.style.padding = '10px';
            div.style.borderRadius = '5px';
            div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
            
            const regions = [
                { color: '#FF6B6B', label: 'Africa' },
                { color: '#FFA500', label: 'Middle East/Central Asia' },
                { color: '#FFD700', label: 'South Asia' },
                { color: '#90EE90', label: 'Southeast Asia' },
                { color: '#87CEEB', label: 'East Asia' },
                { color: '#DDA0DD', label: 'Europe' },
                { color: '#FF1493', label: 'Americas' },
                { color: '#20B2AA', label: 'Oceania' }
            ];
            
            regions.forEach(region => {
                div.innerHTML += `<div style="margin: 5px 0;"><span style="display:inline-block; width:15px; height:15px; background-color:${region.color}; border-radius:50%; margin-right:8px;"></span>${region.label}</div>`;
            });
            
            return div;
        };
        legend.addTo(map);

        // Handle map resize when tab becomes visible
        window.__WORLD_MAP = map;
        return map;
    } catch (e) {
        console.error('Error initializing map:', e);
        mapContainer.innerHTML = '<p style="padding:14px;background:#ffebee;border-left:4px solid #f44336;border-radius:8px;color:#b71c1c;">Map failed to load: ' + e.message + '</p>';
        return null;
    }
}

// Music Glossary Display Function
export function displayGlossary() {
    const glossaryContainers = document.querySelectorAll('[id^="glossary-content-"]');
    
    glossaryContainers.forEach(container => {
        if (!container) return;
        
        container.innerHTML = '';
        container.className = 'glossary-grid';
        
        Object.entries(musicalGlossary).forEach(([term, definition]) => {
            const item = document.createElement('div');
            item.className = 'glossary-item';
            item.innerHTML = `
                <div class="glossary-term">${term}</div>
                <div class="glossary-definition">${definition}</div>
            `;
            container.appendChild(item);
        });
    });
    
    console.log('Musical glossary displayed');
}

// Make functions globally available
window.initializeWorldMap = initializeWorldMap;
window.displayGlossary = displayGlossary;
