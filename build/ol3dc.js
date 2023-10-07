// 1. manage the initialization of
//    - camera
//    - ml
// 2. manage the thread
// 3. conduct convertion and interpolation
// 4. return motion

let tmpInfo = getDefaultInfo();
let tmpResult = null;

// face landmark resolver
function onFaceLandmarkResult(keyPoints, faceInfo) {
    if (faceInfo) {
        Object.keys(faceInfo).forEach(function(key) {
            let sr = getSR(getKeyType(key)) / getCMV("SENSITIVITY_SCALE");
            let v = (1 - sr) * faceInfo[key] + sr * tmpInfo[key];
            tmpInfo[key] = isNaN(v) ? 0 : v;
        });
    }
}


// pose landmark resolver
function onPoseLandmarkResult(keyPoints, poseInfo) {
    if (poseInfo) {
        Object.keys(poseInfo).forEach(function(key) {
            let sr = getSR(getKeyType(key)) / getCMV("SENSITIVITY_SCALE");
            let v = (1 - sr) * poseInfo[key] + sr * tmpInfo[key];
            tmpInfo[key] = isNaN(v) ? 0 : v;
        });
    }
}

// hand landmark resolver
let handTrackers = [new Date().getTime(), new Date().getTime()];

function onHandLandmarkResult(keyPoints, handInfo, leftright) {
    let prefix = ["left", "right"][leftright];
    let preRate = 1 - leftright * 2;
    if (handInfo) {
        handTrackers[leftright] = new Date().getTime();
        Object.keys(handInfo).forEach(function(key) {
            let sr = getSR('hand') / getCMV("SENSITIVITY_SCALE");
            if (key in tmpInfo) {
                let v = (1 - sr) * handInfo[key] + sr * tmpInfo[key];
                tmpInfo[key] = isNaN(v) ? 0 : v;
            }
        });
    }
}

function noHandLandmarkResult(leftright) {
    let prefix = ["left", "right"][leftright];
    let tmpHandInfo = getDefaultHandInfo(leftright);
    Object.keys(tmpHandInfo).forEach(function(key) {
        let sr = getSR(getKeyType(key));
        if (key in tmpInfo) {
            let v = (1 - sr) * tmpHandInfo[key] + sr * tmpInfo[key];
            tmpInfo[key] = isNaN(v) ? 0 : v;
        }
    });
}


// parse inference result
function mergePoints(PoI, tPoI) {
    Object.keys(tPoI).forEach(function(key) {
        PoI[key] = tPoI[key];
    });
}
async function onHolisticResults(results) {
    tmpResult = results;
    if (!getCMV("GOOD_TO_GO")) {
        console.log("1st Result: ", results);
        setCMV("GOOD_TO_GO", true);
    }
    let updateTime = new Date().getTime();

    let allPoI = {};
    let allLog = {};
    if (results.faceLandmarks) {
        let keyPoints = packFaceHolistic(results.faceLandmarks);
        mergePoints(allPoI, keyPoints);
        let faceInfo = face2Info(keyPoints);
        allLog["face"] = faceInfo;
        onFaceLandmarkResult(keyPoints, faceInfo);
    }
    if (results.poseLandmarks) {
        let keyPoints = packPoseHolistic(results.poseLandmarks);
        mergePoints(allPoI, keyPoints);
        let poseInfo = pose2Info(keyPoints);
        allLog["pose"] = poseInfo;
        onPoseLandmarkResult(keyPoints, poseInfo);
    }
    if (results.leftHandLandmarks) {
        let keyPoints = packHandHolistic(results.leftHandLandmarks, 0);
        mergePoints(allPoI, keyPoints);
        let handInfo = hand2Info(keyPoints, 0);
        allLog["left_hand"] = handInfo;
        onHandLandmarkResult(keyPoints, handInfo, 0);
    } else if (updateTime - handTrackers[0] > 1000 * getCMV('HAND_CHECK')) {
        noHandLandmarkResult(0);
    }
    if (results.rightHandLandmarks) {
        let keyPoints = packHandHolistic(results.rightHandLandmarks, 1);
        mergePoints(allPoI, keyPoints);
        let handInfo = hand2Info(keyPoints, 1);
        allLog["right_hand"] = handInfo;
        onHandLandmarkResult(keyPoints, handInfo, 1);
    } else if (updateTime - handTrackers[1] > 1000 * getCMV('HAND_CHECK')) {
        noHandLandmarkResult(1);
    }

    postCoreLog(allLog);
    postPoI(allPoI);
    if (results.faceLandmarks) {
        pushInfo(tmpInfo);
    }
}

// call worker with image
async function postImage() {
    let modelConfig = {
        "mode": getCMV("TRACKING_MODE"),
        "thread": getCMV("MULTI_THREAD")
    }
    getMLModel(modelConfig).postMessage({
        "metakey": getMetaKey(),
        "image": getCaptureImage()
    });
}

// worker update
async function onWorkerResults(e) {
    if (e.data && e.data['results']) {
        addCMV('ML_LOOP_COUNTER', 1);
        onHolisticResults(e.data['results']);
    }
    if (e.data && e.data['metakey'] == getMetaKey()) {
        try {
            correctMeta();
            setTimeout(function() {
                postImage();
            }, getCMV("DYNA_ML_DURATION"));
        } catch (err) {
            console.log(err);
        }
    }
}

