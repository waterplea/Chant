(function() {
    'use strict';
    var app = window.angular.module('Chant');

    app.controller('chantController', ['$scope', '$timeout', 'chantService', function($scope, $timeout, chantService) {

        var howto;

        if (!chantService.init(init)) {
            $scope.notSupported = true;
            return;
        }

        $scope.state = {
            isPlaying: false,
            isCopySupported: document.queryCommandSupported('copy'),
            isFirstVisit: false,
            isMenuVisible: false,
            isLoading: false
        };

        $scope.buttons = {
            share: shareButton,
            clear: clearButton,
            featured: function() { showPopup('featured', chantService.getFeaturedCompositions()) },
            save: saveButton,
            load: loadButton,
            download: downloadButton,
            popup: showPopup
        };

        $scope.notes = [
            'C',
            'C#/Db',
            'D',
            'D#/Eb',
            'E',
            'F',
            'F#/Gb',
            'G',
            'G#/Ab',
            'A',
            'A#/Bb',
            'B'
        ];

        $scope.keys = {
            "1":        [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1],
            "1.0595":   [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2],
            "1.1225":   [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3],
            "1.1892":   [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4],
            "1.2599":   [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5],
            "1.3348":   [5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
            "1.4142":   [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7],
            "1.4983":   [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8],
            "1.5874":   [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            "1.6818":   [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            "1.7818":   [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            "1.8877":   [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        };

        $scope.dialog = null;
        $scope.popup = null;

        $scope.$on('removeTrack', function (event, data) {
            var index = $scope.tracks.indexOf(data.track);
            if (index > -1) {
                $scope.tracks[index].removed = (data.direction ? data.direction : 'left');
                $timeout(function() { $scope.tracks.splice(index, 1); }, 500);
            }
            $scope.$apply();
        });

        $scope.$on('loadingStart', function () {
            $scope.state.isLoading = true;
        });

        $scope.$on('loadingEnd', function () {
            $timeout(function() {
                $scope.state.isLoading = false;
            });
        });

        $scope.$on('accidentals', function (event, track) {
            showPopup('accidentals', track);
        });

        $scope.$on('record', function (event, track) {
            showPopup('record', track);
        });

        $scope.$on('solo', function (event, track) {
            var muted = false;

            for (var i = 0; i < $scope.tracks.length; i++) {
                if (!$scope.tracks[i].muted && $scope.tracks[i] !== track) {
                    muted = true;
                }
            }

            for (i = 0; i < $scope.tracks.length; i++) {
                $scope.tracks[i].muted = muted;
            }

            track.muted = false;
        });

        $scope.$on('updateStartingPosition', function(event, position) {
            for (var i = 0; i < $scope.tracks.length; i++) {
                $scope.tracks[i].currentLetter = position;
                $scope.tracks[i].newWord = true;
                for (var j = $scope.tracks[i].currentLetter; j >= 0; j--) {
                    var c = $scope.tracks[i].chant[j];
                    if (c === 'a' || c === 'A' ||
                        c === 'b' || c === 'B' ||
                        c === 'c' || c === 'C' ||
                        c === 'd' || c === 'D' ||
                        c === 'e' || c === 'E' ||
                        c === 'f' || c === 'F' ||
                        c === 'g' || c === 'G') {
                        $scope.tracks[i].newWord = false;
                        break;
                    }
                }
            }
        });

        $scope.translate = function(string) {
            return chantService.translate(string);
        };

        $scope.closeDialog = function(event) {
            if (event && !event.target.classList.contains('dialog--button') && !event.target.classList.contains('dialog--container')) {
                return;
            }

            document.querySelector('.dialog--container').classList.add('closing');
            $timeout(function() {
                $scope.dialog = null;
            }, 300);
        };

        $scope.help = function(event) {
            if (howto) howto.unhowtofy();
            howto = howtofy('.howto-trigger');
            howto.trigger();
        };

        $scope.addTrack = function() {
            $scope.tracks.push(chantService.newTrack());
        };

        $scope.closePopups = function() {
            if (document.getElementsByClassName('popup')[0]) {
                document.getElementsByClassName('popup')[0].classList.add('closing');
                document.removeEventListener('click', onClick);
                $timeout(function() {
                    $scope.popup = null;
                }, 300);
            }
        };

        $scope.scrollTo = function(event, track) {
            $scope.lastTrack = track;
            var element = event.currentTarget.getBoundingClientRect();
            var container = document.querySelector('MAIN');
            if (element.top < 100) {
                scrollTo(container, container.scrollTop + container.getBoundingClientRect().top + element.top + 10, 100);
            }
        };

        $scope.doShare = function(event, isComposition) {
            if (!event.target.classList.contains('popup--share-button')) {
                return;
            }

            var url = '';

            var share = {
                medium: event.target.classList.item(1),
                url: document.querySelector('meta[property="og:url"]').getAttribute('content'),
                title: document.querySelector('meta[property="og:title"]').getAttribute('content'),
                description: document.querySelector('meta[property="og:description"]').getAttribute('content'),
                image: document.querySelector('meta[property="og:image"]').getAttribute('content')
            };

            if (isComposition) {
                share.url = window.location.origin + window.location.pathname + '?c=' + $scope.popup.data;
                share.title = $scope.settings.title || document.querySelector('meta[property="og:title"]').getAttribute('content');
            }

            switch (share.medium) {
                case 'facebook':
                    url  = 'http://www.facebook.com/sharer.php?s=100';
                    url += '&p[title]='     + encodeURIComponent(share.title);
                    url += '&p[summary]='   + encodeURIComponent(share.description);
                    url += '&p[url]='       + encodeURIComponent(share.url);
                    url += '&p[images][0]=' + encodeURIComponent(share.image);
                    break;
                case 'twitter':
                    url  = 'http://twitter.com/share';
                    url += '?text='          + encodeURIComponent(share.title);
                    url += '&url='          + encodeURIComponent(share.url);
                    url += '&counturl='     + encodeURIComponent(share.url);
                    break;
                case 'vk':
                    url  = 'http://vkontakte.ru/share.php';
                    url += '?url='           + encodeURIComponent(share.url);
                    url += '&title='        + encodeURIComponent(share.title);
                    url += '&description='  + encodeURIComponent(share.description);
                    url += '&image='        + encodeURIComponent(share.image);
                    url += '&noparse=true';
                    break;
                case 'google':
                    url  = 'https://plus.google.com/share';
                    url += '?url='          + encodeURIComponent(share.url);
                    break;
                case 'pinterest':
                    url  = 'https://pinterest.com/pin/create/button/';
                    url += '?url='          + encodeURIComponent(share.url);
                    url += '&media='        + encodeURIComponent(share.image);
                    url += '&description='  + encodeURIComponent(share.description);
                    break;
                case 'tumblr':
                    url  = 'http://www.tumblr.com/share?v=3';
                    url += '&u='            + encodeURIComponent(share.url);
                    url += '&t='            + encodeURIComponent(share.title);
                    break;
                case 'reddit':
                    url  = 'http://www.reddit.com/submit';
                    url += '?url='          + encodeURIComponent(share.url);
                    url += '&title=TITLE'   + encodeURIComponent(share.title);
                    break;
                case 'linkedin':
                    url  = 'https://www.linkedin.com/shareArticle?mini=true';
                    url += '&url='      + encodeURIComponent(share.url);
                    url += '&title='    + encodeURIComponent(share.title);
                    url += '&summary='  + encodeURIComponent(share.description);
                    break;
                case 'email':
                    url  = 'mailto:?';
                    url += 'subject=' + share.title + '&body=' + share.description;
                    url += encodeURIComponent(share.url);
                    window.location.href = url;
                    return;
            }

            window.open(url,'_blank','toolbar=0,status=0,width=626,height=436');
        };

        $scope.saveComposition = function(title) {
            if (chantService.doesCompositionExist(title)) {
                $scope.dialog = {
                    title: chantService.translate('dialog.confirm'),
                    text: chantService.translate('dialog.overwrite'),
                    data: title,
                    callback: function() {
                        doSaveComposition(title);
                    }
                };
            } else {
                doSaveComposition(title)
            }
        };

        $scope.loadComposition = function(title) {
            $scope.state.isLoading = true;
            var composition = chantService.load(title, function() {
                $timeout(function() {
                    $scope.state.isLoading = false
                });
            });
            $scope.settings = composition.settings;
            $scope.tracks = composition.tracks;
            $scope.closePopups();
        };

        $scope.removeComposition = function(composition) {
            $scope.dialog = {
                title: chantService.translate('dialog.confirm'),
                text: chantService.translate('dialog.remove'),
                data: composition.title,
                callback: function() {
                    var index = $scope.popup.data.indexOf(composition);
                    $scope.popup.data.splice(index, 1);
                    chantService.remove(composition.title);
                }
            };
        };

        $scope.loadFeatured = function(index) {
            $scope.state.isLoading = true;
            var composition = chantService.parseLink(chantService.getFeaturedCompositions()[index].content, function() {
                $timeout(function() {
                    $scope.state.isLoading = false
                });
            });
            $scope.settings = composition.settings;
            $scope.tracks = composition.tracks;
            $scope.closePopups();

            if ($scope.settings.splashscreen && $scope.settings.title) {
                $timeout(function() { $scope.splashscreen = $scope.settings; }, 400);
            }
        };

        $scope.copyLink = function(event) {
            var field = document.getElementById('link');
            field.select();
            document.execCommand('copy');
            event.target.classList.add('copied');
            event.target.title = chantService.translate('popup.copied');
        };

        $scope.isStepInScale = function(step, instrument) {
            switch (step) {
                case 0:
                    return (parseFloat(instrument.keys[0]) < 1);
                    break;
                case 1:
                    return (parseFloat(instrument.keys[0]) === 1 || parseFloat(instrument.keys[6]) > 1);
                    break;
                case 2:
                    return (parseFloat(instrument.keys[0]) > 1 || parseFloat(instrument.keys[1]) < 1);
                    break;
                case 3:
                    return (parseFloat(instrument.keys[1]) === 1);
                    break;
                case 4:
                    return (parseFloat(instrument.keys[1]) > 1 || parseFloat(instrument.keys[2]) < 1);
                    break;
                case 5:
                    return (parseFloat(instrument.keys[2]) === 1 || parseFloat(instrument.keys[3]) < 1);
                    break;
                case 6:
                    return (parseFloat(instrument.keys[2]) > 1 || parseFloat(instrument.keys[3]) === 1);
                    break;
                case 7:
                    return (parseFloat(instrument.keys[3]) > 1 || parseFloat(instrument.keys[4]) < 1);
                    break;
                case 8:
                    return (parseFloat(instrument.keys[4]) === 1);
                    break;
                case 9:
                    return (parseFloat(instrument.keys[4]) > 1 || parseFloat(instrument.keys[5]) < 1);
                    break;
                case 10:
                    return (parseFloat(instrument.keys[5]) === 1);
                    break;
                case 11:
                    return (parseFloat(instrument.keys[5]) > 1 || parseFloat(instrument.keys[6]) < 1);
                    break;
                case 12:
                    return (parseFloat(instrument.keys[6]) === 1);
                    break;
                case 13:
                    return (parseFloat(instrument.keys[6]) > 1);
                    break;
            }
        };

        $scope.playStep = function(step, track) {
            chantService.playStep(step, track);
        };

        $scope.play = function() {
            if (!$scope.settings.tempo || !$scope.tracks.length) return;

            for (var i = 0; i < $scope.tracks.length; i++) {
                $scope.tracks[i].finished = false;
            }

            $scope.state.isPlaying = true;

            chantService.play($scope.settings, $scope.tracks, $scope.stop, function() {
                $scope.$apply();
            });
        };

        $scope.stop = function() {
            chantService.stop();

            $scope.state.isPlaying = false;
            for (var i = 0; i < $scope.tracks.length; i++) {
                $scope.tracks[i].currentLetter = 0;
                $scope.tracks[i].newWord = true;
                $scope.tracks[i].finished = true;
            }
        };

        function init() {
            window.addEventListener('resize', onResize);
            document.addEventListener('keydown', onKeydown);

            document.querySelector('MAIN').addEventListener('click', function() {
                $scope.state.isMenuVisible = false;
                $scope.$apply()
            });

            if (chantService.isFirstVisit()) {
                $scope.state.isFirstVisit = true;
                document.addEventListener('click', firstVisitClick);
                document.addEventListener('touchstart', firstVisitClick);
            }

            document.getElementById('tempo').addEventListener('wheel', onWheel);

            $scope.tracks = [];

            $scope.settings = {
                tempo: 90,
                loop: true,
                key: '1',
                keys: [1, 1, 1, 1, 1, 1, 1],
                title: '',
                author: '',
                notes: '',
                splashscreen: false,
                keyboard: false
            };

            if (window.location.search) {
                var composition = window.location.search.substr(3, window.location.search.length);
                $scope.state.isLoading = true;
                composition = chantService.parseLink(decodeURIComponent(composition), function() {
                    $timeout(function() {
                        $scope.state.isLoading = false
                    });
                });
                $scope.settings = composition.settings;
                $scope.tracks = composition.tracks;
                if ($scope.settings.splashscreen && $scope.settings.title) {
                    $scope.splashscreen = $scope.settings;
                }
                $scope.$apply();
            } else {
                $scope.addTrack();
                $scope.state.isLoading = true;
                chantService.loadSamples($scope.tracks[0].instrument, function() {
                    $timeout(function() {
                        $scope.state.isLoading = false;
                    });
                });
            }
        }

        function scrollTo(element, to, duration) {
            if (duration <= 0) return;
            var difference = to - element.scrollTop;
            var perTick = difference / duration * 10;

            setTimeout(function() {
                element.scrollTop = element.scrollTop + perTick;
                if (element.scrollTop === to) return;
                scrollTo(element, to, duration - 10);
            }, 10);
        }

        function firstVisitClick() {
            $scope.state.isFirstVisit = false;
            document.removeEventListener('click', firstVisitClick);
            document.removeEventListener('touchstart', firstVisitClick);
            $scope.$apply();
        }

        function onKeydown(event) {
            if (event.keyCode === 27) {
                if ($scope.dialog) $scope.closeDialog();
                if ($scope.popup) $scope.closePopups();
            }

            if ($scope.settings.keyboard) {
                var key;
                switch (event.which) {
                    case 67:
                        key = 'c';
                        break;
                    case 68:
                        key = 'd';
                        break;
                    case 69:
                        key = 'e';
                        break;
                    case 70:
                        key = 'f';
                        break;
                    case 71:
                        key = 'g';
                        break;
                    case 65:
                        key = 'a';
                        break;
                    case 66:
                        key = 'b';
                        break;
                    case 32:
                        key = ' ';
                        break;
                }
                if (event.shiftKey) key = key.toUpperCase();
                chantService.playChar(key, $scope.lastTrack, $scope.settings);
            }
        }

        function onClick(event) {
            if  (document.getElementsByTagName("header")[0].contains(event.target) ||
                document.getElementsByTagName("main")[0].contains(event.target) ||
                document.getElementsByTagName("footer")[0].contains(event.target)) {
                $scope.closePopups();
            }
        }

        function onWheel(event) {
            if (event.target.getAttribute('disabled')) return;

            event.preventDefault();
            event.stopPropagation();

            if (event.deltaY > 0) {
                if ($scope.settings.tempo > event.target.getAttribute('min')) {
                    $scope.settings.tempo--;
                }
            } else {
                if ($scope.settings.tempo < event.target.getAttribute('max')) {
                    $scope.settings.tempo++;
                }
            }

            $scope.$apply();
        }

        function onResize() {
            if (!document.activeElement.classList.contains('track--chant')) {
                return;
            }
            var element = document.activeElement.getBoundingClientRect();
            var container = document.querySelector('MAIN');
            container.scrollTop = container.scrollTop + container.getBoundingClientRect().top + 70 + element.top;
        }

        function shareButton() {
            var link = window.location.origin + window.location.pathname + '?c=' +
                encodeURIComponent(chantService.encodeLink($scope.settings, $scope.tracks));
            showPopup('share', link);
        }

        function clearButton() {
            $scope.dialog = {
                title: chantService.translate('dialog.confirm'),
                text: chantService.translate('dialog.clear'),
                callback: function() {
                    doClearComposition();
                }
            };
        }

        function saveButton() {
            showPopup('save', chantService.getSavedCompositions());
            $timeout(function() {
                document.getElementById('save-name').focus();
            }, 300);
        }

        function loadButton() {
            showPopup('load', chantService.getSavedCompositions());
        }

        function downloadButton() {
            if (!chantService.download($scope.settings.title)) {
                $scope.dialog = {
                    title: chantService.translate('dialog.note'),
                    text: chantService.translate('dialog.download')
                };
            }
        }

        function showPopup(popup, data) {
            setTimeout(function () {
                document.addEventListener('click', onClick);
            }, 0);
            $scope.popup = {
                type: popup,
                data: data
            };
        }

        function doSaveComposition(title) {
            try {
                chantService.save(title, $scope.settings, $scope.tracks);
                $scope.settings.title = title;
                $scope.closePopups();
            } catch(e) {
                $scope.dialog = {
                    title: chantService.translate('error.title'),
                    text: chantService.translate('error.storage')
                };
                $scope.$apply();
            }
        }

        function doClearComposition() {
            $scope.tracks = [];
            $scope.addTrack();
        }

    }]);

})();