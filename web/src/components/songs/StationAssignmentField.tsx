'use client';

import { TOWERS } from '@/data/station-map';

type StationAssignmentFieldProps = {
  value: string[];
  onChange: (stationIds: string[]) => void;
  id?: string;
  /** Tailwind classes for the mobile select (admin pages use gray borders). */
  selectClassName?: string;
  /** Tailwind classes for the desktop checkbox panel border. */
  panelClassName?: string;
  hintClassName?: string;
};

const defaultSelectClassName =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const defaultPanelClassName = 'rounded-md border border-input divide-y divide-border';
const defaultHintClassName = 'text-xs text-muted-foreground';

export function StationAssignmentField({
  value,
  onChange,
  id,
  selectClassName = defaultSelectClassName,
  panelClassName = defaultPanelClassName,
  hintClassName = defaultHintClassName,
}: StationAssignmentFieldProps) {
  const toggleStation = (stationId: string) => {
    if (value.includes(stationId)) {
      onChange(value.filter((currentId) => currentId !== stationId));
      return;
    }
    onChange([...value, stationId]);
  };

  const handleMobileSelect = (stationId: string) => {
    onChange(stationId ? [stationId] : []);
  };

  return (
    <div className="space-y-2">
      <div className="md:hidden">
        <select
          id={id}
          value={value[0] ?? ''}
          onChange={(e) => handleMobileSelect(e.target.value)}
          className={selectClassName}
        >
          <option value="">Select a station</option>
          {TOWERS.map((tower) => (
            <option key={tower.id} value={tower.id}>
              {tower.genre} (National)
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:block">
        <div className={`max-h-48 overflow-y-auto ${panelClassName}`}>
          {TOWERS.map((tower) => {
            const checked = value.includes(tower.id);
            return (
              <label
                key={tower.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStation(tower.id)}
                  className="shrink-0"
                />
                <span>{tower.genre} (National)</span>
              </label>
            );
          })}
        </div>
        <p className={`mt-1 ${hintClassName}`}>
          Select one or more stations for this song.
        </p>
      </div>
    </div>
  );
}