// motion extraction
function radLimit(rad) {
    let limit = Math.PI / 2;
    return Math.max(-limit, Math.min(limit, rad));
}

function ratioLimit(ratio) {
    return Math.max(0, Math.min(1, ratio));
}

function extractXYZ(keys) {
    return {
        'x': keys['x'],
        'y': keys['y'],
        'z': keys['z']
    };
}

function extractMouthEyes(keys) {
    let meinfo = {
        'b': {},
        'r': {},
        'p': {},
        'e': {}
    };
    if (getCMV("MOOD") != "fun") {
        // mouth
        let mouthRatio = ratioLimit((keys['mouth'] - getCMV("MOUTH_OPEN_OFFSET")) * getCMV('MOUTH_RATIO'));
        meinfo['b']['aa'] = mouthRatio;
        // irises
        let irispos = keys['irisPos'];
        let irisY = (irispos - getCMV('IRIS_POS_OFFSET')) * getCMV('IRIS_POS_RATIO');
        meinfo['r']['rightEye'] = [0, irisY, 0];
        meinfo['r']['leftEye'] = [0, irisY, 0];
        // brows
        let browspos = Math.min(1, Math.max(0, keys['brows'] - getCMV("BROWS_OFFSET")) * getCMV("BROWS_RATIO"));
        meinfo['b']['Brows up'] = browspos;
        // auto
        let happyThresholdForEyes = 1;
        if (getCMV("MOOD") == "auto") {
            let autoV = Math.max(-1, Math.min(1, keys["auto"] * getCMV("MOOD_AUTO_RATIO")));
            let absauto = Math.max(0, Math.abs(autoV) - getCMV("MOOD_AUTO_OFFSET"));
            let browspos = Math.min(1, Math.max(0, keys['brows'] - getCMV("BROWS_OFFSET")) * getCMV("BROWS_RATIO"));
            let browslimit = 0.1;
            let balFun = Math.min(browslimit, Math.max(0, browspos));
            let balSor = Math.min(browslimit / 2, Math.max(0, (browslimit - balFun) / 2));
            let balAng = Math.min(browslimit / 2, Math.max(0, (browslimit - balFun) / 2));
            if (autoV < 0) {
                meinfo['b']['angry'] = balAng;
                meinfo['b']['sad'] = absauto + balSor;
                meinfo['b']['happy'] = balFun;
                meinfo['b']['ee'] = 0;
            } else {
                happyThresholdForEyes = 1 - absauto;
                meinfo['b']['angry'] = balAng;
                meinfo['b']['sad'] = balSor;
                meinfo['b']['happy'] = absauto + balFun;
                meinfo['b']['ee'] = absauto;
            }
        }
        // eyes
        let leo = keys['leftEyeOpen'];
        let reo = keys['rightEyeOpen'];
        if (getCMV("EYE_SYNC") || Math.abs(reo - leo) < getCMV('EYE_LINK_THRESHOLD')) {
            let avgEye = (reo + leo) / 2;
            leo = avgEye;
            reo = avgEye;
        }
        if (reo < getCMV('RIGHT_EYE_CLOSE_THRESHOLD')) {
            meinfo['b']['blinkRight'] = happyThresholdForEyes;
        } else if (reo < getCMV('RIGHT_EYE_OPEN_THRESHOLD')) {
            let eRatio = (reo - getCMV('RIGHT_EYE_CLOSE_THRESHOLD')) / (getCMV('RIGHT_EYE_OPEN_THRESHOLD') - getCMV('RIGHT_EYE_CLOSE_THRESHOLD'));
            meinfo['b']['blinkRight'] = ratioLimit((happyThresholdForEyes - eRatio) * getCMV('RIGHT_EYE_SQUINT_RATIO'));
        } else {
            meinfo['b']['blinkRight'] = 0;
        }
        if (leo < getCMV('LEFT_EYE_CLOSE_THRESHOLD')) {
            meinfo['b']['blinkLeft'] = happyThresholdForEyes;
        } else if (leo < getCMV('LEFT_EYE_OPEN_THRESHOLD')) {
            let eRatio = (leo - getCMV('LEFT_EYE_CLOSE_THRESHOLD')) / (getCMV('LEFT_EYE_OPEN_THRESHOLD') - getCMV('LEFT_EYE_CLOSE_THRESHOLD'));
            meinfo['b']['blinkLeft'] = ratioLimit((happyThresholdForEyes - eRatio) * getCMV('LEFT_EYE_SQUINT_RATIO'));
        } else {
            meinfo['b']['blinkLeft'] = 0;
        }
    }
    return meinfo;
}

// hand landmark resolver
let fingerRates = {
    "Thumb": 0.8,
    "Index": 0.7,
    "Middle": 0.7,
    "Ring": 0.7,
    "Little": 0.6
};
let spreadRates = {
    "Index": -30,
    "Middle": -10,
    "Ring": 10,
    "Little": 30
};
let fingerSegs = ["Distal", "Intermediate", "Proximal"];
let thumbSegs = ["Distal", "Metacarpal", "Proximal"];
let thumbRatios = [40, 60, 20];
let thumbSwing = 20;

