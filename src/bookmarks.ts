import browser, { Bookmarks } from 'webextension-polyfill';

export type Bookmark = {
    id: string,
    title: string,
    url: string,
    created: number,
    updated: number,
    deleted: boolean,
    parentId: string | null,
    index: number | null,
};

function collectBookmarks(bookmark: Bookmarks.BookmarkTreeNode) {
    let bookmarks: Bookmark[] = [];
    if (bookmark.type === 'bookmark' && !bookmark.unmodifiable) {
        // TODO: consider hashing id with browser id to avoid duplicates
        bookmarks.push({
            'id': bookmark.id,
            'title': bookmark.title,
            'url': bookmark.url ?? '',
            'created': bookmark.dateAdded!,
            'updated': Date.now(),
            'deleted': false,
            'parentId': bookmark.parentId ?? null,
            'index': bookmark.index ?? null,
        });
    } else if (bookmark.type === 'folder' && bookmark.children) {
        for (let child of bookmark.children) {
            bookmarks = bookmarks.concat(collectBookmarks(child));
        }
    } return bookmarks;
}

async function getBrowserBookmarks() {
    const tree = await browser.bookmarks.getTree();
    return collectBookmarks(tree[0]);
}

type MergeStats = {
    new: number,
    updated: number,
    unchanged: number,
};

function mergeBookmarks(currentBookmarks: Bookmark[], newBookmarks: Bookmark[]): [Bookmark[], MergeStats] {
    const merged: Bookmark[] = [];
    const mergeStats: MergeStats = {
        new: 0,
        updated: 0,
        unchanged: 0,
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
export async function getBookmarks(): Promise<Bookmark[]> {
    const results = await browser.storage.local.get('bookmarks');
    return results['bookmarks'] || [];
}

/** Saves the bookmarks to the local storage in the extension. */
export async function saveBookmarks(bookmarks: Bookmark[]) {
    await browser.storage.local.set({ 'bookmarks': bookmarks });
    console.info(`Saved ${bookmarks.length} bookmarks`);
}

/** Imports bookmarks from the browser into the extension. Returns the local bookmarks after the import. */
export async function importBookmarks(): Promise<Bookmark[]> {
    const [localBookmarks, importBookmarks] = await Promise.all([getBookmarks(), getBrowserBookmarks()]);
    const [mergedBookmarks, mergeStats] = mergeBookmarks(localBookmarks, importBookmarks);
    if (mergeStats.new === 0 && mergeStats.updated === 0) {
        console.info('No new or updated bookmarks found');
    } else {
        await saveBookmarks(mergedBookmarks);
        console.info(`Imported ${mergeStats.new} new and ${mergeStats.updated} updated bookmarks from browser`);
    }
    return mergedBookmarks;
}

