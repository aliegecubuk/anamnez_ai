import PatientTable from '@/components/patients/PatientTable'

export default async function PatientsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <PatientTable slug={slug} />
}
