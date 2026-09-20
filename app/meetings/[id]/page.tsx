import { MeetingWorkspace } from "@/components/meeting-workspace";
export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingWorkspace key={id} id={id} />;
}
