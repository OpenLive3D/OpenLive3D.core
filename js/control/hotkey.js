function setMoodWithHotkey(moodId) {
  let validmoods = getAllMoods();
  let moodNumber = validmoods.length;
  if (moodId < 0 || moodId >= moodNumber) {
    console.log("moodId exceeds limit:", moodId, "/", moodNumber);
  } else {
    setMoodSelect(validmoods[moodId]);
    setMood(validmoods[moodId]);
  }
}

function userInputKey(e) {
  // Prevent hotkeys if user is typing in an input field
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    return;
  }

  let key = String.fromCharCode(e.which);
  switch (key) {
    case 'H':
      setCMV("TRACKING_MODE", "Upper-Body");
      setTrackingModeSelect("Upper-Body");
      break;
    case 'F':
      setCMV("TRACKING_MODE", "Face-Only");
      setTrackingModeSelect("Face-Only");
      break;
    case '1':
      setMoodWithHotkey(0);
      break;
    case '2':
      setMoodWithHotkey(1);
      break;
    case '3':
      setMoodWithHotkey(2);
      break;
    case '4':
      setMoodWithHotkey(3);
      break;
    case '5':
      setMoodWithHotkey(4);
      break;
    case '6':
      setMoodWithHotkey(5);
      break;
    case '7':
      setMoodWithHotkey(6);
      break;
    case '8':
      setMoodWithHotkey(7);
      break;
    case '9':
      setMoodWithHotkey(8);
      break;
    default:
      break;
  }
}

onKeyUpHook(userInputKey);
