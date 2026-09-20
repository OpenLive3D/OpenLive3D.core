self.importScripts("vision_bundle.js");

// each worker instance is dedicated to one model, chosen at construction
// time via `new Worker(path, {name: "face"|"holistic"})`
const workerRole = self.name === "holistic" ? "holistic" : "face";

let landmarker = null;
let landmarkerReady = null;
let metakey = 0;

function initLandmarker() {
    landmarkerReady = FilesetResolver.forVisionTasks("wasm").then((filesetResolver) => {
        if (workerRole === "holistic") {
            return HolisticLandmarker.createFromOptions(filesetResolver, {
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
            return FaceLandmarker.createFromOptions(filesetResolver, {
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
    }).then((created) => {
        landmarker = created;
        console.log(workerRole + " worker initialization!");
        return created;
    });
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
    if (e.data && e.data["metakey"] && e.data["image"]) {
        metakey = e.data["metakey"];
        let image = e.data["image"];
        try {
            // wait for the model rather than dropping the frame - matters
            // most right after switching tracking modes, when this worker's
            // landmarker may still be loading for the first time.
            await landmarkerReady;
            let raw = await landmarker.detect(image);
            postMessage({
                "metakey": metakey,
                "results": unwrapResults(raw)
            });
        } catch (err) {
            console.log(err);
        } finally {
            // release the transferred ImageBitmap's backing memory; a plain
            // ImageData (non-OffscreenCanvas fallback) has no close() to call.
            if (image && typeof image.close === "function") {
                image.close();
            }
        }
    }
}
