var rainParameters = {
    'intensity': [500, 0, 2000],
    'speed': [32, 0, 200],
    'angle': [0, -10, 10],
    'width': [3, 1, 10],
    'color': "#B0C0D0"
};

function getRainEP(key) {
    if (key == 'color') {
        return rainParameters['color'];
    } else {
        return parseInt(rainParameters[key][0]);
    }
}
const rainLengthMin = 0.4;
const rainLengthMax = 1.2;
const rainAngleRange = 10;
const rainProb = 0.05;

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function drawRain(canvas, arr) {
    let ctx = canvas.getContext("2d");
    ctx.lineWidth = getRainEP('width');
    ctx.lineCap = 'round';
    ctx.strokeStyle = getRainEP('color');
    for (let i = 0; i < arr.length; i++) {
        let p = arr[i];
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[0] + p[4] * p[2],
            p[1] + p[4] * p[3]);
        ctx.stroke();
    }
    ctx.fill();
}

function getRandMinMax(vMin, vMax) {
    return Math.random() * (vMax - vMin) + vMin;
}

function getMotion() {
    let s = getRandMinMax(getRainEP('speed') / 2, getRainEP('speed'));
    let r = getRandomInt(rainAngleRange) - rainAngleRange / 2 + getRainEP('angle');
    let dx = s * Math.sin(r * Math.PI / 180);
    let dy = Math.abs(s * Math.cos(r * Math.PI / 180));
    return [dx, dy];
}

function newRainDrop() {
    let x = getRandomInt(window.innerWidth + 20) - 10;
    let y = -getRandMinMax(2, 10) - rainLengthMax;
    let tmp = getMotion();
    let l = getRandMinMax(rainLengthMin, rainLengthMax);
    return [x, y, tmp[0], tmp[1], l];
}

function moveNodes(arr) {
    let tarr = [];
    for (let i = 0; i < getRainEP('intensity'); i++) {
        if (i < arr.length) {
            let p = arr[i];
            let x = p[0] + p[2];
            let y = p[1] + p[3];
            if (y >= window.innerHeight) {
                tarr.push(newRainDrop());
            } else {
                if (Math.random() < rainProb) {
                    let tmp = getMotion();
                    p[2] = tmp[0];
                    p[3] = tmp[1];
                }
                tarr.push([x, y, p[2], p[3], p[4]]);
            }
        } else {
            tarr.push(newRainDrop());
        }
    }
    return tarr;
}
let arr1 = [];
let arr2 = [];

function enableRainEffect() {
    arr1 = [];
    for (let i = 0; i < getRainEP('intensity'); i++) {
        let x = getRandomInt(window.innerWidth);
        let y = getRandomInt(window.innerHeight);
        let tmp = getMotion();
        let l = getRandMinMax(rainLengthMin, rainLengthMax);
        arr1.push([x, y, tmp[0], tmp[1], l]);
    }
    arr2 = [];
    for (let i = 0; i < getRainEP('intensity'); i++) {
        let x = getRandomInt(window.innerWidth);
        let y = getRandomInt(window.innerHeight);
        let tmp = getMotion();
        let l = getRandMinMax(rainLengthMin, rainLengthMax);
        arr2.push([x, y, tmp[0], tmp[1], l]);
    }
}

function disableRainEffect() {
    arr1 = [];
    arr2 = [];
}

function updateRainEffect(delta) {
    arr1 = moveNodes(arr1);
    arr2 = moveNodes(arr2);
    let foregroundeffect = document.getElementById("foregroundeffect");
    let backgroundeffect = document.getElementById("backgroundeffect");
    drawRain(foregroundeffect, arr1);
    drawRain(backgroundeffect, arr2);
}
