// Shadow the ambient global that a page's debug canvas (any id="dbg"
// element implicitly becomes window.dbg via the DOM) can create. Emscripten's
// glue code guards its internal debug-logging hook with `typeof dbg`, and a
// bare `let dbg;` here - sharing this page's global lexical scope with every
// other classic script, including vision_bundle.js - takes precedence over
// window's own/named properties for that lookup, without requiring any
// particular id name in the consuming page's HTML.
let dbg;

class Single {
    fLandmarker = null;
    fLandmarkerReady = null;
    metakey = 0;
    cb = null;

    constructor(cb) {
        this.cb = cb;
        this.fLandmarkerReady = FilesetResolver.forVisionTasks("ol3dc/vision/wasm").then((filesetResolver) => {
            return FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "ol3dc/vision/face_landmarker.task",
                    delegate: "GPU"
                },
                runningMode: "IMAGE",
                numFaces: 1,
                outputFaceBlendshapes: false,
                minFaceDetectionConfidence: 0.5,
                minTrackingConfidence: 0.55
            });
        }).then((landmarker) => {
            this.fLandmarker = landmarker;
            console.log("single-thread face worker initialization!");
            return landmarker;
        });
    }

    init() {}

    unwrapResults(raw) {
        let newResult = {};
        if (raw.faceLandmarks && raw.faceLandmarks.length >= 1) {
            newResult["faceLandmarks"] = raw.faceLandmarks[0];
        }
        return newResult;
    }

    async postMessage(data) {
        if (data["metakey"] && data["image"]) {
            this.metakey = data["metakey"];
            await this.fLandmarkerReady;
            try {
                let raw = await this.fLandmarker.detect(data["image"]);
                this.cb({
                    "data": {
                        "metakey": this.metakey,
                        "results": this.unwrapResults(raw)
                    }
                });
            } catch (err) {
                console.log(err);
            }
        }
    }
}
