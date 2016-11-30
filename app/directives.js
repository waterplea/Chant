(function() {
    'use strict';
    var app = window.angular.module('Chant');

    app.directive('chant', ['chantService', '$timeout', function(chantService, $timeout) {
        return {
            require: 'ngModel',
            restrict: 'E',
            scope: {
                disabled: '=',
                ngModel: '='
            },
            replace: true,
            templateUrl: 'templates/chant.html',
            controller: ['$scope', function ($scope) {
                $scope.loadSamples = function(instrument) {
                    $scope.isLoading = true;
                    chantService.reWire($scope.track);
                    chantService.loadSamples(instrument, function() {
                        $timeout(function() {
                            $scope.isLoading = false;
                        })
                    });
                };

                $scope.showAccidentals = function() {
                    $scope.$emit('accidentals', $scope.track);
                };

                $scope.solo = function() {
                    $scope.$emit('solo', $scope.track);
                };

                $scope.updateStartingPosition = function() {
                    var range = window.getSelection().getRangeAt(0);
                    if (range && range.endOffset - range.startOffset >= 1) $scope.$emit('updateStartingPosition', range.startOffset);
                };

                $scope.translate = function(string) {
                    return chantService.translate(string);
                };
            }],
            link: function(scope, element) {
                var xDown, yDown, xDiff, yDiff;
                var prevValue = '';

                scope.track = scope.ngModel;

                scope.isLoading = true;
                chantService.loadSamples(scope.track.instrument, function() {
                    $timeout(function() {
						scope.isLoading = false;
					});
                });

                element[0].querySelector('.track--chant').innerHTML = scope.track.chant;

                element[0].addEventListener('touchstart', handleTouchStart, false);
                element[0].addEventListener('touchmove', handleTouchMove, false);
                element[0].addEventListener('touchend', handleTouchEnd, false);
                element[0].querySelector('.track--octave-input').addEventListener('wheel', onWheel);
                element[0].querySelector('.track--volume-input').addEventListener('wheel', onWheel);
                element[0].querySelector('.track--panning-input').addEventListener('wheel', onWheel);
                element[0].querySelector('.track--effects-input').addEventListener('wheel', onWheel);

                element[0].querySelector('.track--remove').addEventListener('click', function() {
                    scope.$emit('removeTrack', { track: scope.track, direction: 'left' });
                });

                function onWheel(event) {
                    if (event.target.getAttribute('disabled')) return;

                    var path = event.target.getAttribute('data-ng-model').split('.');

                    event.preventDefault();
                    event.stopPropagation();

                    if (event.deltaY > 0) {
                        if (scope[path[0]][path[1]] > event.target.getAttribute('min')) {
                            scope[path[0]][path[1]]--;
                        }
                    } else {
                        if (scope[path[0]][path[1]] < event.target.getAttribute('max')) {
                            scope[path[0]][path[1]]++;
                        }
                    }

                    scope.$digest();
                }

                function handleTouchStart(event) {
                    if (event.target.tagName !== 'DIV') return;
                    xDown = event.touches[0].clientX;
                    yDown = event.touches[0].clientY;
                    xDiff = 0;
                    yDiff = 0;
                }

                function handleTouchMove(event) {
                    if (event.target.tagName !== 'DIV') return;
                    var xUp = event.touches[0].clientX;
                    var yUp = event.touches[0].clientY;

                    xDiff = xDown - xUp;
                    yDiff = yDown - yUp;

                    if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
                        event.currentTarget.style.transform = 'translate3d(' + (-1 * xDiff) + 'px, 0, 0)';
                        event.currentTarget.style.transition = 'none';
                    }
                }

                function handleTouchEnd(event) {
                    event.currentTarget.style.transform = '';
                    event.currentTarget.style.transition = '';
                    if (xDiff > 150) {
                        scope.$emit('removeTrack', { track: scope.track, direction: 'left' });
                    } else if (xDiff < -150) {
                        scope.$emit('removeTrack', { track: scope.track, direction: 'right' });
                    }
                }

                function getCaretCharacterOffsetWithin(element) {
                    var caretOffset = 0;
                    var selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        var range = selection.getRangeAt(0);
                        var preCaretRange = range.cloneRange();
                        preCaretRange.selectNodeContents(element);
                        preCaretRange.setEnd(range.endContainer, range.endOffset);
                        caretOffset = preCaretRange.toString().length;
                    }
                    return caretOffset;
                }

                function getDifference(a, b) {
                    var i = 0;
                    var j = 0;
                    var result = "";

                    while (j < b.length)
                    {
                        if (a[i] != b[j] || i == a.length)
                            result += b[j];
                        else
                            i++;
                        j++;
                    }
                    return result;
                }

                function parseInput(input) {
                    var result = '';

                    if (prevValue.length && input.length > prevValue.length) {
                        result = getDifference(prevValue, input);
                    }

                    if (input.length === 1) {
                        result = input;
                    }

                    prevValue = input;
                    scope.$emit('charPressed', result);
                }

                element[0].querySelector('.track--chant').addEventListener('input', function(event) {
                    scope.track.chant = event.target.textContent;
                    if (event.target.innerHTML === event.target.textContent) {
                        parseInput(event.target.textContent);
                        return;
                    }
                    var position = getCaretCharacterOffsetWithin(event.target);
                    event.target.innerHTML = event.target.textContent.replace('<', '&lt;');
                    var range = document.createRange();
                    var sel = window.getSelection();
                    if (event.target.childNodes[0]) {
                        range.setStart(event.target.childNodes[0], position);
                    } else {
                        range.setStart(event.target, 0);
                    }
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);

                    parseInput(event.target.textContent);
                });

                scope.$watch('track.chant', function(value) {
                    if (element[0].querySelector('.track--chant').innerHTML !== value) element[0].querySelector('.track--chant').innerHTML = value;
                });

                scope.$watch('disabled', function(value) {
                    if (!value || scope.track.chant.length !== 1) {
                        return;
                    }

                    var match;

                    switch (scope.track.chant.charAt(0)) {
                        case 'C':
                        case 'c':
                        case 'D':
                        case 'd':
                        case 'E':
                        case 'e':
                        case 'F':
                        case 'f':
                        case 'G':
                        case 'g':
                        case 'A':
                        case 'a':
                        case 'B':
                        case 'b':
                            match = true;
                            break;
                    }

                    element[0].querySelector('.track--chant').innerHTML = '<span class="track--chant-current ' + (match ? 'match' : '') + '">' + element[0].querySelector('.track--chant').textContent + '</span>';
                });

                scope.$watch('track.currentLetter', function(value) {
                    var previousStep = false;
                    var currentStep = false;
                    var textarea = element[0].querySelector('.track--chant');

                    switch (scope.track.chant.charAt(value - 1)) {
                        case 'C':
                        case 'c':
                        case 'D':
                        case 'd':
                        case 'E':
                        case 'e':
                        case 'F':
                        case 'f':
                        case 'G':
                        case 'g':
                        case 'A':
                        case 'a':
                        case 'B':
                        case 'b':
                            previousStep = true;
                            break;
                    }

                    switch (scope.track.chant.charAt(value)) {
                        case 'C':
                        case 'c':
                        case 'D':
                        case 'd':
                        case 'E':
                        case 'e':
                        case 'F':
                        case 'f':
                        case 'G':
                        case 'g':
                        case 'A':
                        case 'a':
                        case 'B':
                        case 'b':
                            currentStep = true;
                            break;
                    }

                    if (textarea.textContent) {
                        var chant = textarea.textContent;
                        var before = '<span class="track--chant-before ';
                        var current = '<span class="track--chant-current ';
                        var after = '</span>';

                        if (value > 1) {
                            chant = before + '">' + chant.substring(0, value - 1) + after +
                                before + (previousStep ? 'match' : '') + '">' + chant.substr(value - 1, 1) + after +
                                current + (currentStep ? 'match' : '') + '">' + chant.substr(value, 1) + after +
                                chant.substring(value + 1, chant.length);
                        } else {
                            chant = before + '">' + chant.substring(0, value) + after +
                                current + (currentStep ? 'match' : '') + '">' + chant.substr(value, 1) + after +
                                chant.substring(value + 1, chant.length);
                        }
                        textarea.innerHTML = chant;
                    }

                    if (scope.track.finished == undefined || scope.track.finished && value === 0) textarea.innerHTML = textarea.textContent
                });
            }
        }
    }]);

})();