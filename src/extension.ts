import browser from 'webextension-polyfill';
// import { syncBookmarks } from './sync';
// import { importBookmarks } from './bookmarks';

browser.runtime.onInstalled.addListener(() => {
    // importBookmarks();
});

browser.alarms.create('sync', {
    periodInMinutes: 1
});

// Auto-sync is disabled for now
// browser.alarms.onAlarm.addListener((alarm) => {
//    if (alarm.name === 'sync') {
//        syncBookmarks();
//    }
// });

browser.bookmarks.onChanged.addListener((id, changeInfo) => {
    console.log('Bookmark changed', id, changeInfo);
    // TODO: somehow prevent this from triggering when applying changes
    //syncBookmarks();
});
browser.bookmarks.onMoved.addListener((id: string, moveInfo) => {
    console.log('Bookmark moved', id, moveInfo);
    // TODO: Re-import bookmarks
    // TODO: somehow prevent this from triggering when applying changes
    // syncBookmarks();
});

browser.bookmarks.onRemoved.addListener((id, removeInfo) => {
    console.log('Bookmark removed', id, removeInfo);
    // TODO: somehow prevent this from triggering when applying changes
    // syncBookmarks();
});