function extractHandLandmark(keys) {
    let hlinfo = {
        'b': {},
        'r': {},
        'p': {},
        'e': {}
    };
    for (let leftright of [0, 1]) {
        let prefix = ["left", "right"][leftright];
        let preRate = 1 - leftright * 2;
        Object.keys(fingerRates).forEach(function(finger) {
            let fingerRate = fingerRates[finger] * getCMV("FINGER_GRIP_RATIO");
            let spreadRate = spreadRates[finger] * getCMV("FINGER_SPREAD_RATIO");
            let preRatio = keys[prefix + finger];
            let _ratio = 1 - Math.max(0, Math.min(fingerRate, preRatio)) / fingerRate;
            let preSpread = keys[prefix + "Spread"];
            if (preRatio < 0) {
                preSpread = 0.1;
            }
            let _spread = Math.min(1, Math.max(-0.2, preSpread - 0.1)) * spreadRate;
            if (finger == "Thumb") {
                for (let i = 0; i < thumbSegs.length; i++) {
                    let seg = thumbSegs[i];
                    let ratio = preRate * _ratio * thumbRatios[i] / 180 * Math.PI;
                    let swing = preRate * (0.5 - Math.abs(0.5 - _ratio)) * thumbSwing / 180 * Math.PI;
                    hlinfo['r'][prefix + finger + seg] = [0, ratio * getCMV('VRM_YR'), swing * getCMV('VRM_ZR')];
                }
            } else {
                let ratio = preRate * _ratio * 70 / 180 * Math.PI;
                let spread = preRate * _spread / 180 * Math.PI;
                for (seg of fingerSegs) {
                    if (seg == "Proximal") {
                        hlinfo['r'][prefix + finger + seg] = [0, spread * getCMV('VRM_YR'), ratio * getCMV('VRM_ZR')];
                    } else {
                        hlinfo['r'][prefix + finger + seg] = [0, 0, ratio * getCMV('VRM_ZR')];
                    }
                }
            }
        });
    }
    return hlinfo;
}

function extractBody(keys) {
    let binfo = {
        'b': {},
        'r': {},
        'p': {},
        'e': {}
    };
    let tiltRatio = Math.min(0.2, Math.max(-0.2, keys['tilt']));
    let leanRatio = Math.min(1, Math.max(-1, keys['lean'])) * 0.6;
    // head
    binfo['r']['head'] = [radLimit(keys['pitch'] * getCMV('HEAD_RATIO')) * getCMV('VRM_XR'),
        radLimit(keys['yaw'] * getCMV('HEAD_RATIO') - leanRatio * 0.3) * getCMV('VRM_YR'),
        radLimit(keys['roll'] * getCMV('HEAD_RATIO') - tiltRatio * 0.3) * getCMV('VRM_ZR')]
    // neck
    binfo['r']['neck'] = [radLimit(keys['pitch'] * getCMV('NECK_RATIO')) * getCMV('VRM_XR'),
        radLimit(keys['yaw'] * getCMV('NECK_RATIO') - leanRatio * 0.7) * getCMV('VRM_YR'),
        radLimit(keys['roll'] * getCMV('NECK_RATIO') - tiltRatio * 0.7) * getCMV('VRM_ZR')];
    // chest
    binfo['r']['spine'] = [radLimit(keys['pitch'] * getCMV('CHEST_RATIO')) * getCMV('VRM_XR'),
        radLimit(keys['yaw'] * getCMV('CHEST_RATIO') + leanRatio) * getCMV('VRM_YR'),
        radLimit(keys['roll'] * getCMV('CHEST_RATIO') + tiltRatio) * getCMV('VRM_ZR')];
    // left right arm
    if (getCMV('TRACKING_MODE') == "Upper-Body") {
        for (let i = 0; i < 2; i++) {
            let prefix = ["left", "right"][i];
            // upperArm, lowerArm
            let wx = keys[prefix + "WristX"] + keys["x"] * getCMV("HEAD_HAND_RATIO");
            let wy = keys[prefix + "WristY"];
            let hy = keys[prefix + 'Yaw'];
            let hr = keys[prefix + 'Roll'];
            let hp = keys[prefix + 'Pitch'];
            let armEuler = armMagicEuler(wx, wy, hy, hr, hp, i);
            Object.keys(armEuler).forEach(function(armkey) {
                binfo['e'][prefix + armkey] = armEuler[armkey];
            });
        }
    }
    return binfo;
}

function mergeInfo(minfo, tinfo) {
    Object.keys(tinfo).forEach(function(key0) {
        if (key0 in minfo) {
            Object.keys(tinfo[key0]).forEach(function(key1) {
                minfo[key0][key1] = tinfo[key0][key1];
            });
        } else {
            minfo[key0] = tinfo[key0];
        }
    });
    return minfo;
}

// get all blendshape + rotation + position
function getVRMMovement() {
    let linfo = getLastInfo();
    let sinfo = getInfo();

    let minfo = extractXYZ(sinfo);
    let meinfo = extractMouthEyes(linfo);
    let hlinfo = extractHandLandmark(linfo);
    let binfo = extractBody(sinfo);

    minfo = mergeInfo(minfo, meinfo);
    minfo = mergeInfo(minfo, hlinfo);
    minfo = mergeInfo(minfo, binfo);

    return minfo;
}

// init of core
function initCore() {
    // start video
    startCamera();
    // load holistic
    loadMLModels(onWorkerResults);
}
// logging manager

let curKeys = {};
let curPoIs = {};

