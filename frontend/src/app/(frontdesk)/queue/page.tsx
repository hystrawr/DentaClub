"use client";

import { TopHeader } from "@/components/frontdesk/TopHeader";
import { OperatoryBoard } from "@/components/queue/OperatoryBoard";
import { longDate, manilaToday } from "@/lib/utils/manila";

/** Today's appointment queue — the chairside board, in the front-desk shell. */
export default function QueuePage() {
  return (
    <div>
      <TopHeader title="Appointment Queue" subtitle={`${longDate(manilaToday())} `} />
      <div className="p-6">
        <OperatoryBoard />
      </div>
    </div>
  );
}
