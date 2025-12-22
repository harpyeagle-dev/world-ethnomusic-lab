export class MusicComposer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sequence = [];
        this.isPlaying = false;
        this.activeNodes = [];
        this._cleanupTimers = [];
    }

    addNote(note, duration, time) {
        this.sequence.push({ note, duration, time });
    }

    clearSequence() {
        this.sequence = [];
    }

    async playSequence() {
        try {
            if (this.isPlaying) return;
            if (!this.sequence || this.sequence.length === 0) {
                console.warn('Composer: no notes to play.');
                return;
            }

            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                } catch (e) {
                    console.error('Composer: failed to resume AudioContext', e);
                }
            }

            this.isPlaying = true;
            const startTime = this.audioContext.currentTime;

            this.sequence.forEach(({ note, duration, time }) => {
                this.playTone(note, startTime + time, duration);
            });

            const totalDuration = Math.max(0, ...this.sequence.map(s => (s.time || 0) + (s.duration || 0)));
            const t = setTimeout(() => {
                this.isPlaying = false;
                this._cleanupAllNodes();
            }, Math.ceil(totalDuration * 1000) + 20);
            this._cleanupTimers.push(t);
        } catch (err) {
            this.isPlaying = false;
            console.error('Composer playback error:', err);
            this._cleanupAllNodes();
        }
    }

    playTone(frequency, time, duration) {
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            const master = (typeof window !== 'undefined' && window.__MASTER_GAIN) ? window.__MASTER_GAIN : null;
            if (master) {
                gainNode.connect(master);
            } else {
                gainNode.connect(this.audioContext.destination);
            }
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(0.85, time + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);
            
            oscillator.start(time);
            oscillator.stop(time + duration);

            // Track nodes for stop()
            const nodeRef = { osc: oscillator, gain: gainNode, startTime: time, stopTime: time + duration };
            this.activeNodes.push(nodeRef);

            // Auto-cleanup: remove from activeNodes after note finishes
            const cleanupTime = Math.max(50, Math.ceil((duration + Math.max(0, time - this.audioContext.currentTime)) * 1000) + 50);
            setTimeout(() => {
                this.activeNodes = this.activeNodes.filter(n => n !== nodeRef);
            }, cleanupTime);
        } catch (err) {
            console.error('playTone error:', err);
        }
    }

    mixCulturalScales(culture1Scales, culture2Scales) {
        // Create a hybrid scale by combining elements
        const combined = [...new Set([...culture1Scales, ...culture2Scales])];
        return combined.sort((a, b) => a - b);
    }

    generateMelody(scale, length = 8) {
        const melody = [];
        let lastNote = null;
        
        for (let i = 0; i < length; i++) {
            // Use weighted probability to favor stepwise motion over large leaps
            let note;
            if (lastNote === null || Math.random() > 0.6) {
                // Random note selection
                note = scale[Math.floor(Math.random() * scale.length)];
            } else {
                // Favor nearby notes for more musical results
                const lastIndex = scale.indexOf(lastNote);
                const nearbyRange = 3;
                const minIndex = Math.max(0, lastIndex - nearbyRange);
                const maxIndex = Math.min(scale.length - 1, lastIndex + nearbyRange);
                const nearbyNotes = scale.slice(minIndex, maxIndex + 1);
                note = nearbyNotes[Math.floor(Math.random() * nearbyNotes.length)];
            }
            melody.push(note);
            lastNote = note;
        }
        return melody;
    }

    exportToMIDI() {
        // Simplified MIDI export structure
        const midiData = {
            header: { format: 0, trackCount: 1, ticksPerBeat: 480 },
            tracks: [{
                notes: this.sequence.map(s => ({
                    pitch: this.frequencyToMIDI(s.note),
                    time: s.time,
                    duration: s.duration
                }))
            }]
        };
        return JSON.stringify(midiData, null, 2);
    }

    frequencyToMIDI(frequency) {
        return Math.round(12 * Math.log2(frequency / 440) + 69);
    }

    stop() {
        try {
            const now = this.audioContext.currentTime;
            // Silence all gains
            this.activeNodes.forEach(({ osc, gain, startTime, stopTime }) => {
                try {
                    gain.gain.cancelScheduledValues(now);
                    gain.gain.setValueAtTime(0, now);
                } catch {}
                // Only stop if oscillator is currently playing
                try {
                    if (now >= startTime && now < stopTime) {
                        osc.stop(now + 0.01);
                    }
                } catch {}
            });
            // Clear node references
            this.activeNodes = [];
            this._cleanupTimers.forEach(t => clearTimeout(t));
            this._cleanupTimers = [];
        } finally {
            this.isPlaying = false;
        }
    }

    _cleanupAllNodes() {
        try {
            this.activeNodes.forEach(({ osc, gain }) => {
                try { gain.disconnect(); } catch {}
                try { osc.disconnect(); } catch {}
            });
        } finally {
            this.activeNodes = [];
        }
    }
}

