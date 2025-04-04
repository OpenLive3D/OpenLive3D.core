const TVRMSHBN = THREE_VRM.VRMHumanBoneName;
console.log("TVRMSHBN", TVRMSHBN);

let loader = new THREE.GLTFLoader();

let poseBones = [
    TVRMSHBN.LeftHand,
    TVRMSHBN.LeftIndexDistal,
    TVRMSHBN.LeftIndexIntermediate,
    TVRMSHBN.LeftIndexProximal,
    TVRMSHBN.LeftLittleDistal,
    TVRMSHBN.LeftLittleIntermediate,
    TVRMSHBN.LeftLittleProximal,
    TVRMSHBN.LeftLowerArm,
    TVRMSHBN.LeftMiddleDistal,
    TVRMSHBN.LeftMiddleIntermediate,
    TVRMSHBN.LeftMiddleProximal,
    TVRMSHBN.LeftRingDistal,
    TVRMSHBN.LeftRingIntermediate,
    TVRMSHBN.LeftRingProximal,
    TVRMSHBN.LeftShoulder,
    TVRMSHBN.LeftThumbDistal,
    TVRMSHBN.LeftThumbMetacarpal,
    TVRMSHBN.LeftThumbProximal,
    TVRMSHBN.LeftUpperArm,
    TVRMSHBN.RightHand,
    TVRMSHBN.RightIndexDistal,
    TVRMSHBN.RightIndexIntermediate,
    TVRMSHBN.RightIndexProximal,
    TVRMSHBN.RightLittleDistal,
    TVRMSHBN.RightLittleIntermediate,
    TVRMSHBN.RightLittleProximal,
    TVRMSHBN.RightLowerArm,
    TVRMSHBN.RightMiddleDistal,
    TVRMSHBN.RightMiddleIntermediate,
    TVRMSHBN.RightMiddleProximal,
    TVRMSHBN.RightRingDistal,
    TVRMSHBN.RightRingIntermediate,
    TVRMSHBN.RightRingProximal,
    TVRMSHBN.RightShoulder,
    TVRMSHBN.RightThumbDistal,
    TVRMSHBN.RightThumbMetacarpal,
    TVRMSHBN.RightThumbProximal,
    TVRMSHBN.RightUpperArm
];

let defaultPose = [
    [TVRMSHBN.LeftUpperArm, [0, 0, 70]],
    [TVRMSHBN.RightUpperArm, [0, 0, -70]],
    [TVRMSHBN.LeftLowerArm, [-20, -30, 10]],
    [TVRMSHBN.RightLowerArm, [-20, 30, -10]],
    [TVRMSHBN.LeftHand, [0, 0, 0]],
    [TVRMSHBN.RightHand, [0, 0, 0]],
];

let heartPose = [
    [TVRMSHBN.LeftIndexDistal, [0, 0, 30]],
    [TVRMSHBN.LeftIndexIntermediate, [0, 0, 50]],
    [TVRMSHBN.LeftIndexProximal, [0, 0, 10]],
    [TVRMSHBN.LeftLittleDistal, [0, 0, 30]],
    [TVRMSHBN.LeftLittleIntermediate, [0, 0, 40]],
    [TVRMSHBN.LeftLowerArm, [27, -140, 0]],
    [TVRMSHBN.LeftMiddleDistal, [0, 0, 30]],
    [TVRMSHBN.LeftMiddleIntermediate, [0, 0, 50]],
    [TVRMSHBN.LeftMiddleProximal, [0, 0, 10]],
    [TVRMSHBN.LeftRingDistal, [0, 0, 30]],
    [TVRMSHBN.LeftRingIntermediate, [0, 0, 50]],
    [TVRMSHBN.LeftRingProximal, [0, 0, 10]],
    [TVRMSHBN.LeftThumbMetacarpal, [-90, 0, 0]],
    [TVRMSHBN.LeftThumbProximal, [0, -15, 0]],
    [TVRMSHBN.LeftUpperArm, [0, -31, 42]],
    [TVRMSHBN.RightIndexDistal, [0, 0, -30]],
    [TVRMSHBN.RightIndexIntermediate, [0, 0, -50]],
    [TVRMSHBN.RightIndexProximal, [0, 0, -10]],
    [TVRMSHBN.RightLittleDistal, [0, 0, -30]],
    [TVRMSHBN.RightLittleIntermediate, [0, 0, -40]],
    [TVRMSHBN.RightLowerArm, [27, 140, 0]],
    [TVRMSHBN.RightMiddleDistal, [0, 0, -30]],
    [TVRMSHBN.RightMiddleIntermediate, [0, 0, -50]],
    [TVRMSHBN.RightMiddleProximal, [0, 0, -10]],
    [TVRMSHBN.RightRingDistal, [0, 0, -30]],
    [TVRMSHBN.RightRingIntermediate, [0, 0, -50]],
    [TVRMSHBN.RightRingProximal, [0, 0, -10]],
    [TVRMSHBN.RightThumbMetacarpal, [-90, 0, 0]],
    [TVRMSHBN.RightThumbProximal, [0, 15, 0]],
    [TVRMSHBN.RightUpperArm, [0, 31, -42]],
];

