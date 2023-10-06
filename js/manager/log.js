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
