import { getBookmarks } from './bookmarks';

const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:3000',
    bookmarkStore: null
};

async function createStore(apiUrl) {
    const response = await fetch(`${apiUrl}/s`, { method: 'POST' });
    if (!response.ok) {
        throw new Error(`Failed to create store: ${response.status} ${response.statusText}`);
    }
    return response.headers.get('Location');
}

async function fetchStore(apiUrl, storeId) {
    const response = await fetch(`${apiUrl}/s/${storeId}`); if (!response.ok) {
        throw new Error(`Failed to fetch store: ${response.status} ${response.statusText}`);
    }
    let data = await response.json();
    return data;
}

async function updateStore(apiUrl, storeId, data) {
    let response = await fetch(`${apiUrl}/s/${storeId}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) {
        throw new Error(`Failed to update store: ${response.status} ${response.statusText}`);
    }
    console.log('Store updated successfully');
}

function mergeBookmarks(local, remote) {
    if (!remote.bookmarks) {
        console.info('First sync, no remote bookmarks');
        return local;
    }
    const merged = [];
    const mergeStats = {
        'new': 0,
        'updated': 0,
        'unchanged': 0,
    };
    for (let item of remote.bookmarks) {
        const existing = local.find((i) => i.id === item.id);
        if (existing) {
            // Existing item
            // Only update if local item is newer
            if (existing.updated > item.updated) {
                console.log(`Updated locally: ${item.title}`);
                merged.push(existing);
                mergeStats.updated++;
            } else {
                merged.push(item);
                mergeStats.unchanged++;
            }
        } else {
            merged.push(item);
            mergeStats.new++;
        }
    }
    if (mergeStats.new === 0 && mergeStats.updated === 0) {
        console.info('Sync completed. No changes');
    } else {
        console.info(`Sync completed. Got ${mergeStats.new} new and ${mergeStats.updated} updated bookmarks`);
    }
    return merged;
}

async function createBookmarkStore(config) {
    try {
        const storeUrl = await createStore(config.apiUrl);
        console.log('Created store: ' + storeUrl);
        await browser.storage.local.set({ 'bookmarkStore': storeUrl });
        config.bookmarkStore = storeUrl;
    } catch (error) {
        throw new Error('Failed to create bookmark store: ', error);
    }
    return config;
}

export function syncBookmarks() {
    const localBookmarks = getBookmarks();
    browser.storage.local.get(DEFAULT_CONFIG)
        .then((config) => {
            if (config.bookmarkStore === null) {
                return createBookmarkStore(config).then((config) => ({ config: config, remote: {} }));
            } else {
                return fetchStore(config.apiUrl, config.bookmarkStore).then((remote) => ({ config: config, remote: remote }));
            }
        })
        .then(({ config: config, remote }) => ({ config: config, data: { bookmarks: mergeBookmarks(localBookmarks, remote) } }))
        .then(({ config, data }) => updateStore(config.apiUrl, config.bookmarkStore, data))
        .catch((error) => console.error(`Failed to sync bookmarks: ${error}`));
}

