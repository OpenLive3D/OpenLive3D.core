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
        Object.keys(faceInfo).forEach(function (key) {
            let sr = getSR(getKeyType(key)) / getCMV("SENSITIVITY_SCALE");
            let v = (1 - sr) * faceInfo[key] + sr * tmpInfo[key];
            tmpInfo[key] = isNaN(v) ? 0 : v;
        });
    }
}


// pose landmark resolver
function onPoseLandmarkResult(keyPoints, poseInfo) {
    if (poseInfo) {
        Object.keys(poseInfo).forEach(function (key) {
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
        Object.keys(handInfo).forEach(function (key) {
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
    Object.keys(tmpHandInfo).forEach(function (key) {
        let sr = getSR(getKeyType(key));
        if (key in tmpInfo) {
            let v = (1 - sr) * tmpHandInfo[key] + sr * tmpInfo[key];
            tmpInfo[key] = isNaN(v) ? 0 : v;
        }
    });
}


// parse inference result
function mergePoints(PoI, tPoI) {
    Object.keys(tPoI).forEach(function (key) {
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
        if (!getCMV('USE_IFACIALMOCAP')) {
            let keyPoints = packFaceHolistic(results.faceLandmarks);
            mergePoints(allPoI, keyPoints);
            let faceInfo = face2Info(keyPoints);
            allLog["face"] = faceInfo;
            onFaceLandmarkResult(keyPoints, faceInfo);
        }
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
    if (results.faceLandmarks || getCMV('USE_IFACIALMOCAP')) {
        pushInfo(tmpInfo);
    }
}

window.applyIFacialMocapData = function (data) {
    let useMocap = getCMV('USE_IFACIALMOCAP');
    if (useMocap === undefined) useMocap = true;

    if (!useMocap) return;

    // Helper to get value (0-100 -> 0-1) with safety
    const getVal = (key) => {
        if (data[key] !== undefined) {
            let v = data[key] / 100.0;
            return isNaN(v) ? 0 : v;
        }
        return 0;
    };

    // --- Head Rotation ---
    const toRad = Math.PI / 180;

    if (data.headPitch !== undefined && !isNaN(data.headPitch)) tmpInfo['pitch'] = data.headPitch * toRad;
    if (data.headYaw !== undefined && !isNaN(data.headYaw)) tmpInfo['yaw'] = data.headYaw * toRad;
    if (data.headRoll !== undefined && !isNaN(data.headRoll)) tmpInfo['roll'] = data.headRoll * toRad;

    // Optional: Head Position (scaled)
    // if (data.headX !== undefined && !isNaN(data.headX)) tmpInfo['x'] = data.headX * 0.5; // Scale TBD

    // --- Eyes ---
    const smooth = 0.5;
    const applySmooth = (key, targetVal) => {
        let oldVal = tmpInfo[key] || 0;
        tmpInfo[key] = oldVal * smooth + targetVal * (1 - smooth);
    };

    applySmooth('leftEyeOpen', 1 - getVal('eyeBlink_L'));
    applySmooth('rightEyeOpen', 1 - getVal('eyeBlink_R'));

    // Iris X (Yaw)
    let irisX = (getVal('eyeLookIn_L') + getVal('eyeLookOut_R')) - (getVal('eyeLookOut_L') + getVal('eyeLookIn_R'));
    let targetIrisX = isNaN(irisX) ? 0 : irisX * 0.2;
    applySmooth('irisPos', targetIrisX);

    // Iris Y (Pitch)
    let irisY = (getVal('eyeLookUp_L') + getVal('eyeLookUp_R')) - (getVal('eyeLookDown_L') + getVal('eyeLookDown_R'));
    let targetIrisY = isNaN(irisY) ? 0 : irisY * 0.2;
    applySmooth('irisYPos', targetIrisY);

    // --- Mouth ---
    const AMP = 1.0;
    const MOUTH_CLOSE_THRESHOLD = 0.05;

    let jawVal = getVal('jawOpen');
    if (jawVal < MOUTH_CLOSE_THRESHOLD) jawVal = 0;

    tmpInfo['mouth'] = Math.min(1, jawVal * AMP);
    tmpInfo['mouthFunnel'] = Math.min(1, getVal('mouthFunnel') * AMP);
    tmpInfo['mouthPucker'] = Math.min(1, getVal('mouthPucker') * AMP);

    tmpInfo['mouthStretch'] = Math.min(1, (getVal('mouthStretch_L') * 0.5 + getVal('mouthStretch_R') * 0.5));

    tmpInfo['mouthSmile'] = Math.min(1, (getVal('mouthSmile_L') * 0.5 + getVal('mouthSmile_R') * 0.5) * 1.2);

    // New Mouth Shapes
    tmpInfo['mouthFrown'] = Math.min(1, (getVal('mouthFrown_L') + getVal('mouthFrown_R')) * 0.5 * AMP);
    tmpInfo['mouthDimple'] = Math.min(1, (getVal('mouthDimple_L') + getVal('mouthDimple_R')) * 0.5 * AMP);
    tmpInfo['mouthPress'] = Math.min(1, (getVal('mouthPress_L') + getVal('mouthPress_R')) * 0.5 * AMP);
    tmpInfo['mouthShrug'] = Math.min(1, (getVal('mouthShrugLower') + getVal('mouthShrugUpper')) * 0.5 * AMP);
    tmpInfo['mouthRoll'] = Math.min(1, (getVal('mouthRollLower') + getVal('mouthRollUpper')) * 0.5 * AMP);

    // Tongue
    tmpInfo['tongueOut'] = getVal('tongueOut');

    // --- Brows ---
    const BROW_AMP = 2.5;

    tmpInfo['brows'] = Math.min(1, getVal('browInnerUp') * BROW_AMP);
    tmpInfo['browOuterUp'] = Math.min(1, (getVal('browOuterUp_L') + getVal('browOuterUp_R')) * 0.5 * BROW_AMP);
    tmpInfo['browDown'] = Math.min(1, (getVal('browDown_L') + getVal('browDown_R')) * 0.5 * BROW_AMP);

    // --- Cheeks ---
    tmpInfo['cheekPuff'] = getVal('cheekPuff');
    tmpInfo['cheekSquint'] = (getVal('cheekSquint_L') + getVal('cheekSquint_R')) * 0.5;

    // Force update
    pushInfo(tmpInfo);
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
            setTimeout(function () {
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

    // --- Mouth ---
    // Basic Open (A)
    let mouthRatio;
    if (getCMV('USE_IFACIALMOCAP')) {
        // iFacialMocap data is already 0-1, use directly
        mouthRatio = keys['mouth'];
    } else {
        // Webcam data needs scaling
        mouthRatio = ratioLimit((keys['mouth'] - getCMV("MOUTH_OPEN_OFFSET")) * getCMV('MOUTH_RATIO'));
    }
    meinfo['b']['aa'] = mouthRatio;

    // Extended Shapes (if available from iFacialMocap)
    if (keys['mouthFunnel'] !== undefined) meinfo['b']['oh'] = keys['mouthFunnel']; // O
    if (keys['mouthPucker'] !== undefined) meinfo['b']['ou'] = keys['mouthPucker']; // U
    if (keys['mouthStretch'] !== undefined) meinfo['b']['ih'] = keys['mouthStretch']; // I / E

    // Frown -> Sorrow/Sad
    if (keys['mouthFrown'] !== undefined) {
        // Mix with existing sad if any
        let currentSad = meinfo['b']['sad'] || 0;
        meinfo['b']['sad'] = Math.max(currentSad, keys['mouthFrown']);
    }

    // Tongue (if model supports 'tongue')
    if (keys['tongueOut'] !== undefined && keys['tongueOut'] > 0.1) {
        meinfo['b']['tongue'] = keys['tongueOut'];
    }

    // Cheek Puff (if model supports 'puff')
    if (keys['cheekPuff'] !== undefined && keys['cheekPuff'] > 0.1) {
        meinfo['b']['puff'] = keys['cheekPuff'];
    }

    // --- Brows ---
    let browInner = keys['brows'] || 0;
    let browOuter = keys['browOuterUp'] || 0;
    // Combine inner and outer for general "Brows up"
    let browspos = Math.min(1, Math.max(0, Math.max(browInner, browOuter) - getCMV("BROWS_OFFSET")) * getCMV("BROWS_RATIO"));
    meinfo['b']['Brows up'] = browspos;

    if (keys['browDown'] !== undefined) {
        meinfo['b']['angry'] = keys['browDown'];
    }

    // --- Iris Rotation ---
    let irispos = keys['irisPos'];
    if (isNaN(irispos)) irispos = 0;

    let irisY = (irispos - getCMV('IRIS_POS_OFFSET')) * getCMV('IRIS_POS_RATIO'); // Yaw (Left/Right)

    let irisYPos = keys['irisYPos'] || 0;
    if (isNaN(irisYPos)) irisYPos = 0;

    let irisX = -irisYPos * getCMV('IRIS_POS_RATIO'); // Pitch (Up/Down)

    // Safety check for array values
    if (isNaN(irisX)) irisX = 0;
    if (isNaN(irisY)) irisY = 0;

    meinfo['r']['rightEye'] = [irisX, irisY, 0];
    meinfo['r']['leftEye'] = [irisX, irisY, 0];

    // --- Auto Mood / Smile ---
    if (keys['mouthSmile'] !== undefined && keys['mouthSmile'] > 0.1) {
        meinfo['b']['happy'] = keys['mouthSmile'];
    }

    // Keep existing Auto Mood logic as fallback or mixer? 
    // If iFacialMocap is active, we might want to override.
    // But for safety, let's keep the original logic ONLY if iFacialMocap keys are missing.
    if (getCMV("MOOD") == "auto" && keys['mouthSmile'] === undefined) {
        // ... original auto logic ...
        let autoV = Math.max(-1, Math.min(1, keys["auto"] * getCMV("MOOD_AUTO_RATIO")));
        let absauto = Math.max(0, Math.abs(autoV) - getCMV("MOOD_AUTO_OFFSET"));
        // ... (simplified for brevity, assuming we rely on direct mapping now)
        if (autoV < 0) {
            meinfo['b']['angry'] = Math.max(meinfo['b']['angry'] || 0, absauto); // Mix
        } else {
            meinfo['b']['happy'] = Math.max(meinfo['b']['happy'] || 0, absauto); // Mix
        }
    }

    // --- Eyes Blink ---
    let happyThresholdForEyes = 1;
    // If happy is high, eyes might squint.
    if (meinfo['b']['happy'] > 0.5) happyThresholdForEyes = 1 - (meinfo['b']['happy'] - 0.5);

    let leo = keys['leftEyeOpen'];
    let reo = keys['rightEyeOpen'];

    if (getCMV("EYE_SYNC") || Math.abs(reo - leo) < getCMV('EYE_LINK_THRESHOLD')) {
        let avgEye = (reo + leo) / 2;
        leo = avgEye;
        reo = avgEye;
    }

    // Right Eye
    if (reo < getCMV('RIGHT_EYE_CLOSE_THRESHOLD')) {
        meinfo['b']['blinkRight'] = happyThresholdForEyes;
    } else if (reo < getCMV('RIGHT_EYE_OPEN_THRESHOLD')) {
        let eRatio = (reo - getCMV('RIGHT_EYE_CLOSE_THRESHOLD')) / (getCMV('RIGHT_EYE_OPEN_THRESHOLD') - getCMV('RIGHT_EYE_CLOSE_THRESHOLD'));
        meinfo['b']['blinkRight'] = ratioLimit((happyThresholdForEyes - eRatio) * getCMV('RIGHT_EYE_SQUINT_RATIO'));
    } else {
        meinfo['b']['blinkRight'] = 0;
    }

    // Left Eye
    if (leo < getCMV('LEFT_EYE_CLOSE_THRESHOLD')) {
        meinfo['b']['blinkLeft'] = happyThresholdForEyes;
    } else if (leo < getCMV('LEFT_EYE_OPEN_THRESHOLD')) {
        let eRatio = (leo - getCMV('LEFT_EYE_CLOSE_THRESHOLD')) / (getCMV('LEFT_EYE_OPEN_THRESHOLD') - getCMV('LEFT_EYE_CLOSE_THRESHOLD'));
        meinfo['b']['blinkLeft'] = ratioLimit((happyThresholdForEyes - eRatio) * getCMV('LEFT_EYE_SQUINT_RATIO'));
    } else {
        meinfo['b']['blinkLeft'] = 0;
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
        Object.keys(fingerRates).forEach(function (finger) {
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
            Object.keys(armEuler).forEach(function (armkey) {
                binfo['e'][prefix + armkey] = armEuler[armkey];
            });
        }
    }
    return binfo;
}

function mergeInfo(minfo, tinfo) {
    Object.keys(tinfo).forEach(function (key0) {
        if (key0 in minfo) {
            Object.keys(tinfo[key0]).forEach(function (key1) {
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
