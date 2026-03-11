'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, Plus, User, Clock, CheckCircle } from 'lucide-react';
import MicrophoneComponent from '@/components/MicrophoneComponent';
import ResultDisplay from '@/components/ResultDisplay';
import { getAllRecords, createRecord, updateRecord, PatientRecord } from '@/lib/patient-storage';

export default function DentistryPage() {
    // View state: 'list' | 'new' | 'recording'
    const [view, setView] = useState<'list' | 'new' | 'recording'>('list');
    const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);
    const [patientName, setPatientName] = useState('');

    // Recording state
    const [transcript, setTranscript] = useState('');
    const [result, setResult] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Patient list
    const [patients, setPatients] = useState<PatientRecord[]>([]);

    // Load patients when on list view
    useEffect(() => {
        if (view === 'list') {
            loadPatients();
        }
    }, [view]);

    const loadPatients = () => {
        const allRecords = getAllRecords();
        const dentistryRecords = allRecords.filter(r => r.template === 'dentistry');
        setPatients(dentistryRecords);
    };

    const handleCreateNewPatient = () => {
        if (!patientName.trim()) {
            setError('Lütfen hasta adını girin');
            return;
        }

        const newRecord = createRecord({
            patientName: patientName.trim(),
            template: 'dentistry',
            status: 'recording',
        });

        setCurrentPatientId(newRecord.id);
        setView('recording');
        setPatientName('');
        setError(null);
    };

    const handleSelectPatient = (patient: PatientRecord) => {
        setCurrentPatientId(patient.id);
        setTranscript(patient.transcript || '');
        setResult(patient.analyzedData || null);
        setPatientName(patient.patientName);
        setView('recording');
    };

    const handleBackToList = () => {
        setView('list');
        setCurrentPatientId(null);
        setTranscript('');
        setResult(null);
        setPatientName('');
        setError(null);
    };

    // Auto-save transcript
    useEffect(() => {
        if (currentPatientId && transcript && view === 'recording') {
            try {
                updateRecord(currentPatientId, { transcript });
            } catch (error) {
                console.error('Failed to save transcript:', error);
            }
        }
    }, [currentPatientId, transcript, view]);

    const handleProcess = async () => {
        if (!transcript.trim()) {
            setError('Lütfen önce kayıt yapın veya metin girin');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // Skip cleanup, use transcript directly (to save API calls)
            const cleanedTranscript = transcript;

            // Analyze
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: cleanedTranscript,
                    mode: 'dentistry',
                }),
            });

            const data = await response.json();

            // Show demo mode info if warning present
            if (data.warning) {
                setError(data.warning);
            }

            setResult(data.result);

            // Save to localStorage
            if (currentPatientId) {
                updateRecord(currentPatientId, {
                    analyzedData: data.result,
                    cleanedTranscript,
                    status: 'generated',
                });
            }
        } catch (err) {
            console.error('Processing error:', err);
            setError('⚠️ İşlem hatası. Lütfen tekrar deneyin.');
        } finally {
            setIsProcessing(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    // ==================== RENDER ====================

    // LIST VIEW
    if (view === 'list') {
        return (
            <div className="min-h-screen p-4 sm:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold">Diş Hekimliği</h1>
                            <p className="text-gray-600 dark:text-gray-400">Hasta Kayıtları</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setView('new')}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Yeni Hasta Kaydı
                    </button>

                    <div className="p-6 glass rounded-2xl space-y-4">
                        <h3 className="text-xl font-bold">Tüm Kayıtlar ({patients.length})</h3>
                        {patients.length === 0 ? (
                            <div className="text-center py-12">
                                <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 dark:text-gray-400">Henüz kayıt yok</p>
                                <p className="text-sm text-gray-500 mt-2">Yeni hasta kaydı oluşturun</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {patients.map(patient => (
                                    <div
                                        key={patient.id}
                                        onClick={() => handleSelectPatient(patient)}
                                        className="p-4 bg-white dark:bg-slate-800 rounded-xl border hover:border-primary-500 cursor-pointer transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-semibold text-lg">{patient.patientName}</h4>
                                                <p className="text-sm text-gray-500">
                                                    {formatDate(patient.createdAt)}
                                                    {patient.duration && ` • ${patient.duration}`}
                                                </p>
                                            </div>
                                            <div>
                                                {patient.status === 'generated' && (
                                                    <div className="flex items-center gap-1 text-green-600">
                                                        <CheckCircle className="w-5 h-5" />
                                                        <span className="text-sm font-medium">Tamamlandı</span>
                                                    </div>
                                                )}
                                                {patient.status === 'recording' && (
                                                    <div className="flex items-center gap-1 text-blue-600">
                                                        <Clock className="w-5 h-5" />
                                                        <span className="text-sm font-medium">Kayıt ediliyor</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // NEW PATIENT FORM
    if (view === 'new') {
        return (
            <div className="min-h-screen p-4 sm:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setView('list')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-3xl font-bold">Yeni Hasta</h1>
                    </div>

                    <div className="p-6 glass rounded-2xl space-y-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2">Hasta Adı</label>
                            <input
                                type="text"
                                value={patientName}
                                onChange={(e) => setPatientName(e.target.value)}
                                placeholder="Hasta adını girin"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
                                <p className="text-red-800 dark:text-red-300">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleCreateNewPatient}
                            className="w-full px-6 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold transition-colors"
                        >
                            Kayda Başla
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // RECORDING VIEW
    return (
        <div className="min-h-screen p-4 sm:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBackToList}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">{patientName}</h1>
                        <p className="text-gray-600 dark:text-gray-400">Diş Hekimliği Anamnezi</p>
                    </div>
                </div>

                <div className="p-6 glass rounded-2xl">
                    <h3 className="text-xl font-bold mb-4">Kayıt</h3>
                    <MicrophoneComponent onTranscriptChange={setTranscript} />
                </div>

                {transcript && (
                    <div className="p-6 glass rounded-2xl">
                        <h3 className="text-xl font-bold mb-4">Transkript</h3>
                        <div className="p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl max-h-96 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{transcript}</p>
                        </div>
                        <div className="text-sm text-gray-600 mt-2">{transcript.length} karakter</div>
                    </div>
                )}

                {transcript && !result && (
                    <button
                        onClick={handleProcess}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Analiz ediliyor...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                <span>Analiz Et</span>
                            </>
                        )}
                    </button>
                )}

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl">
                        <p className="text-red-800 dark:text-red-300">{error}</p>
                    </div>
                )}

                {result && <ResultDisplay result={result} mode="dentistry" />}
            </div>
        </div>
    );
}
