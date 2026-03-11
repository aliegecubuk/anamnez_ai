'use client';

import React, { useState } from 'react';
import { Copy, Check, Download, ChevronDown, ChevronUp, EyeOff, Eye } from 'lucide-react';
import { exportToPDF } from '@/lib/pdf-export';
import DentalChart from './DentalChart';

interface ResultDisplayProps {
    result: any;
    mode: 'dentistry' | 'psychology';
}

export default function ResultDisplay({ result, mode }: ResultDisplayProps) {
    const [copied, setCopied] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['patientInfo', 'complaint', 'presentingProblem']));
    const [showEmptyFields, setShowEmptyFields] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleCopy = () => {
        const textToCopy = JSON.stringify(result, null, 2);
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const patientName = result.patientInfo?.name || 'Hasta';
            await exportToPDF({ result, mode, patientName });
        } catch (error) {
            console.error('PDF export failed:', error);
            alert('PDF oluşturulurken bir hata oluştu');
        } finally {
            setIsExporting(false);
        }
    };

    const toggleSection = (sectionId: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(sectionId)) {
            newExpanded.delete(sectionId);
        } else {
            newExpanded.add(sectionId);
        }
        setExpandedSections(newExpanded);
    };

    const hasValue = (value: any): boolean => {
        if (value === null || value === undefined) return false;
        if (value === 'Belirtilmedi') return false;
        if (value === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && !Array.isArray(value)) {
            return Object.values(value).some(v => hasValue(v));
        }
        return true;
    };

    const Section = ({ title, icon, sectionId, children }: { title: string; icon: string; sectionId: string; children: React.ReactNode }) => {
        const isExpanded = expandedSections.has(sectionId);

        return (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                    onClick={() => toggleSection(sectionId)}
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 hover:from-primary-100 hover:to-secondary-100 dark:hover:from-primary-900/30 dark:hover:to-secondary-900/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                </button>
                {isExpanded && (
                    <div className="p-4 bg-white/50 dark:bg-slate-800/50">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    const Field = ({ label, value, className = '' }: { label: string; value: any; className?: string }) => {
        if (!showEmptyFields && !hasValue(value)) return null;

        const displayValue = Array.isArray(value)
            ? value.join(', ')
            : typeof value === 'boolean'
                ? (value ? 'Evet' : 'Hayır')
                : typeof value === 'object' && value !== null
                    ? JSON.stringify(value, null, 2)
                    : String(value || 'Belirtilmedi');

        return (
            <div className={`mb-3 ${className}`}>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</p>
                <p className="text-gray-800 dark:text-gray-200">{displayValue}</p>
            </div>
        );
    };

    if (!result) return null;

    return (
        <div className="mt-8 p-6 glass rounded-2xl space-y-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {mode === 'dentistry' ? '🦷 Dental Anamnez Sonuçları' : '🧠 Psikolojik Değerlendirme Sonuçları'}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setShowEmptyFields(!showEmptyFields)}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                        title={showEmptyFields ? 'Boş alanları gizle' : 'Boş alanları göster'}
                    >
                        {showEmptyFields ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span className="hidden sm:inline">{showEmptyFields ? 'Boş Gizle' : 'Tümünü Göster'}</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" />
                        <span>{isExporting ? 'Oluşturuluyor...' : 'PDF İndir'}</span>
                    </button>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                    >
                        {copied ? (
                            <>
                                <Check className="w-4 h-4" />
                                <span>Kopyalandı!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                <span>JSON Kopyala</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results by mode */}
            <div className="space-y-4">
                {mode === 'dentistry' ? (
                    <DentistryResults result={result} Section={Section} Field={Field} showEmptyFields={showEmptyFields} />
                ) : (
                    <PsychologyResults result={result} Section={Section} Field={Field} showEmptyFields={showEmptyFields} />
                )}
            </div>
        </div>
    );
}

function DentistryResults({ result, Section, Field, showEmptyFields }: any) {
    return (
        <>
            {/* Patient Info */}
            {result.patientInfo && (
                <Section title="Hasta Bilgileri" icon="👤" sectionId="patientInfo">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Ad Soyad" value={result.patientInfo.name} />
                        <Field label="Yaş" value={result.patientInfo.age} />
                        <Field label="Cinsiyet" value={result.patientInfo.gender} />
                        <Field label="Dosya No" value={result.patientInfo.fileNumber} />
                        <Field label="Telefon" value={result.patientInfo.phone} />
                        <Field label="Tarih" value={result.patientInfo.date} />
                    </div>
                </Section>
            )}

            {/* Complaint */}
            {result.complaint && (
                <Section title="Şikayet ve Hikayesi" icon="🦷" sectionId="complaint">
                    <Field label="Ana Şikayet" value={result.complaint.chiefComplaint} />
                    <Field label="Şikayet Hikayesi" value={result.complaint.complaintHistory} />
                    <div className="grid md:grid-cols-3 gap-4">
                        <Field label="Süre" value={result.complaint.duration} />
                        <Field label="Ağrı Seviyesi" value={result.complaint.painLevel} />
                        <Field label="Tetikleyiciler" value={result.complaint.triggers} />
                    </div>
                </Section>
            )}

            {/* Personal History */}
            {result.personalHistory && (
                <Section title="Öz Geçmiş" icon="📋" sectionId="personalHistory">
                    {/* Childhood Diseases */}
                    {result.personalHistory.childhoodDiseases && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Çocukluk Hastalıkları</h4>
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <Field label="Kızamık" value={result.personalHistory.childhoodDiseases.measles} />
                                <Field label="Kızıl" value={result.personalHistory.childhoodDiseases.scarletFever} />
                                <Field label="Boğmaca" value={result.personalHistory.childhoodDiseases.whoopingCough} />
                                <Field label="Kabakulak" value={result.personalHistory.childhoodDiseases.mumps} />
                                <Field label="Diğer" value={result.personalHistory.childhoodDiseases.other} />
                            </div>
                        </>
                    )}

                    {/* Dental History */}
                    {result.personalHistory.dentalHistory && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-4">Diş Hekimliği Yönünden</h4>
                            <Field label="Son Diş Hekimi Ziyareti" value={result.personalHistory.dentalHistory.lastDentalVisit} />
                            <Field label="Dental İşlemler" value={result.personalHistory.dentalHistory.dentalProcedures} />
                            <div className="grid md:grid-cols-2 gap-4">
                                <Field label="Kanama Sorunu" value={result.personalHistory.dentalHistory.bleedingIssues} />
                                <Field label="Kanama Detayları" value={result.personalHistory.dentalHistory.bleedingDetails} />
                                <Field label="Kalp Kapak Rahatsızlığı" value={result.personalHistory.dentalHistory.heartValveDisorder} />
                                <Field label="Protez Eklem" value={result.personalHistory.dentalHistory.prostheticJoint} />
                            </div>
                        </>
                    )}

                    {/* General Health */}
                    {result.personalHistory.generalHealth && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-4">Genel Sağlık Yönünden</h4>

                            {/* Cardiovascular */}
                            {result.personalHistory.generalHealth.cardiovascularSystem && (
                                <>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Kalp-Damar Sistemi</p>
                                    <div className="grid md:grid-cols-3 gap-4 mb-3">
                                        <Field label="Hipertansiyon" value={result.personalHistory.generalHealth.cardiovascularSystem.hypertension} />
                                        <Field label="Kalp Sorunları" value={result.personalHistory.generalHealth.cardiovascularSystem.heartProblems} />
                                        <Field label="Tansiyon" value={result.personalHistory.generalHealth.cardiovascularSystem.bloodPressure} />
                                    </div>
                                </>
                            )}

                            {/* Respiratory */}
                            {result.personalHistory.generalHealth.respiratorySystem && (
                                <>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Solunum Sistemi</p>
                                    <div className="grid md:grid-cols-2 gap-4 mb-3">
                                        <Field label="Astım" value={result.personalHistory.generalHealth.respiratorySystem.asthma} />
                                        <Field label="Verem" value={result.personalHistory.generalHealth.respiratorySystem.tuberculosis} />
                                        <Field label="Diğer Solunum Sorunları" value={result.personalHistory.generalHealth.respiratorySystem.otherRespiratoryIssues} />
                                    </div>
                                </>
                            )}

                            {/* Other Systems */}
                            {result.personalHistory.generalHealth.other && (
                                <>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Diğer Sistemler</p>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <Field label="Diyabet" value={result.personalHistory.generalHealth.other.diabetes} />
                                        <Field label="Hepatit" value={result.personalHistory.generalHealth.other.hepatitis} />
                                        <Field label="HIV" value={result.personalHistory.generalHealth.other.hiv} />
                                        <Field label="Epilepsi" value={result.personalHistory.generalHealth.other.epilepsy} />
                                        <Field label="Hamilelik" value={result.personalHistory.generalHealth.other.pregnancy} />
                                        <Field label="Menopoz Durumu" value={result.personalHistory.generalHealth.other.menopauseStatus} />
                                        <Field label="Diğer Durumlar" value={result.personalHistory.generalHealth.other.otherConditions} />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </Section>
            )}

            {/* Family History */}
            {result.familyHistory && (
                <Section title="Soy Geçmişi" icon="👨‍👩‍👧‍👦" sectionId="familyHistory">
                    {/* Personal Social History */}
                    {result.familyHistory.personalSocialHistory && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Şahsi ve Sosyal Hikaye</h4>
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <Field label="Meslek" value={result.familyHistory.personalSocialHistory.occupation} />
                                <Field label="Alışkanlıklar" value={result.familyHistory.personalSocialHistory.habits} />
                                {result.familyHistory.personalSocialHistory.tobaccoUse && (
                                    <>
                                        <Field label="Sigara" value={result.familyHistory.personalSocialHistory.tobaccoUse.cigarette} />
                                        <Field label="Pipo" value={result.familyHistory.personalSocialHistory.tobaccoUse.pipe} />
                                        <Field label="Diğer Tütün" value={result.familyHistory.personalSocialHistory.tobaccoUse.other} />
                                    </>
                                )}
                                <Field label="Alkol Kullanımı" value={result.familyHistory.personalSocialHistory.alcoholUse} />
                                <Field label="Diş Fırçalama Alışkanlıkları" value={result.familyHistory.personalSocialHistory.brushingHabits} />
                            </div>
                        </>
                    )}

                    {/* Extraoral Findings */}
                    {result.familyHistory.extraoralFindings && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-4">Ekstraoral Bulgular</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <Field label="Genel Görünüm" value={result.familyHistory.extraoralFindings.generalAppearance} />
                                <Field label="Cilt" value={result.familyHistory.extraoralFindings.skin} />
                                <Field label="Dudaklar" value={result.familyHistory.extraoralFindings.lips} />
                                <Field label="TME" value={result.familyHistory.extraoralFindings.tmj} />
                                <Field label="Lenf Nodları" value={result.familyHistory.extraoralFindings.lymphNodes} />
                                <Field label="Diğer" value={result.familyHistory.extraoralFindings.other} />
                            </div>
                        </>
                    )}

                    {/* Intraoral Findings */}
                    {result.familyHistory.intraoralFindings && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-4">İntraoral Bulgular</h4>

                            {/* Soft Tissue */}
                            {result.familyHistory.intraoralFindings.softTissue && (
                                <>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Yumuşak Doku</p>
                                    <div className="grid md:grid-cols-2 gap-4 mb-3">
                                        <Field label="Dudaklar" value={result.familyHistory.intraoralFindings.softTissue.lips} />
                                        <Field label="Dil" value={result.familyHistory.intraoralFindings.softTissue.tongue} />
                                        <Field label="Damak" value={result.familyHistory.intraoralFindings.softTissue.palate} />
                                        <Field label="Ağız Tabanı" value={result.familyHistory.intraoralFindings.softTissue.floorOfMouth} />
                                    </div>
                                </>
                            )}

                            {/* Teeth */}
                            {result.familyHistory.intraoralFindings.teeth && (
                                <>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Dişler</p>
                                    <Field label="Genel Durum" value={result.familyHistory.intraoralFindings.teeth.generalCondition} />
                                    <div className="grid md:grid-cols-3 gap-4 mb-3">
                                        <Field label="Eksik Dişler" value={result.familyHistory.intraoralFindings.teeth.missing} />
                                        <Field label="Çürük Dişler" value={result.familyHistory.intraoralFindings.teeth.decayed} />
                                        <Field label="Dolgulu Dişler" value={result.familyHistory.intraoralFindings.teeth.filled} />
                                    </div>

                                    {/* Dental Chart */}
                                    <DentalChart
                                        missingTeeth={result.familyHistory.intraoralFindings.teeth.missing || []}
                                        decayedTeeth={result.familyHistory.intraoralFindings.teeth.decayed || []}
                                        filledTeeth={result.familyHistory.intraoralFindings.teeth.filled || []}
                                        className="mt-4"
                                    />
                                </>
                            )}

                            {/* Periodontium */}
                            {result.familyHistory.intraoralFindings.periodontium && (
                                <>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 mt-3">Periodonsiyum</p>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <Field label="Diş Eti Durumu" value={result.familyHistory.intraoralFindings.periodontium.gingivaCondition} />
                                        <Field label="Mobilite" value={result.familyHistory.intraoralFindings.periodontium.mobility} />
                                        <Field label="Cepler" value={result.familyHistory.intraoralFindings.periodontium.pockets} />
                                    </div>
                                </>
                            )}

                            <Field label="Oklüzyon" value={result.familyHistory.intraoralFindings.occlusion} className="mt-3" />
                        </>
                    )}
                </Section>
            )}

            {/* Medications and Allergies */}
            {result.medicationsAndAllergies && (
                <Section title="İlaçlar ve Alerjiler" icon="💊" sectionId="medicationsAllergies">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Kullandığı İlaçlar" value={result.medicationsAndAllergies.currentMedications} />
                        <Field label="Alerjiler" value={result.medicationsAndAllergies.allergies} />
                    </div>
                </Section>
            )}
        </>
    );
}

function PsychologyResults({ result, Section, Field, showEmptyFields }: any) {
    return (
        <>
            {/* Patient Info */}
            {result.patientInfo && (
                <Section title="Hasta Bilgileri" icon="👤" sectionId="patientInfo">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Ad Soyad" value={result.patientInfo.name} />
                        <Field label="Yaş" value={result.patientInfo.age} />
                        <Field label="Cinsiyet" value={result.patientInfo.gender} />
                        <Field label="Medeni Durum" value={result.patientInfo.maritalStatus} />
                        <Field label="Eğitim" value={result.patientInfo.education} />
                        <Field label="Meslek" value={result.patientInfo.occupation} />
                        <Field label="Sevk Kaynağı" value={result.patientInfo.referralSource} />
                        <Field label="Tarih" value={result.patientInfo.date} />
                    </div>
                </Section>
            )}

            {/* Presenting Problem */}
            {result.presentingProblem && (
                <Section title="Ana Şikayet ve Mevcut Problem" icon="🧠" sectionId="presentingProblem">
                    <Field label="Ana Şikayet" value={result.presentingProblem.chiefComplaint} />
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Başlangıç" value={result.presentingProblem.onset} />
                        <Field label="Süre" value={result.presentingProblem.duration} />
                    </div>
                    <Field label="Tetikleyici Faktörler" value={result.presentingProblem.precipitatingFactors} />
                    <Field label="Gelişim Seyri" value={result.presentingProblem.courseDevelopment} />
                    <Field label="Şiddet ve Yaşam Üzerindeki Etkisi" value={result.presentingProblem.severityImpact} />
                </Section>
            )}

            {/* Psychiatric History */}
            {result.psychiatricHistory && (
                <Section title="Psikiyatrik Geçmiş" icon="📋" sectionId="psychiatricHistory">
                    <Field label="Önceki Tanılar" value={result.psychiatricHistory.previousDiagnoses} />
                    {result.psychiatricHistory.previousTreatments && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Önceki Tedaviler</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <Field label="Psikoterapi" value={result.psychiatricHistory.previousTreatments.psychotherapy} />
                                <Field label="İlaçlar" value={result.psychiatricHistory.previousTreatments.medications} />
                                <Field label="Hastane Yatışları" value={result.psychiatricHistory.previousTreatments.hospitalizations} />
                            </div>
                        </>
                    )}
                    <Field label="Aile Psikiyatrik Öyküsü" value={result.psychiatricHistory.familyPsychiatricHistory} />
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="İntihar Girişimi" value={result.psychiatricHistory.suicideAttempts} />
                        <Field label="Kendine Zarar Verme" value={result.psychiatricHistory.selfHarmHistory} />
                    </div>
                    {result.psychiatricHistory.suicideDetails && (
                        <Field label="İntihar Detayları" value={result.psychiatricHistory.suicideDetails} />
                    )}
                </Section>
            )}

            {/* Medical History */}
            {result.medicalHistory && (
                <Section title="Tıbbi Geçmiş" icon="🏥" sectionId="medicalHistory">
                    <Field label="Mevcut Tıbbi Durumlar" value={result.medicalHistory.currentMedicalConditions} />
                    <Field label="Kullandığı İlaçlar" value={result.medicalHistory.currentMedications} />
                    <Field label="Alerjiler" value={result.medicalHistory.allergies} />
                    <Field label="Nörolojik Öykü" value={result.medicalHistory.neurologicalHistory} />
                    <div className="grid md:grid-cols-3 gap-4">
                        <Field label="Kafa Travması" value={result.medicalHistory.headTrauma} />
                        <Field label="Uyku Sorunları" value={result.medicalHistory.sleepProblems} />
                        <Field label="İştah Değişiklikleri" value={result.medicalHistory.appetiteChanges} />
                    </div>
                </Section>
            )}

            {/* Substance Use */}
            {result.substanceUseHistory && (
                <Section title="Madde Kullanım Geçmişi" icon="🚬" sectionId="substanceUse">
                    {result.substanceUseHistory.alcohol && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Alkol</h4>
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <Field label="Kullanıyor" value={result.substanceUseHistory.alcohol.current} />
                                <Field label="Sıklık" value={result.substanceUseHistory.alcohol.frequency} />
                                <Field label="Miktar" value={result.substanceUseHistory.alcohol.amount} />
                                <Field label="İlgili Sorunlar" value={result.substanceUseHistory.alcohol.problems} />
                            </div>
                        </>
                    )}
                    {result.substanceUseHistory.tobacco && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Tütün</h4>
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <Field label="Kullanıyor" value={result.substanceUseHistory.tobacco.current} />
                                <Field label="Miktar" value={result.substanceUseHistory.tobacco.amount} />
                            </div>
                        </>
                    )}
                    {result.substanceUseHistory.illicitDrugs && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Uyuşturucu</h4>
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <Field label="Kullanıyor" value={result.substanceUseHistory.illicitDrugs.current} />
                                <Field label="Türleri" value={result.substanceUseHistory.illicitDrugs.types} />
                                <Field label="Sıklık" value={result.substanceUseHistory.illicitDrugs.frequency} />
                            </div>
                        </>
                    )}
                    <Field label="Kafein Kullanımı" value={result.substanceUseHistory.caffeine} />
                </Section>
            )}

            {/* Social Developmental History */}
            {result.socialDevelopmentalHistory && (
                <Section title="Sosyal ve Gelişimsel Geçmiş" icon="👥" sectionId="socialHistory">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Çocukluk Gelişimi" value={result.socialDevelopmentalHistory.childhoodDevelopment} />
                        <Field label="Eğitim Geçmişi" value={result.socialDevelopmentalHistory.educationalHistory} />
                        <Field label="İş Geçmişi" value={result.socialDevelopmentalHistory.occupationalHistory} />
                        <Field label="İlişki Geçmişi" value={result.socialDevelopmentalHistory.relationshipHistory} />
                        <Field label="Mevcut Yaşam Durumu" value={result.socialDevelopmentalHistory.currentLivingSituation} />
                        <Field label="Destek Sistemi" value={result.socialDevelopmentalHistory.supportSystem} />
                    </div>

                    {result.socialDevelopmentalHistory.traumaHistory && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-4">Travma Geçmişi</h4>
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <Field label="Fiziksel İstismar" value={result.socialDevelopmentalHistory.traumaHistory.physicalAbuse} />
                                    <Field label="Cinsel İstismar" value={result.socialDevelopmentalHistory.traumaHistory.sexualAbuse} />
                                    <Field label="Duygusal İstismar" value={result.socialDevelopmentalHistory.traumaHistory.emotionalAbuse} />
                                    <Field label="İhmal" value={result.socialDevelopmentalHistory.traumaHistory.neglect} />
                                </div>
                                {result.socialDevelopmentalHistory.traumaHistory.details && (
                                    <Field label="Detaylar" value={result.socialDevelopmentalHistory.traumaHistory.details} className="mt-3" />
                                )}
                            </div>
                        </>
                    )}

                    <Field label="Yasal Geçmiş" value={result.socialDevelopmentalHistory.legalHistory} className="mt-3" />
                </Section>
            )}

            {/* Mental Status Exam */}
            {result.mentalStatusExam && (
                <Section title="Mental Durum Muayenesi" icon="🔍" sectionId="mentalStatus">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Görünüm" value={result.mentalStatusExam.appearance} />
                        <Field label="Tutum" value={result.mentalStatusExam.attitude} />
                        <Field label="Psikomotor Aktivite" value={result.mentalStatusExam.psychomotorActivity} />
                        <Field label="Konuşma" value={result.mentalStatusExam.speech} />
                        <Field label="Duygudurum (Mood)" value={result.mentalStatusExam.mood} />
                        <Field label="Duygulanım (Affect)" value={result.mentalStatusExam.affect} />
                        <Field label="Düşünce Süreci" value={result.mentalStatusExam.thoughtProcess} />
                        <Field label="Düşünce İçeriği" value={result.mentalStatusExam.thoughtContent} />
                        <Field label="Algı (Perceptions)" value={result.mentalStatusExam.perceptions} />
                    </div>

                    {result.mentalStatusExam.cognition && (
                        <>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-4">Bilişsel Fonksiyonlar</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <Field label="Oryantasyon" value={result.mentalStatusExam.cognition.orientation} />
                                <Field label="Bellek" value={result.mentalStatusExam.cognition.memory} />
                                <Field label="Konsantrasyon" value={result.mentalStatusExam.cognition.concentration} />
                                <Field label="İçgörü" value={result.mentalStatusExam.cognition.insight} />
                                <Field label="Yargı" value={result.mentalStatusExam.cognition.judgment} />
                            </div>
                        </>
                    )}
                </Section>
            )}

            {/* Risk Assessment */}
            {result.riskAssessment && (
                <Section title="Risk Değerlendirmesi" icon="⚠️" sectionId="riskAssessment">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
                        <div className="grid md:grid-cols-2 gap-4">
                            <Field label="İntihar Düşüncesi" value={result.riskAssessment.suicidalIdeation} />
                            <Field label="İntihar Planı" value={result.riskAssessment.suicidalPlan} />
                            <Field label="Cinayet Düşüncesi" value={result.riskAssessment.homicidalIdeation} />
                            <Field label="Kendine Zarar Riski" value={result.riskAssessment.riskToSelf} />
                            <Field label="Başkalarına Zarar Riski" value={result.riskAssessment.riskToOthers} />
                        </div>
                        <Field label="Koruyucu Faktörler" value={result.riskAssessment.protectiveFactors} className="mt-3" />
                    </div>
                </Section>
            )}

            {/* Clinician Notes */}
            {result.clinicianNotes && (
                <Section title="Terapist Gözlemleri" icon="📝" sectionId="clinicianNotes">
                    <Field label="Tanı İzlenimi" value={result.clinicianNotes.diagnosticImpression} />
                    <Field label="Ayırıcı Tanı" value={result.clinicianNotes.differentialDiagnosis} />
                    <Field label="Tedavi Önerileri" value={result.clinicianNotes.treatmentRecommendations} />
                    <Field label="Ek Notlar" value={result.clinicianNotes.additionalNotes} />
                </Section>
            )}

            {/* Session Q&A */}
            {result.sessionQA && result.sessionQA.questionAnswers && result.sessionQA.questionAnswers.length > 0 && (
                <Section title="Seans Soru-Cevapları" icon="💬" sectionId="sessionQA">
                    <div className="space-y-4">
                        {result.sessionQA.questionAnswers.map((qa: any, index: number) => (
                            <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-secondary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-secondary-600 dark:text-secondary-400 mb-1">TERAPİST SORUSU</p>
                                        <p className="text-gray-800 dark:text-gray-200">{qa.question}</p>
                                    </div>
                                </div>
                                <div className="ml-11">
                                    <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">HASTA CEVABI</p>
                                    <p className="text-gray-800 dark:text-gray-200">{qa.answer}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {result.sessionQA.sessionSummary && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-lg">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">📝 Seans Özeti</h4>
                            <p className="text-gray-800 dark:text-gray-200">{result.sessionQA.sessionSummary}</p>
                        </div>
                    )}
                </Section>
            )}
        </>
    );
}