function postCoreLog(keys) {
    curKeys = keys;
}

function getCoreLog() {
    return curKeys;
}

function postPoI(pois) {
    curPoIs = pois;
}

function getPoI() {
    return curPoIs;
}
// manage metadata for manager evaluation
let metadata = {
    "key": 0,
    "time": 0
};

// healthcheck metadata
function setNewMeta() {
    metadata["key"] = Date.now();
    metadata["time"] = metadata["key"];
    console.log("set new metadata:", metadata);
}

function correctMeta() {
    metadata["time"] = Date.now();
}

function getMetaKey() {
    return metadata["key"];
}

function getMetaTime() {
    return metadata["time"];
}
function getDefaultInfo() {
    return {
        "roll": 0,
        "pitch": 0,
        "yaw": 0,
        "leftEyeOpen": 0,
        "rightEyeOpen": 0,
        "irisPos": 0,
        "mouth": 0,
        "brows": 0,
        "x": 0,
        "y": 0,
        "z": 0, // -1 < x,y,z < 1
        "auto": 0,
        "tilt": 0,
        "lean": 0,
        "leftWristX": 0,
        "rightWristX": 0, // -1 < x < 1
        "leftWristY": 0,
        "rightWristY": 0, //  0 < y < 1
        "leftThumb": 0,
        "rightThumb": 0,
        "leftIndex": 0,
        "rightIndex": 0,
        "leftMiddle": 0,
        "rightMiddle": 0,
        "leftRing": 0,
        "rightRing": 0,
        "leftLittle": 0,
        "rightLittle": 0,
        "leftRoll": 0,
        "rightRoll": 0,
        "leftPitch": 0,
        "rightPitch": 0,
        "leftYaw": 0,
        "rightYaw": 0,
        "leftSpread": 0,
        "rightSpread": 0,
    };
}

function reverse3d(p1, p2) {
    return [-(p2[1] - p1[1]), p2[0] - p1[0], -(p2[2] - p1[2])];
}

function sum3d(p1, p2) {
    return [p1[0] + p2[0], p1[1] + p2[1], p1[2] + p2[2]];
}

function average3d(p1, p2) {
    return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
}

function weight3d(p1, p2, w1, w2) {
    let w12 = w1 + w2;
    return [(p1[0] * w1 + p2[0] * w2) / w12,
        (p1[1] * w1 + p2[1] * w2) / w12,
        (p1[2] * w1 + p2[2] * w2) / w12];
}

function distance3d(p1, p2 = [0, 0, 0]) {
    const horiz = p2[0] - p1[0];
    const vert = p2[1] - p1[1];
    const depth = p2[2] - p1[2];
    return Math.sqrt((horiz * horiz) + (vert * vert) + (depth * depth));
}

function distance2d(p1, p2 = [0, 0]) {
    const horiz = p2[0] - p1[0];
    const vert = p2[1] - p1[1];
    return Math.sqrt((horiz * horiz) + (vert * vert));
}

function slope(xIdx, yIdx, p1, p2) {
    return (p2[yIdx] - p1[yIdx]) / (p2[xIdx] - p1[xIdx]);
}

function slopeXY(xIdx, yIdx, p1, p2) {
    return [p2[xIdx] - p1[xIdx], p2[yIdx] - p1[yIdx]];
}

function diff3d(p1, p2) {
    return [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
}

function cross3d(p1, p2) {
    return [
        p1[1] * p2[2] - p1[2] * p2[1],
        p1[2] * p2[0] - p1[0] * p2[2],
        p1[0] * p2[1] - p1[1] * p2[0]
    ];
}

function dot3d(p1, p2) {
    return p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2];
}

function normalize3d(p1) {
    let d = distance3d(p1);
    return [p1[0] / d, p1[1] / d, p1[2] / d];
}

// holistic worker
let hworkerM = null;
let fworkerM = null;
let fworkerS = null;

function loadMLModels(onResults) {
    let ipath = getCMV("INTEGRATION_SUBMODULE_PATH");
    let hpath = ipath + "/holistic/worker.js";
    let fpath = ipath + "/face_mesh/worker.js";
    hworkerM = new Worker(hpath);
    hworkerM.onmessage = onResults;
    fworkerM = new Worker(fpath);
    fworkerM.onmessage = onResults;
    fworkerS = new Single(onResults);
    fworkerS.init();
    console.log("holistic model connected");
}

function getMLModel(modelConfig) {
    if (!modelConfig["thread"]) {
        return fworkerS;
    } else if (modelConfig["mode"] == "Upper-Body") {
        return hworkerM;
    } else {
        return fworkerM;
    }
}

function checkMLModel() {
    if (hworkerM && fworkerM && fworkerS) {
        return true;
    } else {
        return false;
    }
}
let capture = document.createElement("video");
capture.playsinline = "playsinline";
capture.autoplay = "autoplay";

const defaultWidth = 640,
    defaultHeight = 480;
const scaleWidth = {
    min: defaultWidth
};
const scaleHeight = {
    min: defaultHeight
};
capture.width = defaultWidth;
capture.height = defaultHeight;

// list cameras
function listCameras(cb) {
    let carr = [];
    let count = 1;
    navigator.mediaDevices.enumerateDevices().then(darr => {
        darr.forEach(mediaDevice => {
            if (mediaDevice.kind === 'videoinput') {
                let id = mediaDevice.deviceId;
                let name = mediaDevice.label || `Camera ${count++}`;
                carr.push({
                    "id": id,
                    "name": name
                });
            }
        })
        cb(carr);
    });
}

