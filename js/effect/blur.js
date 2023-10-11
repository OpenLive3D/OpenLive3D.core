var blurParameters = {
    'scale': [3, 1, 7]
};
let curBlurS = blurParameters['scale'][0];

function enableBlurEffect() {
    let canvas = document.getElementById("canvas");
    let blurscale = 'blur(' + curBlurS + 'px)';
    canvas.style['-webkit-backdrop-filter'] = blurscale;
    canvas.style['-moz-filter'] = blurscale;
    canvas.style['-o-filter'] = blurscale;
    canvas.style['-ms-filter'] = blurscale;
    canvas.style['filter'] = blurscale;
}

function disableBlurEffect() {
    let canvas = document.getElementById("canvas");
    canvas.style['-webkit-backdrop-filter'] = '';
    canvas.style['-moz-filter'] = '';
    canvas.style['-o-filter'] = '';
    canvas.style['-ms-filter'] = '';
    canvas.style['filter'] = '';
}

function updateBlurEffect(delta) {
    if (blurParameters['scale'][0] != curBlurS) {
        curBlurS = blurParameters['scale'][0];
        enableBlurEffect();
    }
}
