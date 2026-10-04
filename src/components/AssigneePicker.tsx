"use client";

import { CheckIcon } from "@/components/icons";
import { Popover } from "@/components/Popover";
import { FOCUS_RING, OPTION } from "@/components/styles";

export type Member = { id: string; name: string; role: string };

const AVATAR_COLORS = [
  "bg-avatar-1 text-avatar-1-ink",
  "bg-avatar-2 text-avatar-2-ink",
  "bg-avatar-3 text-avatar-3-ink",
  "bg-avatar-4 text-avatar-4-ink",
  "bg-avatar-5 text-avatar-5-ink",
];

/** Same person, same color, on every row. */
function avatarColor(userId: string) {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** "Ben Whitfield" → "Ben W." */
function shortName(name: string) {
  const parts = name.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

// The first avatar sits on top of the ones it overlaps.
const STACK_ORDER = ["z-30", "z-20", "z-10"];

function Avatar({ member, className = "" }: { member: Member; className?: string }) {
  return (
    <span
      className={`inline-flex size-6.5 flex-none items-center justify-center rounded-full text-micro font-semibold tracking-wide ring-2 ring-white ${avatarColor(
        member.id
      )} ${className}`}
    >
      {initials(member.name)}
    </span>
  );
}

/** Who's answering the comment. Opens a list of the project's team to pick several from. */
export function AssigneePicker({
  assigneeIds,
  members,
  editable,
  onToggle,
}: {
  assigneeIds: string[];
  members: Member[];
  editable: boolean;
  onToggle: (userId: string) => void;
}) {
  // In the order they were assigned, so the first one leads the stack.
  const assignees = assigneeIds.flatMap((id) => members.find((member) => member.id === id) ?? []);
  const names = assignees.map((member) => member.name).join(", ") || undefined;
  const current =
    assignees.length > 0 ? (
      <>
        <span className="flex flex-none">
          {assignees.slice(0, STACK_ORDER.length).map((member, i) => (
            <Avatar
              key={member.id}
              member={member}
              className={`relative ${STACK_ORDER[i]} ${i > 0 ? "-ml-2" : ""}`}
            />
          ))}
        </span>
        <span className="truncate text-meta text-ink-secondary">
          {shortName(assignees[0].name)}
          {assignees.length > 1 && ` +${assignees.length - 1}`}
        </span>
      </>
    ) : (
      <span className="text-meta text-ink-muted">Unassigned</span>
    );

  if (!editable) {
    return (
      <span className="flex min-w-0 items-center justify-center gap-2" title={names}>
        {current}
      </span>
    );
  }

  return (
    <Popover
      label="ASSIGN TO"
      trigger={current}
      title={names}
      className="flex min-w-0 justify-center"
      triggerClassName={`flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-option-hover ${FOCUS_RING}`}
      panelClassName="left-1/2 mt-1 w-60 -translate-x-1/2"
    >
      {members.map((member) => {
        const selected = assigneeIds.includes(member.id);
        return (
          <button
            key={member.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(member.id)}
            className={OPTION}
          >
            <Avatar member={member} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-small text-ink">{member.name}</span>
              <span className="text-tiny text-ink-muted capitalize">
                {member.role === "pm" ? "PM" : member.role}
              </span>
            </span>
            {selected && <CheckIcon className="flex-none text-accent" />}
          </button>
        );
      })}
    </Popover>
  );
}
