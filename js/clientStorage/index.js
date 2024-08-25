let Db

function openIndex() {
    //https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor/key
    //https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor/request
    //https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor/delete
    //https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex
    const request = indexedDB.open('MusicDB', 1)

    request.onupgradeneeded = function(event) {
        Db = event.target.result
        if (!Db.objectStoreNames.contains('songs')) {
            Db.createObjectStore('songs', {
                keyPath: 'id',
                autoIncrement: true
            })
        }
    }
    request.onsuccess = function(event) {
        Db = event.target.result
        loadSongs()
    }
    request.onerror = function(event) {
        console.error('Error initializing Database:', event.target.errorCode)
    }
}

function loadSongs() {
    const transaction = Db.transaction(['songs'], 'readonly')
    const objectStore = transaction.objectStore('songs')
    const request = objectStore.getAll()

    request.onsuccess = function(event) {
        songList = event.target.result
        songCounter = songList.length
        updateMusicList();
    }
    request.onerror = function(event) {
        console.error('Error loading songs:', event.target.errorCode)
    }
}

function addSong(song) {
    const transaction = Db.transaction(['songs'], 'readwrite')
    const objectStore = transaction.objectStore('songs')
    const request = objectStore.add(song)

    request.onsuccess = function() {
        console.log('Song successfully added:', song)
    }
    request.onerror = function(event) {
        console.error('Error adding song:', event.target.errorCode)
    }
}

function deleteSong(id) {
    const transaction = Db.transaction(['songs'], 'readwrite')
    const objectStore = transaction.objectStore('songs')
    const request = objectStore.delete(id)

    request.onsuccess = function() {
        console.log('Song successfully deleted:', id)
    }
    request.onerror = function(event) {
        console.error('Error deleting song :', event.target.errorCode)
    }
}