// get current video device id
function getCurrentVideoId() {
    return capture.srcObject.getTracks()[0].getSettings()['deviceId'];
}

// read video from webcam
function startCamera() {
    navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: 'user',
            width: scaleWidth,
            height: scaleHeight,
        }
    }).then(function(stream) {
        console.log("video initialized");
        window.stream = stream;
        capture.srcObject = stream;
        capture.width = capture.videoWidth;
        capture.height = capture.videoHeight;
        setCMV("CURRENT_CAMERA_ID",
            capture.srcObject.getTracks()[0].getSettings()['deviceId']);
    });
    return capture;
}

// change current video to a new source
function setVideoStream(deviceId) {
    // stop current video
    capture.srcObject.getTracks().forEach(track => {
        track.stop();
    });
    window.stream.getTracks().forEach(track => {
        track.stop();
    });
    navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            deviceId: deviceId ? {
                exact: deviceId
            } : undefined,
            width: scaleWidth,
            height: scaleHeight,
        }
    }).then(function(stream) {
        console.log("video stream set: ", deviceId);
        window.stream = stream;
        capture.srcObject = stream;
        capture.width = capture.videoWidth;
        capture.height = capture.videoHeight;
        setCMV("RESET_CAMERA", true);
        setCMV("CURRENT_CAMERA_ID",
            capture.srcObject.getTracks()[0].getSettings()['deviceId']);
    });
}

// video width and height
function getCameraWH() {
    return [capture.videoWidth, capture.videoHeight];
}

// return the capture as frame
function getCameraFrame() {
    return capture;
}

// validate image readiness
function checkImage() {
    return capture.readyState === 4;
}

let capImage = document.createElement("canvas");
let capCtx = capImage.getContext('2d', {
    willReadFrequently: true
});
capImage.width = defaultWidth;
capImage.height = defaultHeight;

function getCaptureImage() {
    capCtx.drawImage(capture, 0, 0);
    return capCtx.getImageData(0, 0, defaultWidth, defaultHeight);
}
// interpolate for motion smoother

let arrTimeInfo = [];
let curTimeInfo = {
    "time": new Date().getTime(),
    "info": getDefaultInfo()
};
let delayTime = 250; // milliseconds
let lasInfoDiff = getDefaultInfo();
let lasTimeDiff = 30;

function weightedAvg(o1, o2, w1, w2) {
    let obj = {};
    Object.keys(o1).forEach(function(key) {
        obj[key] = o1[key] + (o2[key] - o1[key]) * w1 / (w1 + w2);
    });
    return obj;
}

function calInfoDiff(o1, o2) {
    let obj = {};
    Object.keys(o1).forEach(function(key) {
        obj[key] = o2[key] - o1[key];
    });
    return obj;
}

function calScaleDiff(o1, w1) {
    Object.keys(o1).forEach(function(key) {
        o1[key] *= w1;
    });
}

function sumInfoDiff(o1, o2) {
    let obj = {};
    Object.keys(o1).forEach(function(key) {
        obj[key] = o2[key] + o1[key];
    });
    return obj;
}

function pushInfo(newinfo) {
    let motionBlurFactor = getCMV("MOTION_BLUR_RATIO");
    if (newinfo) {
        if (arrTimeInfo.length >= 2) {
            let t0 = arrTimeInfo[0]["time"];
            let t1 = arrTimeInfo[1]["time"];
            let t2 = new Date().getTime();
            let t0diff = t1 - t0;
            let t1diff = t2 - t1;
            let smoothInfo = weightedAvg(
                arrTimeInfo[1]["info"],
                weightedAvg(
                    arrTimeInfo[0]["info"],
                    newinfo, t0diff, t1diff
                ), 1, motionBlurFactor);
            arrTimeInfo = [{
                "time": t1,
                "info": smoothInfo
            }, {
                "time": t2,
                "info": newinfo
            }];
        } else {
            arrTimeInfo.push({
                "time": new Date().getTime(),
                "info": newinfo
            })
        }
    } else {
        console.log("empty info alert!");
    }
}

let interCheck = {};

function addIC(t) {
    if (t in interCheck) {
        interCheck[t] += 1;
    } else {
        interCheck[t] = 1;
    }
}

function getLastInfo() {
    if (arrTimeInfo.length >= 1) {
        return arrTimeInfo[arrTimeInfo.length - 1]["info"];
    }
    return curTimeInfo["info"];
}

