import browser from 'webextension-polyfill';
import { syncBookmarks } from './sync';
import { importBookmarks, getBookmarks } from './bookmarks';

const list = document.getElementById('list')!;
const syncButton = document.getElementById('sync-button')!;
const importButton = document.getElementById('import-button')!;

async function displayBookmarks() {
    const bookmarks = await getBookmarks();
    for (let bookmark of bookmarks) {
        const item = document.createElement('li');
        item.innerHTML = `<a href="${bookmark.url}">${bookmark.title}</a>`;
        list.appendChild(item);
    }
}
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['bookmarks']) {
        list.innerHTML = 'TODO: Reload bookmarks';
    }
});

syncButton.addEventListener('click', async () => syncBookmarks());
importButton.addEventListener('click', async () => importBookmarks());

displayBookmarks();
