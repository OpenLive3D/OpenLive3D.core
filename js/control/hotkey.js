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

function createShortcutLayout() {
    let shortcutbtn = document.getElementById("shortcutboxbutton");
    if (!shortcutbtn) return;
    shortcutbtn.innerHTML = typeof getL === 'function' ? getL("Shortcuts") : "Shortcuts";
    let shortcutbox = document.getElementById("shortcutbox");
    if (!shortcutbox) return;
    shortcutbox.innerHTML = "";

    const isMac = typeof navigator !== 'undefined' && navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? "⌘" : "Ctrl+";

    const shortcuts = [
        {
            key: `${cmdKey}B / H`,
            desc: "Hide / Show Sidebars"
        },
        {
            key: `${cmdKey}\\`,
            desc: "Hide / Show All UI (Stream Mode)"
        },
        {
            key: `${cmdKey},`,
            desc: "Toggle Settings Drawer"
        },
        {
            key: "Esc",
            desc: "Close Settings Drawer"
        },
        {
            key: `${cmdKey}0`,
            desc: "Reset Camera View"
        },
        {
            key: `${cmdKey}O`,
            desc: "Open VRM Model File..."
        },
        {
            key: `${cmdKey}1 / F`,
            desc: "Face-Only Tracking Mode"
        },
        {
            key: `${cmdKey}2 / H`,
            desc: "Upper-Body Tracking Mode"
        },
        {
            key: "1 - 8",
            desc: "Trigger Moods / Expressions"
        },
        {
            key: "Drag & Drop",
            desc: "Drop VRM / Image into Window"
        }
    ];

    let table = document.createElement("table");
    table.className = "shortcut-table";

    shortcuts.forEach(s => {
        let row = document.createElement("tr");

        let kCell = document.createElement("td");
        kCell.className = "shortcut-key-cell";

        let kbd = document.createElement("kbd");
        kbd.innerHTML = s.key;
        kCell.appendChild(kbd);

        let dCell = document.createElement("td");
        dCell.className = "shortcut-desc-cell";
        dCell.innerHTML = s.desc;

        row.appendChild(kCell);
        row.appendChild(dCell);
        table.appendChild(row);
    });

    shortcutbox.appendChild(table);
}

if (typeof onKeyUpHook === 'function') {
    onKeyUpHook(userInputKey);
} else {
    window.addEventListener('keyup', userInputKey);
}