function getInfo() {
    let momentumFactor = getCMV("MOMENTUM_RATIO");
    let lasTime = curTimeInfo["time"];
    let lasInfo = curTimeInfo["info"];
    let curTime = new Date().getTime();
    let difTime = curTime - lasTime;
    if (arrTimeInfo.length == 1) {
        curTimeInfo = arrTimeInfo[0];
        addIC("l1");
    } else if (arrTimeInfo.length >= 2) {
        let time0 = arrTimeInfo[0]["time"] + delayTime;
        let info0 = arrTimeInfo[0]["info"];
        let time1 = arrTimeInfo[1]["time"] + delayTime;
        let info1 = arrTimeInfo[1]["info"];
        if (time0 > lasTime) {
            let cnt0 = (time0 - lasTime) / difTime;
            curTimeInfo = {
                "time": curTime,
                "info": weightedAvg(lasInfo, info0, 1, cnt0 - 1)
            }
            addIC("l2 t0");
        } else if (time1 > lasTime) {
            let cnt1 = (time1 - lasTime) / difTime;
            curTimeInfo = {
                "time": curTime,
                "info": weightedAvg(lasInfo, info1, 1, cnt1 - 1)
            }
            addIC("l2 t1");
        } else {
            curTimeInfo = {
                "time": curTime,
                "info": arrTimeInfo[1]["info"]
            }
            addIC("l2 t?");
        }
    }
    let curInfoDiff = calInfoDiff(lasInfo, curTimeInfo["info"]);
    calScaleDiff(lasInfoDiff, difTime / lasTimeDiff);
    lasInfoDiff = weightedAvg(lasInfoDiff, curInfoDiff, momentumFactor, 1);
    let minVIDura = getCMV("MIN_VI_DURATION");
    let maxVIDura = getCMV("MAX_VI_DURATION");
    lasTimeDiff = Math.min(maxVIDura, Math.max(minVIDura, difTime));
    curTimeInfo["info"] = sumInfoDiff(curTimeInfo["info"], lasInfoDiff);
    return curTimeInfo["info"];
}
// Face Point of Interests
// left right top down center
// https://i.stack.imgur.com/5Mohl.jpg

const FPoI = {
    "head": [127, 356, 10, 152, 168],
    "righteye": [33, 133, 159, 145, 468],
    "lefteye": [362, 263, 386, 374, 473],
    "mouth": [78, 308, 13, 14],
    "rightbrow": [105, 107],
    "leftbrow": [336, 334]
};

function getOpenRatio(obj) {
    let width = distance3d(obj[0], obj[1]);
    let height = distance3d(obj[2], obj[3]);
    return height / width;
}

function getPosRatio(obj) {
    let dleft = distance3d(obj[0], obj[4]);
    let dright = distance3d(obj[1], obj[4]);
    return dleft / (dleft + dright);
}

function getHeadRotation(head) {
    let rollSlope = slope(0, 1, head[1], head[0]);
    let roll = Math.atan(rollSlope);
    let yawSlope = slope(0, 2, head[1], head[0]);
    let yaw = Math.atan(yawSlope);
    let pitchSlope = slope(2, 1, head[2], head[3]);
    let pitch = Math.atan(pitchSlope);
    if (pitch > 0) {
        pitch -= Math.PI;
    }
    return [roll, pitch + Math.PI / 2, yaw];
}

function getHeadXYZ(head) {
    let wh = getCameraWH();
    let topx = head[2][0];
    let topy = head[2][1];
    let downx = head[3][0];
    let downy = head[3][1];
    let x = Math.max(-1, Math.min(1, (topx + downx) / wh[0] - 1));
    let y = Math.max(-1, Math.min(1, (topy + downy) / wh[0] - 1));
    let z = Math.max(-1, Math.min(1, wh[1] / distance3d(head[2], head[3]) - 3));
    return [x, y, z];
}

function getMoodAutoDraft(mouth) {
    let mbalance = average3d(mouth[0], mouth[1]);
    let mmove = average3d(mouth[2], mouth[3]);
    let absauto = Math.min(1, distance2d(mbalance, mmove) / distance3d(mouth[0], mouth[1]));
    if (mbalance[1] > mmove[1]) { // compare Y
        return -absauto;
    } else {
        return absauto;
    }
}

function getMoodAuto(autoDraft, headRotate) {
    let absYaw = Math.abs(headRotate[2]);
    if (autoDraft > 0) {
        return Math.max(0, autoDraft - absYaw / 1.5);
    } else {
        return Math.min(0, autoDraft + absYaw / 1.5);
    }
}

function getBrowsRatio(face) {
    let htop = face["head"][2];
    let hmid = face["head"][4];
    let letop = face["lefteye"][2];
    let retop = face["righteye"][2];
    let d1 = distance3d(face["rightbrow"][0], htop) +
        distance3d(face["rightbrow"][1], htop) +
        distance3d(face["leftbrow"][0], htop) +
        distance3d(face["leftbrow"][1], htop);
    let d2 = distance3d(face["rightbrow"][0], hmid) +
        distance3d(face["rightbrow"][1], hmid) +
        distance3d(face["leftbrow"][0], hmid) +
        distance3d(face["leftbrow"][1], hmid);
    return d2 / (d1 + d2);
}

function getKeyType(key) {
    if (["roll", "pitch", "yaw"].includes(key)) {
        return "head";
    } else if (["leftEyeOpen", "rightEyeOpen", "irisPos"].includes(key)) {
        return "eye";
    } else if (["mouth"].includes(key)) {
        return "mouth";
    } else {
        return "body";
    }
}

