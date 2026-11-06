"use client";
import AuthGate from "@/components/AuthGate";
import ReportFoundForm from "@/components/ReportFoundForm";

export default function ReportFoundPage() {
  return (
    <AuthGate allowedRole="student">
      <ReportFoundForm />
    </AuthGate>
  );
}
