/** Replaces the form after a blocked transfer or withdrawal, mirroring the original red panel. */
export function BlockedPanel({ title, reason, details }: { title: string; reason: string; details: string }) {
  return (
    <div role="alert" className="animate-slide-down rounded-lg border-l-4 border-[#dc2626] bg-[#fee2e2] p-5">
      <div className="text-lg font-bold text-[#991b1b]">{title}</div>
      <div className="my-2 text-sm text-[#7f1d1d]">{reason}</div>
      <div className="rounded-md bg-white p-4 text-sm whitespace-pre-line text-p-text">
        <span className="font-semibold">Reason: </span>
        {details}
      </div>
      <div className="mt-3 text-sm text-[#7f1d1d]">📞 If you believe this is a mistake, please contact our support team.</div>
    </div>
  );
}
