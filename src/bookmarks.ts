function collectBookmarks(bookmark) {
    let bookmarks = [];
    if (bookmark.type === 'bookmark' && !bookmark.unmodifiable) {
        // TODO: consider hashing id with browser id to avoid duplicates
        bookmarks.push({
            'id': bookmark.id,
            'title': bookmark.title,
            'url': bookmark.url,
            'created': bookmark.dateAdded,
            'parentId': bookmark.parentId,
            'index': bookmark.index,
        });
    } else if (bookmark.type === 'folder') {
        for (let child of bookmark.children) {
            bookmarks = bookmarks.concat(collectBookmarks(child));
        }
    } return bookmarks;
}

async function getBrowserBookmarks() {
    const tree = await browser.bookmarks.getTree();
    return collectBookmarks(tree[0]);
}

function mergeBookmarks(currentBookmarks, newBookmarks) {
    const merged = [];
    const mergeStats = {
        'new': 0,
        'updated': 0,
        'unchanged': 0,
    };
    for (let bookmark of newBookmarks) {
        const existing = currentBookmarks.find((i) => i.id === bookmark.id);
        if (existing) {
            // Only update if browser version has changed
            if (existing.title !== bookmark.title || existing.url !== bookmark.url
                || existing.parentId !== bookmark.parentId || existing.index !== bookmark.index) {
                bookmark.updated = Date.now();
                merged.push(bookmark);
                mergeStats.updated++;
            } else {
                merged.push(existing);
                mergeStats.unchanged++;
            }
        } else {
            bookmark.updated = Date.now();
            merged.push(bookmark);
            mergeStats.new++;
        }
    }
    return [merged, mergeStats];
}

/** Returns the locally stored bookmarks in the extension. */
export async function getBookmarks() {
    const results = await browser.storage.local.get('bookmarks');
    return results['bookmarks'] || [];
}

/** Imports bookmarks from the browser into the extension. Returns the local bookmarks after the import. */
export async function importBookmarks() {
    const [localBookmarks, importBookmarks] = await Promise.all([getBookmarks(), getBrowserBookmarks()]);
    const [mergedBookmarks, mergeStats] = mergeBookmarks(localBookmarks, importBookmarks);
    if (mergeStats.new === 0 && mergeStats.updated === 0) {
        console.info('No new or updated bookmarks found');
    } else {
        await browser.storage.local.set({ 'bookmarks': mergedBookmarks });
        console.info(`Imported ${mergeStats.new} new and ${mergeStats.updated} updated bookmarks from browser`);
    }
    return mergedBookmarks;
}

