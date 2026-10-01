-- ============================================
-- Football H2H Vault Test Data
-- ============================================

-- TEAMS
INSERT INTO teams (
    external_id,
    name,
    short_name,
    country
)
VALUES
    (1001, 'Arsenal', 'ARS', 'England'),
    (1002, 'Chelsea', 'CHE', 'England');


-- COMPETITION
INSERT INTO competitions (
    external_id,
    name,
    country
)
VALUES
    (2001, 'Premier League', 'England');


-- SEASON
INSERT INTO seasons (
    external_id,
    name,
    start_year,
    end_year
)
VALUES
    (2025, '2025/26', 2025, 2026);


-- MATCHES
INSERT INTO matches (
    external_id,
    competition_id,
    season_id,
    match_date,
    home_team_id,
    away_team_id,
    home_score,
    away_score,
    halftime_home_score,
    halftime_away_score,
    status,
    venue
)
VALUES

-- Arsenal 2-1 Chelsea
(
    3001,
    1,
    1,
    '2025-10-05 15:00:00',
    1,
    2,
    2,
    1,
    1,
    0,
    'finished',
    'Emirates Stadium'
),

-- Chelsea 0-0 Arsenal
(
    3002,
    1,
    1,
    '2026-01-18 16:30:00',
    2,
    1,
    0,
    0,
    0,
    0,
    'finished',
    'Stamford Bridge'
),

-- Arsenal 1-3 Chelsea
(
    3003,
    1,
    1,
    '2026-04-12 15:00:00',
    1,
    2,
    1,
    3,
    0,
    2,
    'finished',
    'Emirates Stadium'
);
