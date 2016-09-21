/*
 * Initializes Howto.js
 *
 * @param {string} trigger - a selector to add click event handler to start Howto
 * @param {array} functions - an array of functions to be executed between steps
 * @param {string} [container=body] - a selector for the container to fetch steps from (default body)
 */
function howtofy(trigger, functions, container) {
    var items = (document.querySelector(container) || document.body).querySelectorAll('[data-howto-step]');
    items = Array.prototype.slice.call(items, 0);
    var prerequisites = functions;
    items.sort(function(a, b) {
        return a.getAttribute('data-howto-step') - b.getAttribute('data-howto-step');
    });
    var index = 0;

    var cover = document.createElement('DIV');
    cover.className = 'howto-curtain';

    var back = (navigator.language || navigator.userLanguage) === 'ru' ? 'Назад' : 'Back';
    var close = (navigator.language || navigator.userLanguage) === 'ru' ? 'Выход' : 'Close';
    var next = (navigator.language || navigator.userLanguage) === 'ru' ? 'Далее' : 'Next';

    var template = document.createElement('SECTION');
    template.innerHTML = '<span></span><p>' +
        '<button type="button" id="howto-back">' + back + '</button>' +
        '<button type="button" id="howto-close">' + close + '</button>' +
        '<button type="button" id="howto-next">' + next + '</button>' +
        '</p>';

    var text = template.querySelector('SPAN');

    template.querySelector('#howto-back').addEventListener('click', howtoPrev );
    template.querySelector('#howto-close').addEventListener('click', howtoStop );
    template.querySelector('#howto-next').addEventListener('click', howtoNext );

    var triggers = document.querySelectorAll(trigger);
    for (var i = 0; i < triggers.length; i++) {
        triggers[i].addEventListener('click', howtoStart);
    }

    function howtoStart() {
        var valid = false;
        index = 0;

        for (index; index < items.length; index++) {
            var visible = items[index].getBoundingClientRect().width + items[index].getBoundingClientRect().height;
            if (visible || (prerequisites && prerequisites[index + 1])) {
                valid = true;
                break;
            }
        }

        if (!valid) return;

        template.className = 'howto';

        document.body.appendChild(cover);
        document.body.appendChild(template);
        window.addEventListener('resize', howtoPosition);
        document.querySelector('.howto-curtain').addEventListener('click', howtoStop);

        index--;
        howtoNext(true);
        template.querySelector('#howto-back').style.visibility = 'hidden';
    }

    function howtoStop() {
        var element = document.querySelector('.howto');
        element.parentNode.removeChild(element);
        element = document.querySelector('.howto-curtain');
        element.parentNode.removeChild(element);
        window.removeEventListener('resize', howtoPosition);
        cover.style.width = 0;
        cover.style.height = 0;
        template.style.left = '100vw';
        template.querySelector('#howto-next').style = null;
    }

    function howtoNext(initial) {
        if (initial !== true) template.querySelector('#howto-back').style = null;
        var valid = false;
        index++;
        for (index; index < items.length; index++) {
            items[index].scrollIntoView(false);
            var itemPosition = items[index].getBoundingClientRect();
            var visible = (
            itemPosition.width && itemPosition.height
            && (itemPosition.bottom > 0 && itemPosition.top < window.innerHeight)
            && (itemPosition.right > 0 && itemPosition.left < window.innerWidth));
            if (visible || (prerequisites && prerequisites[index + 1])) {
                valid = true;
                break;
            }
        }

        if (valid) {
            howtoPosition();
        } else {
            howtoStop();
        }

        valid = false;

        for (var i = index + 1; i < items.length; i++) {
            items[i].scrollIntoView(false);
            itemPosition = items[i].getBoundingClientRect();
            visible = (
            itemPosition.width && itemPosition.height
            && (itemPosition.bottom > 0 && itemPosition.top < window.innerHeight)
            && (itemPosition.right > 0 && itemPosition.left < window.innerWidth));
            if (visible || (prerequisites && prerequisites[index + 1])) {
                valid = true;
                break;
            }
        }

        items[index].scrollIntoView(false);

        if (!valid) {
            template.querySelector('#howto-next').style.visibility = 'hidden';
        }
    }

    function howtoPrev() {
        template.querySelector('#howto-next').style = null;
        index--;
        var valid = false;
        for (index; index >= 0; index--) {
            items[index].scrollIntoView(false);
            var itemPosition = items[index].getBoundingClientRect();
            var visible = (
            itemPosition.width && itemPosition.height
            && (itemPosition.bottom > 0 && itemPosition.top < window.innerHeight)
            && (itemPosition.right > 0 && itemPosition.left < window.innerWidth));
            if (visible || (prerequisites && prerequisites[index + 1])) {
                valid = true;
                break;
            }
        }

        howtoPosition();

        valid = false;

        for (var i = index - 1; i >= 0; i--) {
            items[i].scrollIntoView(false);
            itemPosition = items[i].getBoundingClientRect();
            visible = (
            itemPosition.width && itemPosition.height
            && (itemPosition.bottom > 0 && itemPosition.top < window.innerHeight)
            && (itemPosition.right > 0 && itemPosition.left < window.innerWidth));
            if (visible || (prerequisites && prerequisites[index + 1])) {
                valid = true;
                break;
            }
        }

        items[index].scrollIntoView(false);

        if (!valid) {
            template.querySelector('#howto-back').style.visibility = 'hidden';
        }
    }

    function howtoPosition() {
        var delay = 0;
        if (prerequisites && prerequisites[index + 1]) {
            delay = prerequisites[index + 1]();
        }

        setTimeout(function() {
            text.innerHTML = items[index].getAttribute('data-howto-text');
            template.className = 'howto';

            var position = items[index].getBoundingClientRect();

            cover.style.top = position.top - 10 + 'px';
            cover.style.left = position.left - 10 + 'px';
            cover.style.width = position.width + 20 + 'px';
            cover.style.height = position.height + 20 + 'px';

            var top = 0;
            var left = 0;

            var preferredX = (position.left * 2 + position.width < window.innerWidth) ? 1 : 0;
            var preferredY = (position.top * 2 + position.height < window.innerHeight) ? 1 : 0;

            if (position.width / position.height >= 1) {
                var centerX = (position.width > template.getBoundingClientRect().width) ? 1 : 0;

                if (preferredY) {
                    top = position.bottom + 30;
                } else {
                    top = position.top - 30 - template.getBoundingClientRect().height;
                    template.classList.add('bottom');
                }

                if (preferredX) {
                    left = position.left + 10;
                } else {
                    left = position.right - template.getBoundingClientRect().width - 10;
                    template.classList.add('right');
                }

                if (centerX) {
                    left = position.left + (position.width - template.getBoundingClientRect().width) / 2;
                    template.classList.add('center');
                    template.classList.remove('right');
                }
            } else {
                var centerY = (position.height > template.getBoundingClientRect().height) ? 1 : 0;

                template.classList.add('horizontal');

                if (preferredY) {
                    top = position.top + 10;
                } else {
                    top = position.bottom - template.getBoundingClientRect().height - 10;
                    template.classList.add('bottom');
                }

                if (preferredX) {
                    left = position.right + 30;
                } else {
                    left = position.left - template.getBoundingClientRect().width - 30;
                    template.classList.add('right');
                }

                if (centerY) {
                    top = position.top + (position.height - template.getBoundingClientRect().height) / 2;
                    template.classList.add('center');
                    template.classList.remove('bottom');
                }
            }

            if (left < 0) {
                left = 10;
                if (left + template.getBoundingClientRect().width + 30 > position.right) {
                    template.className = 'howto blank';
                }
            }

            if (left + template.getBoundingClientRect().width > window.innerWidth) {
                left = window.innerWidth - template.getBoundingClientRect().width - 10;
                if (left - 30 < position.left) {
                    template.className = 'howto blank';
                }
            }

            if (top < 0) {
                top = 10;
                if (top + template.getBoundingClientRect().height + 30 > position.bottom) {
                    template.className = 'howto blank';
                }
            }

            if (top + template.getBoundingClientRect().height > window.innerHeight) {
                top = window.innerWidth - template.getBoundingClientRect().height - 10;
                if (top - 30 < position.top) {
                    template.className = 'howto blank';
                }
            }

            template.style.top = top + 'px';
            template.style.left = left + 'px';
        }, delay);
    }

    return {
        unhowtofy: function() {
            for (var i = 0; i < triggers.length; i++) {
                triggers[i].removeEventListener('click', howtoStart);
            }
        },
        trigger: howtoStart
    }
}