import { minutesOf } from "@/lib/utils/manila";
import type { Appointment } from "@/types/api";

/**
 * Side-by-side lanes for overlapping appointments on the calendar.
 *
 * Without lanes, two dentists working at the same hour put one appointment on
 * top of the other and the lower one could not be clicked. Overlapping
 * appointments form a cluster; each takes the first free lane, and every block
 * in the cluster gets `1 / lanes` of the width.
 */
export function layoutLanes(appointments: Appointment[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...appointments].sort(
    (a, b) => minutesOf(a.scheduled_start) - minutesOf(b.scheduled_start) || minutesOf(b.scheduled_end) - minutesOf(a.scheduled_end),
  );
  const result = new Map<string, { lane: number; lanes: number }>();
  let cluster: Array<{ id: string; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const item of cluster) result.set(item.id, { lane: item.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const apt of sorted) {
    const start = minutesOf(apt.scheduled_start);
    const end = minutesOf(apt.scheduled_end);
    if (start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ id: apt.id, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return result;
}
