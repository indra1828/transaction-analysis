export interface Segment {
  label: string;
  value: number;
  color: string; // a background colour class, for example bg-success
}

// One bar split into parts, with a legend. Shows how a set of counts divides.
export function SegmentBar({ label, segments }: { label: string; segments: Segment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return null;
  }

  return (
    <figure className="flex flex-col gap-3">
      <div role="img" aria-label={label} className="flex h-3 w-full overflow-hidden rounded-full bg-hairline">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.label}
              className={`${segment.color} h-full`}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
      </div>
      <figcaption>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-body">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${segment.color}`} aria-hidden="true" />
              {segment.label}: {segment.value}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
