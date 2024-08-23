// effect

function initEffect() {}


function getEffectByKey(key) {
    const allEffects = getAllEffects();
    for (let effects in allEffects) {
        for (let type of allEffects[effects]) {
            if (type.key === key) {
                return type;
            } 
        }
    }
    return null; 
}

function getAllEffects() {
    return {
        "BACKGROUND": [{
            'key': 'BG_COLOR',
            'title': 'Background Color',
            'describe': 'Accept Color Code with "#" or "rgba", "hsla"',
            'type': 'background'
        }, {
            'key': 'BG_UPLOAD',
            'title': 'Upload Image',
            'describe': 'Upload an image as your background',
            'type': 'background'
        }, {
            'key': 'BLUR_BG',
            'title': 'Blur effect',
            'describe': 'Blurs background image. Note: There has to be a BG to apply blur effects',
            'type': 'background',
            'enableEffect': enableBgBlur,
            'disableEffect': disableBgBlur,
            'updateEffect': updateBgBlur,
            'parameters': bgParameters 
        }],
        "Screen Modification": [{
            'key': 'BLUR',
            'title': 'Blur',
            'describe': 'Blur the output screen',
            'type': 'screen', // screen | object | particle
            'enableEffect': enableBlurEffect,
            'disableEffect': disableBlurEffect,
            'updateEffect': updateBlurEffect,
            'parameters': blurParameters
        }],
        "Flare / Lighting": [{
            'key': 'FRONTLIGHT',
            'title': 'Front Light',
            'describe': 'The parameters of the front light',
            'type': 'flare', // screen | object | particle
            'enableEffect': adjustFrontLightEffect,
            'disableEffect': resetFrontLightEffect,
            'updateEffect': updateFrontLightEffect,
            'parameters': frontLightParameters
        }, {
            'key': 'BACKLIGHT',
            'title': 'Back Light',
            'describe': 'The parameters of the back light',
            'type': 'flare', // screen | object | particle
            'enableEffect': adjustBackLightEffect,
            'disableEffect': resetBackLightEffect,
            'updateEffect': updateBackLightEffect,
            'parameters': backLightParameters
        }],
        "Particle Effects": [{
            'key': 'RAIN',
            'title': 'Rain',
            'describe': 'Basic raining',
            'type': 'particle', // screen | object | particle
            'enableEffect': enableRainEffect,
            'disableEffect': disableRainEffect,
            'updateEffect': updateRainEffect,
            'parameters': rainParameters
        }]
    }
}