function face2Info(face) {
    let keyInfo = {};
    let headRotate = getHeadRotation(face["head"]);
    let headXYZ = getHeadXYZ(face["head"]);
    let autoDraft = getMoodAutoDraft(face["mouth"]);
    keyInfo["roll"] = headRotate[0];
    keyInfo["pitch"] = headRotate[1];
    keyInfo["yaw"] = headRotate[2];
    keyInfo["leftEyeOpen"] = getOpenRatio(face["lefteye"]);
    keyInfo["rightEyeOpen"] = getOpenRatio(face["righteye"]);
    keyInfo["irisPos"] = getPosRatio(face["lefteye"]) + getPosRatio(face["righteye"]) - 1;
    keyInfo["mouth"] = Math.max(0, getOpenRatio(face["mouth"]) - Math.abs(headRotate[1] / 10));
    keyInfo["brows"] = getBrowsRatio(face);
    keyInfo["x"] = headXYZ[0];
    keyInfo["y"] = headXYZ[1];
    keyInfo["z"] = headXYZ[2];
    keyInfo["auto"] = getMoodAuto(autoDraft, headRotate);
    return keyInfo;
}

// reduce vertices to the desired set, and compress data as well
function packFaceHolistic(_face) {
    let wh = getCameraWH();

    function pointUnpack(p) {
        return [p.x * wh[0], p.y * wh[1], p.z * wh[1]];
    }
    let ret = {};
    Object.keys(FPoI).forEach(function(key) {
        ret[key] = [];
        for (let i = 0; i < FPoI[key].length; i++) {
            ret[key][i] = pointUnpack(_face[FPoI[key][i]]);
        }
    });
    return ret;
}
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
// arm magic
// interpret arm moving from ML model to VRM

// Left most
// [0, 0, 45], [40, 0, 23], [40, 0, 0], [35, -15, -23], [30, -30, -45]
// [20, 0, 0], [30, 0, 0], [40, 0, 0], [45, 0, 0], [50, 0, 0]
// Left / 2
// [0, 0, 57], [20, 3, 44], [20, 5, 30], [20, -25, 20], [15, -50, -45]
// [0, -15, 5], [10, -50, 10], [20, -70, 5], [20, -70, -20], [25, -10, 0]
// middle
// [0, 0, 70], [0, 5, 65], [0, 10, 60], [0, -30, -5], [0, -70, -70]
// [-20, -30, 10], [-10, -85, 5], [0, -140, 0], [0, -80, -40], [0, -10, 0]
// right / 2
// [45, 0, 90], [45, 0, 70], [70, 0, 70], [80, -20, 70], [80, -75, 20]
// [-40, 0, 40], [-30, -60, 60], [-30, -100, 45], [-20, -90, 10], [-10, -50, 0]
// right most
// [45, 0, 110], [60, 0, 110], [90, 0, 110], [115, 0, 110], [135, 0, 110]
// [-45, -20, 30], [-45, -30, 40], [-45, -45, 45], [-45, -45, 20], [-45, -45, 0]

let armScales = {
    "UpperArm": [
        [[0, 0, 45], [40, 0, 25], [40, 0, 0], [35, -15, -23], [30, -30, -45]],
        [[0, 0, 57], [20, 3, 44], [20, 5, 30], [20, -25, 20], [15, -50, -45]],
        [[0, 0, 70], [0, 5, 65], [0, 10, 60], [0, -30, -5], [0, -70, -70]],
        [[45, 0, 90], [45, 0, 70], [70, 0, 70], [80, -20, 70], [80, -75, 20]],
        [[45, 0, 110], [60, 0, 110], [90, 0, 110], [115, 0, 110], [135, 0, 110]]
    ],
    "LowerArm": [
        [[20, 0, 0], [30, 0, 0], [40, 0, 0], [45, 0, 0], [50, 0, 0]],
        [[0, -15, 5], [10, -50, 10], [20, -70, 5], [20, -70, -20], [25, -10, 0]],
        [[-20, -30, 10], [-10, -85, 5], [0, -140, 0], [0, -80, -40], [0, -10, 0]],
        [[-40, 0, 40], [-30, -60, 60], [-30, -100, 45], [-20, -90, 10], [-10, -50, 0]],
        [[-45, -20, 30], [-45, -30, 40], [-45, -45, 45], [-45, -45, 20], [-45, -45, 0]]
    ],
    // "Hand": [
    //     [[-100, -50, -160], [-90, -60, -110], [-90, -90, -90], [-30, -60, -30], [-20, -40, 0]],
    //     [[-100, -30, -170], [-60, -50, -100], [-30, -50, -60], [-10, -20, -30], [0, -15, -20]],
    //     [[-50, 10, -150], [-60, 0, -100], [-60, 20, -40], [0, 10, -30], [20, 5, -20]],
    //     [[-50, 20, -150], [-30, 40, -130], [-50, 80, -50], [-40, 40, -40], [0, 40, -25]],
    //     [[-30, 50, -150], [-30, 50, -140], [-10, 70, -100], [-40, 60, -50], [-45, 45, -10]]
    // ]
};

Object.keys(armScales).forEach(function(armkey) {
    let scales = armScales[armkey];
    for (scale of scales) {
        for (let j = 0; j < 5; j++) {
            for (let i = 0; i < 3; i++) {
                scale[j][i] *= Math.PI / 180;
            }
        }
    }
});

