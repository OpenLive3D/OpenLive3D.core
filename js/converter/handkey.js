// Hand Point of Interests
// left right
// https://google.github.io/mediapipe/solutions/hands.html

const HPoI = {
    "paw": [0, 5, 17],
    "thumb": [1, 2, 4],
    "index": [5, 6, 8],
    "middle": [9, 10, 12],
    "ring": [13, 14, 16],
    "pinky": [17, 18, 20]
};

function getThumbRatio(hand, prefix) {
    let base = hand[prefix + "paw"][2];
    let d1 = distance3d(hand[prefix + "paw"][1], base);
    let d2 = distance3d(hand[prefix + "thumb"][2], base);
    return (d2 - d1) / d1;
}

function getHandSpread(hand, prefix) {
    let indexFinger = hand[prefix + "index"];
    let pinkyFinger = hand[prefix + "pinky"];
    let d1 = distance3d(indexFinger[0], pinkyFinger[0]);
    let d2 = distance3d(indexFinger[1], pinkyFinger[1]);
    return (d2 - d1) / d1;
}

function getIMRPRatio(hand, prefix) {
    let arr = ["index", "middle", "ring", "pinky"];
    let res = [];
    let base = hand[prefix + "paw"][0];
    for (let i = 0; i < arr.length; i++) {
        let d1 = distance3d(hand[prefix + arr[i]][0], base);
        let d2 = distance3d(hand[prefix + arr[i]][2], base);
        res[i] = (d2 - d1) / d1;
    }
    return res;
}

function getHandRotation(hand, leftright) {
    let prefix = ["left", "right"][leftright];
    let lrRatio = 1 - leftright * 2;
    let i0 = prefix + "ring";
    let i1 = prefix + "index";
    let i2 = prefix + "middle";
    let i3 = prefix + "paw";
    let rollSlope = slope(0, 1, hand[i1][0], hand[i0][0]);
    let roll = Math.atan(rollSlope);
    let yawSlope = slope(0, 2, hand[i1][0], hand[i0][0]);
    let yaw = Math.atan(yawSlope);
    if ((hand[i1][0][0] > hand[i0][0][0]) != (prefix == "right")) {
        roll *= -1;
        yaw -= Math.PI * lrRatio;
    }
    let pitchSlope = slope(2, 1, hand[i2][0], hand[i3][0]);
    let pitch = Math.atan(pitchSlope) + Math.PI / 2;
    if (pitch > Math.PI / 2) {
        pitch -= Math.PI;
    }
    if (hand[i2][0][1] > hand[i3][0][1]) {
        pitch -= Math.PI;
    }
    return [roll, pitch, yaw];
}

function getDefaultHandInfo(leftright) {
    let prefix = ["left", "right"][leftright];
    let lrRatio = 1 - leftright * 2;
    let keyInfo = {};
    keyInfo[prefix + "Thumb"] = 1;
    keyInfo[prefix + "Index"] = 1;
    keyInfo[prefix + "Middle"] = 1;
    keyInfo[prefix + "Ring"] = 1;
    keyInfo[prefix + "Little"] = 1;
    keyInfo[prefix + "Roll"] = 0;
    keyInfo[prefix + "Pitch"] = Math.PI;
    keyInfo[prefix + "Yaw"] = 0;
    keyInfo[prefix + "Spread"] = 0;
    return keyInfo;
}

function hand2Info(hand, leftright) {
    let keyInfo = {};
    let prefix = ["left", "right"][leftright];
    let imrp = getIMRPRatio(hand, prefix);
    let handRotate = getHandRotation(hand, leftright);
    keyInfo[prefix + "Thumb"] = getThumbRatio(hand, prefix);
    keyInfo[prefix + "Index"] = imrp[0];
    keyInfo[prefix + "Middle"] = imrp[1];
    keyInfo[prefix + "Ring"] = imrp[2];
    keyInfo[prefix + "Little"] = imrp[3];
    keyInfo[prefix + "Roll"] = handRotate[0];
    keyInfo[prefix + "Pitch"] = handRotate[1];
    keyInfo[prefix + "Yaw"] = handRotate[2];
    keyInfo[prefix + "Spread"] = getHandSpread(hand, prefix);
    return keyInfo;
}

function packHandHolistic(_hand, leftright) {
    let wh = getCameraWH();
    let prefix = ["left", "right"][leftright];

    function pointUnpack(p) {
        return [p.x * wh[0], p.y * wh[1], p.z * wh[1]];
    }
    let ret = {};
    Object.keys(HPoI).forEach(function(key) {
        ret[prefix + key] = [];
        for (let i = 0; i < HPoI[key].length; i++) {
            ret[prefix + key][i] = pointUnpack(_hand[HPoI[key][i]]);
        }
    });
    return ret;
}
