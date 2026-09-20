self.importScripts("vision_bundle.js");

// each worker instance is dedicated to one model, chosen at construction
// time via `new Worker(path, {name: "face"|"holistic"})`
const workerRole = self.name === "holistic" ? "holistic" : "face";

let landmarker = null;
let metakey = 0;

async function initLandmarker() {
    const filesetResolver = await FilesetResolver.forVisionTasks("wasm");
    if (workerRole === "holistic") {
        landmarker = await HolisticLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: "holistic_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "IMAGE",
            minFaceDetectionConfidence: 0.5,
            minPoseDetectionConfidence: 0.5,
            minTrackingConfidence: 0.55
        });
    } else {
        landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: "face_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "IMAGE",
            numFaces: 1,
            outputFaceBlendshapes: false,
            minFaceDetectionConfidence: 0.5,
            minTrackingConfidence: 0.55
        });
    }
    console.log(workerRole + " worker initialization!");
}
initLandmarker();

// adapt Tasks Vision's per-detection array results into the flat shape
// the rest of the codebase (ml-manager.js, converter/*.js) already expects
function unwrapResults(raw) {
    let newResult = {};
    if (raw.faceLandmarks && raw.faceLandmarks.length >= 1) {
        newResult["faceLandmarks"] = raw.faceLandmarks[0];
    }
    if (workerRole === "holistic") {
        if (raw.poseLandmarks && raw.poseLandmarks.length >= 1) {
            newResult["poseLandmarks"] = raw.poseLandmarks[0];
        }
        if (raw.leftHandLandmarks && raw.leftHandLandmarks.length >= 1) {
            newResult["leftHandLandmarks"] = raw.leftHandLandmarks[0];
        }
        if (raw.rightHandLandmarks && raw.rightHandLandmarks.length >= 1) {
            newResult["rightHandLandmarks"] = raw.rightHandLandmarks[0];
        }
    }
    return newResult;
}

onmessage = async e => {
    if (landmarker && e.data && e.data["metakey"] && e.data["image"]) {
        metakey = e.data["metakey"];
        try {
            let raw = await landmarker.detect(e.data["image"]);
            postMessage({
                "metakey": metakey,
                "results": unwrapResults(raw)
            });
        } catch (err) {
            console.log(err);
        }
    }
}