function armMagic(x, y, z, leftright) {
    let prefix = ["left", "right"][leftright];
    let lrRatio = 1 - leftright * 2;
    let armRotate = {};
    Object.keys(armScales).forEach(function(armkey) {
        let scales = armScales[armkey];
        let tx = Math.max(0, Math.min(4, (x + lrRatio * 0.2 + 1) * 2));
        let ty = Math.max(0, Math.min(4, (y + 0.06) * 4));
        if (leftright) {
            tx = 4 - tx;
        }
        let xi = Math.min(3, Math.floor(tx));
        let yi = Math.min(3, Math.floor(ty));
        let xyz1 = weight3d(scales[xi][yi], scales[xi][yi + 1], yi + 1 - ty, ty - yi);
        let xyz2 = weight3d(scales[xi + 1][yi], scales[xi + 1][yi + 1], yi + 1 - ty, ty - yi);
        let xyz = weight3d(xyz1, xyz2, xi + 1 - tx, tx - xi);
        armRotate[armkey] = [xyz[0], lrRatio * xyz[1], lrRatio * xyz[2]];
    });
    return armRotate;
}

let armTuneRatios = {
    "UpperArm": 0.1,
    "LowerArm": 0.6,
}

function armMagicEuler(wx, wy, hy, hr, hp, leftright) {
    let VRM_R = [getCMV('VRM_XR'), getCMV('VRM_YR'), getCMV('VRM_ZR')];
    let lrRatio = 1 - leftright * 2;
    let nq = new THREE.Quaternion();
    let armRotate = armMagic(wx, wy, 0, leftright);
    let armEuler = {};
    Object.keys(armRotate).forEach(function(armkey) {
        let rt = armRotate[armkey];
        let ae = new THREE.Euler(rt[0] * VRM_R[0], rt[1] * VRM_R[1], rt[2] * VRM_R[2]);
        let aq = new THREE.Quaternion().setFromEuler(ae);
        let armTR = armTuneRatios[armkey];
        let ee = new THREE.Euler(-hy * lrRatio * armTR * VRM_R[0], 0, 0);
        let eq = new THREE.Quaternion().setFromEuler(ee);
        aq.multiply(eq);
        ae = new THREE.Euler().setFromQuaternion(aq);
        nq.multiply(aq);
        armEuler[armkey] = ae;
    });
    nq.invert();
    let de = new THREE.Euler(0, -Math.PI / 2 * lrRatio * VRM_R[1], -Math.PI / 2 * lrRatio * VRM_R[2]);
    nq.multiply(new THREE.Quaternion().setFromEuler(de));
    let he = new THREE.Euler(-hy * lrRatio * VRM_R[0], hr * VRM_R[1], -hp * lrRatio * VRM_R[2]);
    nq.multiply(new THREE.Quaternion().setFromEuler(he));
    let ne = new THREE.Euler().setFromQuaternion(nq);
    armEuler["Hand"] = ne;
    return armEuler;
}
// Post Point of Interests
// left right
// https://google.github.io/mediapipe/solutions/pose.html

const PPoI = {
    "elbow": [13, 14],
    "shoulder": [11, 12],
    "wrist": [15, 16],
};

function getElbowUpFront(pose, leftright) {
    let shoulder = pose["shoulder"][leftright];
    let elbow = pose["elbow"][leftright];
    let d = distance3d(shoulder, elbow);
    let up = (shoulder[1] - elbow[1]) / d;
    let front = (shoulder[2] - elbow[2]) / d;
    return [up, front];
}

// Down   //    0   0  70 //  -20 -30  10
// Down/2 //    0   5  65 //  -10 -85   5
// Middle //    0  10  60 //    0 -140  0
// Up/2   //    0 -30  -5 //    0 -80 -40
// Up     //    0 -70 -70 //    0 -10   0
function getWristXYZ(pose, leftright) {
    let base = distance3d(pose["shoulder"][0], pose["shoulder"][1]) * 1.2;
    let shoulder = pose["shoulder"][leftright];
    let wrist = pose["wrist"][leftright];
    let x = Math.max(-1, Math.min(1, (shoulder[0] - wrist[0]) / base));
    let y = Math.max(0, Math.min(1, (shoulder[1] - wrist[1]) / base / 2 + 0.5));
    let z = +(wrist[2] > shoulder[2]);
    return [x, y, z];
}

function getTiltLean(shoulder) {
    let d = distance3d(shoulder[0], shoulder[1]);
    let tilt = (shoulder[0][1] - shoulder[1][1]) / d;
    let lean = (shoulder[0][2] - shoulder[1][2]) / d;
    return [tilt, lean * Math.sqrt(Math.abs(lean))];
}

function pose2Info(pose) {
    let keyInfo = {};
    let tl = getTiltLean(pose["shoulder"]);
    let lwrist = getWristXYZ(pose, 0);
    let rwrist = getWristXYZ(pose, 1);
    keyInfo["tilt"] = tl[0];
    keyInfo["lean"] = tl[1];
    keyInfo["leftWristX"] = lwrist[0];
    keyInfo["leftWristY"] = lwrist[1];
    keyInfo["rightWristX"] = rwrist[0];
    keyInfo["rightWristY"] = rwrist[1];
    return keyInfo;
}

function packPoseHolistic(_pose) {
    let wh = getCameraWH();

    function pointUnpack(p) {
        return [p.x * wh[0], p.y * wh[1], p.z * wh[1]];
    }
    let ret = {};
    Object.keys(PPoI).forEach(function(key) {
        ret[key] = [];
        for (let i = 0; i < PPoI[key].length; i++) {
            ret[key][i] = pointUnpack(_pose[PPoI[key][i]]);
        }
    });
    return ret;
}