export class Looper {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.loops = [];
        this.isRecording = false;
        this.recordingStartTime = 0;
        this.loopDuration = 4; // seconds
    }

    startRecording() {
        this.isRecording = true;
        this.recordingStartTime = this.audioContext.currentTime;
        this.currentLoop = [];
    }

    stopRecording() {
        this.isRecording = false;
        if (this.currentLoop.length > 0) {
            this.loops.push({
                notes: this.currentLoop,
                duration: this.loopDuration
            });
        }
    }

    recordNote(frequency, duration) {
        if (this.isRecording) {
            const time = this.audioContext.currentTime - this.recordingStartTime;
            this.currentLoop.push({ frequency, time, duration });
        }
    }

    playAllLoops() {
        const startTime = this.audioContext.currentTime;
        this.loops.forEach(loop => {
            this.playLoop(loop, startTime);
        });
    }

    playLoop(loop, startTime) {
        loop.notes.forEach(note => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = note.frequency;
            oscillator.type = 'sine';
            
            const time = startTime + note.time;
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(0.2, time + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, time + note.duration);
            
            oscillator.start(time);
            oscillator.stop(time + note.duration);
        });

        // Loop continuously
        setTimeout(() => {
            if (this.loops.includes(loop)) {
                this.playLoop(loop, this.audioContext.currentTime);
            }
        }, loop.duration * 1000);
    }

    clearAllLoops() {
        this.loops = [];
    }
}

export class PitchMatchingGame {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.targetPitch = 0;
        this.tolerance = 10; // Hz
        this.score = 0;
        this.attempts = 0;
    }

    generateTargetPitch() {
        const pitches = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
        this.targetPitch = pitches[Math.floor(Math.random() * pitches.length)];
        return this.targetPitch;
    }

    playTargetPitch() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = this.targetPitch;
        oscillator.type = 'sine';
        
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1);
        
        oscillator.start(now);
        oscillator.stop(now + 1);
    }

    checkMatch(userPitch) {
        this.attempts++;
        const difference = Math.abs(userPitch - this.targetPitch);
        
        if (difference <= this.tolerance) {
            this.score += Math.max(100 - difference, 50);
            return { match: true, difference, score: this.score };
        }
        
        return { match: false, difference, score: this.score };
    }

    reset() {
        this.score = 0;
        this.attempts = 0;
    }
}

