var period = 1000;

onmessage = function (event) {
    period = event.data;
    tick();
};

function tick() {
    postMessage('Tick');
    setTimeout("tick()", period);
}