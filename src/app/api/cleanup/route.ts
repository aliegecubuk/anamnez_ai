import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { transcript } = await request.json();

        if (!transcript) {
            return NextResponse.json(
                { error: 'Transcript is required' },
                { status: 400 }
            );
        }

        console.log('🧹 Cleaning transcript (Local processing)');

        // Simple text cleanup without API
        const cleanedTranscript = cleanupText(transcript);

        return NextResponse.json({ cleanedTranscript });

    } catch (error) {
        console.error('Transcript cleanup error:', error);
        return NextResponse.json(
            { error: 'Failed to clean transcript', details: String(error) },
            { status: 500 }
        );
    }
}

// Simple text cleanup function
function cleanupText(text: string): string {
    let cleaned = text;

    // Remove excessive spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove repeated words (e.g., "diş diş" -> "diş")
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');

    // Add period at the end if missing
    cleaned = cleaned.trim();
    if (cleaned && !cleaned.match(/[.!?]$/)) {
        cleaned += '.';
    }

    // Capitalize first letter of sentences
    cleaned = cleaned.replace(/(^|[.!?]\s+)(\w)/g, (match, p1, p2) => p1 + p2.toUpperCase());

    // Capitalize first letter
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
}
