// In-app hrefs that more than one screen builds.

/** The vote screen for one routine (a static route, so it opens offline too). */
export const voteHref = (teamId: string): string => `/meet/vote?team=${encodeURIComponent(teamId)}`;
