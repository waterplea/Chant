(function() {
    'use strict';
    var app = window.angular.module('Chant');

    app.factory('chantService', function () {
        var bufferLoader,
            title,
            context,
            detune,
            reverb,
            delay,
            distDelay,
            bassFilter,
            tremolo,
            master,
            rec,
            metronome,
            encoder,
            dummyTrack,
            featuredCompositions,
            localization,
            undoComposition;
        var delayBeats = 1.5;
        var newWord = true;
        var instruments = {};
        var effects = {};

        var lang = (navigator.language || navigator.userLanguage) === 'ru' ? 'ru' : 'en';

        var c = {};
            c.TEMPO = 0;
            c.LOOP = 1;
            c.KEY = 2;
            c.KEYS = 3;
            c.CHANT = 0;
            c.INSTRUMENT = 1;
            c.OCTAVE = 4;
            c.LOCKED = 5;
            c.VOLUME = 6;
            c.PANNING = 7;
            c.MUTED = 8;
            c.DRY = 9;
            c.EFFECTS = 10;
            c.TITLE = 4;
            c.AUTHOR = 5;
            c.NOTES = 6;
            c.SPLASH = 7;
            c.KEYBOARD = 8;
            c.PREFIX = 'composition.';

        function init(callback) {
            try {
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                context = new AudioContext();
            }
            catch(e) {
                return false;
            }

            master = context.createGain();
            master.connect(context.destination);

            rec = new Recorder(master);

            var recordStopper = (function() {
                var node = context.createScriptProcessor(8192, 2, 2);
                node.onaudioprocess = function(e) {
                    if (!rec.recording) return;
                    var volume = 0;
                    var inputA = e.inputBuffer.getChannelData(0);
                    var inputB = e.inputBuffer.getChannelData(1);
                    for (var i = 0; i < inputA.length; i++) {
                        volume += Math.abs(inputA[i]);
                        volume += Math.abs(inputB[i]);
                    }
                    if (!metronome && volume < 2 && rec.recording) {
                        rec.stop();
                    }
                };
                return node;
            })();
            var recordStopperSilencer = context.createGain();
            recordStopperSilencer.gain.value = 0;
            master.connect(recordStopper);
            recordStopper.connect(recordStopperSilencer);
            recordStopperSilencer.connect(context.destination);

            loadReverb('StMarysAbbeyReconstructionPhase3', function() {
                loadSamples('piano', callback);
            });

            dummyTrack = {
                chant: '',
                instrument: 'piano',
                key: '1',
                keys: [1, 1, 1, 1, 1, 1, 1],
                octave: 0,
                locked: true,
                volume: 50,
                muted: false,
                panning: 0,
                dry: false,
                effects: 50,
                volumeNode: context.createGain(),
                panNode: context.createPanner()
            };

            loadJSON('assets/json/featured.json',
                function(data) { featuredCompositions = data; },
                function(xhr) { console.error(xhr); });
            loadJSON('assets/json/localization_' + lang + '.json',
                function(data) {
                    localization = data;
                },
                function(xhr) { console.error(xhr); });

            return true;
        }

        function translate(string) {
            if (!localization) return;
            var path = string.split('.');
            var result = localization;

            for (var i = 0; i < path.length; i++) {
                result = result[path[i]];
            }

            return result;
        }

        function getFeaturedCompositions() {
            return featuredCompositions;
        }

        function newTrack() {
            var newTrack = Object.assign({}, dummyTrack);

            newTrack.volumeNode = context.createGain();
            newTrack.panNode = context.createPanner();
            newTrack.effectsNode = context.createGain();
            newTrack.dryNode = context.createGain();

            newTrack.volumeNode.connect(newTrack.panNode);
            newTrack.panNode.connect(newTrack.dryNode);
            newTrack.panNode.connect(newTrack.effectsNode);

            newTrack.dryNode.connect(master);
            newTrack.effectsNode.connect(effects[newTrack.instrument]);
            newTrack.currentLetter = -1;
            newTrack.newWord = true;

            return newTrack;
        }

        function playback(settings, tracks) {
            var buffer, currentStep, multiplier;

            var finished = true;

            tremolo.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 5 / settings.tempo);
            tremolo.gain.exponentialRampToValueAtTime(1.0, context.currentTime + 10 / settings.tempo);
            tremolo.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 15 / settings.tempo);
            tremolo.gain.exponentialRampToValueAtTime(1.0, context.currentTime + 20 / settings.tempo);
            tremolo.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 25 / settings.tempo);
            tremolo.gain.exponentialRampToValueAtTime(1.0, context.currentTime + 30 / settings.tempo);

            for (var i = 0; i < tracks.length; i++) {
                if (!tracks[i].finished) {
                    finished = false;
                } else {
                    continue;
                }

                currentStep = 0;
                multiplier = 1;

                switch (tracks[i].chant.charAt(tracks[i].currentLetter)) {
                    case 'C':
                        multiplier = 2;
                    case 'c':
                        currentStep = 1;
                        break;
                    case 'D':
                        multiplier = 2;
                    case 'd':
                        currentStep = 2;
                        break;
                    case 'E':
                        multiplier = 2;
                    case 'e':
                        currentStep = 3;
                        break;
                    case 'F':
                        multiplier = 2;
                    case 'f':
                        currentStep = 4;
                        break;
                    case 'G':
                        multiplier = 2;
                    case 'g':
                        currentStep = 5;
                        break;
                    case 'A':
                        multiplier = 2;
                    case 'a':
                        currentStep = 6;
                        break;
                    case 'B':
                        multiplier = 2;
                    case 'b':
                        currentStep = 7;
                        break;
                    case ' ':
                    case '\t':
                    case '\n':
                    case '\r':
                        tracks[i].newWord = true;
                        break;
                }

                if (currentStep && instruments[tracks[i].instrument]) {
                    buffer = instruments[tracks[i].instrument][currentStep - 1];

                    tracks[i].volumeNode.gain.value = tracks[i].volume / 50 * !tracks[i].muted;

                    var xDeg = tracks[i].panning * 4;
                    var zDeg = xDeg + 90;
                    if (zDeg > 90) {
                        zDeg = 180 - zDeg;
                    }
                    var x = Math.sin(xDeg * (Math.PI / 180));
                    var z = Math.sin(zDeg * (Math.PI / 180));


                    tracks[i].panNode.setPosition(x, 0, z);
                    tracks[i].effectsNode.gain.value = tracks[i].effects / 50 * !tracks[i].dry;
                    tracks[i].dryNode.gain.value = 1 - tracks[i].effectsNode.gain.value;

                    var source = context.createBufferSource();
                    source.buffer = buffer;

                    source.connect(tracks[i].volumeNode);

                    if (tracks[i].locked) {
                        source.playbackRate.value = multiplier *
                            settings.key *
                            settings.keys[currentStep - 1] *
                            Math.pow(2, tracks[i].octave || 0);
                    } else {
                        source.playbackRate.value = multiplier *
                            tracks[i].key *
                            tracks[i].keys[currentStep - 1] *
                            Math.pow(2, tracks[i].octave || 0);
                    }

                    if (tracks[i].newWord) {
                        source.playbackRate.value *= 0.5;
                        tracks[i].newWord = false;
                    }

                    if (tracks[i].instrument === 'organ' && tracks[i].effects > 25) {
                        detune.connect(source.detune);
                    }

                    source.start();

                    setTimeout(function() {
                        source.disconnect();
                    }, 60000);
                }

                tracks[i].currentLetter++;
                if (tracks[i].currentLetter >= tracks[i].chant.length) {
                    if (settings.loop) {
                        tracks[i].currentLetter = 0;
                        tracks[i].newWord = true;
                    } else {
                        tracks[i].finished = true;
                    }
                }
            }

            return !finished;
        }

        function loadSamples(instrument, callback) {
            var extension = 'mp3';

            var a = document.createElement('audio');
            if (!!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, ''))) {
                extension = 'ogg';
            }

            if (localStorage.getItem('hd')) {
                extension = 'wav';
            }


            if (instruments[instrument]) {
				if (callback) callback();
                return;
            }
            bufferLoader = new BufferLoader(
                context,
                [
                    'assets/audio/' + instrument + '/1.' + extension,
                    'assets/audio/' + instrument + '/2.' + extension,
                    'assets/audio/' + instrument + '/3.' + extension,
                    'assets/audio/' + instrument + '/4.' + extension,
                    'assets/audio/' + instrument + '/5.' + extension,
                    'assets/audio/' + instrument + '/6.' + extension,
                    'assets/audio/' + instrument + '/7.' + extension
                ],
                function(data) {
                    instruments[instrument] = data;
                    if (callback) callback();
                }
            );
            bufferLoader.load();
        }

        function loadReverb(name, callback) {
            bufferLoader = new BufferLoader(
                context,
                [
                    'assets/audio/reverb/' + name + '.m4a'
                ],
                function(data) {
                    initEffects(data[0]);
                    callback();
                }
            );

            bufferLoader.load();
        }

        function makeDistortionCurve(amount) {
            var k = typeof amount === 'number' ? amount : 50,
                n_samples = 44100,
                curve = new Float32Array(n_samples),
                deg = Math.PI / 180,
                i = 0,
                x;
            for ( ; i < n_samples; ++i ) {
                x = i * 2 / n_samples - 1;
                curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
            }
            return curve;
        }

        function initEffects(response) {
            effects['acoustic'] = context.createGain();
            effects['electric'] = context.createGain();
            effects['electric'].gain.value = 0.5;
            effects['bass'] = context.createGain();
            effects['harmonics'] = context.createGain();
            effects['harmonics'].gain.value = 0.6;
            effects['ebow'] = context.createGain();
            effects['ebow'].gain.value = 0.6;
            effects['piano'] = context.createGain();
            effects['rhodes'] = context.createGain();
            effects['synth'] = context.createGain();
            effects['organ'] = context.createGain();
            effects['organ'].gain.value = 0.5;
            //effects['hammond'] = context.createGain();
            //effects['violin'] = context.createGain();
            //effects['cello'] = context.createGain();
            effects['double'] = context.createGain();
            effects['harmonica'] = context.createGain();
            effects['harmonica'].gain.value = 0.5;
            effects['flute'] = context.createGain();
            effects['flute'].gain.value = 3.0;
            //effects['chimes'] = context.createGain();
            //effects['bell'] = context.createGain();
            //effects['sax'] = context.createGain();
            effects['tank'] = context.createGain();
            effects['tank'].gain.value = 0.5;
            effects['drums'] = context.createGain();
            effects['waterplea'] = context.createGain();

            /* Oscillators */
            var osc = context.createOscillator();
            osc.frequency.value = 5.7;
            var oscDouble = context.createOscillator();
            oscDouble.frequency.value = 6.8;
            osc.start();
            oscDouble.start();

            /* Universal reverb */
            reverb = context.createConvolver();
            reverb.buffer = response;
            reverb.connect(master);
            var reverbFeedback = context.createGain();

            /* Universal filtered delay */
            delay = context.createDelay(5.0);
            delay.delayTime.value = 1;
            var feedback = context.createGain();
            feedback.gain.value = 0.3;
            var filter = context.createBiquadFilter();
            filter.frequency.value = 1000;
            delay.connect(feedback);
            feedback.connect(filter);
            filter.connect(delay);
            delay.connect(master);

            /* Bass filter */
            var bassFilterFeedback = context.createGain();
            bassFilterFeedback.gain.value = 0.6;
            bassFilter = context.createBiquadFilter();
            bassFilter.frequency.value = 600;
            bassFilter.Q.value = 20;
            bassFilter.type = 'lowpass';
            bassFilter.connect(delay);
            bassFilterFeedback.connect(bassFilter);
            var oscBass = context.createOscillator();
            oscBass.frequency.value = 0.07;
            var oscBassAmp = context.createGain();
            oscBassAmp.gain.value = 400;
            oscBass.connect(oscBassAmp);
            oscBassAmp.connect(bassFilter.frequency);
            oscBass.start();
            var fluteFeedback = context.createGain();
            fluteFeedback.gain.value = 0.1;
            fluteFeedback.connect(bassFilter);
            fluteFeedback.connect(master);

            /* Acoustic filter */
            reverbFeedback.gain.value = 0.1;
            reverbFeedback.connect(reverb);
            var acousticFilterFeedback = context.createGain();
            acousticFilterFeedback.gain.value = 0.2;
            acousticFilterFeedback.connect(bassFilter);

            /* Distortion */
            distDelay = context.createDelay(5.0);
            distDelay.delayTime.value = .5;
            distDelay.connect(master);
            var distFeedback = context.createGain();
            distFeedback.gain.value = 0.2;
            var distVolume = context.createGain();
            distVolume.gain.value = 0.6;
            var distortion = context.createWaveShaper();
            distortion.curve = makeDistortionCurve(400);
            distortion.oversample = '4x';
            distortion.connect(distVolume);
            distVolume.connect(master);
            distortion.connect(distFeedback);
            distFeedback.connect(distDelay);

            /* Tremolo */
            tremolo = context.createGain();
            tremolo.gain.value = 1.0;
            tremolo.connect(master);

            /* Leslie */
            var leslie = context.createGain();
            leslie.gain.value = 1.0;
            detune = context.createGain();
            detune.gain.value = 12.0;
            var leslieLow = context.createBiquadFilter();
            leslieLow.frequency.value = 500;
            leslieLow.gain.value = -30;
            leslieLow.Q.value = 20;
            leslieLow.type = 'highshelf';
            var leslieHigh = context.createBiquadFilter();
            leslieHigh.frequency.value = 500;
            leslieHigh.gain.value = -30;
            leslieHigh.Q.value = 20;
            leslieHigh.type = 'lowshelf';
            var leslieDistortion = context.createWaveShaper();
            leslieDistortion.curve = makeDistortionCurve(10);
            leslieDistortion.oversample = '4x';
            var leslieLowFeedback = context.createGain();
            leslieLowFeedback.gain.value = 0.9;
            var leslieHighFeedback = context.createGain();
            leslieHighFeedback.gain.value = 0.9;
            var leslieLowOsc = context.createGain();
            leslieLowOsc.gain.value = 0.1;
            var leslieHighOsc = context.createGain();
            leslieHighOsc.gain.value = 0.1;
            leslie.connect(leslieDistortion);
            leslieDistortion.connect(leslieHigh);
            leslieDistortion.connect(leslieLow);
            leslieLow.connect(leslieLowFeedback);
            leslieHigh.connect(leslieHighFeedback);
            leslieLowFeedback.connect(reverbFeedback);
            leslieHighFeedback.connect(reverbFeedback);
            leslieLowFeedback.connect(master);
            leslieHighFeedback.connect(master);
            osc.connect(leslieLowOsc);
            oscDouble.connect(leslieHighOsc);
            oscDouble.connect(detune);
            leslieLowOsc.connect(leslieLowFeedback.gain);
            leslieHighOsc.connect(leslieHighFeedback.gain);
            
            /* Wah Wah */
            var wahwah = context.createGain();
            var waveshaper = context.createWaveShaper();
            var awFollower = context.createBiquadFilter();
            awFollower.type = "lowpass";
            awFollower.frequency.value = 5.0;
            var curve = new Float32Array(65536);
            for (var i=-32768; i<32768; i++)
                curve[i+32768] = ((i>0)?i:-i)/32768;
            waveshaper.curve = curve;
            waveshaper.connect(awFollower);
            var awDepth = context.createGain();
            awDepth.gain.value = 11585;
            awFollower.connect(awDepth);
            var awFilter = context.createBiquadFilter();
            awFilter.type = "lowpass";
            awFilter.Q.value = 15;
            awFilter.frequency.value = 250;
            awDepth.connect(awFilter.frequency);
            awFilter.connect(master);
            wahwah.connect(waveshaper);
            wahwah.connect(awFilter);

            /* Stereo flanger */
            var splitter = context.createChannelSplitter(2);
            var merger = context.createChannelMerger(2);
            var flanger = context.createGain();
            var flangerFeedback = context.createGain();
            flangerFeedback.gain.value = 0.5;
            flangerFeedback.connect(flanger);
            var sfllfb = context.createGain();
            var sflrfb = context.createGain();
            var sflspeed = context.createOscillator();
            var sflldepth = context.createGain();
            var sflrdepth = context.createGain();
            var sflldelay = context.createDelay();
            var sflrdelay = context.createDelay();
            sfllfb.gain.value = sflrfb.gain.value = 0.9;
            flanger.connect(splitter);
            flanger.connect(master);
            sflldelay.delayTime.value = 0.003;
            sflrdelay.delayTime.value = 0.003;
            splitter.connect(sflldelay, 0);
            splitter.connect(sflrdelay, 1);
            sflldelay.connect(sfllfb);
            sflrdelay.connect(sflrfb);
            sfllfb.connect(sflrdelay);
            sflrfb.connect(sflldelay);
            sflldepth.gain.value = 0.005;
            sflrdepth.gain.value = -0.005;
            sflspeed.type = 'triangle';
            sflspeed.frequency.value = 0.15;
            sflspeed.connect(sflldepth);
            sflspeed.connect(sflrdepth);
            sflldepth.connect(sflldelay.delayTime);
            sflrdepth.connect(sflrdelay.delayTime);
            sflldelay.connect(merger, 0, 0);
            sflrdelay.connect(merger, 0, 1);
            merger.connect(master);
            sflspeed.start();

            /* Bit Crusher */
            var bitCrusher = (function() {
                var node = context.createScriptProcessor(1024, 2, 2);
                node.bits = 6; // between 1 and 16
                node.normfreq = 0.2; // between 0.0 and 1.0
                var step = Math.pow(1/2, node.bits);
                var phaser = 0;
                var lastA = 0;
                var lastB = 0;
                node.onaudioprocess = function(e) {
                    var inputA = e.inputBuffer.getChannelData(0);
                    var inputB = e.inputBuffer.getChannelData(1);
                    var outputA = e.outputBuffer.getChannelData(0);
                    var outputB = e.outputBuffer.getChannelData(1);
                    for (var i = 0; i < inputA.length; i++) {
                        phaser += node.normfreq;
                        if (phaser >= 1.0) {
                            phaser -= 1.0;
                            lastA = step * Math.floor(inputA[i] / step + 0.5);
                            lastB = step * Math.floor(inputB[i] / step + 0.5);
                        }
                        outputA[i] = lastA;
                        outputB[i] = lastB;
                    }
                };
                return node;
            })();
            bitCrusher.connect(master);

            /* Reverser */
            var reverser = (function() {
                var node = context.createScriptProcessor(2048, 2, 2);
                node.onaudioprocess = function(e) {
                    var inputA = e.inputBuffer.getChannelData(0);
                    var inputB = e.inputBuffer.getChannelData(1);
                    var outputA = e.outputBuffer.getChannelData(0);
                    var outputB = e.outputBuffer.getChannelData(1);
                    for (var i = 0; i < inputA.length; i++) {
                        outputA[i] = 2 * inputA[i] * Math.abs(inputA.length / 2 - i) / inputA.length + 2 * inputA[inputA.length - i - 1] * (inputA.length / 2 - Math.abs(inputA.length / 2 - i)) / inputA.length;
                        outputB[i] = 2 * inputB[i] * Math.abs(inputA.length / 2 - i) / inputA.length + 2 * inputB[inputA.length - i - 1] * (inputA.length / 2 - Math.abs(inputA.length / 2 - i)) / inputA.length;
                    }
                };
                return node;
            })();

            var reverserLong = (function() {
                var node = context.createScriptProcessor(16384, 2, 2);
                node.onaudioprocess = function(e) {
                    var inputA = e.inputBuffer.getChannelData(0);
                    var inputB = e.inputBuffer.getChannelData(1);
                    var outputA = e.outputBuffer.getChannelData(0);
                    var outputB = e.outputBuffer.getChannelData(1);
                    for (var i = 0; i < inputA.length; i++) {
                        outputA[i] = 2 * inputA[i] * Math.abs(inputA.length / 2 - i) / inputA.length + 2 * inputA[inputA.length - i - 1] * (inputA.length / 2 - Math.abs(inputA.length / 2 - i)) / inputA.length;
                        outputB[i] = 2 * inputB[i] * Math.abs(inputA.length / 2 - i) / inputA.length + 2 * inputB[inputA.length - i - 1] * (inputA.length / 2 - Math.abs(inputA.length / 2 - i)) / inputA.length;
                    }
                };
                return node;
            })();
            reverserLong.connect(master);
            reverser.connect(reverserLong);

            effects['acoustic'].connect(distFeedback);
            effects['acoustic'].connect(acousticFilterFeedback);
            effects['acoustic'].connect(reverbFeedback);
            effects['acoustic'].connect(master);
            effects['electric'].connect(reverb);
            effects['bass'].connect(bassFilterFeedback);
            effects['bass'].connect(master);
            effects['harmonics'].connect(reverbFeedback);
            effects['harmonics'].connect(delay);
            effects['harmonics'].connect(reverser);
            effects['ebow'].connect(bassFilterFeedback);
            effects['ebow'].connect(reverbFeedback);
            effects['piano'].connect(flanger);
            effects['piano'].connect(reverser);
            effects['piano'].connect(delay);
            effects['piano'].connect(reverbFeedback);
            effects['rhodes'].connect(reverbFeedback);
            effects['rhodes'].connect(flangerFeedback);
            effects['rhodes'].connect(leslie);
            effects['rhodes'].connect(distFeedback);
            effects['rhodes'].connect(delay);
            //effects['synth'].connect(reverb);
            //effects['synth'].connect(highAttenuator);
            effects['synth'].connect(bitCrusher);
            effects['organ'].connect(leslie);
            //effects['organ'].connect(delay);
            //effects['hammond'].connect(reverb);
            //effects['hammond'].connect(delay);
            //effects['violin'].connect(reverb);
            //effects['violin'].connect(delay);
            //effects['cello'].connect(reverb);
            //effects['cello'].connect(delay);
            effects['double'].connect(wahwah);
            //effects['double'].connect(master);
            effects['harmonica'].connect(flanger);
            effects['harmonica'].connect(distFeedback);
            effects['harmonica'].connect(leslie);
            effects['harmonica'].connect(bassFilterFeedback);
            effects['harmonica'].connect(reverser);
            effects['harmonica'].connect(reverb);
            effects['flute'].connect(reverbFeedback);
            //effects['flute'].connect(acousticFilterFeedback);
            //effects['flute'].connect(leslie);
            //effects['flute'].connect(wahwah);
            effects['flute'].connect(fluteFeedback);
            //effects['chimes'].connect(reverb);
            //effects['chimes'].connect(delay);
            //effects['bell'].connect(reverb);
            //effects['bell'].connect(delay);
            //effects['sax'].connect(reverb);
            //effects['sax'].connect(delay);
            effects['tank'].connect(reverb);
            effects['tank'].connect(delay);
            effects['tank'].connect(reverser);
            //effects['drums'].connect(reverb);
            //effects['drums'].connect(delay);
            effects['drums'].connect(distortion);
            effects['waterplea'].connect(tremolo);
            effects['waterplea'].connect(reverbFeedback);
            //effects['waterplea'].connect(delay);
        }

        function hannWindow(length) {
            var window = new Float32Array(length);
            for (var i = 0; i < length; i++) {
                window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
            }
            return window;
        }

        function linearInterpolation(a, b, t) {
            return a + (b - a) * t;
        }

        function reWire(track) {
            track.effectsNode.disconnect();
            track.effectsNode.connect(effects[track.instrument]);
        }

        function validate(tracks) {
            for (var i = 0; i < tracks.length; i++) {
                for (var j = 0; j < tracks[i].chant.length; j++) {
                    var c = tracks[i].chant[j];
                    if (c === 'a' || c === 'A' ||
                        c === 'b' || c === 'B' ||
                        c === 'c' || c === 'C' ||
                        c === 'd' || c === 'D' ||
                        c === 'e' || c === 'E' ||
                        c === 'f' || c === 'F' ||
                        c === 'g' || c === 'G') {
                        return true;
                    }
                }
            }
            return false;
        }

        function getSavedCompositions() {
            var compositions = [];

            for (var key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    var index = key.indexOf(c.PREFIX);
                    if (index !== -1) {
                        compositions.push({ title: key.substr(c.PREFIX.length), content: localStorage[key] });
                    }
                }
            }

            return compositions;
        }

        function doesCompositionExist(title) {
            for (var key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    var index = key.indexOf(c.PREFIX);
                    if (index !== -1) {
                        if (key.substr(c.PREFIX.length) === title) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        function save(title, settings, tracks) {
            if (localStorage.getItem(c.PREFIX + title)) {
                undoComposition = {
                    title: c.PREFIX + title,
                    composition: localStorage.getItem(c.PREFIX + title)
                };
            }

            localStorage.setItem(c.PREFIX + title, encodeLink(settings, tracks));
        }

        function load(title) {
            return parseLink(localStorage.getItem(c.PREFIX + title));
        }

        function remove(title) {
            undoComposition = {
                title: c.PREFIX + title,
                composition: localStorage.getItem(c.PREFIX + title)
            };
            localStorage.removeItem(c.PREFIX + title);
        }

        function undo() {
            localStorage.setItem(undoComposition.title, undoComposition.composition);
            undoComposition = null;
        }

        function download(name) {
            title = name;
            rec.getBuffer(function(data) {
                if (localStorage.getItem('hd')) {
                    rec.exportWAV(downloadWav);
                } else {
                    document.getElementById('progress').setAttribute('data-progress', 0);
                    downloadMp3(data);
                }
            });
        }

        function downloadWav(blob) {
            var a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            var url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = title ? title + '.wav' : 'Chant.wav';
            a.click();
            setTimeout(function(){
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        }

        function downloadMp3(data) {
            encoder = new Worker("app/encoder.js");
            encoder.onmessage = onEncoderCallback;
            encoder.postMessage({ data: data, sampleRate: context.sampleRate })
        }

        function onEncoderCallback(event) {
            var element = document.getElementById('progress');
            if (event.data.finished) {
                encoder.terminate();
                encoder = undefined;
                element.className = 'progress closing';
                setTimeout(function() {
                    element.setAttribute('data-progress', false);
                    element.className = 'progress';
                }, 300);

                var blob = new Blob(event.data.content, {type: 'audio/mp3'});
                var a = document.createElement("a");
                document.body.appendChild(a);
                a.style = "display: none";
                var url = window.URL.createObjectURL(blob);
                a.href = url;
                a.download = title ? title + '.mp3' : 'Chant.mp3';
                a.click();
                setTimeout(function(){
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
            } else {
                element.setAttribute('data-progress', event.data.content);
            }
        }

        function isFirstVisit() {
            var result = localStorage.getItem('visited');

            try {
                localStorage.setItem('visited', 'true');
            }
            catch(e) {
                return true;
            }

            return !result;
        }

        function playStep(step, track, safariInitialize) {
            var buffer;
            var currentStep;
            var multiplier = 1;

            switch(step) {
                case 0:
                    currentStep = 1;
                    multiplier = 0.9439;
                    break;
                case 1:
                    currentStep = 1;
                    break;
                case 2:
                    currentStep = 2;
                    multiplier = 0.9439;
                    break;
                case 3:
                    currentStep = 2;
                    break;
                case 4:
                    currentStep = 3;
                    multiplier = 0.9439;
                    break;
                case 5:
                    currentStep = 3;
                    break;
                case 6:
                    currentStep = 4;
                    break;
                case 7:
                    currentStep = 5;
                    multiplier = 0.9439;
                    break;
                case 8:
                    currentStep = 5;
                    break;
                case 9:
                    currentStep = 6;
                    multiplier = 0.9439;
                    break;
                case 10:
                    currentStep = 6;
                    break;
                case 11:
                    currentStep = 7;
                    multiplier = 0.9439;
                    break;
                case 12:
                    currentStep = 7;
                    break;
                case 13:
                    currentStep = 7;
                    multiplier = 1.0595;
                    break;
            }

            if (track.instrument) {
                buffer = instruments[track.instrument][currentStep - 1];
            } else {
				for (var i in instruments) {
					buffer = instruments[i][currentStep - 1];
					break;
				}
            }

            var source = context.createBufferSource();
            if (safariInitialize) {
                var gain = context.createGain();
                gain.gain.value = 0;
                source.connect(gain);
                gain.connect(master);
                source.start(0);
                return;
            }
            source.buffer = buffer;
            source.connect(master);

            source.playbackRate.value = multiplier * track.key;
            source.start(0);
        }

        function playChar(char, track, settings) {
            if (!track) return;

            var currentStep;
            var multiplier = 1;

            switch (char) {
                case 'C':
                    multiplier = 2;
                case 'c':
                    currentStep = 1;
                    break;
                case 'D':
                    multiplier = 2;
                case 'd':
                    currentStep = 2;
                    break;
                case 'E':
                    multiplier = 2;
                case 'e':
                    currentStep = 3;
                    break;
                case 'F':
                    multiplier = 2;
                case 'f':
                    currentStep = 4;
                    break;
                case 'G':
                    multiplier = 2;
                case 'g':
                    currentStep = 5;
                    break;
                case 'A':
                    multiplier = 2;
                case 'a':
                    currentStep = 6;
                    break;
                case 'B':
                    multiplier = 2;
                case 'b':
                    currentStep = 7;
                    break;
                case ' ':
                    newWord = true;
            }

            if (currentStep) {
                var buffer = instruments[track.instrument][currentStep - 1];

                delay.delayTime.value = 60 / settings.tempo * delayBeats;
                distDelay.delayTime.value = 30 / settings.tempo * delayBeats;
                track.volumeNode.gain.value = track.volume / 50;

                var xDeg = track.panning * 4;
                var zDeg = xDeg + 90;
                if (zDeg > 90) {
                    zDeg = 180 - zDeg;
                }
                var x = Math.sin(xDeg * (Math.PI / 180));
                var z = Math.sin(zDeg * (Math.PI / 180));


                track.panNode.setPosition(x, 0, z);
                track.effectsNode.gain.value = track.effects / 50 * !track.dry;
                track.dryNode.gain.value = 1 - track.effectsNode.gain.value;

                var source = context.createBufferSource();
                source.buffer = buffer;

                source.connect(track.volumeNode);

                if (track.locked) {
                    source.playbackRate.value = multiplier *
                        settings.key *
                        settings.keys[currentStep - 1] *
                        Math.pow(2, track.octave || 0);
                } else {
                    source.playbackRate.value = multiplier *
                        track.key *
                        track.keys[currentStep - 1] *
                        Math.pow(2, track.octave || 0);
                }

                if (newWord) {
                    source.playbackRate.value *= 0.5;
                    newWord = false;
                }

                source.start(0);
            }
        }

        function play(settings, tracks, callback, tick) {
            if (!validate(tracks)) {
                tracks[0].chant = translate('ui.noletters');
            }

            rec.stop();
            rec.clear();
            rec.record();

            delay.delayTime.value = 60 / settings.tempo * delayBeats;
            distDelay.delayTime.value = 30 / settings.tempo * delayBeats;

            metronome = new Worker("app/metronome.js");
            metronome.postMessage(30000/settings.tempo|0);
            metronome.onmessage = function () {
                if (!playback(settings, tracks)) {
                    callback();
                }
                tick();
            };
        }

        function stop() {
            metronome.terminate();
            metronome = undefined;
        }

        function encodeLink(settings, tracks) {
            var settingsArray = [];
            settingsArray[c.TEMPO] = settings.tempo;
            settingsArray[c.LOOP] = settings.loop;
            settingsArray[c.KEY] = settings.key;
            settingsArray[c.KEYS] = settings.keys;
            settingsArray[c.TITLE] = settings.title;
            settingsArray[c.AUTHOR] = settings.author;
            settingsArray[c.NOTES] = settings.notes;
            settingsArray[c.SPLASH] = settings.splashscreen;
            settingsArray[c.KEYBOARD] = settings.keyboard;

            var tracksArray = [];
            for (var i = 0; i < tracks.length; i++) {
                tracksArray.push([]);
                tracksArray[i][c.CHANT] = tracks[i].chant;
                tracksArray[i][c.INSTRUMENT] = tracks[i].instrument;
                tracksArray[i][c.KEY] = tracks[i].key;
                tracksArray[i][c.KEYS] = tracks[i].keys;
                tracksArray[i][c.OCTAVE] = tracks[i].octave;
                tracksArray[i][c.LOCKED] = tracks[i].locked;
                tracksArray[i][c.VOLUME] = tracks[i].volume;
                tracksArray[i][c.PANNING] = tracks[i].panning;
                tracksArray[i][c.MUTED] = tracks[i].muted;
                tracksArray[i][c.DRY] = tracks[i].dry;
                tracksArray[i][c.EFFECTS] = tracks[i].effects;
            }

            return LZString.compressToEncodedURIComponent(JSON.stringify([settingsArray, tracksArray]));
        }

        function parseLink(composition) {
            try {
                var compositionJson = JSON.parse(LZString.decompressFromEncodedURIComponent(composition));
            }
            catch(e) {
                return false;
            }
            var data = {
                settings: {},
                tracks: []
            };

            try {
                data.settings.tempo = compositionJson[0][c.TEMPO];
            }
            catch(e) {
                compositionJson = JSON.parse(composition);
                data.settings.tempo = compositionJson[0][c.TEMPO];
            }
            data.settings.loop = compositionJson[0][c.LOOP];
            data.settings.key = compositionJson[0][c.KEY];
            data.settings.keys = compositionJson[0][c.KEYS];
            data.settings.title = compositionJson[0][c.TITLE];
            data.settings.author = compositionJson[0][c.AUTHOR];
            data.settings.notes = compositionJson[0][c.NOTES];
            data.settings.splashscreen = compositionJson[0][c.SPLASH];
            data.settings.keyboard = compositionJson[0][c.KEYBOARD];

            for (var i = 0; i < compositionJson[1].length; i++) {
                data.tracks.push({});
                data.tracks[i].chant = compositionJson[1][i][c.CHANT];
                data.tracks[i].instrument = compositionJson[1][i][c.INSTRUMENT];
                data.tracks[i].key = compositionJson[1][i][c.KEY];
                data.tracks[i].keys = compositionJson[1][i][c.KEYS];
                data.tracks[i].octave = compositionJson[1][i][c.OCTAVE];
                data.tracks[i].locked = compositionJson[1][i][c.LOCKED];
                data.tracks[i].volume = compositionJson[1][i][c.VOLUME];
                data.tracks[i].panning = compositionJson[1][i][c.PANNING];
                data.tracks[i].muted = compositionJson[1][i][c.MUTED];
                data.tracks[i].dry = compositionJson[1][i][c.DRY];
                data.tracks[i].effects = compositionJson[1][i][c.EFFECTS];

                data.tracks[i].currentLetter = -1;
                data.tracks[i].newWord = true;

                data.tracks[i].volumeNode = context.createGain();
                data.tracks[i].panNode = context.createPanner();

                data.tracks[i].effectsNode = context.createGain();
                data.tracks[i].dryNode = context.createGain();

                data.tracks[i].volumeNode.connect(data.tracks[i].panNode);
                data.tracks[i].panNode.connect(data.tracks[i].dryNode);
                data.tracks[i].panNode.connect(data.tracks[i].effectsNode);

                data.tracks[i].dryNode.connect(master);
                data.tracks[i].effectsNode.connect(effects[data.tracks[i].instrument]);
            }

            return data;
        }

        function loadJSON(path, success, error) {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function()
            {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    if (xhr.status === 200) {
                        if (success)
                            success(JSON.parse(xhr.responseText));
                    } else {
                        if (error)
                            error(xhr);
                    }
                }
            };
            xhr.open("GET", path, true);
            xhr.send();
        }

        function BufferLoader(context, urlList, callback) {
            this.context = context;
            this.urlList = urlList;
            this.onload = callback;
            this.bufferList = [];
            this.loadCount = 0;
        }

        BufferLoader.prototype.loadBuffer = function(url, index) {
            // Load buffer asynchronously
            var request = new XMLHttpRequest();
            request.open("GET", url, true);
            request.responseType = "arraybuffer";

            var loader = this;

            request.onload = function() {
                // Asynchronously decode the audio file data in request.response
                loader.context.decodeAudioData(
                    request.response,
                    function(buffer) {
                        if (!buffer) {
                            alert('error decoding file data: ' + url);
                            return;
                        }
                        loader.bufferList[index] = buffer;
                        if (++loader.loadCount == loader.urlList.length)
                            loader.onload(loader.bufferList);
                    },
                    function(error) {
                        console.error('decodeAudioData error', error);
                    }
                );
            };

            request.onerror = function() {
                alert('BufferLoader: XHR error');
            };

            request.send();
        };

        BufferLoader.prototype.load = function() {
            for (var i = 0; i < this.urlList.length; ++i)
                this.loadBuffer(this.urlList[i], i);
        };

        return {
            init: init,
            play: play,
            stop: stop,
            translate: translate,
            validate: validate,
            getFeaturedCompositions: getFeaturedCompositions,
            getSavedCompositions: getSavedCompositions,
            doesCompositionExist: doesCompositionExist,
            save: save,
            load: load,
            remove: remove,
            undo: undo,
            encodeLink: encodeLink,
            parseLink: parseLink,
            download: download,
            isFirstVisit: isFirstVisit,
            playStep: playStep,
            playChar: playChar,
            newTrack: newTrack,
            reWire: reWire,
            loadSamples: loadSamples
        }
    });

})();