export class RhythmDictation {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.targetPattern = [];
        this.userPattern = [];
        this.beats = 8;
    }

    generatePattern(difficulty = 'easy') {
        this.targetPattern = [];
        const density = difficulty === 'easy' ? 0.4 : difficulty === 'medium' ? 0.6 : 0.8;
        
        for (let i = 0; i < this.beats; i++) {
            this.targetPattern.push(Math.random() < density);
        }
        
        return this.targetPattern;
    }

    playPattern() {
        const beatDuration = 0.5;
        const now = this.audioContext.currentTime;
        
        this.targetPattern.forEach((beat, i) => {
            if (beat) {
                this.playClick(now + i * beatDuration);
            }
        });
    }

    playClick(time) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = 1000;
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        
        oscillator.start(time);
        oscillator.stop(time + 0.05);
    }

    recordUserPattern(pattern) {
        this.userPattern = pattern;
    }

    checkAccuracy() {
        let correct = 0;
        const total = this.beats;
        
        for (let i = 0; i < total; i++) {
            if (this.targetPattern[i] === this.userPattern[i]) {
                correct++;
            }
        }
        
        return Math.round((correct / total) * 100);
    }
}

export class InstrumentIdentifier {
    constructor() {
        this.instruments = [
            { name: 'Piano', timbre: 'harmonic', attack: 'fast', sustain: 'long' },
            { name: 'Guitar', timbre: 'harmonic', attack: 'medium', sustain: 'medium' },
            { name: 'Violin', timbre: 'harmonic', attack: 'slow', sustain: 'long' },
            { name: 'Trumpet', timbre: 'bright', attack: 'medium', sustain: 'medium' },
            { name: 'Flute', timbre: 'pure', attack: 'medium', sustain: 'long' },
            { name: 'Drums', timbre: 'percussive', attack: 'fast', sustain: 'short' },
            { name: 'Sitar', timbre: 'resonant', attack: 'medium', sustain: 'long' },
            { name: 'Didgeridoo', timbre: 'drone', attack: 'slow', sustain: 'continuous' }
        ];
    }

    identifyFromFeatures(spectralCentroid, attackTime, sustainLevel) {
        // Simplified identification based on features
        const scores = this.instruments.map(inst => {
            let score = 0;
            
            // Timbre matching
            if (spectralCentroid > 3000 && inst.timbre === 'bright') score += 3;
            if (spectralCentroid < 1000 && inst.timbre === 'drone') score += 3;
            if (spectralCentroid > 1000 && spectralCentroid < 3000 && inst.timbre === 'harmonic') score += 3;
            
            // Attack matching
            if (attackTime < 0.01 && inst.attack === 'fast') score += 2;
            if (attackTime > 0.1 && inst.attack === 'slow') score += 2;
            
            return { instrument: inst.name, score };
        });
        
        scores.sort((a, b) => b.score - a.score);
        return scores[0].instrument;
    }

    getRandomInstrument() {
        return this.instruments[Math.floor(Math.random() * this.instruments.length)];
    }
}

export function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function generatePDF(analysisData) {
    // Create a simplified text report
    let report = `ETHNOMUSICOLOGY ANALYSIS REPORT\n`;
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    report += `=== ANALYSIS RESULTS ===\n\n`;
    
    if (analysisData.rhythm) {
        report += `Rhythm Analysis:\n`;
        report += `- Tempo: ${analysisData.rhythm.tempo} BPM\n`;
        report += `- Regularity: ${(analysisData.rhythm.regularity * 100).toFixed(1)}%\n`;
        report += `- Beats Detected: ${analysisData.rhythm.peakCount}\n\n`;
    }
    
    if (analysisData.pitch) {
        report += `Pitch Analysis:\n`;
        report += `- Average Frequency: ${analysisData.pitch.avgPitch} Hz\n`;
        report += `- Range: ${analysisData.pitch.min} - ${analysisData.pitch.max} Hz\n\n`;
    }
    
    if (analysisData.cultural) {
        report += `Cultural Matches:\n`;
        analysisData.cultural.forEach((match, i) => {
            report += `${i + 1}. ${match.culture.name} (${(match.confidence * 100).toFixed(1)}%)\n`;
        });
    }
    
    // Download as text file (PDF generation would require additional library)
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ethnomusicology-report.txt';
    a.click();
    URL.revokeObjectURL(url);
}
