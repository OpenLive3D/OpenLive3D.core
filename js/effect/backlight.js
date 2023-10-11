var backLightParameters = {
    'color': "#FF0000",
    'intensity': [100, 0, 100]
};

function adjustBackLightEffect() {
    let light = getBackLight();
    light.color = new THREE.Color(backLightParameters['color']);
    light.intensity = backLightParameters['intensity'][0] / 100.0;
}

function resetBackLightEffect() {
    let light = getBackLight();
    light.color = new THREE.Color(0x000000);
    light.intensity = 0;
}

function updateBackLightEffect() {
    adjustBackLightEffect();
}
