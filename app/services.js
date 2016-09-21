(function() {
    'use strict';
    var app = window.angular.module('Chant');

    app.factory('chantService', function () {
        var bufferLoader,
            title,
            context,
            reverb,
            master,
            rec,
            metronome,
            encoder,
            dummyTrack,
            featuredCompositions,
            localization;
        var delayBeats = 1.5;
        var newWord = true;
        var instruments = {};

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

            loadReverb('ErrolBrickworksKiln', callback);

            rec = new Recorder(master);

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
                panNode: context.createStereoPanner()
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
            newTrack.panNode = context.createStereoPanner();
            newTrack.effectsNode = context.createGain();
            newTrack.dryNode = context.createGain();

            newTrack.delay = context.createDelay(5.0);
            newTrack.feedback = context.createGain();
            newTrack.feedback.gain.value = 0.3;
            newTrack.filter = context.createBiquadFilter();
            newTrack.filter.frequency.value = 1000;
            newTrack.reverb = context.createConvolver();
            newTrack.reverb.buffer = reverb;

            newTrack.delay.connect(newTrack.feedback);
            newTrack.feedback.connect(newTrack.filter);
            newTrack.filter.connect(newTrack.delay);
            newTrack.reverb.connect(newTrack.effectsNode);
            newTrack.delay.connect(newTrack.effectsNode);

            newTrack.volumeNode.connect(newTrack.panNode);
            newTrack.panNode.connect(newTrack.reverb);
            newTrack.panNode.connect(newTrack.delay);
            newTrack.panNode.connect(newTrack.dryNode);

            newTrack.dryNode.connect(master);
            newTrack.effectsNode.connect(master);
            newTrack.currentLetter = 0;
            newTrack.newWord = true;

            return newTrack;
        }

        function playback(settings, tracks) {
            var buffer, currentStep, multiplier;

            var finished = true;

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

                    tracks[i].delay.delayTime.value = 60 / settings.tempo * delayBeats;
                    tracks[i].volumeNode.gain.value = tracks[i].volume / 50 * !tracks[i].muted;
                    tracks[i].panNode.pan.value = tracks[i].panning / 25;
                    tracks[i].effectsNode.gain.value = tracks[i].effects / 50 * !tracks[i].dry;
                    tracks[i].dryNode.gain.value = 1 - tracks[i].effectsNode.gain.value;

                    var source = context.createBufferSource();
                    source.buffer = buffer;

                    source.connect(tracks[i].volumeNode);

                    if (tracks[i].locked) {
                        source.playbackRate.value = multiplier *
                            settings.key *
                            settings.keys[currentStep - 1] *
                            Math.pow(2, tracks[i].octave);
                    } else {
                        source.playbackRate.value = multiplier *
                            tracks[i].key *
                            tracks[i].keys[currentStep - 1] *
                            Math.pow(2, tracks[i].octave);
                    }

                    if (tracks[i].newWord) {
                        source.playbackRate.value *= 0.5;
                        tracks[i].newWord = false;
                    }

                    source.start(0);
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
            if (instruments[instrument]) {
                callback();
                return;
            }
            bufferLoader = new BufferLoader(
                context,
                [
                    'assets/audio/' + instrument + '/1.' + (localStorage.getItem('hd') ? 'wav' : 'mp3'),
                    'assets/audio/' + instrument + '/2.' + (localStorage.getItem('hd') ? 'wav' : 'mp3'),
                    'assets/audio/' + instrument + '/3.' + (localStorage.getItem('hd') ? 'wav' : 'mp3'),
                    'assets/audio/' + instrument + '/4.' + (localStorage.getItem('hd') ? 'wav' : 'mp3'),
                    'assets/audio/' + instrument + '/5.' + (localStorage.getItem('hd') ? 'wav' : 'mp3'),
                    'assets/audio/' + instrument + '/6.' + (localStorage.getItem('hd') ? 'wav' : 'mp3'),
                    'assets/audio/' + instrument + '/7.' + (localStorage.getItem('hd') ? 'wav' : 'mp3')
                ],
                function(data) {
                    instruments[instrument] = data;
                    callback();
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
                    reverb = data[0];
                    callback();
                }
            );

            bufferLoader.load();
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
            localStorage.setItem(c.PREFIX + title, encodeLink(settings, tracks));
        }

        function load(title, callback) {
            return parseLink(localStorage.getItem(c.PREFIX + title), callback);
        }

        function remove(title) {
            localStorage.removeItem(c.PREFIX + title);
        }

        function download(name) {
            title = name;
            rec.getBuffer(function(data) {
                if (data[0].length) {
                    if (localStorage.getItem('hd')) {
                        rec.exportWAV(downloadWav);
                    } else {
                        document.getElementById('progress').setAttribute('data-progress', 0);
                        downloadMp3(data);
                    }
                } else {
                    return false;
                }
            });

            return true;
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
            encoder.postMessage(data)
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
            localStorage.setItem('visited', 'true');
            return !result;
        }

        function playStep(step, track) {
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
                buffer = instruments['piano'][currentStep - 1];
            }

            var source = context.createBufferSource();
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

                track.delay.delayTime.value = 60 / settings.tempo * delayBeats;
                track.volumeNode.gain.value = track.volume / 50;
                track.panNode.pan.value = track.panning / 25;
                track.effectsNode.gain.value = track.effects / 50 * !track.dry;
                track.dryNode.gain.value = 1 - track.effectsNode.gain.value;

                var source = context.createBufferSource();
                source.buffer = buffer;

                source.connect(track.volumeNode);

                if (track.locked) {
                    source.playbackRate.value = multiplier *
                        settings.key *
                        settings.keys[currentStep - 1] *
                        Math.pow(2, track.octave);
                } else {
                    source.playbackRate.value = multiplier *
                        track.key *
                        track.keys[currentStep - 1] *
                        Math.pow(2, track.octave);
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
                tracks[0].chant = 'At least one entry of any of the following letters is required in any track: C, D, E, F, G, A, B. Click info icon for more.'
            }

            rec.stop();
            rec.clear();
            rec.record();

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

            var recordingTail = setInterval(function() {
                rec.getBuffer(function(data) {
                    var volume = 0;

                    if (data[0].length > 10000) {
                        for (var i = data[0].length - 10000; i < data[0].length; i++) {
                            volume += Math.abs(data[0][i]);
                        }
                        if (volume < 1) {
                            clearInterval(recordingTail);
                            rec.stop();
                        }
                    } else {
                        clearInterval(recordingTail);
                        rec.stop();
                    }
                });
            }, 1000);
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

            return JSON.stringify([settingsArray, tracksArray]);
        }

        function parseLink(composition, callback) {
            var compositionJson = JSON.parse(composition);
            var data = {
                settings: {},
                tracks: []
            };

            data.settings.tempo = compositionJson[0][c.TEMPO];
            data.settings.loop = compositionJson[0][c.LOOP];
            data.settings.key = compositionJson[0][c.KEY];
            data.settings.keys = compositionJson[0][c.KEYS];
            data.settings.title = compositionJson[0][c.TITLE];
            data.settings.author = compositionJson[0][c.AUTHOR];
            data.settings.notes = compositionJson[0][c.NOTES];
            data.settings.splashscreen = compositionJson[0][c.SPLASH];
            data.settings.keyboard = compositionJson[0][c.KEYBOARD];

            var loaded = 0;

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

                data.tracks[i].currentLetter = 0;
                data.tracks[i].newWord = true;

                data.tracks[i].volumeNode = context.createGain();
                data.tracks[i].panNode = context.createStereoPanner();

                data.tracks[i].effectsNode = context.createGain();
                data.tracks[i].dryNode = context.createGain();

                data.tracks[i].delay = context.createDelay(5.0);
                data.tracks[i].feedback = context.createGain();
                data.tracks[i].feedback.gain.value = 0.3;
                data.tracks[i].filter = context.createBiquadFilter();
                data.tracks[i].filter.frequency.value = 1000;
                data.tracks[i].reverb = context.createConvolver();
                data.tracks[i].reverb.buffer = reverb;

                data.tracks[i].delay.connect(data.tracks[i].feedback);
                data.tracks[i].feedback.connect(data.tracks[i].filter);
                data.tracks[i].filter.connect(data.tracks[i].delay);
                data.tracks[i].reverb.connect(data.tracks[i].effectsNode);
                data.tracks[i].delay.connect(data.tracks[i].effectsNode);

                data.tracks[i].volumeNode.connect(data.tracks[i].panNode);
                data.tracks[i].panNode.connect(data.tracks[i].reverb);
                data.tracks[i].panNode.connect(data.tracks[i].delay);
                data.tracks[i].panNode.connect(data.tracks[i].dryNode);

                data.tracks[i].dryNode.connect(master);
                data.tracks[i].effectsNode.connect(master);

                loadSamples(data.tracks[i].instrument, function() {
                    loaded++;
                    if (loaded === compositionJson[1].length) {
                        callback();
                    }
                });
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
            encodeLink: encodeLink,
            parseLink: parseLink,
            download: download,
            isFirstVisit: isFirstVisit,
            playStep: playStep,
            playChar: playChar,
            newTrack: newTrack,
            loadSamples: loadSamples
        }
    });

})();