import React, { useState } from "react";
import { Check, Pencil, Plus, Sparkles, User, X } from "lucide-react";
import { CandidateFace, PersonGroup } from "../../types/gallery";

interface PeopleViewProps {
  mode: "people" | "pets";
  people: PersonGroup[];
  candidates: CandidateFace[];
  onConfirmCandidate: (face_id: number, person_key: string) => void;
  onSelectPerson?: (person: PersonGroup) => void;
  onRenamePerson?: (person_key: string, name: string, is_pet: boolean) => Promise<void>;
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  mode,
  people,
  candidates,
  onConfirmCandidate,
  onSelectPerson,
  onRenamePerson,
}) => {
  const [confirmedFaces, setConfirmedFaces] = useState<Set<number>>(new Set());
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const [failedCandidateAvatars, setFailedCandidateAvatars] = useState<Set<number>>(new Set());

  // Inline name editing state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingIsPet, setEditingIsPet] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isPetMode = mode === "pets";
  const displayList = people.filter((p) => (isPetMode ? p.is_pet : !p.is_pet));

  const handleConfirm = (face_id: number, person_key: string) => {
    setConfirmedFaces((prev) => new Set(prev).add(face_id));
    onConfirmCandidate(face_id, person_key);
  };

  const pendingCandidates = candidates.filter((c) => {
    if (confirmedFaces.has(c.face_id)) return false;
    const matchingPerson = people.find((p) => p.key === c.person_key);
    if (matchingPerson) {
      return isPetMode ? matchingPerson.is_pet : !matchingPerson.is_pet;
    }
    return !isPetMode;
  });

  const handleStartRename = (e: React.MouseEvent, person: PersonGroup) => {
    e.stopPropagation();
    setEditingKey(person.key);
    setEditingName(person.name || "");
    setEditingIsPet(Boolean(person.is_pet));
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingKey(null);
    setEditingName("");
  };

  const handleSaveRename = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!editingKey) return;
    setIsSaving(true);
    try {
      if (onRenamePerson) {
        await onRenamePerson(editingKey, editingName.trim(), editingIsPet);
      }
      setEditingKey(null);
      setEditingName("");
    } catch (err) {
      console.error("Failed to rename person:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 select-none">
      {/* 1. Candidate Verification Banner (Apple Photos style) */}
      {pendingCandidates.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[var(--accent-soft)] via-[var(--glass-card)] to-[var(--glass-card)] border border-[var(--accent)]/30 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">
                <Sparkles className="w-5 h-5 text-[var(--accent)] animate-pulse" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  Review Additional {isPetMode ? "Pet" : "Face"} Detections
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Apple Neural Engine detected candidate {isPetMode ? "pets" : "faces"} matching your catalog.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[11px] font-semibold">
              {pendingCandidates.length} Pending
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {pendingCandidates.map((cand) => {
              const hasCandidateAvatarFailed = failedCandidateAvatars.has(cand.face_id);
              return (
                <div
                  key={cand.face_id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-700/20 border border-[var(--glass-border)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {!hasCandidateAvatarFailed ? (
                        <img
                          src={cand.thumb || cand.avatar_url || `/api/face/${cand.face_id}/avatar`}
                          alt={cand.person_name || "Candidate face"}
                          onError={() =>
                            setFailedCandidateAvatars((prev) => new Set(prev).add(cand.face_id))
                          }
                          className="w-full h-full object-cover rounded-full"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-lg">{isPetMode ? "🐾" : "👤"}</span>
                      )}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-[var(--text-main)] truncate">
                        {cand.person_name || "Unnamed"}
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
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Apple Photos-Style Circular Faces Grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <span>{isPetMode ? "Pets" : "People"}</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {isPetMode
                ? "Domestic animals and pets recognized locally on your Mac with Apple Vision."
                : "Organized locally on your Mac using Apple Vision CoreML face embeddings."}
            </p>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-medium">
            {displayList.length} {isPetMode ? (displayList.length === 1 ? "Pet" : "Pets") : (displayList.length === 1 ? "Person" : "People")}
          </span>
        </div>

        {displayList.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-[var(--glass-border)] rounded-2xl bg-[var(--surface-subtle)]">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-2xl">
              {isPetMode ? "🐶" : "👤"}
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-main)]">
              No {isPetMode ? "pets" : "people"} found yet
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
              {isPetMode
                ? "Photos containing dogs or cats will automatically show up here as they are indexed."
                : "Apple Neural Engine automatically identifies faces in your photos and groups them here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {displayList.map((person) => {
              const hasAvatarFailed = failedAvatars.has(person.key);
              const isEditingThis = editingKey === person.key;

              return (
                <div
                  key={person.key}
                  onClick={() => {
                    if (!isEditingThis) {
                      onSelectPerson?.(person);
                    }
                  }}
                  className="group relative p-3.5 rounded-2xl bg-[var(--glass-card)] border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] hover:shadow-xl transition-all cursor-pointer flex flex-col items-center text-center select-none"
                >
                  {/* Apple Photos Circular Face Frame */}
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-3">
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[var(--glass-border)] group-hover:border-[var(--accent)] group-hover:shadow-lg transition-all bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                      {!hasAvatarFailed ? (
                        <img
                          src={person.avatar_url || `/api/person/${person.key}/avatar`}
                          alt={person.name || (isPetMode ? "Pet" : "Person")}
                          onError={() =>
                            setFailedAvatars((prev) => new Set(prev).add(person.key))
                          }
                          className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] bg-[var(--surface-subtle)]">
                          {person.name ? (
                            <span className="text-2xl font-bold uppercase text-[var(--accent)]">
                              {person.name.charAt(0)}
                            </span>
                          ) : isPetMode ? (
                            <span className="text-3xl">🐾</span>
                          ) : (
                            <User size={36} className="opacity-50 text-[var(--text-muted)]" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pet Badge */}
                    {person.is_pet && (
                      <span
                        className="absolute bottom-1 right-1 p-1.5 rounded-full bg-emerald-500 text-white text-xs shadow-md border-2 border-white dark:border-slate-900"
                        title="Pet"
                      >
                        🐾
                      </span>
                    )}
                  </div>

                  {/* Name Display & Inline Rename Form */}
                  <div className="w-full min-w-0" onClick={(e) => isEditingThis && e.stopPropagation()}>
                    {isEditingThis ? (
                      <form
                        onSubmit={handleSaveRename}
                        className="w-full space-y-1.5 animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename();
                            if (e.key === "Escape") handleCancelRename();
                          }}
                          placeholder={isPetMode ? "Pet name (e.g. Milo)" : "Name (e.g. Eleanor)"}
                          className="w-full px-2 py-1 text-xs text-center font-medium rounded-lg bg-[var(--button-bg)] border border-[var(--accent)] text-[var(--text-main)] outline-none shadow-sm focus:ring-1 focus:ring-[var(--accent)]"
                        />

                        {/* Pet / Person toggle in edit mode */}
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingIsPet(!editingIsPet)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                              editingIsPet
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-[var(--button-bg)] text-[var(--text-muted)] border border-[var(--button-border)] hover:bg-[var(--button-hover)]"
                            }`}
                            title="Toggle whether this is a pet"
                          >
                            {editingIsPet ? "🐾 Pet" : "👤 Person"}
                          </button>
                        </div>

                        {/* Save & Cancel Action Buttons */}
                        <div className="flex items-center justify-center gap-1 pt-0.5">
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="p-1 rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition-all shadow-sm flex items-center gap-1 text-[11px] px-2 font-semibold"
                            title="Save name"
                          >
                            <Check size={12} />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1 rounded-md bg-[var(--button-bg)] border border-[var(--button-border)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)] transition-all"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col items-center">
                        {person.name ? (
                          <div
                            onClick={(e) => handleStartRename(e, person)}
                            className="group/name flex items-center justify-center gap-1.5 cursor-pointer max-w-full hover:text-[var(--accent)] transition-colors"
                            title="Click to rename"
                          >
                            <h4 className="text-xs font-bold text-[var(--text-main)] truncate max-w-[120px]">
                              {person.name}
                            </h4>
                            <Pencil
                              size={11}
                              className="text-[var(--text-muted)] opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0"
                            />
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleStartRename(e, person)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition-all active:scale-95 shadow-sm"
                            title="Assign a name"
                          >
                            <Plus size={11} />
                            <span>Add Name</span>
                          </button>
                        )}

                        <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                          {person.count} {person.count === 1 ? "photo" : "photos"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};