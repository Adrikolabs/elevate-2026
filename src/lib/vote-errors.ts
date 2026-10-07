// Maps error codes raised by the secure database voting function to friendly copy.
const VOTE_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in to vote.",
  NOT_REGISTERED: "Your email isn't registered as an Elevate Academy student. Please contact Elevate Academy.",
  INACTIVE: "Your student account is inactive, so you can't vote. Please contact Elevate Academy.",
  NO_DEPARTMENT:
    "Your student account has not been assigned to a department. Please contact Elevate Academy.",
  VOTING_CLOSED: "Voting is currently closed.",
  NOMINEE_NOT_FOUND: "That nominee could not be found.",
  NOMINEE_INELIGIBLE: "That student is not an eligible nominee.",
  WRONG_DEPARTMENT: "You can only vote for nominees in your own department.",
  SELF_VOTE: "You can't vote for yourself.",
  ALREADY_VOTED: "You have already submitted your vote.",
};

export const GENERIC_VOTE_ERROR = "We couldn't record your vote. Please try again.";

export function voteErrorMessage(error: { message?: string } | null | undefined): string {
  const code = error?.message?.trim() ?? "";
  return VOTE_ERRORS[code] ?? GENERIC_VOTE_ERROR;
}

const MESSAGE_ERRORS: Record<string, string> = {
  RATE_LIMIT: "You're posting too quickly. Please wait a few seconds.",
  MESSAGE_LIMIT: "You've reached the maximum number of wishes.",
};

export function messageErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const code = error?.message?.trim() ?? "";
  if (MESSAGE_ERRORS[code]) return MESSAGE_ERRORS[code];
  if (error?.code === "42501") return "Posting is currently unavailable for your account.";
  return "We couldn't post your wish. Please try again.";
}
