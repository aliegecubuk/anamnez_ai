// Patient Record Management with localStorage

export interface PatientRecord {
    id: string;
    patientName: string;
    template: 'dentistry' | 'psychology';
    status: 'draft' | 'recording' | 'generated';
    transcript: string;
    cleanedTranscript?: string;
    analyzedData: any;
    createdAt: string;
    updatedAt: string;
    duration?: string;
}

const STORAGE_KEY = 'anamnezai_patients';

// Helper to safely access localStorage (only on client)
const isBrowser = typeof window !== 'undefined';

/**
 * Get all patient records from localStorage
 */
export function getAllRecords(): PatientRecord[] {
    if (!isBrowser) return [];

    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return [];
    }
}

/**
 * Get a single patient record by ID
 */
export function getRecordById(id: string): PatientRecord | null {
    const records = getAllRecords();
    return records.find(r => r.id === id) || null;
}

/**
 * Create a new patient record
 */
export function createRecord(data: Partial<PatientRecord>): PatientRecord {
    if (!isBrowser) throw new Error('localStorage not available');

    const records = getAllRecords();

    const newRecord: PatientRecord = {
        id: generateId(),
        patientName: data.patientName || 'Unnamed Patient',
        template: data.template || 'dentistry',
        status: data.status || 'draft',
        transcript: data.transcript || '',
        cleanedTranscript: data.cleanedTranscript,
        analyzedData: data.analyzedData || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: data.duration,
    };

    records.push(newRecord);
    saveRecords(records);

    return newRecord;
}

/**
 * Update an existing patient record
 */
export function updateRecord(id: string, data: Partial<PatientRecord>): PatientRecord {
    if (!isBrowser) throw new Error('localStorage not available');

    const records = getAllRecords();
    const index = records.findIndex(r => r.id === id);

    if (index === -1) {
        throw new Error(`Record with id ${id} not found`);
    }

    const updatedRecord: PatientRecord = {
        ...records[index],
        ...data,
        id, // Ensure ID doesn't change
        updatedAt: new Date().toISOString(),
    };

    records[index] = updatedRecord;
    saveRecords(records);

    return updatedRecord;
}

/**
 * Delete a patient record
 */
export function deleteRecord(id: string): boolean {
    if (!isBrowser) throw new Error('localStorage not available');

    const records = getAllRecords();
    const filtered = records.filter(r => r.id !== id);

    if (filtered.length === records.length) {
        return false; // Record not found
    }

    saveRecords(filtered);
    return true;
}

/**
 * Search patient records by name or transcript
 */
export function searchRecords(query: string): PatientRecord[] {
    if (!query.trim()) return getAllRecords();

    const records = getAllRecords();
    const lowerQuery = query.toLowerCase();

    return records.filter(record =>
        record.patientName.toLowerCase().includes(lowerQuery) ||
        record.transcript.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Get records grouped by date
 */
export function getRecordsGroupedByDate(): Record<string, PatientRecord[]> {
    const records = getAllRecords();

    // Sort by createdAt descending
    const sorted = records.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const grouped: Record<string, PatientRecord[]> = {};

    sorted.forEach(record => {
        const date = new Date(record.createdAt);
        const dateKey = formatDateKey(date);

        if (!grouped[dateKey]) {
            grouped[dateKey] = [];
        }
        grouped[dateKey].push(record);
    });

    return grouped;
}

/**
 * Calculate duration from timestamps
 */
export function calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const diff = end - start;

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

// ============ Private Helper Functions ============

function saveRecords(records: PatientRecord[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        throw new Error('Failed to save records');
    }
}

function generateId(): string {
    return `patient_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatDateKey(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffDays = Math.floor((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Bugün';
    } else if (diffDays === 1) {
        return 'Dün';
    } else if (diffDays < 7) {
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return days[date.getDay()];
    } else {
        const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }
}

/**
 * Clear all records (for testing/reset)
 */
export function clearAllRecords(): void {
    if (!isBrowser) throw new Error('localStorage not available');
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export records as JSON file
 */
export function exportRecordsToJSON(): string {
    const records = getAllRecords();
    return JSON.stringify(records, null, 2);
}

/**
 * Import records from JSON
 */
export function importRecordsFromJSON(jsonString: string): boolean {
    if (!isBrowser) throw new Error('localStorage not available');

    try {
        const imported = JSON.parse(jsonString);
        if (!Array.isArray(imported)) {
            throw new Error('Invalid format');
        }
        saveRecords(imported);
        return true;
    } catch (error) {
        console.error('Error importing records:', error);
        return false;
    }
}
