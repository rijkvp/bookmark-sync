import browser from 'webextension-polyfill';
import { Bookmark, getBookmarks, saveBookmarks } from './bookmarks';

async function createStore(apiUrl: string): Promise<string> {
    const response = await fetch(`${apiUrl}/s`, { method: 'POST' });
    if (!response.ok) {
        throw new Error(`Failed to create store: ${response.status} ${response.statusText}`);
    }
    return response.headers.get('Location')!;
}

async function fetchStore(apiUrl: string, storeId: string): Promise<any> {
    const response = await fetch(`${apiUrl}/s/${storeId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch store: ${response.status} ${response.statusText}`);
    }
    let data = await response.json();
    return data;
}

async function updateStore(apiUrl: string, storeId: string, data: any) {
    let response = await fetch(`${apiUrl}/s/${storeId}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) {
        throw new Error(`Failed to update store: ${response.status} ${response.statusText}`);
    }
}

export type SyncResult = {
    bookmarks: Bookmark[],
    localUpdates: Bookmark[],
    remoteUpdates: Bookmark[],
    localNew: Bookmark[],
    remoteNew: Bookmark[],
};

// Inefficient change direction implementation, but it works :)
function findChanges(local: Bookmark[], remote: Bookmark[]): SyncResult {
    const result: SyncResult = {
        bookmarks: [],
        localUpdates: [],
        remoteUpdates: [],
        localNew: [],
        remoteNew: [],
    };
    for (let item of local) {
        const existing = remote.find((i) => i.id === item.id);
        if (existing) {
            if (item.updated > existing.updated) {
                // Locally updated
                result.bookmarks.push(item);
                result.localUpdates.push(item);
            } else if (existing.updated > item.updated) {
                // Remotely updated
                result.bookmarks.push(existing);
                result.remoteUpdates.push(existing);
            } else {
                // Unchanged
                result.bookmarks.push(item);
            }
        } else {
            // Locally new
            result.bookmarks.push(item);
            result.localNew.push(item);
        }
    }
    for (let item of remote) {
        const existing = local.find((i) => i.id === item.id);
        if (!existing) {
            // Remotely new
            result.bookmarks.push(item);
            result.remoteNew.push(item);
        }
    }
    return result;
}

async function createBookmarkStore(apiUrl: string): Promise<string> {
    try {
        const storeUrl = await createStore(apiUrl);
        console.log('Created store: ' + storeUrl);
        await browser.storage.local.set({ 'bookmarkStore': storeUrl });
        return storeUrl;
    } catch (error) {
        throw new Error(`Failed to create store: ${error}`);
    }
}

export async function syncBookmarks() {
    const localBookmarks = await getBookmarks();
    let config = await browser.storage.local.get({
        apiUrl: 'http://localhost:3000',
        bookmarkStore: null
    });
    let bookmarkStore = config.bookmarkStore;

    const remoteBookmarks = [];
    if (config.bookmarkStore === null) {
        bookmarkStore = await createBookmarkStore(config.apiUrl);
    } else {
        const store = await fetchStore(config.apiUrl, bookmarkStore);
        if (store.bookmarks) {
            remoteBookmarks.push(...store.bookmarks);
        } else {
            console.info('Empty bookmark store, this is probably the first sync');
        }
    }
    const syncResult = findChanges(localBookmarks, remoteBookmarks);
    console.log(syncResult);
    await Promise.all([updateStore(config.apiUrl, bookmarkStore, { bookmarks: syncResult.bookmarks }), saveBookmarks(syncResult.bookmarks)]);
    if (syncResult.localUpdates.length === 0 && syncResult.remoteUpdates.length === 0
        || syncResult.localNew.length === 0 && syncResult.remoteNew.length === 0) {
        console.info('Sync completed. No changes');
    } else {
        console.info(`Sync completed. Local: ${syncResult.localUpdates.length} updates, ${syncResult.localNew.length} new, Remote: ${syncResult.remoteUpdates.length} updates, ${syncResult.remoteNew.length} new`);
    }

    // Update changes in browser
    let deleted = false;
    for (let remoteChange of syncResult.remoteUpdates) {
        if (remoteChange.deleted) {
            console.log('Deleting bookmark: ' + remoteChange.title);
            browser.bookmarks.remove(remoteChange.id);
            deleted = true;
        } else {
            console.log('Updating bookmark: ' + remoteChange.title);
            browser.bookmarks.update(remoteChange.id, { title: remoteChange.title, url: remoteChange.url });
            // TODO: Check if the bookmark is moved to a different folder / position
        }
    }
    for (let newBookmark of syncResult.remoteNew) {
        console.log('Creating bookmark: ' + newBookmark.title);
        browser.bookmarks.create({
            title: newBookmark.title,
            url: newBookmark.url,
            index: newBookmark.index ?? undefined,
            parentId: newBookmark.parentId ?? undefined,
        });
    }
    if (deleted) {
        // TODO: Reimport stuff because ordering is likely changed
    }
}

