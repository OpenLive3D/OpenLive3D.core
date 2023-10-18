let capture = document.getElementById("webcam");

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

function checkCameraPaused() {
    return capture.paused;
}

// force video play
function playCapture() {
    capture.play();
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