function setPoseMode(vrm, mode) {
    let VRM_R = [getCMV('VRM_XR'), getCMV('VRM_YR'), getCMV('VRM_ZR')];
    for (let i = 0; i < poseBones.length; i++) {
        let pose = poseBones[i];
        for (let j = 0 ; j < 3; j++) {
            vrm.humanoid.getNormalizedBoneNode(pose).rotation["xyz"[j]] = 0;
        }
    }
    let poseMode = defaultPose;
    if (getCMV('TRACKING_MODE') == "Heart") {
        poseMode = heartPose;
    }
    for (let i = 0; i < poseMode.length; i++) {
        let pose = poseMode[i];
        for (let j = 0; j < 3; j++) {
            vrm.humanoid.getNormalizedBoneNode(pose[0]).rotation["xyz" [j]] =
                pose[1][j] * Math.PI / 180 * VRM_R[j];
        }
    }
}

function setDefaultPose(vrm) {
    for (let i = 0; i < poseBones.length; i++) {
        let pose = poseBones[i];
        for (let j = 0 ; j < 3; j++) {
            vrm.humanoid.getNormalizedBoneNode(pose).rotation["xyz"[j]] = 0;
        }
    }
    let VRM_R = [getCMV('VRM_XR'), getCMV('VRM_YR'), getCMV('VRM_ZR')];
    for (let i = 0; i < defaultPose.length; i++) {
        let pose = defaultPose[i];
        for (let j = 0; j < 3; j++) {
            vrm.humanoid.getNormalizedBoneNode(pose[0]).rotation["xyz" [j]] =
                pose[1][j] * Math.PI / 180 * VRM_R[j];
        }
    }
}

function setDefaultHand(vrm, leftright) {
    let VRM_R = [getCMV('VRM_XR'), getCMV('VRM_YR'), getCMV('VRM_ZR')];
    for (let i = leftright; i < defaultPose.length; i += 2) {
        let pose = defaultPose[i];
        for (let j = 0; j < 3; j++) {
            vrm.humanoid.getNormalizedBoneNode(pose[0]).rotation["xyz" [j]] =
                pose[1][j] * Math.PI / 180 * VRM_R[j];
        }
    }
}

function loadVRMModel(url, cb, ecb) {
    loader.crossOrigin = 'anonymous';
    loader.register((parser) => {
        return new THREE_VRM.VRMLoaderPlugin(parser);
    });
    loader.load(url,
        (gltf) => {
            THREE_VRM.VRMUtils.removeUnnecessaryVertices(gltf.scene);
            THREE_VRM.VRMUtils.removeUnnecessaryJoints(gltf.scene);
            let vrm = gltf.userData.vrm;
            if (vrm.meta.metaVersion === '0') {
                setCMV('VRM_XR', 1);
                setCMV('VRM_ZR', 1);
            } else if (vrm.meta.metaVersion === '1') {
                setCMV('VRM_XR', -1);
                setCMV('VRM_ZR', -1);
            }
            setDefaultPose(vrm);
            cb(vrm);
        },
        (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
        (error) => {
            ecb();
            console.error(error);
        }
    );
}
