var topLightParameters = {
    'color': "#FF0000",
    'intensity': [100, 0, 100]
};

function adjustTopLightEffect() {
    let light = getTopLight();
    light.color = new THREE.Color(topLightParameters['color']);
    light.intensity = topLightParameters['intensity'][0] / 100.0;
}

function resetTopLightEffect() {
    let light = getTopLight();
    light.color = new THREE.Color(0x000000);
    light.intensity = 0;
}

function updateTopLightEffect() {
    adjustTopLightEffect();
}
