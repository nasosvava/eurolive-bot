// src/handlers/teams.js

// — v1-based lists (unchanged logic)
export {
    teamsTopOffense,
    teamsTopDefense,
    teamsTop3ptPct,
    teamsWorst3ptPct,
    teamsTop2ptPct,
    teamsWorst2ptPct,
    teamsTopFtPct,
    teamsWorstFtPct,
    teamsPointsDiff,
} from './teams/v1basic.js';

// — ratings-based (clubs-full-stats)
export {
    teamsNetRating,
    teamsOffensiveRating,
    teamsDefensiveRating,
    teamRating,
} from './teams/ratings.js';

// — analytics (single team deep dive)
export { teamAnalytics } from './teams/analyticsOne.js';

// - stat ranking & chart
export { teamsStat, teamsChart, teamsRatingChart } from './teams/statChart.js';

export { teamsCompare } from './teams/compare.js'

// — odds
export { teamsOdds } from './teams/odds.js';

export { teamsSeasonCompare } from './teams/seasonCompare.js';

