import { Note, Folder, Flashcard, Slide, Cell, NoteBlock } from '../types';

const API_URL = '/api.php';
const DB_NAME = 'ESNotesDB';
const STORE_NAME = 'app_data';

export interface AppData {
    notes: Note[];
    folders: Folder[];
    flashcards: Flashcard[];
}

// --- Mappers: DB (snake_case) -> App (camelCase) ---

const mapFolder = (dbFolder: any): Folder => ({
    id: String(dbFolder.id),
    name: dbFolder.name,
    createdAt: Number(dbFolder.created_at || Date.now())
});

const mapFlashcard = (dbCard: any): Flashcard => ({
    id: String(dbCard.id),
    noteId: String(dbCard.note_id),
    front: dbCard.front,
    back: dbCard.back,
    box: Number(dbCard.box || 1),
    nextReview: dbCard.next_review ? Number(dbCard.next_review) : undefined
});

const mapSlide = (dbSlide: any): Slide => {
    let paths = [];
    try {
        paths = typeof dbSlide.paths === 'string' ? JSON.parse(dbSlide.paths) : (dbSlide.paths || []);
    } catch (e) { console.warn("Failed to parse slide paths", e); }

    return {
        id: String(dbSlide.id),
        imageData: dbSlide.image_data,
        width: Number(dbSlide.width),
        height: Number(dbSlide.height),
        summary: dbSlide.summary,
        paths: paths
    };
};

const mapCell = (dbCell: any): Cell => {
    let drawData;
    try {
        drawData = dbCell.draw_data ? (typeof dbCell.draw_data === 'string' ? JSON.parse(dbCell.draw_data) : dbCell.draw_data) : undefined;
    } catch (e) { console.warn("Failed to parse cell drawData", e); }

    return {
        id: String(dbCell.id),
        type: dbCell.type,
        content: dbCell.content || '',
        output: dbCell.output,
        language: dbCell.language,
        isCodeCollapsed: Boolean(dbCell.is_code_collapsed),
        isOutputCollapsed: Boolean(dbCell.is_output_collapsed),
        drawData
    };
};

const mapNote = (dbNote: any, slides: Slide[], cells: Cell[]): Note => {
    let blocks: NoteBlock[] = [];
    try {
        blocks = dbNote.blocks ? (typeof dbNote.blocks === 'string' ? JSON.parse(dbNote.blocks) : dbNote.blocks) : [];
    } catch (e) { console.warn("Failed to parse note blocks", e); }

    return {
        id: String(dbNote.id),
        title: dbNote.title,
        content: dbNote.content || '',
        folderId: dbNote.folder_id ? String(dbNote.folder_id) : undefined,
        templateId: dbNote.template_id || 'tpl_standard',
        language: dbNote.language,
        lastModified: Number(dbNote.last_modified || Date.now()),
        slides: slides, // Attached from separate array
        cells: cells,   // Attached from separate array
        blocks: blocks
    };
};

// --- IndexedDB Helpers ---

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const dbPut = async (key: string, value: any): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const dbGet = async (key: string): Promise<any> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        return null;
    }
};

// --- Main Service ---

export const loadData = async (): Promise<AppData | null> => {
    // 1. Try Server first
    if (navigator.onLine) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

            const response = await fetch(API_URL, { 
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                const text = await response.text();
                // Validate if text looks like JSON before parsing to avoid "Unexpected end of JSON input"
                if (text && text.trim().length > 0 && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
                    const data = JSON.parse(text);
                    
                    // Handle Flat Table Structure (Normalized DB)
                    if (data.notes) { 
                        console.log("Synced with Database");
                        
                        const rawNotes = Array.isArray(data.notes) ? data.notes : [];
                        const rawFolders = Array.isArray(data.folders) ? data.folders : [];
                        const rawCards = Array.isArray(data.flashcards) ? data.flashcards : [];
                        const rawSlides = Array.isArray(data.slides) ? data.slides : [];
                        const rawCells = Array.isArray(data.cells) ? data.cells : [];

                        // Assemble Objects
                        const folders = rawFolders.map(mapFolder);
                        const flashcards = rawCards.map(mapFlashcard);

                        const notes = rawNotes.map((n: any) => {
                            // Find related slides and cells for this note
                            const noteSlides = rawSlides
                                .filter((s: any) => String(s.note_id) === String(n.id))
                                .map(mapSlide);
                            
                            const noteCells = rawCells
                                .filter((c: any) => String(c.note_id) === String(n.id))
                                .map(mapCell);

                            return mapNote(n, noteSlides, noteCells);
                        });
                        
                        // Update Local Cache (IndexedDB)
                        await dbPut('notes', notes);
                        await dbPut('folders', folders);
                        await dbPut('flashcards', flashcards);
                        
                        return { notes, folders, flashcards };
                    }
                }
            }
        } catch (e) {
            // Backend unreachable is expected in some environments, logging as debug to avoid console noise
            console.debug("Backend load skipped (using offline storage):", e);
        }
    }

    // 2. Fallback to IndexedDB
    try {
        const dbNotes = await dbGet('notes');
        const dbFolders = await dbGet('folders');
        const dbCards = await dbGet('flashcards');
        
        if (dbNotes) {
            return {
                notes: dbNotes,
                folders: dbFolders || [],
                flashcards: dbCards || []
            };
        }
    } catch (e) {
        console.error("IndexedDB load failed", e);
    }

    // 3. Fallback to Local Storage (Migration from old version)
    try {
        const localNotes = localStorage.getItem('smartnotes_data');
        if (localNotes) {
            console.log("Migrating from LocalStorage to IndexedDB...");
            const notes = JSON.parse(localNotes);
            const folders = JSON.parse(localStorage.getItem('smartnotes_folders') || '[]');
            const flashcards = JSON.parse(localStorage.getItem('smartnotes_cards') || '[]');

            // Save to DB
            await dbPut('notes', notes);
            await dbPut('folders', folders);
            await dbPut('flashcards', flashcards);

            // Optional: Clear LocalStorage to free space? 
            // localStorage.removeItem('smartnotes_data');
            
            return { notes, folders, flashcards };
        }
    } catch (e) {
        console.error("Local storage corrupted", e);
    }

    return null;
};

export const saveData = async (data: AppData): Promise<void> => {
    // 1. Save to IndexedDB (Robust Client Storage)
    try {
        await dbPut('notes', data.notes);
        await dbPut('folders', data.folders);
        await dbPut('flashcards', data.flashcards);
    } catch (e) {
        console.error("IndexedDB Save Failed", e);
        throw new Error("Failed to save to local database");
    }

    // 2. Server Sync
    if (navigator.onLine) {
        try {
            const controller = new AbortController();
            // Short timeout for sync to prevent blocking behavior
            const timeoutId = setTimeout(() => controller.abort(), 3000); 

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal,
                keepalive: true 
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                // Just log debug, not warn, to prevent user alarm if backend is missing
                console.debug("Server sync skipped (backend not available)");
            }
        } catch (e) {
            console.debug("Background sync failed (expected if no backend)", e);
        }
    }
};