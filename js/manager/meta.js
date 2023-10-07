// manage metadata for manager evaluation
let metadata = {
    "key": 0,
    "time": 0
};

// healthcheck metadata
function setNewMeta() {
    metadata["key"] = Date.now();
    metadata["time"] = metadata["key"];
    console.log("set new metadata:", metadata);
}

function correctMeta() {
    metadata["time"] = Date.now();
}

function getMetaKey() {
    return metadata["key"];
}

function getMetaTime() {
    return metadata["time"];
}
