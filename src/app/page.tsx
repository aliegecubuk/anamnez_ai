import Link from 'next/link';
import { Stethoscope, Brain, ArrowRight } from 'lucide-react';
import ModeCard from '@/components/ModeCard';

export default function Home() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
            <div className="max-w-6xl w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="p-3 bg-primary-500 rounded-2xl shadow-lg">
                            <Stethoscope className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                            AnamnezAI
                        </h1>
                    </div>
                    <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                        Klinik Belgelendirme Asistanınız
                    </p>
                    <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
                        Yapay zeka destekli ambient scribe ile hasta-doktor görüşmelerini otomatik olarak yapılandırılmış notlara dönüştürün
                    </p>
                </div>

                {/* Mode Selection */}
                <div className="grid md:grid-cols-2 gap-6 mt-12">
                    <Link href="/dentistry" className="group">
                        <ModeCard
                            icon={<Stethoscope className="w-12 h-12" />}
                            title="Diş Hekimliği"
                            description="Dental muayeneler için şablonlu kayıt sistemi"
                            features={[
                                "Şikayet kaydı",
                                "Tıbbi geçmiş",
                                "Ağrı seviyesi",
                                "Tedavi planı"
                            ]}
                            color="primary"
                        />
                    </Link>

                    <Link href="/psychology" className="group">
                        <ModeCard
                            icon={<Brain className="w-12 h-12" />}
                            title="Psikoloji / Terapi"
                            description="Terapi seansları için soru-cevap analizi"
                            features={[
                                "Terapist soruları",
                                "Hasta cevapları",
                                "Seans özeti",
                                "Yapılandırılmış rapor"
                            ]}
                            color="secondary"
                        />
                    </Link>
                </div>

                {/* Footer Info */}
                <div className="text-center mt-12 p-6 glass rounded-2xl">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <ArrowRight className="w-4 h-4" />
                        <span>Başlamak için bir mod seçin</span>
                    </div>
                </div>
            </div>
        </main>
    );
}
