import React, { useState } from "react";
import { CandidateFace, PersonGroup } from "../../types/gallery";

interface PeopleViewProps {
  people: PersonGroup[];
  candidates: CandidateFace[];
  onConfirmCandidate: (face_id: number, person_key: string) => void;
  onSelectPerson?: (person: PersonGroup) => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  people,
  candidates,
  onConfirmCandidate,
  onSelectPerson,
}) => {
  const [confirmedFaces, setConfirmedFaces] = useState<Set<number>>(new Set());

  const handleConfirm = (face_id: number, person_key: string) => {
    setConfirmedFaces((prev) => new Set(prev).add(face_id));
    onConfirmCandidate(face_id, person_key);
  };

  const pendingCandidates = candidates.filter((c) => !confirmedFaces.has(c.face_id));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 select-none">
      {/* 1. Candidate Verification Banner (Apple Photos style) */}
      {pendingCandidates.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[var(--accent-soft)] via-[var(--glass-card)] to-[var(--glass-card)] border border-[var(--accent)]/30 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">✨</span>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  Review Additional Photos
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Apple Neural Engine detected candidate faces matching people in your library.
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-[11px] font-semibold">
              {pendingCandidates.length} Pending
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {pendingCandidates.map((cand) => (
              <div
                key={cand.face_id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-700/20 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                    👤
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-[var(--text-main)] truncate">
                      {cand.person_name}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Match: {(cand.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleConfirm(cand.face_id, cand.person_key)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Clustered People & Pets Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)]">People & Pets</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Organized locally on your Mac using Apple Vision CoreML embeddings.
            </p>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-medium">
            {people.length} Groups
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {people.map((person) => (
            <div
              key={person.key}
              onClick={() => onSelectPerson?.(person)}
              className="group p-3 rounded-2xl bg-[var(--glass-card)] border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] hover:shadow-lg transition-all cursor-pointer flex flex-col items-center text-center"
            >
              <div className="relative w-24 h-24 mb-3">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-[var(--glass-border)] group-hover:border-[var(--accent)] group-hover:scale-105 transition-all shadow-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-3xl">
                  {person.is_pet ? "🐶" : "👤"}
                </div>
                {person.is_pet && (
                  <span className="absolute bottom-0 right-0 p-1 rounded-full bg-emerald-500 text-white text-[10px] shadow">
                    🐾
                  </span>
                )}
              </div>

              <h4 className="text-xs font-bold text-[var(--text-main)] truncate w-full group-hover:text-[var(--accent)] transition-colors">
                {person.name}
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {person.count} photos
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
