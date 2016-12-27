(function() {
    'use strict';
    var app = window.angular.module('Chant');

    app.controller('chantController', ['$scope', '$timeout', 'chantService', function($scope, $timeout, chantService) {

        var hasPlayed, undoTimer, removedIndex, titleBackup, originalHeight;

        if (!chantService.init(init)) {
            $scope.notSupported = true;
            return;
        }

        $scope.hd = !!localStorage.getItem('hd');

        $scope.state = {
            isPlaying: false,
            isFirstVisit: false,
            isMenuVisible: false
        };

        $scope.buttons = {
            play: function() { $scope.state.isPlaying ? stop() : play() },
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

            removedIndex = index;
            undo($scope.translate('ui.removed'), undoRemove, $scope.tracks[index], function() { removedIndex = null; });
            $scope.$apply();
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

        $scope.$on('charPressed', function (event, data) {
            if ($scope.settings.keyboard) {
                chantService.playChar(data, $scope.lastTrack, $scope.settings);
            }
        });

        $scope.toggleHd = function() {
            if ($scope.hd) {
                localStorage.setItem('hd', true);
            } else {
                localStorage.removeItem('hd');
            }
        };

        $scope.validateTitle = function() {
            if (!$scope.settings.title && titleBackup) {
                $scope.settings.title = titleBackup;
            } else {
                titleBackup = $scope.settings.title;
            }
        };

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
                share.url = $scope.popup.data;
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
                doSaveComposition(title);
                undo($scope.translate('popup.overwritten'), undoComposition);
            } else {
                doSaveComposition(title)
            }
        };

        $scope.loadComposition = function(title) {
            var composition = chantService.load(title);
            $scope.settings = composition.settings;
            $scope.tracks = composition.tracks;
            $scope.closePopups();
        };

        $scope.removeComposition = function(composition) {
            var index = $scope.popup.data.indexOf(composition);
            $scope.popup.data.splice(index, 1);
            chantService.remove(composition.title);

            undo($scope.translate('popup.removed'), undoComposition);
        };

        $scope.loadFeatured = function(index) {
            var composition = chantService.parseLink(chantService.getFeaturedCompositions()[index].content);
            $scope.settings = composition.settings;
            $scope.tracks = composition.tracks;
            $scope.closePopups();

            if ($scope.settings.splashscreen) {
                $timeout(function() { showPopup('splashscreen'); }, 400);
            }
        };

        $scope.copyLink = function(event) {
            var field = document.getElementById('link');
            field.select();
            if (document.queryCommandEnabled('copy')) {
                event.target.classList.add('copied');
                event.target.title = chantService.translate('popup.copied');
                document.execCommand('copy');
            } else {
                event.target.classList.add('failed');
                event.target.title = chantService.translate('popup.failed');
            }
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

        $scope.wakeSafari = function() {
            chantService.playStep(1, $scope.settings, true);
        };

        function play() {
            $scope.wakeSafari();
            if (!$scope.tracks.length) return;

            if (!$scope.settings.tempo) $scope.settings.tempo = 90;

            for (var i = 0; i < $scope.tracks.length; i++) {
                $scope.tracks[i].finished = false;
            }

            $scope.state.isPlaying = true;
            hasPlayed = true;

            chantService.play($scope.settings, $scope.tracks, stop, function() {
                $scope.$apply();
            });
        }

        function stop() {
            chantService.stop();

            $scope.state.isPlaying = false;
            for (var i = 0; i < $scope.tracks.length; i++) {
                $scope.tracks[i].currentLetter = -1;
                $scope.tracks[i].newWord = true;
                $scope.tracks[i].finished = true;
            }
        }

        function init() {
            window.addEventListener('resize', onResize);
            document.addEventListener('keydown', onKeydown);

            document.querySelector('MAIN').addEventListener('click', function() {
                $scope.state.isMenuVisible = false;
                $scope.$apply()
            });
			
            //TODO: Update help
            if (chantService.isFirstVisit()) {
                $scope.state.isFirstVisit = true;
                document.addEventListener('click', firstVisitClick);
                document.addEventListener('touchstart', firstVisitClick);
                document.querySelector('.header--controls-help').addEventListener('mouseenter', firstVisitClick);
                document.querySelector('.footer--controls-help').addEventListener('mouseenter', firstVisitClick);
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
                composition = chantService.parseLink(decodeURIComponent(composition));
                if (composition) {
                    $scope.settings = composition.settings;
                    $scope.tracks = composition.tracks;
                    if ($scope.settings.splashscreen) {
                        $timeout(function() { showPopup('splashscreen'); }, 400);
                    }
                } else {
                    $scope.dialog = {
                        title: chantService.translate('dialog.error'),
                        text: chantService.translate('dialog.link')
                    };
                    $scope.addTrack();
                }
            } else {
                $scope.addTrack();
            }

            $scope.lastTrack = $scope.tracks[0];
            $scope.$apply();
        }

        function clearButton() {
            undo($scope.translate('ui.cleared'), undoClear, $scope.tracks);

            $scope.tracks = [];
            $scope.addTrack();
        }

        function undo(text, func, data, expireCallback) {
            $scope.undo = {
                data: data,
                text: text,
                func: func
            };

            if (document.querySelector('.undo')) document.querySelector('.undo').classList.remove('closing');
            clearTimeout(undoTimer);
            undoTimer = setTimeout(function() {
                document.querySelector('.undo').classList.add('closing');
                undoTimer = setTimeout(function() {
                    if (expireCallback) expireCallback();
                    $scope.undo = null;
                    $scope.$apply();
                }, 300);
            }, 5000);
        }

        function undoRemove() {
            clearTimeout(undoTimer);
            $scope.undo.data.removed = '';
            $scope.tracks.splice(removedIndex, 0, $scope.undo.data);
            $scope.undo = null;
            removedIndex = null;
        }

        function undoClear() {
            $scope.tracks = $scope.undo.data;
            $scope.undo = null;
        }

        function undoComposition() {
            clearTimeout(undoTimer);
            $scope.undo = null;
            chantService.undo();

            if ($scope.popup) $scope.popup.data = chantService.getSavedCompositions();
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
                document.querySelector('.header--controls-help').removeEventListener('mouseenter', firstVisitClick);
                document.querySelector('.footer--controls-help').removeEventListener('mouseenter', firstVisitClick);
            $scope.$apply();
        }

        function onKeydown(event) {
            if ((event.ctrlKey || event.metaKey) && String.fromCharCode(event.which).toLowerCase() === 's') {
                event.preventDefault();
                $scope.saveComposition($scope.settings.title);
                $scope.$digest();
                return;
            }

            if (event.keyCode === 27) {
                if ($scope.dialog) $scope.closeDialog();
                if ($scope.popup) $scope.closePopups();
            }

            if ($scope.settings.keyboard && !document.activeElement.classList.contains('track--chant')) {
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
                if (event.shiftKey && key) key = key.toUpperCase();
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
            var link = window.location.origin + window.location.pathname + '?c=' + chantService.encodeLink($scope.settings, $scope.tracks);
            showPopup('share', link);
        }

        function saveButton() {
            titleBackup = $scope.settings.title;
            showPopup('save', chantService.getSavedCompositions());
            $timeout(function() {
                document.getElementById('save-name').focus();
            }, 300);
        }

        function loadButton() {
            showPopup('load', chantService.getSavedCompositions());
        }

        function downloadButton() {
            if (hasPlayed) {
                chantService.download($scope.settings.title);
            } else {
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
            if (!title) return;
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

    }]);

})();