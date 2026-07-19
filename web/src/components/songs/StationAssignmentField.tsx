'use client';

import { TOWERS } from '@/data/station-map';

type StationAssignmentFieldProps = {
  value: string[];
  onChange: (stationIds: string[]) => void;
  id?: string;
  /** Use on light surfaces (e.g. admin modals) so labels stay readable in dark-themed apps. */
  variant?: 'default' | 'light';
  /** Tailwind classes for the checkbox panel border. */
  panelClassName?: string;
  hintClassName?: string;
};

const defaultPanelClassName = 'rounded-md border border-input divide-y divide-border';
const defaultHintClassName = 'text-xs text-muted-foreground';

export function StationAssignmentField({
  value,
  onChange,
  id,
  variant = 'default',
  panelClassName = defaultPanelClassName,
  hintClassName = defaultHintClassName,
}: StationAssignmentFieldProps) {
  const isLight = variant === 'light';
  const resolvedPanelClassName =
    panelClassName === defaultPanelClassName && isLight
      ? 'rounded-lg border border-gray-300 divide-y divide-gray-200 bg-white'
      : panelClassName;
  const resolvedHintClassName =
    hintClassName === defaultHintClassName && isLight
      ? 'text-xs text-gray-600'
      : hintClassName;
  const rowClassName = isLight
    ? 'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-gray-900 hover:bg-gray-50 active:bg-gray-100'
    : 'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 active:bg-muted';

  const toggleStation = (stationId: string) => {
    if (value.includes(stationId)) {
      onChange(value.filter((currentId) => currentId !== stationId));
      return;
    }
    onChange([...value, stationId]);
  };

  const selectedLabel =
    value.length === 0
      ? 'None selected'
      : value.length === 1
        ? '1 station selected'
        : `${value.length} stations selected`;

  return (
    <div className="space-y-2">
      <div
        id={id}
        className={`max-h-56 overflow-y-auto overscroll-contain ${resolvedPanelClassName}`}
      >
        {TOWERS.map((tower) => {
          const checked = value.includes(tower.id);
          return (
            <label key={tower.id} className={rowClassName}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleStation(tower.id)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <span>{tower.genre} (National)</span>
            </label>
          );
        })}
      </div>
      <p className={resolvedHintClassName}>
        {selectedLabel}. Tap or click to select one or more stations for this song.
      </p>
    </div>
  );
}
