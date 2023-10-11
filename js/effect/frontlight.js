var frontLightParameters = {
    'color': "#FF0000",
    'intensity': [100, 0, 100]
};

function adjustFrontLightEffect() {
    let light = getFrontLight();
    light.color = new THREE.Color(frontLightParameters['color']);
    light.intensity = frontLightParameters['intensity'][0] / 100.0;
}

function resetFrontLightEffect() {
    let light = getFrontLight();
    light.color = new THREE.Color(0xffffff);
    light.intensity = 1;
}

function updateFrontLightEffect() {
    adjustFrontLightEffect();
}
