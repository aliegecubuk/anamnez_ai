'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, Trash2, Edit3, Save } from 'lucide-react';

interface MicrophoneComponentProps {
    onTranscriptChange: (transcript: string) => void;
    isProcessing?: boolean;
}

// Extend Window interface for Speech Recognition
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export default function MicrophoneComponent({ onTranscriptChange, isProcessing = false }: MicrophoneComponentProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editableTranscript, setEditableTranscript] = useState('');

    const recognitionRef = useRef<any>(null);
    const finalTranscriptRef = useRef('');
    const isRecordingRef = useRef(false); // Track recording state for callbacks

    useEffect(() => {
        // Check if Speech Recognition is supported
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setIsSupported(false);
                setError('Tarayıcınız ses tanıma özelliğini desteklemiyor. Lütfen Chrome veya Edge kullanın.');
                return;
            }
        }

        if (!isSupported) return;

        if (!recognitionRef.current) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'tr-TR';

            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcriptPiece = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcriptPiece + ' ';
                    } else {
                        interimTranscript += transcriptPiece;
                    }
                }

                if (finalTranscript) {
                    finalTranscriptRef.current += finalTranscript;
                    const fullText = finalTranscriptRef.current + interimTranscript;
                    setTranscript(fullText);
                    setEditableTranscript(fullText);
                    onTranscriptChange(fullText);
                } else if (interimTranscript) {
                    const fullText = finalTranscriptRef.current + interimTranscript;
                    setTranscript(fullText);
                    // No need to update editableTranscript or call onTranscriptChange for interim only
                    // as onTranscriptChange is typically for the final output or significant updates.
                    // If real-time interim updates are needed for the parent, uncomment the line below:
                    // onTranscriptChange(fullText);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'no-speech') {
                    setError('Ses algılanamadı. Lütfen mikrofona yakın konuşun.');
                } else if (event.error === 'not-allowed') {
                    setError('Mikrofon erişimi reddedildi. Lütfen tarayıcı ayarlarından izin verin.');
                } else if (event.error === 'aborted') {
                    // Ignore aborted errors (happens on manual stop)
                    return;
                } else {
                    setError(`Ses tanıma hatası: ${event.error}`);
                }
                setIsRecording(false);
                isRecordingRef.current = false;
            };

            recognitionRef.current.onend = () => {
                console.log('Recognition ended, isRecording:', isRecordingRef.current);
                // Only restart if we're still in recording mode
                if (isRecordingRef.current && recognitionRef.current) {
                    try {
                        console.log('Attempting to restart recognition...');
                        recognitionRef.current.start();
                    } catch (e) {
                        console.log('Recognition restart failed:', e);
                        setIsRecording(false);
                        isRecordingRef.current = false;
                    }
                }
            };
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore errors on cleanup
                }
            }
        };
    }, []); // Empty dependency array - only run once

    const toggleRecording = () => {
        if (!isSupported) return;

        if (isRecording) {
            // Stop recording
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                    setIsRecording(false);
                    isRecordingRef.current = false;
                } catch (e) {
                    console.error('Failed to stop recognition:', e);
                }
            }
        } else {
            // Start recording (do NOT clear transcript)
            setError(null);
            try {
                recognitionRef.current.start();
                setIsRecording(true);
                isRecordingRef.current = true;
                console.log('Started recording');
            } catch (e) {
                console.error('Failed to start recognition:', e);
                setError('Ses tanıma başlatılamadı. Lütfen sayfayı yenileyin.');
            }
        }
    };

    const handleClearTranscript = () => {
        setTranscript('');
        setEditableTranscript('');
        finalTranscriptRef.current = '';
        onTranscriptChange('');
        setError(null);
    };

    const handleSaveEdit = () => {
        setTranscript(editableTranscript);
        finalTranscriptRef.current = editableTranscript;
        onTranscriptChange(editableTranscript);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditableTranscript(transcript);
        setIsEditing(false);
    };

    return (
        <div className="space-y-4">
            {/* Microphone Button */}
            <div className="flex flex-col items-center gap-4">
                <button
                    onClick={toggleRecording}
                    disabled={!isSupported || isProcessing || isEditing}
                    className={`
            relative p-8 rounded-full transition-all duration-300 transform
            ${isRecording
                            ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse-ring'
                            : 'bg-primary-500 hover:bg-primary-600 hover:scale-105'
                        }
            ${(!isSupported || isProcessing || isEditing) ? 'opacity-50 cursor-not-allowed' : 'shadow-2xl'}
            disabled:hover:scale-100
          `}
                    aria-label={isRecording ? 'Kaydı durdur' : 'Kayda başla'}
                >
                    {isRecording ? (
                        <MicOff className="w-12 h-12 text-white" />
                    ) : (
                        <Mic className="w-12 h-12 text-white" />
                    )}

                    {/* Recording indicator rings */}
                    {isRecording && (
                        <>
                            <span className="absolute inset-0 rounded-full bg-red-400 opacity-75 animate-ping" />
                            <span className="absolute inset-0 rounded-full bg-red-400 opacity-50 animate-pulse" />
                        </>
                    )}
                </button>

                <div className="text-center">
                    <p className="text-lg font-semibold">
                        {isRecording ? (
                            <span className="text-red-600 dark:text-red-400">🔴 Kayıt Devam Ediyor...</span>
                        ) : (
                            <span className="text-gray-600 dark:text-gray-400">
                                {isProcessing ? 'İşleniyor...' : isEditing ? 'Düzenleme Modu' : 'Kayıt için tıklayın'}
                            </span>
                        )}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        {isRecording
                            ? 'Durdur için tekrar tıklayın'
                            : isEditing
                                ? 'Düzenlemeyi bitirmek için kaydedin'
                                : 'Mikrofon ile konuşmayı kaydedin'}
                    </p>
                    {transcript && !isEditing && (
                        <p className="text-xs text-gray-400 mt-2">
                            {transcript.length} karakter
                        </p>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
            )}

            {/* Browser Support Warning */}
            {!isSupported && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        ⚠️ Bu özellik için Chrome veya Edge tarayıcısı gereklidir.
                    </p>
                </div>
            )}

            {/* Transcript Display with Edit Mode */}
            {transcript && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {isEditing ? 'Transkripti Düzenle' : 'Transkript'}
                        </h4>
                        <div className="flex gap-2">
                            {!isEditing ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setEditableTranscript(transcript);
                                            setIsEditing(true);
                                        }}
                                        disabled={isRecording || isProcessing}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
                                        title="Düzenle"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Düzenle</span>
                                    </button>
                                    <button
                                        onClick={handleClearTranscript}
                                        disabled={isRecording || isProcessing}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
                                        title="Temizle"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Temizle</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSaveEdit}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Kaydet</span>
                                    </button>
                                    <button
                                        onClick={handleCancelEdit}
                                        className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                                    >
                                        İptal
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {isEditing ? (
                        <textarea
                            value={editableTranscript}
                            onChange={(e) => setEditableTranscript(e.target.value)}
                            className="w-full p-4 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-xl border-2 border-blue-500 focus:border-blue-600 focus:outline-none min-h-[150px] resize-y"
                            placeholder="Transkripti buraya yazın veya düzenleyin..."
                        />
                    ) : (
                        <div className="p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl max-h-64 overflow-y-auto">
                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {transcript}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
