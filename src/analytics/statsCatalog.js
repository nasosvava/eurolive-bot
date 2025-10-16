// src/analytics/statsCatalog.js
// Catalog describing each metric: label, how to read value from team row, sort direction, and formatting.

export const METRICS = [
    { key: 'points', label: 'Points Scored', getter: (t) => Number(t?.points) || 0, dir: 'desc' },
    { key: 'oppPoints', label: 'Opponent Points', getter: (t) => Number(t?.oppPoints) || 0, dir: 'asc' },
    // Possessions / plays
    { key: 'offPossessions', label: 'Offensive Possessions', getter: (t) => Number(t?.offPossessions) || 0, dir: 'desc' },
    { key: 'defPossessions', label: 'Defensive Possessions', getter: (t) => Number(t?.defPossessions) || 0, dir: 'desc' },
    { key: 'offPlays',       label: 'Offensive Plays',       getter: (t) => Number(t?.offPlays) || 0, dir: 'desc' },
    { key: 'defPlays',       label: 'Defensive Plays',       getter: (t) => Number(t?.defPlays) || 0, dir: 'desc' },

    // Free throws
    { key: 'madeFt',         label: 'FT Made',               getter: (t) => Number(t?.madeFt) || 0, dir: 'desc' },
    { key: 'attemptedFt',    label: 'FT Attempted',          getter: (t) => Number(t?.attemptedFt) || 0, dir: 'desc' },
    { key: 'oppMadeFt',      label: 'Opp FT Made',           getter: (t) => Number(t?.oppMadeFt) || 0, dir: 'asc'  },
    { key: 'oppAttemptedFt', label: 'Opp FT Attempted',      getter: (t) => Number(t?.oppAttemptedFt) || 0, dir: 'asc' },

    // 2-pointers
    { key: 'madeTwo',         label: '2PT Made',             getter: (t) => Number(t?.madeTwo) || 0, dir: 'desc' },
    { key: 'attemptedTwo',    label: '2PT Attempted',        getter: (t) => Number(t?.attemptedTwo) || 0, dir: 'desc' },
    { key: 'oppMadeTwo',      label: 'Opp 2PT Made',         getter: (t) => Number(t?.oppMadeTwo) || 0, dir: 'asc'  },
    { key: 'oppAttemptedTwo', label: 'Opp 2PT Attempted',    getter: (t) => Number(t?.oppAttemptedTwo) || 0, dir: 'asc' },

    // 3-pointers
    { key: 'madeThree',         label: '3PT Made',           getter: (t) => Number(t?.madeThree) || 0, dir: 'desc' },
    { key: 'attemptedThree',    label: '3PT Attempted',      getter: (t) => Number(t?.attemptedThree) || 0, dir: 'desc' },
    { key: 'oppMadeThree',      label: 'Opp 3PT Made',       getter: (t) => Number(t?.oppMadeThree) || 0, dir: 'asc'  },
    { key: 'oppAttemptedThree', label: 'Opp 3PT Attempted',  getter: (t) => Number(t?.oppAttemptedThree) || 0, dir: 'asc' },

    // Rebounds
    { key: 'offRebounds',    label: 'Offensive Rebounds',    getter: (t) => Number(t?.offRebounds) || 0, dir: 'desc' },
    { key: 'defRebounds',    label: 'Defensive Rebounds',    getter: (t) => Number(t?.defRebounds) || 0, dir: 'desc' },
    { key: 'oppOffRebounds', label: 'Opp Offensive Rebounds',getter: (t) => Number(t?.oppOffRebounds) || 0, dir: 'asc'  },
    { key: 'oppDefRebounds', label: 'Opp Defensive Rebounds',getter: (t) => Number(t?.oppDefRebounds) || 0, dir: 'asc'  },

    // Playmaking / defense
    { key: 'assists',      label: 'Assists',        getter: (t) => Number(t?.assists) || 0, dir: 'desc' },
    { key: 'oppAssists',   label: 'Opp Assists',    getter: (t) => Number(t?.oppAssists) || 0, dir: 'asc'  },
    { key: 'steals',       label: 'Steals',         getter: (t) => Number(t?.steals) || 0, dir: 'desc' },
    { key: 'oppSteals',    label: 'Opp Steals',     getter: (t) => Number(t?.oppSteals) || 0, dir: 'asc'  },
    { key: 'blocks',       label: 'Blocks',         getter: (t) => Number(t?.blocks) || 0, dir: 'desc' },
    { key: 'oppBlocks',    label: 'Opp Blocks',     getter: (t) => Number(t?.oppBlocks) || 0, dir: 'asc'  },

    // Ball security / fouls
    { key: 'turnovers',    label: 'Turnovers',      getter: (t) => Number(t?.turnovers) || 0, dir: 'asc'  }, // lower is better
    { key: 'oppTurnovers', label: 'Opp Turnovers',  getter: (t) => Number(t?.oppTurnovers) || 0, dir: 'desc' }, // more forced is better
    { key: 'fouls',        label: 'Fouls Committed',getter: (t) => Number(t?.fouls) || 0, dir: 'asc'  }, // lower is better
    { key: 'oppFouls',     label: 'Opp Fouls Drawn',getter: (t) => Number(t?.oppFouls) || 0, dir: 'desc' },
];

export function metricByKey(key) {
    return METRICS.find(m => m.key === key);
}
