'use client';

import jsPDF from 'jspdf';

interface ExportOptions {
    result: any;
    mode: 'dentistry' | 'psychology';
    patientName?: string;
}

export async function exportToPDF({ result, mode, patientName }: ExportOptions): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Helper function to add text with auto line breaks
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
        if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(fontSize);
        if (isBold) {
            doc.setFont('helvetica', 'bold');
        } else {
            doc.setFont('helvetica', 'normal');
        }

        const lines = doc.splitTextToSize(text, pageWidth - 40);
        doc.text(lines, 20, yPosition);
        yPosition += (lines.length * fontSize * 0.5) + 5;
    };

    const addSection = (title: string) => {
        yPosition += 5;
        doc.setFillColor(59, 130, 246); // Primary blue
        doc.rect(20, yPosition - 5, pageWidth - 40, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 22, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 10;
    };

    const addField = (label: string, value: any) => {
        if (value && value !== 'Belirtilmedi' && value !== '' && !(Array.isArray(value) && value.length === 0)) {
            const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
            addText(`${label}: ${displayValue}`, 10, false);
        }
    };

    // Header
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('AnamnezAI - Klinik Anamnez Formu', 20, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const currentDate = new Date().toLocaleString('tr-TR');
    doc.text(`Tarih: ${currentDate}`, 20, 23);
    doc.setTextColor(0, 0, 0);

    yPosition = 40;

    if (mode === 'dentistry') {
        addSection('📋 DİŞ HEKİMLİĞİ ANAMNEZ FORMU');

        // Patient Info
        if (result.patientInfo) {
            addSection('HASTA BİLGİLERİ');
            addField('Ad Soyad', result.patientInfo.name);
            addField('Yaş', result.patientInfo.age);
            addField('Cinsiyet', result.patientInfo.gender);
            addField('Dosya No', result.patientInfo.fileNumber);
            addField('Telefon', result.patientInfo.phone);
        }

        // Complaint
        if (result.complaint) {
            addSection('ŞİKAYET VE HİKAYESİ');
            addField('Ana Şikayet', result.complaint.chiefComplaint);
            addField('Şikayet Hikayesi', result.complaint.complaintHistory);
            addField('Süre', result.complaint.duration);
            addField('Ağrı Seviyesi', result.complaint.painLevel);
            addField('Tetikleyiciler', result.complaint.triggers);
        }

        // Personal History
        if (result.personalHistory) {
            addSection('ÖZ GEÇMİŞ');

            if (result.personalHistory.childhoodDiseases) {
                addText('Çocukluk Hastalıkları:', 10, true);
                const cd = result.personalHistory.childhoodDiseases;
                if (cd.measles && cd.measles !== 'Belirtilmedi') addField('  Kızamık', cd.measles);
                if (cd.scarletFever && cd.scarletFever !== 'Belirtilmedi') addField('  Kızıl', cd.scarletFever);
                if (cd.whoopingCough && cd.whoopingCough !== 'Belirtilmedi') addField('  Boğmaca', cd.whoopingCough);
                if (cd.mumps && cd.mumps !== 'Belirtilmedi') addField('  Kabakulak', cd.mumps);
                if (cd.other) addField('  Diğer', cd.other);
            }

            if (result.personalHistory.dentalHistory) {
                addText('Diş Hekimliği Öyküsü:', 10, true);
                const dh = result.personalHistory.dentalHistory;
                addField('  Son Diş Hekimi Ziyareti', dh.lastDentalVisit);
                addField('  Dental İşlemler', dh.dentalProcedures);
                addField('  Kanama Sorunu', dh.bleedingIssues ? 'Var' : 'Yok');
                if (dh.bleedingDetails) addField('  Kanama Detayları', dh.bleedingDetails);
                addField('  Kalp Kapak Rahatsızlığı', dh.heartValveDisorder ? 'Var' : 'Yok');
                addField('  Protez Eklem', dh.prostheticJoint ? 'Var' : 'Yok');
            }

            if (result.personalHistory.generalHealth) {
                addText('Genel Sağlık:', 10, true);
                const gh = result.personalHistory.generalHealth;

                if (gh.cardiovascularSystem) {
                    addField('  Hipertansiyon', gh.cardiovascularSystem.hypertension ? 'Var' : 'Yok');
                    addField('  Kalp Sorunları', gh.cardiovascularSystem.heartProblems);
                    addField('  Tansiyon', gh.cardiovascularSystem.bloodPressure);
                }

                if (gh.respiratorySystem) {
                    addField('  Astım', gh.respiratorySystem.asthma ? 'Var' : 'Yok');
                    addField('  Verem', gh.respiratorySystem.tuberculosis ? 'Var' : 'Yok');
                    addField('  Diğer Solunum Sorunları', gh.respiratorySystem.otherRespiratoryIssues);
                }

                if (gh.other) {
                    addField('  Diyabet', gh.other.diabetes ? 'Var' : 'Yok');
                    addField('  Hepatit', gh.other.hepatitis ? 'Var' : 'Yok');
                    addField('  HIV', gh.other.hiv ? 'Var' : 'Yok');
                    addField('  Epilepsi', gh.other.epilepsy ? 'Var' : 'Yok');
                    addField('  Hamilelik', gh.other.pregnancy ? 'Hamile' : 'Değil');
                    addField('  Diğer Durumlar', gh.other.otherConditions);
                }
            }
        }

        // Family History
        if (result.familyHistory) {
            addSection('SOY GEÇMİŞİ');

            if (result.familyHistory.personalSocialHistory) {
                const psh = result.familyHistory.personalSocialHistory;
                addField('Meslek', psh.occupation);
                addField('Tütün Kullanımı', psh.tobaccoUse);
                addField('Alkol Kullanımı', psh.alcoholUse);
                addField('Diş Fırçalama Alışkanlıkları', psh.brushingHabits);
            }

            if (result.familyHistory.extraoralFindings) {
                addText('Ekstraoral Bulgular:', 10, true);
                const ef = result.familyHistory.extraoralFindings;
                addField('  Genel Görünüm', ef.generalAppearance);
                addField('  Cilt', ef.skin);
                addField('  Dudaklar', ef.lips);
                addField('  TME', ef.tmj);
                addField('  Lenf Nodları', ef.lymphNodes);
            }

            if (result.familyHistory.intraoralFindings) {
                addText('İntraoral Bulgular:', 10, true);
                const inf = result.familyHistory.intraoralFindings;

                if (inf.softTissue) {
                    addField('  Dudaklar', inf.softTissue.lips);
                    addField('  Dil', inf.softTissue.tongue);
                    addField('  Damak', inf.softTissue.palate);
                    addField('  Ağız Tabanı', inf.softTissue.floorOfMouth);
                }

                if (inf.teeth) {
                    addField('  Dişler Genel Durum', inf.teeth.generalCondition);
                    addField('  Eksik Dişler', inf.teeth.missing);
                    addField('  Çürük Dişler', inf.teeth.decayed);
                    addField('  Dolgulu Dişler', inf.teeth.filled);
                }

                if (inf.periodontium) {
                    addField('  Diş Eti Durumu', inf.periodontium.gingivaCondition);
                    addField('  Mobilite', inf.periodontium.mobility);
                    addField('  Cepler', inf.periodontium.pockets);
                }

                addField('  Oklüzyon', inf.occlusion);
            }
        }

        // Medications and Allergies
        if (result.medicationsAndAllergies) {
            addSection('İLAÇLAR VE ALERJİLER');
            addField('Kullandığı İlaçlar', result.medicationsAndAllergies.currentMedications);
            addField('Alerjiler', result.medicationsAndAllergies.allergies);
        }

    } else if (mode === 'psychology') {
        addSection('🧠 PSİKOLOJİ ANAMNEZ FORMU');

        // Patient Info
        if (result.patientInfo) {
            addSection('HASTA BİLGİLERİ');
            addField('Ad Soyad', result.patientInfo.name);
            addField('Yaş', result.patientInfo.age);
            addField('Cinsiyet', result.patientInfo.gender);
            addField('Medeni Durum', result.patientInfo.maritalStatus);
            addField('Eğitim', result.patientInfo.education);
            addField('Meslek', result.patientInfo.occupation);
            addField('Sevk Kaynağı', result.patientInfo.referralSource);
        }

        // Presenting Problem
        if (result.presentingProblem) {
            addSection('ANA ŞİKAYET VE MEVCUT PROBLEM');
            addField('Ana Şikayet', result.presentingProblem.chiefComplaint);
            addField('Başlangıç', result.presentingProblem.onset);
            addField('Süre', result.presentingProblem.duration);
            addField('Tetikleyici Faktörler', result.presentingProblem.precipitatingFactors);
            addField('Gelişim Seyri', result.presentingProblem.courseDevelopment);
            addField('Şiddet ve Etki', result.presentingProblem.severityImpact);
        }

        // Psychiatric History
        if (result.psychiatricHistory) {
            addSection('PSİKİYATRİK GEÇMİŞ');
            addField('Önceki Tanılar', result.psychiatricHistory.previousDiagnoses);
            if (result.psychiatricHistory.previousTreatments) {
                addField('Önceki Psikoterapi', result.psychiatricHistory.previousTreatments.psychotherapy);
                addField('Önceki İlaçlar', result.psychiatricHistory.previousTreatments.medications);
                addField('Önceki Yatışlar', result.psychiatricHistory.previousTreatments.hospitalizations);
            }
            addField('Aile Psikiyatrik Öyküsü', result.psychiatricHistory.familyPsychiatricHistory);
            addField('İntihar Girişimi', result.psychiatricHistory.suicideAttempts ? 'Var' : 'Yok');
            if (result.psychiatricHistory.suicideDetails) {
                addField('İntihar Detayları', result.psychiatricHistory.suicideDetails);
            }
            addField('Kendine Zarar Verme', result.psychiatricHistory.selfHarmHistory ? 'Var' : 'Yok');
        }

        // Medical History
        if (result.medicalHistory) {
            addSection('TIBBİ GEÇMİŞ');
            addField('Mevcut Tıbbi Durumlar', result.medicalHistory.currentMedicalConditions);
            addField('Kullandığı İlaçlar', result.medicalHistory.currentMedications);
            addField('Alerjiler', result.medicalHistory.allergies);
            addField('Nörolojik Öykü', result.medicalHistory.neurologicalHistory);
            addField('Kafa Travması', result.medicalHistory.headTrauma ? 'Var' : 'Yok');
            addField('Uyku Sorunları', result.medicalHistory.sleepProblems);
            addField('İştah Değişiklikleri', result.medicalHistory.appetiteChanges);
        }

        // Substance Use
        if (result.substanceUseHistory) {
            addSection('MADDE KULLANIM GEÇMİŞİ');
            const sub = result.substanceUseHistory;

            if (sub.alcohol) {
                addText('Alkol:', 10, true);
                addField('  Kullanıyor', sub.alcohol.current ? 'Evet' : 'Hayır');
                addField('  Sıklık', sub.alcohol.frequency);
                addField('  Miktar', sub.alcohol.amount);
                addField('  Sorunlar', sub.alcohol.problems);
            }

            if (sub.tobacco) {
                addText('Tütün:', 10, true);
                addField('  Kullanıyor', sub.tobacco.current ? 'Evet' : 'Hayır');
                addField('  Miktar', sub.tobacco.amount);
            }

            if (sub.illicitDrugs) {
                addText('Uyuşturucu:', 10, true);
                addField('  Kullanıyor', sub.illicitDrugs.current ? 'Evet' : 'Hayır');
                addField('  Türler', sub.illicitDrugs.types);
                addField('  Sıklık', sub.illicitDrugs.frequency);
            }

            addField('Kafein', sub.caffeine);
        }

        // Social History
        if (result.socialDevelopmentalHistory) {
            addSection('SOSYAL VE GELİŞİMSEL GEÇMİŞ');
            const sdh = result.socialDevelopmentalHistory;
            addField('Çocukluk Gelişimi', sdh.childhoodDevelopment);
            addField('Eğitim Geçmişi', sdh.educationalHistory);
            addField('İş Geçmişi', sdh.occupationalHistory);
            addField('İlişki Geçmişi', sdh.relationshipHistory);
            addField('Mevcut Yaşam Durumu', sdh.currentLivingSituation);
            addField('Destek Sistemi', sdh.supportSystem);

            if (sdh.traumaHistory) {
                addText('Travma Geçmişi:', 10, true);
                const th = sdh.traumaHistory;
                addField('  Fiziksel İstismar', th.physicalAbuse ? 'Var' : 'Yok');
                addField('  Cinsel İstismar', th.sexualAbuse ? 'Var' : 'Yok');
                addField('  Duygusal İstismar', th.emotionalAbuse ? 'Var' : 'Yok');
                addField('  İhmal', th.neglect ? 'Var' : 'Yok');
                if (th.details) addField('  Detaylar', th.details);
            }

            addField('Yasal Geçmiş', sdh.legalHistory);
        }

        // Mental Status Exam
        if (result.mentalStatusExam) {
            addSection('MENTAL DURUM MUAYENESİ');
            const mse = result.mentalStatusExam;
            addField('Görünüm', mse.appearance);
            addField('Tutum', mse.attitude);
            addField('Psikomotor Aktivite', mse.psychomotorActivity);
            addField('Konuşma', mse.speech);
            addField('Duygudurum', mse.mood);
            addField('Duygulanım', mse.affect);
            addField('Düşünce Süreci', mse.thoughtProcess);
            addField('Düşünce İçeriği', mse.thoughtContent);
            addField('Algı', mse.perceptions);

            if (mse.cognition) {
                addText('Biliş:', 10, true);
                addField('  Oryantasyon', mse.cognition.orientation);
                addField('  Bellek', mse.cognition.memory);
                addField('  Konsantrasyon', mse.cognition.concentration);
                addField('  İçgörü', mse.cognition.insight);
                addField('  Yargı', mse.cognition.judgment);
            }
        }

        // Risk Assessment
        if (result.riskAssessment) {
            addSection('RİSK DEĞERLENDİRMESİ');
            const ra = result.riskAssessment;
            addField('İntihar Düşüncesi', ra.suicidalIdeation ? 'Var' : 'Yok');
            addField('İntihar Planı', ra.suicidalPlan ? 'Var' : 'Yok');
            addField('Cinayet Düşüncesi', ra.homicidalIdeation ? 'Var' : 'Yok');
            addField('Kendine Zarar Riski', ra.riskToSelf);
            addField('Başkalarına Zarar Riski', ra.riskToOthers);
            addField('Koruyucu Faktörler', ra.protectiveFactors);
        }

        // Clinician Notes
        if (result.clinicianNotes) {
            addSection('TERAPİST GÖZLEMLERİ');
            addField('Tanı İzlenimi', result.clinicianNotes.diagnosticImpression);
            addField('Ayırıcı Tanı', result.clinicianNotes.differentialDiagnosis);
            addField('Tedavi Önerileri', result.clinicianNotes.treatmentRecommendations);
            addField('Ek Notlar', result.clinicianNotes.additionalNotes);
        }

        // Session Q&A
        if (result.sessionQA && result.sessionQA.questionAnswers && result.sessionQA.questionAnswers.length > 0) {
            addSection('SEANS SORU-CEVAPLARI');
            result.sessionQA.questionAnswers.forEach((qa: any, index: number) => {
                addText(`${index + 1}. Soru: ${qa.question}`, 10, true);
                addText(`   Cevap: ${qa.answer}`, 10, false);
            });

            if (result.sessionQA.sessionSummary) {
                yPosition += 3;
                addText('Seans Özeti:', 10, true);
                addText(result.sessionQA.sessionSummary, 10, false);
            }
        }
    }

    // Footer
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
            `Sayfa ${i} / ${totalPages} - AnamnezAI tarafından oluşturulmuştur`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
    }

    // Save PDF
    const fileName = `${patientName || 'Anamnez'}_${mode}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}
