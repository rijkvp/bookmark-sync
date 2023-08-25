import { syncBookmarks } from './sync';
import { importBookmarks } from './bookmarks';

if (chrome) {
    browser = chrome;
}

browser.runtime.onInstalled.addListener(() => {
    importBookmarks();
});

browser.alarms.create('sync', {
    periodInMinutes: 0.2
});

browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync') {
        syncBookmarks();
    }
});

browser.bookmarks.onChanged.addListener((id, changeInfo) => {
    console.log('Bookmark changed', id, changeInfo);
    syncBookmarks();
});
browser.bookmarks.onMoved.addListener((id, moveInfo) => {
    console.log('Bookmark moved', id, moveInfo);
    syncBookmarks();
});

browser.bookmarks.onRemoved.addListener((id, removeInfo) => {
    console.log('Bookmark removed', id, removeInfo);
    syncBookmarks();
});
