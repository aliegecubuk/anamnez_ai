import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { transcript, mode } = await request.json();

        console.log('🔍 Analyze API Request (Demo Mode):', {
            mode,
            transcriptLength: transcript?.length || 0,
            transcriptPreview: transcript?.substring(0, 100) + '...',
            timestamp: new Date().toISOString()
        });

        if (!transcript) {
            return NextResponse.json(
                { error: 'Transcript is required' },
                { status: 400 }
            );
        }

        // Always use mock data (demo mode)
        console.log('📋 Returning mock data for demo purposes');
        return NextResponse.json({
            result: getMockResult(mode, transcript),
            warning: '🎭 Demo modu - Örnek veriler gösteriliyor'
        });

    } catch (error) {
        console.error('❌ Analysis error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze transcript', details: String(error) },
            { status: 500 }
        );
    }
}

// Mock results for testing without API key
function getMockResult(mode: string, transcript: string) {
    if (mode === 'dentistry') {
        return {
            patientInfo: {
                name: "Mock Hasta",
                age: "35",
                gender: "Erkek"
            },
            complaint: {
                chiefComplaint: 'Sol alt arka dişte ağrı (⚠️ API Anahtarı Gerekli - Bu Mock Data)',
                complaintHistory: 'Soğuk içeceklerle başlamış, giderek şiddetlenmiş',
                duration: '1 hafta',
                painLevel: '7/10',
                triggers: 'Soğuk ve sıcak içecekler'
            },
            personalHistory: {
                childhoodDiseases: {
                    measles: "Belirtilmedi",
                    scarletFever: "Belirtilmedi",
                    whoopingCough: "Belirtilmedi",
                    mumps: "Belirtilmedi"
                },
                dentalHistory: {
                    lastDentalVisit: '6 ay önce',
                    dentalProcedures: ['Dolgu tedavisi'],
                    bleedingIssues: false,
                    heartValveDisorder: false,
                    prostheticJoint: false
                },
                generalHealth: {
                    cardiovascularSystem: {
                        hypertension: false,
                        heartProblems: false
                    },
                    respiratorySystem: {
                        asthma: false,
                        tuberculosis: false
                    },
                    other: {
                        diabetes: true,
                        hepatitis: false,
                        hiv: false,
                        epilepsy: false,
                        pregnancy: false
                    }
                }
            },
            familyHistory: {
                personalSocialHistory: {
                    tobaccoUse: {
                        cigarette: 'Yok'
                    },
                    alcoholUse: 'Sosyal',
                    brushingHabits: 'Günde 2 kez'
                }
            },
            medicationsAndAllergies: {
                currentMedications: ['Metformin'],
                allergies: ['Penisilin']
            }
        };
    } else {
        return {
            patientInfo: {
                name: "Mock Hasta",
                age: "28",
                gender: "Kadın",
                maritalStatus: "Bekar"
            },
            presentingProblem: {
                chiefComplaint: 'Anksiyete ve uyku sorunları (⚠️ API Anahtarı Gerekli - Bu Mock Data)',
                onset: '3 ay önce',
                duration: '3 ay',
                precipitatingFactors: 'İş stresi',
                severityImpact: 'Günlük yaşamı orta derecede etkilemekte'
            },
            psychiatricHistory: {
                previousDiagnoses: [],
                previousPsychotherapy: 'Yok',
                familyPsychiatricHistory: 'Anne depresyon tanısı almış',
                suicideAttempts: false,
                selfHarmHistory: false
            },
            medicalHistory: {
                currentMedicalConditions: [],
                currentMedications: [],
                allergies: [],
                sleepProblems: 'Uykuya dalmada zorluk, sık uyanma',
                appetiteChanges: 'Azalmış'
            },
            substanceUseHistory: {
                alcohol: {
                    current: false
                },
                tobacco: {
                    current: false
                },
                caffeine: 'Günde 2-3 fincan kahve'
            },
            socialDevelopmentalHistory: {
                occupation: 'Yazılım geliştirici',
                currentLivingSituation: 'Yalnız yaşıyor',
                supportSystem: 'Arkadaşları ve ailesi destekleyici'
            },
            mentalStatusExam: {
                appearance: 'Bakımlı, yaşına uygun giyimli',
                attitude: 'İşbirlikçi',
                mood: 'Gergin',
                affect: 'Anksiyöz',
                thoughtProcess: 'Organize',
                thoughtContent: 'Endişeli düşünceler',
                cognition: {
                    orientation: 'Tam oryante',
                    insight: 'İyi',
                    judgment: 'Sağlam'
                }
            },
            riskAssessment: {
                suicidalIdeation: false,
                suicidalPlan: false,
                homicidalIdeation: false,
                riskToSelf: 'Düşük',
                riskToOthers: 'Düşük',
                protectiveFactors: ['İyi destek sistemi', 'Tedavi motivasyonu yüksek']
            },
            sessionQA: {
                questionAnswers: [
                    {
                        question: 'Bu hafta kendinizi nasıl hissettiniz?',
                        answer: 'Genel olarak stresliydim, işte yoğunluk vardı.'
                    },
                    {
                        question: 'Uyku düzeniniz nasıl?',
                        answer: 'Uykuya dalmakta zorlanıyorum, gece sık sık uyanıyorum.'
                    }
                ],
                sessionSummary: 'Hasta anksiyete belirtileri ve uyku sorunları ile başvurdu. Mental durum muayenesi normal sınırlarda, risk düşük.'
            }
        };
    }
}
