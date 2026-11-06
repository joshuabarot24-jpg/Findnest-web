"use client";
import AuthGate from "@/components/AuthGate";
import ReportLostForm from "@/components/ReportLostForm";

export default function ReportLostPage() {
  return (
    <AuthGate allowedRole="student">
      <ReportLostForm />
    </AuthGate>
  );
}
