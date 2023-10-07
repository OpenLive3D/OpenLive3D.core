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
