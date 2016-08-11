var app = angular.module('chant', []);

app.controller('mainCtrl', ['$scope', '$interval', function($scope, $interval){

    var context;
    var bufferLoader;

    try {
        window.AudioContext = window.AudioContext||window.webkitAudioContext;
        context = new AudioContext();
    }
    catch(e) {
        $scope.notSupported = true;
        return;
    }
    var interval;
    var currentLetter = 0;
    var newWord;
    var delayBeats = 1.5;


    $scope.isPlaying = false;
    $scope.loop = true;
    $scope.chant = '';
    $scope.instrument = 'Piano';
    $scope.key = '1';
    $scope.octaveShift = 0;
    $scope.tempo = 180;
    $scope.steps = [
        1,
        1,
        1,
        1,
        1,
        1,
        1
    ];

    var scale = [];
    var impulseResponse;

    loadSamples($scope.instrument.toLowerCase());
    loadReverb('ErrolBrickworksKiln');

    var delay = context.createDelay(5.0);

    var feedback = context.createGain();
    feedback.gain.value = 0.3;

    var filter = context.createBiquadFilter();
    filter.frequency.value = 1000;

    var reverb = context.createConvolver();
    reverb.buffer = impulseResponse;

    delay.connect(feedback);
    feedback.connect(filter);
    filter.connect(delay);

    $scope.play = function() {
        newWord = true;
        $scope.isPlaying = true;
        interval = $interval(playback, (30000/$scope.tempo|0));
    };

    $scope.stop = function() {
        $scope.isPlaying = false;
        currentLetter = 0;
        $interval.cancel(interval);
    };

    $scope.showform = function(event) {
        $scope.formActive = !$scope.formActive;
        event.stopPropagation();
    };

    function playback() {
        var buffer;
        var currentStep = 0;

        switch ($scope.chant.charAt(currentLetter)) {
            case 'C':
            case 'c':
                currentStep = 1;
                break;
            case 'D':
            case 'd':
                currentStep = 2;
                break;
            case 'E':
            case 'e':
                currentStep = 3;
                break;
            case 'F':
            case 'f':
                currentStep = 4;
                break;
            case 'G':
            case 'g':
                currentStep = 5;
                break;
            case 'A':
            case 'a':
                currentStep = 6;
                break;
            case 'B':
            case 'b':
                currentStep = 7;
                break;
            case ' ':
            case '\t':
            case '\n':
            case '\r':
                newWord = true;
                break;
            default:
                break;
        }

        if (currentStep) {
            buffer = scale[currentStep - 1];

            delay.delayTime.value = 60 / $scope.tempo * delayBeats;

            var source = context.createBufferSource();
            source.buffer = buffer;

            source.connect(delay);
            source.connect(reverb);
            reverb.connect(context.destination);
            delay.connect(context.destination);

            source.playbackRate.value = 1.0 * $scope.key * $scope.steps[currentStep - 1] * Math.pow(2, $scope.octaveShift);

            if (newWord) {
                source.playbackRate.value *= 0.5;
                newWord = false;
            }

            source.start(0);
        }

        currentLetter++;
        if (currentLetter === $scope.chant.length) {
            if ($scope.loop) {
                currentLetter = 0;
            } else {
                $scope.stop();
            }
        }
    }

    function loadReverb(reverb) {
        bufferLoader = new BufferLoader(
            context,
            [
                'assets/audio/reverb/' + reverb + '.m4a'
            ],
            function(data) {
                impulseResponse = data[0];
            }
        );

        bufferLoader.load();
    }

    function loadSamples(type) {
        bufferLoader = new BufferLoader(
            context,
            [
                'assets/audio/' + type + '/1.wav',
                'assets/audio/' + type + '/2.wav',
                'assets/audio/' + type + '/3.wav',
                'assets/audio/' + type + '/4.wav',
                'assets/audio/' + type + '/5.wav',
                'assets/audio/' + type + '/6.wav',
                'assets/audio/' + type + '/7.wav'
            ],
            function(data) {
                scale = data;
            }
        );

        bufferLoader.load();
    }

    document.addEventListener('touchstart', handleTouchStart, false);
    document.addEventListener('touchmove', handleTouchMove, false);
    document.getElementsByTagName('MAIN')[0].addEventListener('click', handleMainClick, false);

    function handleMainClick() {
        $scope.formActive = false;
        $scope.$apply();
    }

    var xDown = null;
    var yDown = null;

    function handleTouchStart(evt) {
        xDown = evt.touches[0].clientX;
        yDown = evt.touches[0].clientY;
    }

    function handleTouchMove(evt) {
        if ( ! xDown || ! yDown ) {
            return;
        }

        var xUp = evt.touches[0].clientX;
        var yUp = evt.touches[0].clientY;

        var xDiff = xDown - xUp;
        var yDiff = yDown - yUp;

        if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {/*most significant*/
            if (xDiff > 0 ) {
                $scope.formActive = false;
            } else {
                $scope.formActive = true;
            }
        } else {
            if ( yDiff > 0 ) {
                /* up swipe */
            } else {
                /* down swipe */
            }
        }
        /* reset values */
        xDown = null;
        yDown = null;

        $scope.$apply();
    }

}]);

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