// logging manager

let curKeys = {};
let curPoIs = {};
function postLog(keys){
    Object.keys(keys).forEach(function(key){
        curKeys[key] = keys[key];
    });
}
function getLog(){
    return curKeys;
}
function postPoI(pois){
    curPoIs = pois;
}
function getPoI(){
    return curPoIs;
}
