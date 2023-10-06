class Single {
    fModel = null;
    fModelInit = false;
    metakey = 0;
    cb = null;

    constructor(cb) {
        this.fModel = new FaceMesh({
            locateFile: (file) => {
                if (file == "face_mesh_solution_packed_assets.data") {
                    return "./ol3dc/face_mesh/face_mesh_solution_packed_assets.data";
                } else {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
                }
            }
        });
        this.fModel.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.55
        });
        console.log("holistic worker initialization!");
        this.fModelInit = true;
        this.cb = cb;
    }
    init() {
        let this2 = this;
        this.fModel.onResults(function(results) {
            let newResult = {};
            if ("multiFaceLandmarks" in results && results["multiFaceLandmarks"].length >= 1) {
                newResult["faceLandmarks"] = results["multiFaceLandmarks"][0];
            }
            try {
                this2.cb({
                    "data": {
                        "metakey": this2.metakey,
                        "results": newResult
                    }
                });
            } catch (err) {
                console.log(err);
            }
        });
    }

    async postMessage(data) {
        if (this.fModelInit && data["metakey"] && data["image"]) {
            this.metakey = data["metakey"];
            await this.fModel.send({
                image: data["image"]
            });
        }
    }
}
