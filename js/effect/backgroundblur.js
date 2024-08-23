var bgParameters = {
    'scale': [3, 1, 7]
};
let BlurS = bgParameters['scale'][0];

function enableBgBlur() {
    const bgImage = document.getElementById('bgimg');
    let bgscale = 'blur(' + BlurS + 'px)';
    bgImage.style.filter = bgscale;
}

function disableBgBlur() {
    const bgImage = document.getElementById('bgimg');
    bgImage.style.filter = '';
}

function updateBgBlur() {
    if (bgParameters['scale'][0] != BlurS) {
        BlurS = bgParameters['scale'][0];
        enableBgBlur();
    }
}