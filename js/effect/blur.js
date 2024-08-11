var blurParameters = {
    'scale': [3, 1, 7]
};
var bgParameters = {
    'scale': [3, 1, 7]
};
let curBlurS = blurParameters['scale'][0];

//seperate background blur from canvas
let BlurS = bgParameters['scale'][0];

function enableBlurEffect(key) {
    let canvas = document.getElementById("canvas");
    let blurscale = 'blur(' + curBlurS + 'px)';
    let bgscale = 'blur(' + BlurS + 'px)';
    const bgImage = document.getElementById('bgimg');
    if(key === 'BLUR_BG'){
        bgImage.style.filter = bgscale;
    } else {
        canvas.style['-webkit-backdrop-filter'] = blurscale;
        canvas.style['-moz-filter'] = blurscale;
        canvas.style['-o-filter'] = blurscale;
        canvas.style['-ms-filter'] = blurscale;
        canvas.style['filter'] = blurscale;
    }
}

function disableBlurEffect(key) {
    let bgImg = document.getElementById('bgimg');
    let canvas = document.getElementById("canvas");
    if (key === 'BLUR_BG') {
        bgImg.style.filter = '';
    } else {
        canvas.style['filter'] = '';
        canvas.style['-webkit-backdrop-filter'] = '';
        canvas.style['-moz-filter'] = '';                                                                                                                               
        canvas.style['-o-filter'] = ''; 
        canvas.style['-ms-filter'] = '';    
        
    }
}

function updateBlurEffect(delta) {
    if (blurParameters['scale'][0] != curBlurS) {
        curBlurS = blurParameters['scale'][0];
        enableBlurEffect();
    } else if (bgParameters['scale'][0] != BlurS){
        BlurS = bgParameters['scale'][0];
        enableBlurEffect('BLUR_BG');
    }
}
